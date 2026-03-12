import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * 관리자 전용: 사용자별 주간(7일) 분석 보고서
 * - 잘한 점 / 문제점 요약
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    let adminClient: ReturnType<typeof createAdminClient> | null = null
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      if (key.length >= 50 && key.startsWith('eyJ')) {
        adminClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          key
        ) as ReturnType<typeof createAdminClient>
      }
    }

    const client = adminClient || supabase

    const { data: profile } = await client
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = Math.min(30, Math.max(1, parseInt(searchParams.get('days') || '7', 10)))
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceIso = since.toISOString()

    const { data: usageRows, error: usageError } = await client
      .from('usage_logs')
      .select('id, user_id, type, total_tokens, meta, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(3000)

    if (usageError) {
      console.error('[admin/weekly-reports] usage_logs 조회 오류:', usageError)
      return NextResponse.json({ error: usageError.message }, { status: 500 })
    }

    const userIds = [...new Set((usageRows || []).map((r) => r.user_id).filter(Boolean))]
    const { data: profiles } = await client
      .from('profiles')
      .select('id, username, full_name, department_id, department_name')
      .in('id', userIds)

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))

    type UserStats = {
      qaCount: number
      blogCount: number
      totalTokens: number
      qualityWarningCount: number
      qaWithKeywordVolumeCount: number
      qaKeywordVolumeSum: number
      qualityWarningExamples: string[]
      lastActivity: string | null
    }

    const userStatsMap = new Map<string, UserStats>()

    for (const row of usageRows || []) {
      const uid = row.user_id
      if (!uid) continue

      if (!userStatsMap.has(uid)) {
        userStatsMap.set(uid, {
          qaCount: 0,
          blogCount: 0,
          totalTokens: 0,
          qualityWarningCount: 0,
          qaWithKeywordVolumeCount: 0,
          qaKeywordVolumeSum: 0,
          qualityWarningExamples: [],
          lastActivity: null,
        })
      }
      const st = userStatsMap.get(uid)!

      // created_at은 DESC 정렬이므로 첫 번째로 보는 행이 가장 최근 활동
      if (!st.lastActivity) {
        st.lastActivity = row.created_at
      }

      if (row.type === 'qa') st.qaCount++
      else if (row.type === 'blog') st.blogCount++
      st.totalTokens += row.total_tokens || 0

      const meta = row.meta as any
      if (meta?.qualityWarnings?.length > 0) {
        st.qualityWarningCount++
        if (st.qualityWarningExamples.length < 3) {
          st.qualityWarningExamples.push(...(meta.qualityWarnings as string[]).slice(0, 2))
        }
      }
      if (row.type === 'qa' && meta?.searchKeywordsWithVolume?.length > 0) {
        const withVol = meta.searchKeywordsWithVolume as Array<{ keyword: string; volume: number | null }>
        const hasVolume = withVol.some((x) => x.volume != null && x.volume > 0)
        if (hasVolume) {
          st.qaWithKeywordVolumeCount++
          withVol.forEach((x) => {
            if (x.volume != null && x.volume > 0) st.qaKeywordVolumeSum += x.volume
          })
        }
      }
    }

    const reports: Array<{
      user_id: string
      username: string
      full_name: string
      department_id: string | null
      department_name: string | null
      stats: UserStats
      good: string[]
      bad: string[]
      lastActivity: string | null
    }> = []

    for (const [uid, st] of userStatsMap.entries()) {
      const p = profileMap.get(uid)
      const username = p?.username ?? '-'
      const full_name = p?.full_name ?? '-'
      const department_id = (p as any)?.department_id ?? null
      const department_name = (p as any)?.department_name ?? null

      const good: string[] = []
      const bad: string[] = []

      if (st.qaCount > 0) good.push(`Q&A ${st.qaCount}건 생성`)
      if (st.blogCount > 0) good.push(`블로그 ${st.blogCount}건 생성`)
      if (st.totalTokens > 0) good.push(`토큰 ${st.totalTokens.toLocaleString()} 사용`)

      if (st.qaCount > 0 && st.qaWithKeywordVolumeCount > 0) {
        const avgVol = Math.round(st.qaKeywordVolumeSum / st.qaWithKeywordVolumeCount)
        good.push(`연관 키워드 검색량 수집 ${st.qaWithKeywordVolumeCount}건 (평균 검색량 약 ${avgVol >= 10000 ? (avgVol / 10000).toFixed(1) + '만' : avgVol.toLocaleString()})`)
      }
      if (st.qaCount > 0 && st.qualityWarningCount === 0) good.push('품질 경고 없음')

      if (st.qualityWarningCount > 0) {
        bad.push(`품질 경고 ${st.qualityWarningCount}건 발생`)
        if (st.qualityWarningExamples.length > 0) {
          bad.push(`예: ${[...new Set(st.qualityWarningExamples)].slice(0, 2).join(', ')}`)
        }
      }
      if (st.qaCount > 0 && st.qaWithKeywordVolumeCount === 0) {
        bad.push('연관 키워드 검색량 수집 없음 (Naver 미연동 또는 Google만 사용)')
      }
      if (st.qaCount === 0 && st.blogCount === 0) {
        bad.push('이 기간 생성 이력 없음')
      }

      reports.push({
        user_id: uid,
        username,
        full_name,
        department_id,
        department_name,
        stats: st,
        good,
        bad,
        lastActivity: st.lastActivity,
      })
    }

    // 활동 많은 순 정렬 (qa+blog 합계)
    reports.sort((a, b) => {
      const actA = a.stats.qaCount + a.stats.blogCount
      const actB = b.stats.qaCount + b.stats.blogCount
      return actB - actA
    })

    return NextResponse.json({
      success: true,
      days,
      since: sinceIso,
      reports,
    })
  } catch (err: unknown) {
    console.error('[admin/weekly-reports] 오류:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '서버 오류' },
      { status: 500 }
    )
  }
}
