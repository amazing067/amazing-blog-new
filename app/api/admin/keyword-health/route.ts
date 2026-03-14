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

    const kwStats: Record<string, { count: number; volumes: number[]; inTitle: number; products: Set<string> }> = {}
    const concernCounts: Record<string, number> = {}
    let totalKwPerGen = 0
    let minKw = Infinity
    let maxKw = 0
    let genWithKw = 0

    for (const r of usageRows || []) {
      const meta = r.meta as any
      const keywords: string[] = Array.isArray(meta?.searchKeywords) ? meta.searchKeywords : []
      const withVolume: Array<{ keyword: string; volume: number | null }> = Array.isArray(meta?.searchKeywordsWithVolume) ? meta.searchKeywordsWithVolume : []
      const title: string = meta?.questionTitle || ''
      const product: string = meta?.productName || meta?.topicCore || ''
      const concern: string = meta?.topicConcern || ''

      if (keywords.length > 0) {
        genWithKw++
        totalKwPerGen += keywords.length
        minKw = Math.min(minKw, keywords.length)
        maxKw = Math.max(maxKw, keywords.length)
      }

      if (concern) {
        concernCounts[concern] = (concernCounts[concern] || 0) + 1
      }

      const volumeMap = new Map(withVolume.map(kv => [kv.keyword, kv.volume]))

      for (const kw of keywords) {
        if (!kwStats[kw]) {
          kwStats[kw] = { count: 0, volumes: [], inTitle: 0, products: new Set() }
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
      }
    }

    const keywordDistribution = Object.entries(kwStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 50)
      .map(([keyword, stats]) => ({
        keyword,
        count: stats.count,
        avgVolume: stats.volumes.length > 0
          ? Math.round(stats.volumes.reduce((a, b) => a + b, 0) / stats.volumes.length)
          : null,
        inTitleRate: stats.count > 0
          ? Math.round(stats.inTitle / stats.count * 1000) / 10
          : 0,
        productGroups: [...stats.products].slice(0, 5),
      }))

    const zeroVolumeKeywords = Object.entries(kwStats)
      .filter(([, stats]) => stats.volumes.length > 0 && stats.volumes.every(v => v === 0))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([keyword, stats]) => ({ keyword, count: stats.count }))

    const topConcernKeywords = Object.entries(concernCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([keyword, count]) => ({ keyword, count }))

    return NextResponse.json({
      success: true,
      keywordDistribution,
      zeroVolumeKeywords,
      topConcernKeywords,
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
