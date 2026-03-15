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

const PRIORITY_COLORS = { high: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/20', medium: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/20', low: 'text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-700' }
const TREND_ICONS = { up: TrendingUp, down: TrendingDown, stable: Minus }

const TAG_LABELS: Record<string, string> = {
  title_too_short: '제목 짧음', title_too_long: '제목 김', title_blog_style: '블로그형 제목', title_internal_code: '내부 코드 노출',
  body_no_paragraph: '문단 없음', body_formal_tone: '격식체 본문', body_too_short: '본문 짧음', body_too_long: '본문 김', body_exclamation: '느낌표 남발',
  answer_role_leakage: '역할 누수', answer_no_judgment: '판단 없음', answer_doc_style: '설명체 답변', answer_too_short: '답변 짧음', answer_too_long: '답변 김',
  thread_sales_ending: '영업 종결', thread_role_break: '역할 흐름 깨짐', thread_too_short: '댓글 짧음', thread_too_long: '댓글 김',
  human_self_intro: '자기소개', human_excessive_cta: 'CTA 과다', human_first_sentence_repeat: '첫 문장 반복', human_formal_tone: '격식체', human_role_leakage: '역할 누수',
  evidence_outside_facts: 'Evidence 이탈', evidence_forbidden_pattern: '금지 패턴',
  keyword_missing: '키워드 없음', keyword_overweight: '키워드 과밀', keyword_zero_volume: '검색량 0', keyword_no_title: '제목 키워드 없음',
  operational_regen_no_improvement: '재생성 미개선', operational_family_repeat: '패밀리 반복', operational_first_sentence_repeat: '첫 문장 유사',   operational_no_analysis: '분석 없이 override',
  operational_final_agent_ending_missing: 'finalAgentEnding 미저장',
  thread_empty: '스레드 없음',
  uncategorized_warning: '미분류 경고',
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
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[a.priority]}`}>{a.priority}</span>
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
