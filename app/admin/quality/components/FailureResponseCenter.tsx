'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'

type FailureAgg = {
  tag: string
  count: number
  percentage: number
  trend: 'up' | 'down' | 'stable'
  recentExamples: Array<{ id: string; created_at: string; username: string; questionTitle: string; totalScore: number | null }>
}

type RecommendedAction = { tag: string; action: string; priority: 'high' | 'medium' | 'low' }

const PRIORITY_COLORS = {
  high: 'text-red-100 dark:text-red-100 bg-red-900 dark:bg-red-900 border border-red-500/70',
  medium: 'text-amber-100 dark:text-amber-100 bg-amber-900 dark:bg-amber-900 border border-amber-500/70',
  low: 'text-slate-100 dark:text-slate-100 bg-slate-800 dark:bg-slate-800 border border-slate-600/70',
}
const PRIORITY_LABELS: Record<string, string> = { high: '높음', medium: '중간', low: '낮음' }
const TREND_ICONS = { up: TrendingUp, down: TrendingDown, stable: Minus }

const TAG_LABELS: Record<string, string> = {
  title_too_short: '제목이 너무 짧아요',
  title_too_long: '제목이 너무 길어요',
  title_blog_style: '블로그 광고 같은 제목이에요',
  title_internal_code: '제목에 상품 코드가 그대로 보여요',
  body_no_paragraph: '본문에 문단 나눔이 거의 없어요',
  body_formal_tone: '본문이 약관/설명서 말투예요',
  body_too_short: '본문이 너무 짧아요',
  body_too_long: '본문이 너무 길어요',
  body_exclamation: '느낌표, ㅠㅠ 같은 표현이 너무 많아요',
  answer_role_leakage: '답변에서 설계사 자기소개나 영업 멘트가 나와요',
  answer_no_judgment: '답변에 “그래서 어떤지” 정리가 없어요',
  answer_doc_style: '답변이 안내문처럼 딱딱해요',
  answer_too_short: '답변이 너무 짧아요',
  answer_too_long: '답변이 너무 길어요',
  thread_sales_ending: '댓글이 상담/가입 유도로 끝나요',
  thread_role_break: '고객/설계사 역할이 섞여 보여요',
  thread_too_short: '댓글 길이가 너무 짧아요',
  thread_too_long: '댓글 길이가 너무 길어요',
  human_self_intro: '“몇 년 경력 설계사입니다” 같은 자기소개가 나와요',
  human_excessive_cta: '“연락 주세요/문의 주세요”가 너무 자주 나와요',
  human_first_sentence_repeat: '여러 글의 첫 문장이 너무 비슷해요',
  human_formal_tone: '전체 말투가 지나치게 격식 있어요',
  human_role_leakage: '전문가/고객 역할이 헷갈리게 섞여요',
  evidence_outside_facts: '설계서에 없는 수치나 조건을 확정처럼 말해요',
  evidence_forbidden_pattern: '“약관을 참고하세요” 같은 금지 문장이 남아 있어요',
  keyword_missing: '검색 키워드가 거의 안 쓰였어요',
  keyword_overweight: '키워드를 너무 많이 우겨 넣었어요',
  keyword_zero_volume: '검색량 0인 키워드가 많이 쓰였어요',
  keyword_no_title: '제목에 핵심 키워드가 안 들어가요',
  internal_keyword_leak: '내부 상품 코드/약어가 겉으로 드러났어요',
  internal_concern_lock: '비슷한 고민 문장이 계속 복붙돼요',
  market_head_missing: '큰 시장 키워드(암보험, 실손보험 등)가 빠졌어요',
  market_head_not_big_keyword: '시장 키워드 자리에 애매한 단어가 들어갔어요',
  customer_concern_missing: '고객 고민 칸이 비어 있거나 내부어로만 채워졌어요',
  operational_regen_no_improvement: '여러 번 다시 생성했지만 내용이 안 좋아졌어요',
  operational_family_repeat: '비슷한 제목/패턴이 같은 가족처럼 반복돼요',
  operational_first_sentence_repeat: '질문·답변 첫 문장이 비슷한 패턴으로 반복돼요',
  operational_no_analysis: '분석 없이 결과만 덮어쓴 기록이 있어요',
  operational_final_agent_ending_missing: '마지막 설계사 마무리 문장이 저장되지 않았어요',
  thread_empty: 'conversation 모드인데 댓글 대화가 비어 있어요',
  uncategorized_warning: '다른 분류에 안 들어가는 경고예요',
}

