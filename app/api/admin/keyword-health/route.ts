import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    let adminClient: ReturnType<typeof createAdminClient> | null = null
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      if (key.length >= 50 && key.startsWith('eyJ')) {
        adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key) as ReturnType<typeof createAdminClient>
      }
    }
    const client = adminClient || supabase

    const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30', 10)))
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data: usageRows, error: usageError } = await client
      .from('usage_logs')
      .select('meta')
      .eq('type', 'qa')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(2000)

    if (usageError) {
      return NextResponse.json({ error: usageError.message }, { status: 500 })
    }

    const kwStats: Record<string, { count: number; volumes: number[]; inTitle: number; products: Set<string>; roles: Record<string, number> }> = {}
    const concernCounts: Record<string, number> = {}
    let totalKwPerGen = 0
    let minKw = Infinity
    let maxKw = 0
    let genWithKw = 0
    let displayGenCount = 0
    let marketHeadPresent = 0
    let displayZeroVolume = 0
    let displayNullVolume = 0
    let displayTotalSlots = 0
    let concernSetCount = 0
    let concernInKeywordsCount = 0
    const rolePresence: Record<string, number> = { market_head: 0, product_core: 0, concern_search: 0, persona_longtail: 0, intent_head: 0 }

    for (const r of usageRows || []) {
      const meta = r.meta as any
      const keywords: string[] = Array.isArray(meta?.searchKeywords) ? meta.searchKeywords : []
      const withVolume: Array<{ keyword: string; volume: number | null }> = Array.isArray(meta?.searchKeywordsWithVolume) ? meta.searchKeywordsWithVolume : []
      const displayKw = meta?.displayKeywords as Array<{ keyword?: string; volume?: number | null; role?: string }> | undefined
      const title: string = meta?.questionTitle || ''
      const product: string = meta?.productName || meta?.topicCore || ''
      const concern: string = meta?.topicConcern || ''

      if (Array.isArray(displayKw) && displayKw.length >= 5) {
        displayGenCount++
        if (displayKw.some((d) => d.role === 'market_head' && d.keyword?.trim())) marketHeadPresent++
        for (const d of displayKw) {
          displayTotalSlots++
          const role = d.role || ''
          if (role && rolePresence[role] !== undefined) rolePresence[role]++
          if (d.volume == null) displayNullVolume++
          else if (d.volume === 0) displayZeroVolume++
        }
      }

      if (keywords.length > 0) {
        genWithKw++
        totalKwPerGen += keywords.length
        minKw = Math.min(minKw, keywords.length)
        maxKw = Math.max(maxKw, keywords.length)
      }

      if (concern) {
        concernCounts[concern] = (concernCounts[concern] || 0) + 1
        concernSetCount++
        const concernInDisplay = Array.isArray(displayKw) && displayKw.some((d) => d.keyword && (d.keyword.includes(concern) || concern.includes(d.keyword)))
        const concernInSearch = keywords.some((k) => k && (k.includes(concern) || concern.includes(k)))
        if (concernInDisplay || concernInSearch) concernInKeywordsCount++
      }

      const volumeMap = new Map(withVolume.map(kv => [kv.keyword, kv.volume]))
      const displayKwRoleByKeyword = new Map<string, string>()
      if (Array.isArray(displayKw)) {
        for (const d of displayKw) {
          if (d.keyword?.trim() && d.role) displayKwRoleByKeyword.set(d.keyword.trim(), d.role)
        }
      }

      for (const kw of keywords) {
        if (!kwStats[kw]) {
          kwStats[kw] = { count: 0, volumes: [], inTitle: 0, products: new Set(), roles: {} }
        }
        kwStats[kw].count++
        const vol = volumeMap.get(kw)
        if (vol !== undefined && vol !== null) {
          kwStats[kw].volumes.push(vol)
        }
        if (title && title.includes(kw)) {
          kwStats[kw].inTitle++
        }
        if (product) {
          kwStats[kw].products.add(product)
        }
        const role = displayKwRoleByKeyword.get(kw)
        if (role) {
          kwStats[kw].roles[role] = (kwStats[kw].roles[role] || 0) + 1
        }
      }
    }

    const keywordDistribution = Object.entries(kwStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 50)
      .map(([keyword, stats]) => {
        const primaryRole = Object.keys(stats.roles).length > 0
          ? Object.entries(stats.roles).sort((a, b) => b[1] - a[1])[0][0]
          : null
        return {
          keyword,
          count: stats.count,
          avgVolume: stats.volumes.length > 0
            ? Math.round(stats.volumes.reduce((a, b) => a + b, 0) / stats.volumes.length)
            : null,
          inTitleRate: stats.count > 0
            ? Math.round(stats.inTitle / stats.count * 1000) / 10
            : 0,
          role: primaryRole,
          productGroups: [...stats.products].slice(0, 5),
        }
      })

    const zeroVolumeKeywords = Object.entries(kwStats)
      .filter(([, stats]) => stats.volumes.length > 0 && stats.volumes.every(v => v === 0))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([keyword, stats]) => ({ keyword, count: stats.count }))

    const topConcernKeywords = Object.entries(concernCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([keyword, count]) => ({ keyword, count }))

    const totalWithDisplay = displayGenCount
    const displayStats = totalWithDisplay > 0 ? {
      marketHeadPresenceRate: Math.round(marketHeadPresent / totalWithDisplay * 1000) / 10,
      zeroVolumeRate: displayTotalSlots > 0 ? Math.round(displayZeroVolume / displayTotalSlots * 1000) / 10 : 0,
      unknownVolumeRate: displayTotalSlots > 0 ? Math.round(displayNullVolume / displayTotalSlots * 1000) / 10 : 0,
      displayWithVolumeRate: displayTotalSlots > 0
        ? Math.round((displayTotalSlots - displayZeroVolume - displayNullVolume) / displayTotalSlots * 1000) / 10
        : 0,
      concernReflectionRate: concernSetCount > 0 ? Math.round(concernInKeywordsCount / concernSetCount * 1000) / 10 : null,
      rolePresenceRate: {
        market_head: totalWithDisplay > 0 ? Math.round(rolePresence.market_head / totalWithDisplay * 1000) / 10 : 0,
        product_core: totalWithDisplay > 0 ? Math.round(rolePresence.product_core / totalWithDisplay * 1000) / 10 : 0,
        concern_search: totalWithDisplay > 0 ? Math.round(rolePresence.concern_search / totalWithDisplay * 1000) / 10 : 0,
        persona_longtail: totalWithDisplay > 0 ? Math.round(rolePresence.persona_longtail / totalWithDisplay * 1000) / 10 : 0,
        intent_head: totalWithDisplay > 0 ? Math.round(rolePresence.intent_head / totalWithDisplay * 1000) / 10 : 0,
      },
    } : null

    return NextResponse.json({
      success: true,
      keywordDistribution,
      zeroVolumeKeywords,
      topConcernKeywords,
      displayKeywordsStats: displayStats,
      keywordPerGeneration: {
        avg: genWithKw > 0 ? Math.round(totalKwPerGen / genWithKw * 10) / 10 : 0,
        min: minKw === Infinity ? 0 : minKw,
        max: maxKw,
      },
    })
  } catch (err: unknown) {
    console.error('[admin/keyword-health] 오류:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 })
  }
}
