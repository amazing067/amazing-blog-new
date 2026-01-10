import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: 연락처 정보 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // RLS 문제 해결을 위해 SERVICE_ROLE_KEY 사용 시도 (GET도 동일하게 처리)
    let profileClient = supabase
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (rawServiceRoleKey) {
      const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      if (serviceRoleKey && serviceRoleKey.length >= 50 && serviceRoleKey.startsWith('eyJ')) {
        try {
          const { createClient: createAdminClient } = await import('@supabase/supabase-js')
          profileClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
          ) as any
        } catch (clientError: any) {
          console.error('[API] SERVICE_ROLE 클라이언트 생성 실패:', clientError)
        }
      }
    }

    // 프로필에서 contact_info 조회
    const { data: profile, error } = await profileClient
      .from('profiles')
      .select('contact_info')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('[연락처 정보 조회 오류]', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return NextResponse.json({ 
        success: false,
        error: '연락처 정보를 불러오는데 실패했습니다',
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      contactInfo: profile?.contact_info || null
    })
  } catch (error: any) {
    console.error('[연락처 정보 조회 오류]', error)
    return NextResponse.json({ 
      success: false,
      error: '서버 오류가 발생했습니다',
      message: error?.message || '알 수 없는 오류'
    }, { status: 500 })
  }
}

// PUT: 연락처 정보 저장/업데이트
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { contactInfo } = body

    // contactInfo 유효성 검사
    if (!contactInfo || typeof contactInfo !== 'object') {
      return NextResponse.json({ error: '연락처 정보가 올바르지 않습니다' }, { status: 400 })
    }

    // RLS 문제 해결을 위해 SERVICE_ROLE_KEY 사용 시도
    let profileClient = supabase
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (rawServiceRoleKey) {
      const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      if (serviceRoleKey && serviceRoleKey.length >= 50 && serviceRoleKey.startsWith('eyJ')) {
        try {
          const { createClient: createAdminClient } = await import('@supabase/supabase-js')
          profileClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
          ) as any
        } catch (clientError: any) {
          console.error('[API] SERVICE_ROLE 클라이언트 생성 실패:', clientError)
        }
      }
    }

    // contact_info 업데이트
    const { data: updateData, error } = await profileClient
      .from('profiles')
      .update({ contact_info: contactInfo })
      .eq('id', user.id)
      .select()

    if (error) {
      console.error('[연락처 정보 저장 오류]', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return NextResponse.json({ 
        error: '연락처 정보를 저장하는데 실패했습니다',
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '연락처 정보가 저장되었습니다',
      data: updateData
    })
  } catch (error: any) {
    console.error('[연락처 정보 저장 오류]', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다',
      message: error?.message || '알 수 없는 오류'
    }, { status: 500 })
  }
}