export default function FailureResponseCenter({ days }: { days: number }) {
  const [data, setData] = useState<{ failureTagAggregation: FailureAgg[]; recommendedActions: RecommendedAction[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/quality-failures?days=${days}`)
      .then(r => r.json())
      .then(json => { if (json.success) setData(json) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  if (loading) return <div className="text-center py-8 text-gray-400">실패 데이터 로딩...</div>

  if (!data || data.failureTagAggregation.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />실패 대응 센터 (전체 사용자)</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">기간 내 실패 태그가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-6">
      <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />실패 대응 센터 (전체 사용자)</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 dark:border-slate-700 text-left text-gray-500 dark:text-slate-300">
            <th className="py-2 pr-4">태그</th><th className="py-2 pr-4">건수</th><th className="py-2 pr-4">비율</th><th className="py-2 pr-4">추세</th><th className="py-2">최근 예시</th>
          </tr></thead>
          <tbody>
            {data.failureTagAggregation.slice(0, 15).map(f => {
              const TrendIcon = TREND_ICONS[f.trend]
              const trendColor = f.trend === 'up' ? 'text-red-500' : f.trend === 'down' ? 'text-green-500' : 'text-gray-400 dark:text-slate-400'
              return (
                <tr key={f.tag} className="border-b border-gray-100 dark:border-slate-700 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => setExpanded(expanded === f.tag ? null : f.tag)}>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-slate-100">{TAG_LABELS[f.tag] || f.tag}</td>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-slate-100">{f.count}</td>
                  <td className="py-2 pr-4 text-gray-700 dark:text-slate-300">{f.percentage}%</td>
                  <td className="py-2 pr-4"><TrendIcon className={`w-4 h-4 ${trendColor}`} /></td>
                  <td className="py-2 text-gray-500 dark:text-slate-400 truncate max-w-[200px]">{f.recentExamples[0]?.questionTitle || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {expanded && (() => {
        const f = data.failureTagAggregation.find(x => x.tag === expanded)
        if (!f) return null
        return (
          <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 text-sm space-y-2 border border-gray-200 dark:border-slate-600">
            <div className="font-bold text-gray-900 dark:text-slate-100">{TAG_LABELS[f.tag] || f.tag} - 최근 예시</div>
            {f.recentExamples.map(ex => (
              <div key={ex.id} className="flex gap-4 text-gray-600 dark:text-slate-300">
                <span>{new Date(ex.created_at).toLocaleDateString('ko-KR')}</span>
                <span>{ex.username}</span>
                <span className="truncate flex-1">{ex.questionTitle}</span>
                <span className="font-medium text-gray-900 dark:text-slate-100">{ex.totalScore !== null ? `${ex.totalScore}점` : '-'}</span>
              </div>
            ))}
          </div>
        )
      })()}

      {data.recommendedActions.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 mb-2">권장 조치</h3>
          <div className="space-y-2">
            {data.recommendedActions.slice(0, 5).map(a => (
              <div key={a.tag} className="flex items-center gap-3 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[a.priority]}`}>{PRIORITY_LABELS[a.priority] ?? a.priority}</span>
                <span className="font-medium text-gray-900 dark:text-slate-100">{TAG_LABELS[a.tag] || a.tag}:</span>
                <span className="text-gray-600 dark:text-slate-300">{a.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
