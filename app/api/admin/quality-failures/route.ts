import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const RECOMMENDED_ACTIONS: Record<string, { action: string; priority: 'high' | 'medium' | 'low' }> = {
  title_too_short: { action: '제목 최소 길이 제한 강화 (22자)', priority: 'low' },
  title_too_long: { action: '제목 최대 길이 프롬프트 조정', priority: 'low' },
  title_blog_style: { action: '블로그형 금지 패턴 목록 확장', priority: 'medium' },
  title_internal_code: { action: 'forbiddenPatterns에 내부 코드 추가', priority: 'high' },
  body_no_paragraph: { action: '자동 문단 분리 후처리 임계값 조정', priority: 'medium' },
  body_formal_tone: { action: '질문 프롬프트 생활형 말투 강화', priority: 'medium' },
  body_too_short: { action: '질문 본문 최소 길이 프롬프트 조정', priority: 'low' },
  body_too_long: { action: '질문 본문 최대 길이 제한 강화', priority: 'low' },
  body_exclamation: { action: '느낌표 정규화 후처리 강화', priority: 'low' },
  answer_role_leakage: { action: '답변 프롬프트 역할 재정의 + stripAnswerRoleLeakage 패턴 확장', priority: 'high' },
  answer_no_judgment: { action: '답변 4블록 구조(공감→판단→체크→행동) 강제 강화', priority: 'high' },
  answer_doc_style: { action: '답변 프롬프트에서 약관/설명서체 금지 목록 확장', priority: 'medium' },
  answer_too_short: { action: '답변 최소 길이 프롬프트 조정', priority: 'low' },
  answer_too_long: { action: '답변 최대 길이 제한 강화', priority: 'low' },
  thread_sales_ending: { action: '마지막 agent 턴 종료 규칙 강화 (영업 금지)', priority: 'high' },
  thread_role_break: { action: '댓글 role 흐름 검증 강화', priority: 'medium' },
  thread_too_short: { action: '댓글 최소 길이 프롬프트 조정', priority: 'low' },
  thread_too_long: { action: '댓글 최대 길이 제한 강화', priority: 'low' },
  human_self_intro: { action: '답변 프롬프트 자기소개 금지 강화', priority: 'high' },
  human_excessive_cta: { action: 'CTA 빈도 제한 프롬프트 강화', priority: 'medium' },
  human_first_sentence_repeat: { action: 'Opening Family 확대 + 첫 문장 유사도 임계값 조정', priority: 'medium' },
  human_formal_tone: { action: '정리/약관 문체 금지 패턴 확장', priority: 'medium' },
  human_role_leakage: { action: '전문가님 호칭 등 역할 누수 차단 강화', priority: 'high' },
  evidence_outside_facts: { action: 'evidenceMap 밖 단정적 표현 감지 패턴 확장', priority: 'high' },
  evidence_forbidden_pattern: { action: 'forbiddenPatterns 목록 업데이트', priority: 'medium' },
  keyword_missing: { action: '키워드 생성 로직 검토', priority: 'medium' },
  keyword_overweight: { action: '제목 키워드 삽입 로직 제한 강화', priority: 'medium' },
  keyword_zero_volume: { action: '키워드 볼륨 조회 로직 검토', priority: 'low' },
  keyword_no_title: { action: '제목 생성 시 키워드 포함 규칙 강화', priority: 'medium' },
  operational_regen_no_improvement: { action: '재생성 프롬프트 품질 개선', priority: 'medium' },
  operational_family_repeat: { action: 'Family 샘플링 중복 방지 로직 강화', priority: 'low' },
  operational_first_sentence_repeat: { action: '첫 문장 유사도 검사 임계값 조정', priority: 'medium' },
  operational_no_analysis: { action: 'canonical override 시 분석 결과 필수 검증', priority: 'high' },
  uncategorized_warning: { action: '품질 경고 문구를 failureTags 매핑에 추가', priority: 'medium' },
}

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
      .select('id, user_id, type, meta, created_at')
      .eq('type', 'qa')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(2000)

    if (usageError) {
      return NextResponse.json({ error: usageError.message }, { status: 500 })
    }

    const userIds = [...new Set((usageRows || []).map(r => r.user_id).filter(Boolean))]
    const { data: profiles } = await client.from('profiles').select('id, username, full_name').in('id', userIds)
    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    const tagCounts: Record<string, number> = {}
    const tagExamples: Record<string, Array<{ id: string; created_at: string; username: string; questionTitle: string; totalScore: number | null }>> = {}
    const userFailures: Record<string, { username: string; full_name: string; count: number; tags: Record<string, number> }> = {}

    for (const r of usageRows || []) {
      const meta = r.meta as any
      const tags: string[] = Array.isArray(meta?.failureTags) ? meta.failureTags : []
      if (tags.length === 0) continue

      const p = profileMap.get(r.user_id)
      const username = p?.username ?? '-'
      const full_name = p?.full_name ?? ''

      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
        if (!tagExamples[tag]) tagExamples[tag] = []
        if (tagExamples[tag].length < 5) {
          tagExamples[tag].push({
            id: r.id,
            created_at: r.created_at,
            username,
            questionTitle: meta?.questionTitle ?? '-',
            totalScore: meta?.qualityGate?.totalScore ?? null,
          })
        }
      }

      if (!userFailures[r.user_id]) {
        userFailures[r.user_id] = { username, full_name, count: 0, tags: {} }
      }
      userFailures[r.user_id].count += tags.length
      for (const tag of tags) {
        userFailures[r.user_id].tags[tag] = (userFailures[r.user_id].tags[tag] || 0) + 1
      }
    }

    // Trend: compare current period with previous same-length period
    const prevSince = new Date(since)
    prevSince.setDate(prevSince.getDate() - days)
    const { data: prevRows } = await client
      .from('usage_logs')
      .select('meta')
      .eq('type', 'qa')
      .gte('created_at', prevSince.toISOString())
      .lt('created_at', since.toISOString())
      .limit(2000)

    const prevTagCounts: Record<string, number> = {}
    for (const r of prevRows || []) {
      const tags: string[] = Array.isArray((r.meta as any)?.failureTags) ? (r.meta as any).failureTags : []
      for (const tag of tags) {
        prevTagCounts[tag] = (prevTagCounts[tag] || 0) + 1
      }
    }

    const totalTagged = Object.values(tagCounts).reduce((a, b) => a + b, 0)
    const failureTagAggregation = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => {
        const prev = prevTagCounts[tag] || 0
        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (count > prev * 1.2) trend = 'up'
        else if (count < prev * 0.8) trend = 'down'
        return {
          tag,
          count,
          percentage: totalTagged > 0 ? Math.round(count / totalTagged * 1000) / 10 : 0,
          trend,
          recentExamples: tagExamples[tag] || [],
        }
      })

    const userDistribution = Object.entries(userFailures)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([user_id, data]) => ({
        user_id,
        username: data.username,
        full_name: data.full_name,
        failureCount: data.count,
        topFailureTags: Object.entries(data.tags)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([t]) => t),
      }))

    const recommendedActions = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => ({
        tag,
        ...(RECOMMENDED_ACTIONS[tag] || { action: '해당 태그 분석 필요', priority: 'medium' as const }),
      }))

    return NextResponse.json({
      success: true,
      failureTagAggregation,
      userDistribution,
      recommendedActions,
    })
  } catch (err: unknown) {
    console.error('[admin/quality-failures] 오류:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 })
  }
}
