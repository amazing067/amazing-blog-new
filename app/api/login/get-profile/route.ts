import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * 로그인 전 프로필 조회 API
 * username으로 프로필을 조회하고 로그인에 필요한 정보를 반환합니다.
 * SERVICE_ROLE_KEY를 사용하여 RLS를 우회합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username } = body

    if (!username) {
      return NextResponse.json({ error: 'username이 필요합니다' }, { status: 400 })
    }

    // SERVICE_ROLE_KEY 사용 (RLS 우회)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ 
        error: '서버 설정 오류: Supabase 환경 변수가 설정되지 않았습니다' 
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // username으로 프로필 조회 (RLS 우회 - SERVICE_ROLE_KEY 사용)
    const trimmedUsername = username.trim()
    console.log('[로그인 프로필 조회] 입력된 username:', username, '→ 정규화:', trimmedUsername)
    
    // 삭제되지 않은 프로필만 조회 (대소문자 구분 없이)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('is_approved, role, membership_status, id, phone, username, deleted_at')
      .ilike('username', trimmedUsername) // 대소문자 구분 없이 검색
      .is('deleted_at', null) // 삭제된 사용자 제외
      .single()
    
    console.log('[로그인 프로필 조회] 쿼리 결과:', {
      hasData: !!profileData,
      hasError: !!profileError,
      errorCode: profileError?.code,
      errorMessage: profileError?.message,
      profileUsername: profileData?.username,
      profileDeletedAt: profileData?.deleted_at
    })

    if (profileError) {
      console.error('[로그인 프로필 조회] 오류 상세:', {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        username: username.trim()
      })
      
      // PGRST116은 "no rows returned" 오류
      if (profileError.code === 'PGRST116') {
        return NextResponse.json({ 
          error: '존재하지 않는 아이디입니다',
          code: 'PGRST116'
        }, { status: 404 })
      }
      
      return NextResponse.json({ 
        error: profileError.message || '프로필을 찾을 수 없습니다',
        code: profileError.code 
      }, { status: 404 })
    }

    if (!profileData) {
      console.error('[로그인 프로필 조회] 프로필 데이터 없음:', username)
      return NextResponse.json({ 
        error: '존재하지 않는 아이디입니다' 
      }, { status: 404 })
    }

    // 삭제된 사용자 확인 (추가 안전장치)
    if (profileData.deleted_at) {
      console.error('[로그인 프로필 조회] 삭제된 사용자:', username)
      return NextResponse.json({ 
        error: '존재하지 않는 아이디입니다' 
      }, { status: 404 })
    }

    console.log('[로그인 프로필 조회] 성공:', {
      username: profileData.username,
      id: profileData.id,
      role: profileData.role,
      is_approved: profileData.is_approved
    })

    // 로그인용 이메일 생성 (Supabase Auth는 내부적으로 이메일 형식 필요)
    // 전화번호를 기반으로 이메일 형식 생성 (사용자에게는 보이지 않음)
    let loginEmail: string | null = null
    
    // 1. auth.users에서 이메일 조회 (기존 사용자 호환)
    const { data: authUser } = await supabase.auth.admin.getUserById(profileData.id)
    
    if (authUser?.user?.email) {
      loginEmail = authUser.user.email
    }
    
    // 2. 없으면 전화번호 기반 이메일 생성
    if (!loginEmail && profileData.phone) {
      const phoneNumber = profileData.phone.replace(/[^\d]/g, '')
      if (phoneNumber.length >= 10) {
        loginEmail = `${phoneNumber}@phone.local`
      }
    }
    
    // 3. 로그인 이메일을 찾을 수 없으면 에러
    if (!loginEmail) {
      return NextResponse.json({ 
        error: '로그인 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.' 
      }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      profile: {
        ...profileData,
        loginEmail: loginEmail // 내부적으로만 사용
      }
    })
  } catch (error: any) {
    console.error('로그인 프로필 조회 API 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다',
      message: error?.message || '알 수 없는 오류'
    }, { status: 500 })
  }
}

