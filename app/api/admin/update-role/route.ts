import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { ROLES } from '@/lib/constants/roles'
import { DEPARTMENTS } from '@/lib/constants/departments'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 관리자 권한 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 관리자 권한 확인 및 SERVICE_ROLE_KEY 설정
    let profile: { id: string; role: string } | null = null
    let updateClient = supabase
    
    // 환경 변수에서 SERVICE_ROLE_KEY 가져오기 (한 번만 정의)
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    console.log('[API] SERVICE_ROLE_KEY 존재 여부:', !!rawServiceRoleKey)
    
    if (rawServiceRoleKey) {
      // 키에서 공백, 줄바꿈, 특수문자 제거
      const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      
      console.log('[API] SERVICE_ROLE_KEY 원본 길이:', rawServiceRoleKey.length)
      console.log('[API] SERVICE_ROLE_KEY 정리 후 길이:', serviceRoleKey.length)
      console.log('[API] SERVICE_ROLE_KEY 정리 후 시작:', serviceRoleKey.substring(0, 30))
      
      // JWT 토큰 형식 확인 (eyJ로 시작해야 함)
      if (serviceRoleKey && serviceRoleKey.length >= 50 && serviceRoleKey.startsWith('eyJ')) {
        try {
          const adminClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
          ) as any

          // 관리자 권한 확인
          const { data: profileData } = await adminClient
            .from('profiles')
            .select('id, role')
            .eq('id', user.id)
            .single()

          if (profileData) {
            profile = profileData
          }

          // 업데이트 클라이언트 설정
          updateClient = adminClient
          console.log('[API] SERVICE_ROLE 클라이언트 생성 성공')
        } catch (clientError: any) {
          console.error('[API] SERVICE_ROLE 클라이언트 생성 실패:', clientError)
        }
      } else {
        console.error('[API] SERVICE_ROLE_KEY가 유효하지 않습니다.', {
          length: serviceRoleKey?.length,
          startsWith: serviceRoleKey?.substring(0, 3),
          rawLength: rawServiceRoleKey?.length
        })
      }
    }

    // SERVICE_ROLE_KEY가 없거나 실패한 경우 일반 클라이언트 사용
    if (!profile) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single()

      if (profileData) {
        profile = profileData
      }
    }

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    if (!rawServiceRoleKey) {
      console.warn('[API] SERVICE_ROLE_KEY가 설정되지 않았습니다. ANON_KEY를 사용합니다.')
    }

    const body = await request.json()
    let { userId, role, department_id, department_name } = body

    console.log('[API] 역할 변경 요청 받음:', { 
      userId, 
      role, 
      department_id, 
      department_name,
      bodyKeys: Object.keys(body),
      roleType: typeof role
    })

    if (!userId || !role) {
      return NextResponse.json({ error: 'userId와 role이 필요합니다' }, { status: 400 })
    }

    // 역할 값 정리 (공백 제거, 소문자 변환)
    role = String(role).trim().toLowerCase()
    
    // 유효한 역할인지 확인 (ROLES 상수 사용)
    const validRoles = Object.values(ROLES)
    console.log('[API] 역할 검증:', { 
      receivedRole: role, 
      validRoles,
      isValid: validRoles.includes(role as any)
    })
    
    if (!validRoles.includes(role as any)) {
      console.error('[API] 유효하지 않은 역할:', { 
        receivedRole: role, 
        validRoles,
        roleType: typeof role,
        bodyRole: body.role
      })
      return NextResponse.json({ 
        error: `유효하지 않은 역할입니다: ${role}`,
        validRoles: validRoles,
        receivedRole: role
      }, { status: 400 })
    }
    
    console.log('[API] 역할 검증 통과:', { userId, role, department_id })

    // 관리자 계정은 역할 변경 불가 (updateClient 사용 - RLS 우회)
    const { data: targetProfile, error: targetProfileError } = await updateClient
      .from('profiles')
      .select('role, username')
      .eq('id', userId)
      .single()

    if (targetProfileError) {
      console.error('[API] 대상 사용자 조회 오류:', targetProfileError)
      return NextResponse.json({ 
        error: `사용자 조회 실패: ${targetProfileError.message}`,
        details: targetProfileError
      }, { status: 500 })
    }

    if (!targetProfile) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    console.log('[API] 대상 사용자 정보:', { 
      userId, 
      currentRole: targetProfile.role, 
      username: targetProfile.username,
      requestedRole: role
    })

    if (targetProfile?.role === ROLES.ADMIN || targetProfile?.username === 'amazing') {
      return NextResponse.json({ error: '관리자 계정의 역할은 변경할 수 없습니다.' }, { status: 400 })
    }

    // 관리자 역할로 변경 시 290본부로 자동 설정
    if (role === ROLES.ADMIN) {
      const dept290 = DEPARTMENTS.find(d => d.id === '290')
      if (dept290) {
        department_id = '290'
        department_name = dept290.name
      }
    }

    // 업데이트 데이터 준비
    const updates: Record<string, any> = {
      role,
    }

    // 본부 정보 업데이트
    if (department_id) {
      updates.department_id = department_id
      updates.department_name = department_name || null
    } else {
      updates.department_id = null
      updates.department_name = null
    }

    console.log('[API] 역할 업데이트 시작:', { userId, role, updates })

    const { data: updateResult, error } = await updateClient
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, role, department_id, department_name')
      .single()

    if (error) {
      console.error('[API] 역할 업데이트 오류:', error)
      return NextResponse.json({ 
        error: `역할 업데이트 실패: ${error.message || '알 수 없는 오류'}`,
        errorCode: error.code,
      }, { status: 500 })
    }

    if (!updateResult) {
      return NextResponse.json({ 
        error: '역할 업데이트가 반영되지 않았습니다. RLS 정책을 확인해주세요.',
      }, { status: 500 })
    }

    console.log('[API] 역할 업데이트 성공:', { userId, updateResult })

    return NextResponse.json({ 
      success: true, 
      message: '역할이 업데이트되었습니다',
      data: updateResult
    })
  } catch (error: any) {
    console.error('[API] 예상치 못한 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다',
      message: error?.message || '알 수 없는 오류',
    }, { status: 500 })
  }
}

