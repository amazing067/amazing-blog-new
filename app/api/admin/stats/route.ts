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

    // Service role 우선 사용 (있으면)
    let statsClient = supabase
    let adminClient: any = null
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      
      if (serviceRoleKey && serviceRoleKey.length >= 50 && serviceRoleKey.startsWith('eyJ')) {
        adminClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        ) as any
        statsClient = adminClient
      }
    }

    // 관리자 권한 확인 (SERVICE_ROLE_KEY 사용)
    let me: { role: string } | null = null
    
    if (adminClient) {
      const { data: profileData, error: profileError } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (!profileError && profileData) {
        me = profileData
      }
    }
    
    // SERVICE_ROLE_KEY가 없거나 실패한 경우 일반 클라이언트 사용
    if (!me) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (profileError) {
        console.error('프로필 조회 오류:', profileError)
        return NextResponse.json({ 
          error: '프로필을 조회할 수 없습니다. RLS 정책을 확인해주세요.',
          details: profileError.message
        }, { status: 500 })
      }
      
      if (profileData) {
        me = profileData
      }
    }

    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    // 병렬 조회
    const [profilesRes, blogRes, qaRes, usageRes] = await Promise.all([
      statsClient
        .from('profiles')
        .select('id, username, full_name, phone, created_at, role, department_id, department_name, team_id, team_name')
        .is('deleted_at', null), // 삭제된 사용자는 제외
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
        phone: p.phone,
        role: p.role,
        department_id: p.department_id,
        department_name: p.department_name,
        team_id: p.team_id,
        team_name: p.team_name,
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
        custom_search_count: 0, // 커스텀 서치 총 횟수
        custom_search_cost: 0, // 커스텀 서치 총 비용 (KRW)
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
        }
        // gemini-1.5 모델은 더 이상 사용하지 않음
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

    console.log('[통계] usage_logs 총 개수:', usageRes.data?.length || 0)
    
    usageRes.data?.forEach((row, index) => {
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
      
      // 커스텀 서치 비용 계산
      const customSearchCount = row.meta?.customSearchCount
      const customSearchCostUsd = row.meta?.customSearchCost
      
      // 디버깅: 최근 5개 Q&A/Blog만 로그 (너무 많이 출력 방지)
      if ((rowType === 'qa' || rowType === 'blog') && index < 5) {
        console.log(`[통계] [${index}] ${rowType} - meta 확인:`, {
          hasMeta: !!row.meta,
          customSearchCount,
          customSearchCostUsd,
          metaKeys: row.meta ? Object.keys(row.meta) : [],
          created_at: row.created_at
        })
      }
      
      // customSearchCount가 0이어도 명시적으로 있을 수 있으므로 undefined가 아닌지 확인
      if ((customSearchCount !== undefined && customSearchCount !== null && customSearchCount > 0) || 
          (customSearchCostUsd !== undefined && customSearchCostUsd !== null && customSearchCostUsd > 0)) {
        const finalCostUsd = customSearchCostUsd !== undefined && customSearchCostUsd !== null 
          ? customSearchCostUsd 
          : ((customSearchCount || 0) * 0.0005)
        const customSearchCostKrw = finalCostUsd * usdToKrwRate
        
        target.custom_search_count += customSearchCount || 0
        target.custom_search_cost += customSearchCostKrw
        
        if (index < 5) {
          console.log(`[통계] [${index}] ${rowType} - 서치 비용 추가:`, {
            customSearchCount,
            customSearchCostUsd: finalCostUsd,
            customSearchCostKrw,
            userId: row.user_id?.substring(0, 8)
          })
        }
        
        // 커스텀 서치 비용도 총 비용에 포함
        target.cost_total += customSearchCostKrw
        if (rowType === 'blog') {
          target.blog_cost_total += customSearchCostKrw
        } else if (rowType === 'qa') {
          target.qa_cost_total += customSearchCostKrw
        }
      } else if ((rowType === 'qa' || rowType === 'blog') && index < 5) {
        console.log(`[통계] [${index}] ${rowType} - 서치 비용 없음:`, {
          customSearchCount,
          customSearchCostUsd,
          hasMeta: !!row.meta
        })
      }
      
      if (!target.last_usage || (row.created_at && row.created_at > target.last_usage)) {
        target.last_usage = row.created_at
      }
    })
    
    console.log('[통계] 집계 완료 - 사용자별 서치 비용:', 
      Array.from(profileMap.values())
        .filter(u => u.custom_search_cost > 0)
        .map(u => ({ username: u.username, searchCost: u.custom_search_cost.toFixed(2) }))
    )

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


