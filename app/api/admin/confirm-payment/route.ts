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
    
    // 환경 변수에서 SERVICE_ROLE_KEY 가져오기
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (rawServiceRoleKey) {
      const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      
      if (serviceRoleKey && serviceRoleKey.length >= 50 && serviceRoleKey.startsWith('eyJ')) {
        try {
          const adminClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
          ) as any

          // 관리자 권한 확인 (SERVICE_ROLE_KEY 사용)
          const { data: profileData } = await adminClient
            .from('profiles')
            .select('id, role')
            .eq('id', user.id)
            .single()

          if (profileData) {
            profile = profileData
            updateClient = adminClient
          }
        } catch (clientError: any) {
          console.error('[API] SERVICE_ROLE 클라이언트 생성 실패:', clientError)
        }
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

    // updateClient는 위에서 이미 설정됨

    const body = await request.json()
    const { userId, paidUntil, paymentNote } = body

    if (!userId || !paidUntil) {
      return NextResponse.json({ error: 'userId와 paidUntil이 필요합니다' }, { status: 400 })
    }

    // 대상 사용자 정보 확인 (관리 제외: admin / username 'amazing')
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role, username')
      .eq('id', userId)
      .single()

    if (targetProfile?.role === 'admin' || targetProfile?.username === 'amazing') {
      return NextResponse.json({ error: '이 계정은 결제가 필요 없습니다.' }, { status: 400 })
    }

    // 결제 확인 및 활성화 (직접 UPDATE 쿼리 사용)
    const { error } = await updateClient
      .from('profiles')
      .update({
        membership_status: 'active',
        paid_until: paidUntil,
        last_payment_at: new Date().toISOString(),
        grace_period_until: null,
        suspended_at: null,
        payment_note: paymentNote || null
      })
      .eq('id', userId)

    if (error) {
      console.error('결제 확인 오류:', error)
      console.error('에러 상세:', JSON.stringify(error, null, 2))
      return NextResponse.json({ 
        error: `결제 확인 실패: ${error.message || '알 수 없는 오류'}`,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '결제가 확인되었고 회원이 활성화되었습니다' })
  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

