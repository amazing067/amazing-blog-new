import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * 사용자의 블로그 글 목록 조회 API
 * RLS 우회를 위해 서버 사이드에서 처리
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // SERVICE_ROLE_KEY 사용 (RLS 우회)
    let blogClient = supabase
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (rawServiceRoleKey) {
      const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      
      if (serviceRoleKey && serviceRoleKey.length >= 50 && serviceRoleKey.startsWith('eyJ')) {
        blogClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        ) as any
      }
    }

    // 사용자의 블로그 글 조회
    const { data, error } = await blogClient
      .from('blog_posts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('블로그 글 조회 오류:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return NextResponse.json({ 
        error: error.message || '블로그 글을 불러올 수 없습니다',
        code: error.code
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      posts: data || []
    })
  } catch (error: any) {
    console.error('블로그 글 조회 API 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다',
      message: error?.message || '알 수 없는 오류'
    }, { status: 500 })
  }
}

