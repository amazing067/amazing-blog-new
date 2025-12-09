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
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      updateClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ) as any
    }

    const body = await request.json()
    const { userId, status, note } = body

    if (!userId || !status) {
      return NextResponse.json({ error: 'userId와 status가 필요합니다' }, { status: 400 })
    }

    if (!['active', 'pending', 'suspended', 'deleted'].includes(status)) {
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

    // 정지(suspended)는 대기(pending)과 동일하게 처리
    const normalizedStatus = status === 'suspended' ? 'pending' : status

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

    if (normalizedStatus === 'pending') {
      updates.grace_period_until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      updates.suspended_at = null
    }

    const { error } = await updateClient
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) {
      console.error('회원 상태 업데이트 오류:', error)
      console.error('에러 상세:', JSON.stringify(error, null, 2))
      return NextResponse.json({ 
        error: `상태 업데이트 실패: ${error.message || '알 수 없는 오류'}`,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '상태가 업데이트되었습니다' })
  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

