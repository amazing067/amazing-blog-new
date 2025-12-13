import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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
    const { userId, status, note } = body

    if (!userId || !status) {
      return NextResponse.json({ error: 'userId와 status가 필요합니다' }, { status: 400 })
    }

    if (!['active', 'suspended', 'deleted'].includes(status)) {
      return NextResponse.json({ error: '유효하지 않은 상태입니다' }, { status: 400 })
    }

    // 대상 사용자 정보 확인 (관리 제외: admin / username 'amazing')
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role, username')
      .eq('id', userId)
      .single()

    if (targetProfile?.role === 'admin' || targetProfile?.username === 'amazing') {
      return NextResponse.json({ error: '이 계정은 변경할 수 없습니다.' }, { status: 400 })
    }

    // 삭제인 경우 완전히 삭제 (기록에도 남지 않음)
    if (status === 'deleted') {
      console.log('[API] 사용자 완전 삭제 시작:', { userId })
      
      // 삭제는 반드시 SERVICE_ROLE_KEY를 사용해야 함
      if (!rawServiceRoleKey) {
        return NextResponse.json({ 
          error: '삭제 기능은 SERVICE_ROLE_KEY가 필요합니다. 환경 변수를 확인해주세요.' 
        }, { status: 500 })
      }

      // SERVICE_ROLE_KEY로 Admin 클라이언트 생성
      const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      
      if (!serviceRoleKey || !serviceRoleKey.startsWith('eyJ')) {
        return NextResponse.json({ 
          error: 'SERVICE_ROLE_KEY가 유효하지 않습니다.' 
        }, { status: 500 })
      }

      const adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )

      try {
        // 1. 관련 데이터 먼저 삭제 (CASCADE가 작동하지 않는 경우 대비)
        // blog_posts 삭제
        const { error: deletePostsError } = await adminClient
          .from('blog_posts')
          .delete()
          .eq('user_id', userId)
        
        if (deletePostsError) {
          console.warn('[API] blog_posts 삭제 오류 (무시 가능):', deletePostsError)
        } else {
          console.log('[API] blog_posts 삭제 완료')
        }

        // qa_sets 삭제 (존재하는 경우)
        const { error: deleteQaError } = await adminClient
          .from('qa_sets')
          .delete()
          .eq('user_id', userId)
        
        if (deleteQaError) {
          console.warn('[API] qa_sets 삭제 오류 (무시 가능):', deleteQaError)
        } else {
          console.log('[API] qa_sets 삭제 완료')
        }

        // 2. profiles 테이블에서 삭제 (SERVICE_ROLE_KEY 사용)
        const { data: deleteResult, error: deleteProfileError } = await adminClient
          .from('profiles')
          .delete()
          .eq('id', userId)
          .select()

        if (deleteProfileError) {
          console.error('[API] 프로필 삭제 오류 상세:', {
            message: deleteProfileError.message,
            code: deleteProfileError.code,
            details: deleteProfileError.details,
            hint: deleteProfileError.hint
          })
          return NextResponse.json({ 
            error: `프로필 삭제 실패: ${deleteProfileError.message || '알 수 없는 오류'}`,
            errorCode: deleteProfileError.code,
            hint: deleteProfileError.hint,
            details: process.env.NODE_ENV === 'development' ? deleteProfileError : undefined
          }, { status: 500 })
        }

        console.log('[API] 프로필 삭제 결과:', deleteResult)

        // 3. auth.users에서도 삭제 (Admin API 사용)
        try {
          const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId)
          if (deleteAuthError) {
            console.warn('[API] auth.users 삭제 오류 (무시 가능):', deleteAuthError)
            // auth.users 삭제 실패해도 profiles는 삭제되었으므로 성공으로 처리
          } else {
            console.log('[API] auth.users 삭제 성공')
          }
        } catch (authDeleteError: any) {
          console.warn('[API] auth.users 삭제 시도 중 오류 (무시 가능):', authDeleteError)
          // auth.users 삭제 실패해도 profiles는 삭제되었으므로 성공으로 처리
        }

        console.log('[API] 사용자 완전 삭제 성공:', { userId })

        return NextResponse.json({ 
          success: true, 
          message: '사용자가 완전히 삭제되었습니다',
          data: { id: userId, deleted: true }
        })
      } catch (error: any) {
        console.error('[API] 삭제 중 예상치 못한 오류:', error)
        return NextResponse.json({ 
          error: `삭제 중 오류 발생: ${error.message || '알 수 없는 오류'}`,
          details: process.env.NODE_ENV === 'development' ? String(error) : undefined
        }, { status: 500 })
      }
    }

    // suspended는 그대로 유지 (정지 상태)
    const normalizedStatus = status

    // 직접 UPDATE로 상태 변경
    const updates: Record<string, any> = {
      membership_status: normalizedStatus,
      payment_note: note || null
    }

    if (normalizedStatus === 'active') {
      updates.suspended_at = null
      updates.grace_period_until = null
      updates.deleted_at = null
      updates.is_approved = true
      // 활성화 시 user 역할을 fc로 변경
      const { data: targetUser } = await updateClient
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      
      if (targetUser?.role === 'user') {
        updates.role = 'fc'
      }
    }

    if (normalizedStatus === 'suspended') {
      updates.suspended_at = new Date().toISOString()
      updates.grace_period_until = null
    }

    console.log('[API] 상태 업데이트 시작:', { userId, status, updates })
    console.log('[API] 사용하는 클라이언트:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON_KEY')
    
    const { data: updateResult, error } = await updateClient
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, membership_status, suspended_at')

    if (error) {
      console.error('[API] 회원 상태 업데이트 오류:', error)
      console.error('[API] 에러 상세:', JSON.stringify(error, null, 2))
      console.error('[API] 에러 코드:', error.code)
      console.error('[API] 에러 메시지:', error.message)
      console.error('[API] 에러 힌트:', error.hint)
      return NextResponse.json({ 
        error: `상태 업데이트 실패: ${error.message || '알 수 없는 오류'}`,
        errorCode: error.code,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }, { status: 500 })
    }

    console.log('[API] 상태 업데이트 응답:', { userId, updateResult, error })
    
    // 업데이트 결과가 없으면 에러
    if (!updateResult || updateResult.length === 0) {
      console.error('[API] 업데이트 결과가 없습니다. RLS 정책 문제일 수 있습니다.')
      
      // 다시 한 번 확인
      const { data: verifyData, error: verifyError } = await supabase
        .from('profiles')
        .select('id, membership_status, suspended_at, role, username')
        .eq('id', userId)
        .single()
      
      console.log('[API] 재확인 결과:', { verifyData, verifyError })
      
      return NextResponse.json({ 
        error: '상태 업데이트가 반영되지 않았습니다. RLS 정책을 확인해주세요.',
        currentData: verifyData
      }, { status: 500 })
    }

    console.log('[API] 상태 업데이트 성공:', { userId, updateResult: updateResult[0] })

    return NextResponse.json({ 
      success: true, 
      message: '상태가 업데이트되었습니다',
      data: updateResult[0]
    })
  } catch (error: any) {
    console.error('[API] 예상치 못한 오류:', error)
    console.error('[API] 오류 상세:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      cause: error?.cause
    })
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다',
      message: error?.message || '알 수 없는 오류',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}

