import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * 관리자 프로필 조회 API (서버 사이드)
 * RLS 문제 해결을 위한 대안
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
    let profileClient = supabase
    
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (rawServiceRoleKey) {
      const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      
      if (serviceRoleKey && serviceRoleKey.length >= 50 && serviceRoleKey.startsWith('eyJ')) {
        try {
          profileClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
          ) as any
        } catch (clientError: any) {
          console.error('[API] SERVICE_ROLE 클라이언트 생성 실패:', clientError)
        }
      }
    }

    // 프로필 조회 (RLS 우회)
    const { data: profileData, error: profileError } = await profileClient
      .from('profiles')
      .select('id, username, full_name, phone, membership_status, is_approved, role, department_id, department_name, team_id, team_name, created_at')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('프로필 조회 오류:', profileError)
      return NextResponse.json({ 
        error: profileError.message || '프로필을 찾을 수 없습니다',
        code: profileError.code 
      }, { status: 404 })
    }

    if (!profileData) {
      return NextResponse.json({ 
        error: '프로필을 찾을 수 없습니다' 
      }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      profile: profileData 
    })
  } catch (error: any) {
    console.error('프로필 조회 API 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다',
      message: error?.message || '알 수 없는 오류'
    }, { status: 500 })
  }
}

