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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    // SERVICE_ROLE_KEY가 있으면 사용, 없으면 ANON_KEY로 RLS 정책을 통해 업데이트
    let updateClient = supabase
    
    // 환경 변수 확인
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    console.log('[API] SERVICE_ROLE_KEY 존재 여부:', !!rawServiceRoleKey)
    console.log('[API] SERVICE_ROLE_KEY 원본 길이:', rawServiceRoleKey?.length || 0)
    console.log('[API] SERVICE_ROLE_KEY 원본 시작:', rawServiceRoleKey?.substring(0, 30) || '없음')
    
    if (rawServiceRoleKey) {
      // 키에서 공백, 줄바꿈, 특수문자 제거
      const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      
      console.log('[API] SERVICE_ROLE_KEY 정리 후 길이:', serviceRoleKey.length)
      console.log('[API] SERVICE_ROLE_KEY 정리 후 시작:', serviceRoleKey.substring(0, 30))
      
      // JWT 토큰 형식 확인 (eyJ로 시작해야 함)
      if (!serviceRoleKey || serviceRoleKey.length < 50 || !serviceRoleKey.startsWith('eyJ')) {
        console.error('[API] SERVICE_ROLE_KEY가 유효하지 않습니다.', {
          length: serviceRoleKey?.length,
          startsWith: serviceRoleKey?.substring(0, 3),
          rawLength: rawServiceRoleKey?.length
        })
        return NextResponse.json({ 
          error: 'SERVICE_ROLE_KEY가 올바르게 설정되지 않았습니다. .env.local 파일을 확인해주세요.',
          hint: '키는 "eyJ"로 시작하는 JWT 토큰이어야 합니다.'
        }, { status: 500 })
      }
      
      try {
        updateClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        ) as any
        console.log('[API] SERVICE_ROLE 클라이언트 생성 성공')
      } catch (clientError: any) {
        console.error('[API] SERVICE_ROLE 클라이언트 생성 실패:', clientError)
        return NextResponse.json({ 
          error: 'SERVICE_ROLE 클라이언트 생성 실패',
          details: clientError?.message
        }, { status: 500 })
      }
    } else {
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

    // suspended는 그대로 유지 (정지 상태)
    const normalizedStatus = status

    // 직접 UPDATE로 상태 변경
    const updates: Record<string, any> = {
      membership_status: normalizedStatus,
      payment_note: note || null
    }

    if (normalizedStatus === 'deleted') {
      updates.deleted_at = new Date().toISOString()
    }

    if (normalizedStatus === 'active') {
      updates.suspended_at = null
      updates.grace_period_until = null
      updates.deleted_at = null
      updates.is_approved = true
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

