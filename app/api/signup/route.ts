import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { DEPARTMENTS } from '@/lib/constants/departments'

export async function POST(request: NextRequest) {
  console.log('[회원가입 API] ========== 시작 ==========')
  console.log('[회원가입 API] 환경 변수 확인:', {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    serviceRoleKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    serviceRoleKeyStart: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) || '없음'
  })
  
  try {
    // 요청 본문 파싱
    const body = await request.json()
    const { username, full_name, phone, password, department_id, department_name } = body

    console.log('[회원가입 API] 요청 데이터:', {
      username: username?.substring(0, 3) + '***',
      hasFullName: !!full_name,
      hasPhone: !!phone,
      hasPassword: !!password,
      hasDepartment: !!department_id
    })

    // 필수 필드 검증
    if (!username || !full_name || !phone || !password || !department_id) {
      return NextResponse.json({ 
        error: '모든 필드를 입력해주세요' 
      }, { status: 400 })
    }

    // 아이디 형식 검증
    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      return NextResponse.json({ 
        error: '아이디는 3자 이상 20자 이하여야 합니다' 
      }, { status: 400 })
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return NextResponse.json({ 
        error: '아이디는 영문, 숫자, 언더스코어(_)만 사용할 수 있습니다' 
      }, { status: 400 })
    }

    // 본부 검증
    if (department_id.trim() === '') {
      return NextResponse.json({ 
        error: '본부를 선택해주세요' 
      }, { status: 400 })
    }

    // 본부명 자동 설정
    let finalDepartmentName = department_name?.trim() || null
    if (!finalDepartmentName) {
      const selectedDept = DEPARTMENTS.find(d => d.id === department_id.trim())
      if (selectedDept) {
        finalDepartmentName = selectedDept.name
      }
    }

    // 전화번호 검증
    const phoneNumber = phone.replace(/[^\d]/g, '')
    if (phoneNumber.length < 10 || phoneNumber.length > 11) {
      return NextResponse.json({ 
        error: '올바른 전화번호 형식이 아닙니다' 
      }, { status: 400 })
    }

    if (!/^01[0-9]/.test(phoneNumber)) {
      return NextResponse.json({ 
        error: '전화번호는 010, 011, 016, 017, 018, 019로 시작해야 합니다' 
      }, { status: 400 })
    }

    // 비밀번호 검증
    if (password.length < 6) {
      return NextResponse.json({ 
        error: '비밀번호는 최소 6자 이상이어야 합니다' 
      }, { status: 400 })
    }

    // 전화번호를 이메일 형식으로 변환 (Supabase Auth 내부 사용)
    const emailForAuth = `${phoneNumber}@phone.local`

    // Supabase 클라이언트 생성
    const supabase = await createClient()

    // 1. Supabase Auth에 회원가입
    console.log('[회원가입 API] Auth 회원가입 시도:', {
      emailForAuth: emailForAuth.substring(0, 10) + '***',
      hasPassword: !!password,
      passwordLength: password.length
    })
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: emailForAuth,
      password: password,
      options: {
        data: {
          username: trimmedUsername,
          full_name: full_name.trim(),
          phone: phone.trim(),
        },
      },
    })

    if (authError) {
      console.error('[회원가입 API] Auth 오류 상세:', {
        message: authError.message,
        status: authError.status,
        name: authError.name,
        code: (authError as any).code,
        fullError: JSON.stringify(authError, Object.getOwnPropertyNames(authError))
      })
      
      // 에러 메시지 변환
      let koreanMessage = '회원가입 중 오류가 발생했습니다'
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        koreanMessage = '이미 가입된 전화번호입니다'
      } else if (authError.message.includes('Invalid') || authError.message.includes('invalid')) {
        koreanMessage = '올바른 전화번호 형식이 아닙니다'
      } else if (authError.message.includes('Password') || authError.message.includes('password')) {
        koreanMessage = '비밀번호는 최소 6자 이상이어야 합니다'
      } else if (authError.message.includes('rate limit')) {
        koreanMessage = '너무 많이 시도했습니다. 잠시 후 다시 시도해주세요'
      } else if (authError.message.includes('Database error')) {
        koreanMessage = '데이터베이스 오류가 발생했습니다. 관리자에게 문의해주세요.'
      }
      
      return NextResponse.json({ 
        error: koreanMessage,
        details: authError.message,
        code: (authError as any).code || authError.status
      }, { status: 400 })
    }

    if (!authData.user) {
      console.error('[회원가입 API] Auth 사용자 생성 실패')
      return NextResponse.json({ 
        error: '회원가입에 실패했습니다. 사용자 정보를 생성할 수 없습니다.' 
      }, { status: 500 })
    }

    console.log('[회원가입 API] Auth 성공:', authData.user.id)

    // 2. 프로필 생성 (SERVICE_ROLE_KEY 사용)
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!rawServiceRoleKey) {
      console.error('[회원가입 API] SERVICE_ROLE_KEY 없음')
      return NextResponse.json({ 
        error: '서버 설정 오류' 
      }, { status: 500 })
    }

    const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
    
    if (!serviceRoleKey || serviceRoleKey.length < 50 || !serviceRoleKey.startsWith('eyJ')) {
      console.error('[회원가입 API] SERVICE_ROLE_KEY 형식 오류')
      return NextResponse.json({ 
        error: '서버 설정 오류' 
      }, { status: 500 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      console.error('[회원가입 API] SUPABASE_URL 없음')
      return NextResponse.json({ 
        error: '서버 설정 오류' 
      }, { status: 500 })
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey) as any
    console.log('[회원가입 API] Admin 클라이언트 생성 완료')

    // 프로필이 이미 존재하는지 확인
    console.log('[회원가입 API] 기존 프로필 확인 중:', authData.user.id)
    const { data: existingProfile, error: checkError } = await adminClient
      .from('profiles')
      .select('id, username, phone')
      .eq('id', authData.user.id)
      .single()
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.warn('[회원가입 API] 프로필 확인 중 오류 (무시 가능):', checkError.message)
    }
    
    if (existingProfile) {
      console.log('[회원가입 API] 프로필 이미 존재, 성공 처리:', existingProfile)
      return NextResponse.json({ 
        success: true,
        message: '회원가입이 완료되었습니다. 관리자 승인 대기 중입니다.',
        userId: authData.user.id
      })
    }
    
    // 프로필 생성
    console.log('[회원가입 API] 프로필 생성 시도:', {
      userId: authData.user.id,
      username: trimmedUsername,
      department_id: department_id.trim(),
      department_name: finalDepartmentName
    })
    
    const profileData = {
      id: authData.user.id,
      username: trimmedUsername,
      full_name: full_name.trim(),
      phone: phone.trim(),
      is_approved: false,
      role: 'fc',
      membership_status: 'pending',
      department_id: department_id.trim(),
      department_name: finalDepartmentName,
    }
    
    console.log('[회원가입 API] 삽입할 데이터:', profileData)
    
    const { error: profileError, data: insertedProfile } = await adminClient
      .from('profiles')
      .insert(profileData)
      .select()

    if (profileError) {
      console.error('[회원가입 API] 프로필 생성 오류 상세:', {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        profileData: profileData
      })
      
      // Auth 사용자 삭제 시도 (롤백)
      try {
        await adminClient.auth.admin.deleteUser(authData.user.id)
      } catch (rollbackError) {
        console.error('[회원가입 API] 롤백 실패:', rollbackError)
      }
      
      // 에러 타입별 처리
      if (profileError.code === '23505') {
        return NextResponse.json({ 
          error: '이미 사용 중인 아이디 또는 전화번호입니다',
          details: profileError.message
        }, { status: 400 })
      }
      
      if (profileError.code === '23503') {
        return NextResponse.json({ 
          error: '본부 정보가 올바르지 않습니다',
          details: profileError.message
        }, { status: 400 })
      }
      
      if (profileError.code === '23502') {
        return NextResponse.json({ 
          error: '필수 정보가 누락되었습니다',
          details: profileError.message
        }, { status: 400 })
      }
      
      // 상세한 에러 메시지 반환
      let userFriendlyError = '프로필 생성 중 오류가 발생했습니다'
      
      if (profileError.message) {
        // PostgreSQL 에러 메시지에서 유용한 정보 추출
        if (profileError.message.includes('null value') || profileError.message.includes('NOT NULL')) {
          userFriendlyError = '필수 정보가 누락되었습니다. 관리자에게 문의해주세요.'
        } else if (profileError.message.includes('duplicate') || profileError.message.includes('unique')) {
          userFriendlyError = '이미 사용 중인 아이디 또는 전화번호입니다'
        } else if (profileError.message.includes('foreign key') || profileError.message.includes('constraint')) {
          userFriendlyError = '본부 정보가 올바르지 않습니다'
        }
      }
      
      return NextResponse.json({ 
        error: userFriendlyError,
        details: profileError.message,
        code: profileError.code,
        hint: profileError.hint
      }, { status: 500 })
    }

    console.log('[회원가입 API] 성공:', insertedProfile)
    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다. 관리자 승인 대기 중입니다.',
      userId: authData.user.id
    })
  } catch (error: any) {
    console.error('[회원가입 API] 예상치 못한 오류:', error?.message || error)
    
    let errorMessage = '서버 오류가 발생했습니다'
    let statusCode = 500
    
    if (error?.message) {
      errorMessage = String(error.message).substring(0, 200)
    }
    
    if (error instanceof SyntaxError) {
      errorMessage = '요청 데이터 형식이 올바르지 않습니다'
      statusCode = 400
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      message: error?.message || '알 수 없는 오류'
    }, { status: statusCode })
  }
}
