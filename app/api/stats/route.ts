import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { canViewUserStats, canViewTokenUsage, getViewableUserIds } from '@/lib/auth/permissions'

type RowCount = { user_id: string; count: number; last?: string | null; sum?: number | null }

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    // Service role 우선 사용 (있으면)
    let profileClient = supabase
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      
      if (serviceRoleKey && serviceRoleKey.length >= 50 && serviceRoleKey.startsWith('eyJ')) {
        profileClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        ) as any
      }
    }

    // 사용자 프로필 조회 (RLS 우회)
    const { data: viewerProfile } = await profileClient
      .from('profiles')
      .select('id, role, department_id, team_id')
      .eq('id', user.id)
      .single()

    if (!viewerProfile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다' }, { status: 404 })
    }

    // Service role 우선 사용 (있으면)
    let statsClient = supabase
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      statsClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ) as any
    }

    // 모든 사용자 프로필 조회
    const { data: allProfiles } = await statsClient
      .from('profiles')
      .select('id, username, full_name, phone, created_at, role, department_id, department_name, team_id, team_name')

    if (!allProfiles) {
      return NextResponse.json({ error: '사용자 목록을 가져올 수 없습니다' }, { status: 500 })
    }

    // 권한에 따라 조회 가능한 사용자 ID 목록 필터링
    const viewableUserIds = getViewableUserIds(
      viewerProfile,
      allProfiles.map(p => ({
        id: p.id,
        role: p.role || null,
        department_id: p.department_id || null,
        team_id: p.team_id || null,
      }))
    )

    // 토큰 사용량 조회 권한 확인
    const canViewTokens = canViewTokenUsage(viewerProfile.role)

    // 조회 가능한 사용자만 필터링
    const viewableProfiles = allProfiles.filter(p => viewableUserIds.includes(p.id))

    // 병렬 조회 (조회 가능한 사용자만)
    const [blogRes, qaRes, usageRes] = await Promise.all([
      statsClient
        .from('blog_posts')
        .select('user_id, created_at', { count: 'exact', head: false })
        .in('user_id', viewableUserIds),
      statsClient
        .from('qa_sets')
        .select('user_id, created_at', { count: 'exact', head: false })
        .in('user_id', viewableUserIds),
      canViewTokens
        ? statsClient
            .from('usage_logs')
            .select('user_id, type, total_tokens, meta, created_at', { count: 'exact', head: false })
            .in('user_id', viewableUserIds)
        : Promise.resolve({ data: [], error: null }), // 토큰 조회 권한 없으면 빈 배열
    ])

    // 집계
    const profileMap = new Map<string, any>()
    viewableProfiles.forEach((p) => {
      profileMap.set(p.id, {
        user_id: p.id,
        username: p.username,
        full_name: p.full_name,
        phone: p.phone,
        created_at: p.created_at,
        role: p.role,
        department_name: p.department_name,
        team_name: p.team_name,
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
        custom_search_count: 0,
        custom_search_cost: 0,
        usage_blog_count: 0,
        usage_qa_count: 0,
        last_usage: null as string | null,
      })
    })

    // 비용 계산 함수
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
        }
      }
    }

    const calculateCostFromUsage = (meta: any): number | null => {
      if (meta?.costEstimate !== null && meta?.costEstimate !== undefined) {
        return meta.costEstimate
      }

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

    // 토큰 사용량 집계 (권한이 있는 경우만)
    if (canViewTokens && usageRes.data) {
      const usdToKrwRate = parseFloat(process.env.USD_TO_KRW_RATE || '1300') || 1300

      usageRes.data.forEach((row) => {
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
        
        const costUsd = calculateCostFromUsage(row.meta)
        if (costUsd !== null) {
          const costKrw = costUsd * usdToKrwRate
          target.cost_total += costKrw
          if (rowType === 'blog') {
            target.blog_cost_total += costKrw
          } else if (rowType === 'qa') {
            target.qa_cost_total += costKrw
          }
        }
        
        const customSearchCount = row.meta?.customSearchCount
        const customSearchCostUsd = row.meta?.customSearchCost
        
        if ((customSearchCount !== undefined && customSearchCount !== null && customSearchCount > 0) || 
            (customSearchCostUsd !== undefined && customSearchCostUsd !== null && customSearchCostUsd > 0)) {
          const finalCostUsd = customSearchCostUsd !== undefined && customSearchCostUsd !== null 
            ? customSearchCostUsd 
            : ((customSearchCount || 0) * 0.0005)
          const customSearchCostKrw = finalCostUsd * usdToKrwRate
          
          target.custom_search_count += customSearchCount || 0
          target.custom_search_cost += customSearchCostKrw
          target.cost_total += customSearchCostKrw
          
          if (rowType === 'blog') {
            target.blog_cost_total += customSearchCostKrw
          } else if (rowType === 'qa') {
            target.qa_cost_total += customSearchCostKrw
          }
        }
        
        if (!target.last_usage || (row.created_at && row.created_at > target.last_usage)) {
          target.last_usage = row.created_at
        }
      })
    }

    // usage 기반 카운트 보정
    profileMap.forEach((value) => {
      if (value.usage_blog_count > 0 && value.blog_count === 0) {
        value.blog_count = value.usage_blog_count
      }
      if (value.usage_qa_count > 0 && value.qa_count === 0) {
        value.qa_count = value.usage_qa_count
      }
    })

    const result = Array.from(profileMap.values())
      .sort((a, b) => {
        // 관리자는 토큰 기준, 그 외는 글 수 기준
        if (canViewTokens) {
          return (b.token_total || 0) - (a.token_total || 0)
        }
        return (b.blog_count || 0) - (a.blog_count || 0)
      })

    return NextResponse.json({ 
      success: true, 
      users: result,
      canViewTokens, // 토큰 조회 권한 여부
      viewerRole: viewerProfile.role,
    })
  } catch (error: any) {
    console.error('Stats API error:', error)
    const message = error?.message?.includes('relation') 
      ? '테이블이 없을 수 있습니다. supabase-schema-usage.sql을 실행하세요.' 
      : error.message
    return NextResponse.json({ error: message || '서버 오류' }, { status: 500 })
  }
}

