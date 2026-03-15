import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * 관리자 전용: 품질 경고 이력 + KPI 요약
 * - qualityLogs: meta.qualityWarnings가 있는 최근 usage_logs
 * - kpiSummary: 기간 내 Q&A/블로그 건수, 토큰 합계, 비용, 품질 경고 발생 건수
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
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30', 10)))
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceIso = since.toISOString()

    // 최근 usage_logs (qa 위주로 품질 경고 확인용 + KPI 집계용)
    const { data: usageRows, error: usageError } = await client
      .from('usage_logs')
      .select('id, user_id, type, total_tokens, meta, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (usageError) {
      console.error('[admin/quality-kpi] usage_logs 조회 오류:', usageError)
      return NextResponse.json({ error: usageError.message }, { status: 500 })
    }

    const userIds = [...new Set((usageRows || []).map((r) => r.user_id).filter(Boolean))]
    const { data: profiles } = await client
      .from('profiles')
      .select('id, username, full_name')
      .in('id', userIds)

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))

    // 품질 경고가 있는 로그만 (Q&A 생성 시 8절 품질 게이트)
    const qualityLogs = (usageRows || [])
      .filter((r) => r.meta && Array.isArray((r.meta as any).qualityWarnings) && (r.meta as any).qualityWarnings.length > 0)
      .slice(0, 100)
      .map((r) => {
        const p = profileMap.get(r.user_id)
        const meta = r.meta as any
        return {
          id: r.id,
          user_id: r.user_id,
          username: p?.username ?? '-',
          full_name: p?.full_name ?? '-',
          created_at: r.created_at,
          type: r.type,
          total_tokens: r.total_tokens ?? 0,
          questionTitle: meta?.questionTitle ?? null,
          questionContentSnippet: meta?.questionContentSnippet ?? null,
          promptVersion: meta?.promptVersion ?? '-',
          qualityWarnings: meta?.qualityWarnings ?? [],
          costEstimate: meta?.costEstimate ?? null,
        }
      })

    // KPI 요약 (기간 내)
    const usdToKrw = parseFloat(process.env.USD_TO_KRW_RATE || '1300') || 1300
    let totalQa = 0
    let totalBlog = 0
    let totalTokens = 0
    let totalCostUsd = 0
    let qualityWarningCount = 0

    // 경고 유형별 건수 (동일 문구가 여러 건에서 나오면 합산)
    const warningTypeCounts: Record<string, number> = {}

    const sectionSums: Record<string, number> = {}
    const sectionCounts: Record<string, number> = {}
    const failureTagCounts: Record<string, number> = {}
    let regenCount = 0
    let totalLatencyMs = 0
    let latencyCount = 0
    let designSheetCount = 0
    let sumQuestionFirstSim = 0
    let sumAnswerFirstSim = 0
    let sumFinalAgentSim = 0
    let simCount = 0
    let totalScoreSum = 0
    let totalScoreCount = 0
    let totalKeywordSlots = 0
    let zeroVolumeSlots = 0
    let qaWithMarketHead = 0
    let marketHeadNonZero = 0
    let marketHeadUnavailable = 0
    let marketHeadFakePresence = 0
    let threadMissingCount = 0
    let finalAgentEndingMissingCount = 0

    ;(usageRows || []).forEach((r) => {
      if (r.type === 'qa') totalQa++
      else if (r.type === 'blog') totalBlog++
      totalTokens += r.total_tokens || 0
      const meta = r.meta as any
      if (meta?.costEstimate != null) totalCostUsd += Number(meta.costEstimate)
      else if (meta?.tokenBreakdown && Array.isArray(meta.tokenBreakdown)) {
        const rates: Record<string, { prompt: number; completion: number }> = {
          'gemini-2.0-flash': { prompt: 0.10, completion: 0.40 },
          'gemini-2.5-flash': { prompt: 0.075, completion: 0.30 },
          'gemini-2.5-pro': { prompt: 1.25, completion: 10.0 },
        }
        meta.tokenBreakdown.forEach((u: any) => {
          const rate = rates[u.model]
          if (rate) totalCostUsd += (u.promptTokens || 0) / 1e6 * rate.prompt + (u.candidatesTokens || 0) / 1e6 * rate.completion
        })
      }
      if (meta?.qualityWarnings?.length > 0) {
        qualityWarningCount++
        ;(meta.qualityWarnings as string[]).forEach((w: string) => {
          warningTypeCounts[w] = (warningTypeCounts[w] || 0) + 1
        })
      }
      if (meta?.qualityGate?.breakdown) {
        for (const [key, val] of Object.entries(meta.qualityGate.breakdown)) {
          sectionSums[key] = (sectionSums[key] || 0) + (val as number)
          sectionCounts[key] = (sectionCounts[key] || 0) + 1
        }
      }
      if (typeof meta?.qualityGate?.totalScore === 'number') {
        totalScoreSum += meta.qualityGate.totalScore
        totalScoreCount++
      }
      if (Array.isArray(meta?.failureTags)) {
        for (const tag of meta.failureTags) {
          failureTagCounts[tag] = (failureTagCounts[tag] || 0) + 1
        }
      }
      if (Array.isArray(meta?.regenHistory) && meta.regenHistory.length > 0) {
        regenCount++
      }
      if (typeof meta?.latencyMs === 'number') {
        totalLatencyMs += meta.latencyMs
        latencyCount++
      }
      if (meta?.isDesignSheetMode) {
        designSheetCount++
      }
      if (typeof meta?.questionFirstSentenceSimilarity === 'number') {
        sumQuestionFirstSim += meta.questionFirstSentenceSimilarity
        simCount++
      }
      if (typeof meta?.answerFirstSentenceSimilarity === 'number') {
        sumAnswerFirstSim += meta.answerFirstSentenceSimilarity
      }
      if (typeof meta?.finalAgentEndingSimilarity === 'number') {
        sumFinalAgentSim += meta.finalAgentEndingSimilarity
      }
      const displayKw = meta?.displayKeywords as Array<{ keyword?: string; volume?: number | null }> | undefined
      if (Array.isArray(displayKw) && displayKw.length > 0) {
        for (const d of displayKw) {
          totalKeywordSlots++
          if (d.volume == null || d.volume === 0) zeroVolumeSlots++
        }
      } else {
        const withVol = meta?.searchKeywordsWithVolume as Array<{ volume?: number | null }> | undefined
        if (Array.isArray(withVol)) {
          for (const w of withVol) {
            totalKeywordSlots++
            if (w.volume == null || w.volume === 0) zeroVolumeSlots++
          }
        }
      }
      const mh = meta?.marketHeadKeyword as { keyword?: string; volume?: number | null; source?: string } | undefined
      if (r.type === 'qa' && mh?.keyword?.trim()) {
        qaWithMarketHead++
        if (mh.volume != null && mh.volume > 0) marketHeadNonZero++
        else if (mh.source === 'unavailable') marketHeadUnavailable++
        else if (mh.volume === 0) marketHeadFakePresence++
      }
      if (r.type === 'qa') {
        const thread = meta?.thread
        if (!Array.isArray(thread) || thread.length === 0) threadMissingCount++
        if (meta?.finalAgentEnding == null || meta?.finalAgentEnding === '') finalAgentEndingMissingCount++
      }
    })

    const totalWithWarnings = totalQa + totalBlog
    const qualityWarningRate = totalWithWarnings > 0
      ? Math.round((qualityWarningCount / totalWithWarnings) * 1000) / 10
      : 0
    const avgCostPerQa = totalQa > 0 ? Math.round((totalCostUsd * usdToKrw) / totalQa) : 0
    const avgCostPerBlog = totalBlog > 0 ? Math.round((totalCostUsd * usdToKrw) / totalBlog) : 0

    const sectionAverages: Record<string, number> = {}
    for (const key of Object.keys(sectionSums)) {
      sectionAverages[key] = sectionCounts[key] > 0
        ? Math.round(sectionSums[key] / sectionCounts[key] * 10) / 10
        : 0
    }

    const totalTagged = Object.values(failureTagCounts).reduce((a, b) => a + b, 0)
    const failureTopList = Object.entries(failureTagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, count]) => ({
        tag,
        count,
        pct: totalTagged > 0 ? Math.round(count / totalTagged * 1000) / 10 : 0,
      }))

    const kpiSummary = {
      days,
      since: sinceIso,
      totalUsers: userIds.length,
      totalRuns: totalQa,
      totalQa,
      totalBlog,
      totalTokens,
      avgTotalScore: totalScoreCount > 0 ? Math.round(totalScoreSum / totalScoreCount * 10) / 10 : null,
      totalCostUsd: Math.round(totalCostUsd * 1e6) / 1e6,
      totalCostKrw: Math.round(totalCostUsd * usdToKrw),
      qualityWarningCount,
      qualityWarningRate,
      avgCostPerQa,
      avgCostPerBlog,
      warningTypeCounts,
      sectionAverages,
      failureTopList,
      regenRate: totalQa > 0 ? Math.round(regenCount / totalQa * 1000) / 10 : 0,
      avgLatencyMs: latencyCount > 0 ? Math.round(totalLatencyMs / latencyCount) : 0,
      designSheetModeRate: totalQa > 0 ? Math.round(designSheetCount / totalQa * 1000) / 10 : 0,
      avgQuestionFirstSentenceSimilarity: simCount > 0 ? Math.round(sumQuestionFirstSim / simCount * 1000) / 1000 : null,
      avgAnswerFirstSentenceSimilarity: simCount > 0 ? Math.round(sumAnswerFirstSim / simCount * 1000) / 1000 : null,
      avgFinalAgentEndingSimilarity: simCount > 0 ? Math.round(sumFinalAgentSim / simCount * 1000) / 1000 : null,
      similarityInsufficientData: simCount === 0,
      zeroVolumeKeywordRate: totalKeywordSlots > 0 ? Math.round(zeroVolumeSlots / totalKeywordSlots * 1000) / 10 : null,
      marketHeadNonZeroRate: qaWithMarketHead > 0 ? Math.round(marketHeadNonZero / qaWithMarketHead * 1000) / 10 : null,
      marketHeadUnavailableRate: qaWithMarketHead > 0 ? Math.round(marketHeadUnavailable / qaWithMarketHead * 1000) / 10 : null,
      fakePresenceRate: qaWithMarketHead > 0 ? Math.round(marketHeadFakePresence / qaWithMarketHead * 1000) / 10 : null,
      threadMissingCount,
      finalAgentEndingMissingCount,
    }

    // 연관 키워드 사용 현황 (키워드·검색량 잘 잡히는지 확인용)
    const keywordLogs = (usageRows || [])
      .filter((r) => {
        const meta = r.meta as any
        return r.type === 'qa' && meta && (
          (Array.isArray(meta.searchKeywordsWithVolume) && meta.searchKeywordsWithVolume.length > 0) ||
          (Array.isArray(meta.searchKeywords) && meta.searchKeywords.length > 0)
        )
      })
      .slice(0, 80)
      .map((r) => {
        const p = profileMap.get(r.user_id)
        const meta = r.meta as any
        const withVol = meta?.searchKeywordsWithVolume as Array<{ keyword: string; volume: number | null }> | undefined
        const keywordsOnly = meta?.searchKeywords as string[] | undefined
        return {
          id: r.id,
          user_id: r.user_id,
          username: p?.username ?? '-',
          full_name: p?.full_name ?? '-',
          created_at: r.created_at,
          productName: meta?.productName ?? '-',
          searchKeywords: keywordsOnly ?? [],
          searchKeywordsWithVolume: withVol ?? (keywordsOnly?.map((k) => ({ keyword: k, volume: null as number | null })) ?? []),
        }
      })

    const recentWarnings = (usageRows || [])
      .filter((r) => {
        const meta = r.meta as any
        return r.type === 'qa' && Array.isArray(meta?.failureTags) && meta.failureTags.length > 0
      })
      .slice(0, 50)
      .map((r) => {
        const p = profileMap.get(r.user_id)
        const meta = r.meta as any
        return {
          id: r.id,
          created_at: r.created_at,
          username: p?.username ?? '-',
          full_name: p?.full_name ?? '-',
          failureTags: meta.failureTags,
          totalScore: meta.qualityGate?.totalScore ?? null,
          questionTitle: meta.questionTitle ?? null,
        }
      })

    return NextResponse.json({
      success: true,
      qualityLogs,
      kpiSummary,
      keywordLogs,
      recentWarnings,
    })
  } catch (err: unknown) {
    console.error('[admin/quality-kpi] 오류:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '서버 오류' },
      { status: 500 }
    )
  }
}
