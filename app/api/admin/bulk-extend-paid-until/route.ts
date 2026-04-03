import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { DEPARTMENTS_WITHOUT_EXPIRY } from '@/lib/constants/departments'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 관리자 권한 확인 (SERVICE_ROLE_KEY 있으면 RLS 우회)
    let profile: { id: string; role: string } | null = null
    let updateClient = supabase

    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (rawServiceRoleKey) {
      const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      if (serviceRoleKey && serviceRoleKey.length >= 50 && serviceRoleKey.startsWith('eyJ')) {
        const adminClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey,
        ) as any

        const { data: profileData } = await adminClient
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .single()

        if (profileData) {
          profile = profileData
          updateClient = adminClient
        }
      }
    }

    if (!profile) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single()

      profile = profileData
    }

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const body = await request.json()
    const { userIds, extendMonths, paymentNote } = body

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'userIds가 필요합니다' }, { status: 400 })
    }

    const months = Number(extendMonths)
    if (!Number.isFinite(months) || months <= 0) {
      return NextResponse.json({ error: 'extendMonths는 1 이상의 숫자여야 합니다' }, { status: 400 })
    }

    // 선택된 회원들의 부서/권한을 미리 조회해서, 290/067/292는 paid_until=null 처리
    const { data: targets, error: targetsError } = await updateClient
      .from('profiles')
      .select('id, role, username, department_id')
      .in('id', userIds)

    if (targetsError) {
      return NextResponse.json({ error: `대상 회원 조회 실패: ${targetsError.message || 'unknown'}` }, { status: 500 })
    }

    const eligibleTargets = (targets || []).filter(t => t.role !== 'admin' && t.username !== 'amazing')

    const idsNoExpiry = eligibleTargets
      .filter(t => !!t.department_id && DEPARTMENTS_WITHOUT_EXPIRY.includes(t.department_id as any))
      .map(t => t.id)

    const idsWithExpiry = eligibleTargets
      .filter(t => !t.department_id || !DEPARTMENTS_WITHOUT_EXPIRY.includes(t.department_id as any))
      .map(t => t.id)

    const now = new Date()
    const nowIso = now.toISOString()

    const paidUntil = new Date(now)
    paidUntil.setMonth(paidUntil.getMonth() + months)
    const paidUntilIso = paidUntil.toISOString()

    const baseUpdate = {
      membership_status: 'active',
      last_payment_at: nowIso,
      grace_period_until: null,
      suspended_at: null,
      payment_note: paymentNote || null,
    } as const

    let updatedWithExpiryCount = 0
    let updatedNoExpiryCount = 0

    if (idsWithExpiry.length > 0) {
      const { error: updateWithExpiryError } = await updateClient
        .from('profiles')
        .update({
          ...baseUpdate,
          paid_until: paidUntilIso,
        })
        .in('id', idsWithExpiry)

      if (updateWithExpiryError) {
        return NextResponse.json({ error: `만료일 연장 업데이트 실패: ${updateWithExpiryError.message || 'unknown'}` }, { status: 500 })
      }

      updatedWithExpiryCount = idsWithExpiry.length
    }

    if (idsNoExpiry.length > 0) {
      const { error: updateNoExpiryError } = await updateClient
        .from('profiles')
        .update({
          ...baseUpdate,
          paid_until: null,
        })
        .in('id', idsNoExpiry)

      if (updateNoExpiryError) {
        return NextResponse.json({ error: `만료일 없음 업데이트 실패: ${updateNoExpiryError.message || 'unknown'}` }, { status: 500 })
      }

      updatedNoExpiryCount = idsNoExpiry.length
    }

    return NextResponse.json({
      success: true,
      message: '만료일이 일괄 처리되었습니다',
      data: {
        requested: userIds.length,
        updatedWithExpiry: updatedWithExpiryCount,
        updatedNoExpiry: updatedNoExpiryCount,
      },
    })
  } catch (error: any) {
    console.error('API 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다', message: error?.message }, { status: 500 })
  }
}

