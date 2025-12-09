import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

type RowCount = { user_id: string; count: number; last?: string | null; sum?: number | null }

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 관리자 인증
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    // Service role 우선 사용 (있으면)
    let statsClient = supabase
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      statsClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ) as any
    }

    // 병렬 조회
    const [profilesRes, blogRes, qaRes, usageRes] = await Promise.all([
      statsClient.from('profiles').select('id, username, full_name, email, created_at'),
      statsClient
        .from('blog_posts')
        .select('user_id, created_at', { count: 'exact', head: false }),
      statsClient
        .from('qa_sets')
        .select('user_id, created_at', { count: 'exact', head: false }),
      statsClient
        .from('usage_logs')
        .select('user_id, type, total_tokens, meta, created_at', { count: 'exact', head: false }),
    ])

    if (profilesRes.error) throw profilesRes.error

    // 집계
    const profileMap = new Map<string, any>()
    profilesRes.data?.forEach((p) => {
      profileMap.set(p.id, {
        user_id: p.id,
        username: p.username,
        full_name: p.full_name,
        email: p.email,
        created_at: p.created_at,
        blog_count: 0,
        last_blog: null as string | null,
        qa_count: 0,
        last_qa: null as string | null,
        token_total: 0,
        cost_total: 0,
        blog_token_total: 0,
        qa_token_total: 0,
        blog_cost_total: 0,
        qa_cost_total: 0,
        usage_blog_count: 0,
        usage_qa_count: 0,
        last_usage: null as string | null,
      })
    })

    // 비용 계산 함수 (환경변수 기반)
    const getCostRates = () => {
      const toNumber = (v?: string, defaultValue?: number) => {
        const n = v ? parseFloat(v) : defaultValue ?? NaN
        return Number.isFinite(n) ? n : null
      }

      return {
        'gemini-2.0-flash': {
          prompt: toNumber(process.env.GEMINI_FLASH_2_0_INPUT_COST_PER_1M, 0.10),
          completion: toNumber(process.env.GEMINI_FLASH_2_0_OUTPUT_COST_PER_1M, 0.40)
        },
        'gemini-2.5-pro': {
          prompt: toNumber(process.env.GEMINI_PRO_2_5_INPUT_COST_PER_1M, 1.25),
          completion: toNumber(process.env.GEMINI_PRO_2_5_OUTPUT_COST_PER_1M, 10.00)
        },
        'gemini-1.5-pro': {
          prompt: toNumber(process.env.GEMINI_15_PRO_INPUT_COST_PER_1M),
          completion: toNumber(process.env.GEMINI_15_PRO_OUTPUT_COST_PER_1M)
        },
        'gemini-1.5-flash': {
          prompt: toNumber(process.env.GEMINI_15_FLASH_INPUT_COST_PER_1M),
          completion: toNumber(process.env.GEMINI_15_FLASH_OUTPUT_COST_PER_1M)
        }
      }
    }

    const calculateCostFromUsage = (meta: any): number | null => {
      // meta.costEstimate가 있으면 직접 사용
      if (meta?.costEstimate !== null && meta?.costEstimate !== undefined) {
        return meta.costEstimate
      }

      // tokenBreakdown이 있으면 계산
      if (meta?.tokenBreakdown && Array.isArray(meta.tokenBreakdown)) {
        const rates = getCostRates()
        let totalCost = 0
        let hasValidCost = false

        for (const usage of meta.tokenBreakdown) {
          const rate = rates[usage.model as keyof typeof rates]
          if (rate?.prompt !== null && rate?.completion !== null) {
            const cost = (usage.promptTokens / 1_000_000) * rate.prompt + 
                        (usage.candidatesTokens / 1_000_000) * rate.completion
            totalCost += cost
            hasValidCost = true
          }
        }

        return hasValidCost ? totalCost : null
      }

      return null
    }

    const accumulate = (rows: any[], keyCount: 'blog_count' | 'qa_count', keyLast: 'last_blog' | 'last_qa') => {
      rows?.forEach((row) => {
        const target = profileMap.get(row.user_id)
        if (!target) return
        target[keyCount] += 1
        if (!target[keyLast] || (row.created_at && row.created_at > target[keyLast])) {
          target[keyLast] = row.created_at
        }
      })
    }

    accumulate(blogRes.data || [], 'blog_count', 'last_blog')
    accumulate(qaRes.data || [], 'qa_count', 'last_qa')

    // USD → KRW 환율 (환경변수 또는 기본값 1300원)
    const usdToKrwRate = parseFloat(process.env.USD_TO_KRW_RATE || '1300') || 1300

    usageRes.data?.forEach((row) => {
      const target = profileMap.get(row.user_id)
      if (!target) return
      const rowTokens = row.total_tokens || 0
      target.token_total += rowTokens
      
      const rowType = row.type as string | null
      if (rowType === 'blog') {
        target.blog_token_total += rowTokens
        target.usage_blog_count += 1
      } else if (rowType === 'qa') {
        target.qa_token_total += rowTokens
        target.usage_qa_count += 1
      }
      
      // 비용 계산 (USD)
      const costUsd = calculateCostFromUsage(row.meta)
      if (costUsd !== null) {
        // USD를 KRW로 변환
        const costKrw = costUsd * usdToKrwRate
        target.cost_total += costKrw
        if (rowType === 'blog') {
          target.blog_cost_total += costKrw
        } else if (rowType === 'qa') {
          target.qa_cost_total += costKrw
        }
      }
      
      if (!target.last_usage || (row.created_at && row.created_at > target.last_usage)) {
        target.last_usage = row.created_at
      }
    })

    // usage 기반 카운트 보정 (blog_posts/qa_sets 카운트가 0일 때)
    profileMap.forEach((value) => {
      if (value.usage_blog_count > 0 && value.blog_count === 0) {
        value.blog_count = value.usage_blog_count
      }
      if (value.usage_qa_count > 0 && value.qa_count === 0) {
        value.qa_count = value.usage_qa_count
      }
    })

    const result = Array.from(profileMap.values())
      .sort((a, b) => (b.token_total || 0) - (a.token_total || 0))

    return NextResponse.json({ success: true, users: result })
  } catch (error: any) {
    console.error('Admin stats error:', error)
    // 테이블 미생성 등 오류 안내
    const message = error?.message?.includes('relation') ? '테이블이 없을 수 있습니다. supabase-schema-usage.sql을 실행하세요.' : error.message
    return NextResponse.json({ error: message || '서버 오류' }, { status: 500 })
  }
}


