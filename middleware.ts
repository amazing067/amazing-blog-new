import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SITE_CLOSED, SITE_REDIRECT_URL, SITE_REDIRECT_URL_ASCII } from '@/lib/site-status'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 사이트 폐쇄 스위치 (lib/site-status.ts) ─────────────────────────
  // 켜져 있으면: 모든 /api 차단(유료 호출 0) + 모든 페이지를 통합 사이트로 301 영구 이동.
  // 안내 페이지(200 + JS 6초 이동)는 이전 초기 사용자 안내용이었다. 이전 완료 후에도 200을
  // 반환하면 검색엔진이 옛 blog 주소를 계속 색인해 통합 사이트의 브랜드 검색을 갉아먹는다.
  // 301은 기존 색인·링크 평가를 통합 사이트로 넘긴다 (2026-08-07).
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
    return NextResponse.redirect(`${SITE_REDIRECT_URL_ASCII}/`, 301)
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

