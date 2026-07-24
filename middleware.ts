import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SITE_CLOSED, SITE_REDIRECT_URL } from '@/lib/site-status'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 사이트 폐쇄 스위치 (lib/site-status.ts) ─────────────────────────
  // 켜져 있으면: 모든 /api 차단(유료 호출 0) + 모든 페이지를 안내 페이지로 리라이트.
  if (SITE_CLOSED) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        {
          closed: true,
          message: '이 서비스는 어메이징사업부 통합 사이트로 이전되었습니다.',
          url: SITE_REDIRECT_URL,
        },
        { status: 503 },
      )
    }
    // 안내 페이지 자체는 통과(리라이트 루프 방지)
    if (pathname === '/site-closed') {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    url.pathname = '/site-closed'
    return NextResponse.rewrite(url)
  }
  // ────────────────────────────────────────────────────────────────

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 보호된 경로 확인
  if (
    !user &&
    (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/admin'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

