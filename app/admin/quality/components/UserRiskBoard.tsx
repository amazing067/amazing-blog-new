'use client'

import { useEffect, useState } from 'react'

type UserDist = { user_id: string; username: string; full_name?: string; failureCount: number; topFailureTags: string[] }

const TAG_SHORT: Record<string, string> = {
  title_too_short: '제목 짧음', title_too_long: '제목 김', title_blog_style: '블로그형 제목', title_internal_code: '내부 코드 노출',
  body_no_paragraph: '문단 없음', body_formal_tone: '격식체 본문', body_too_short: '본문 짧음', body_too_long: '본문 김', body_exclamation: '느낌표 남발',
  answer_role_leakage: '역할 누수', answer_no_judgment: '판단 없음', answer_doc_style: '설명체 답변', answer_too_short: '답변 짧음', answer_too_long: '답변 김',
  thread_sales_ending: '영업 종결', thread_role_break: '역할 흐름 깨짐', thread_too_short: '댓글 짧음', thread_too_long: '댓글 김', thread_empty: '댓글 대화 없음',
  human_self_intro: '자기소개', human_excessive_cta: '행동 유도 과다', human_first_sentence_repeat: '첫 문장 반복', human_formal_tone: '격식체', human_role_leakage: '역할 누수',
  evidence_outside_facts: '근거 이탈', evidence_forbidden_pattern: '금지 패턴',
  keyword_missing: '키워드 없음', keyword_overweight: '키워드 과밀', keyword_zero_volume: '검색량 0', keyword_no_title: '제목 키워드 없음',
  operational_regen_no_improvement: '재생성 미개선', operational_family_repeat: '패밀리 반복', operational_first_sentence_repeat: '첫 문장 유사', operational_no_analysis: '분석 없이 덮어쓰기',
  operational_final_agent_ending_missing: '최종 마무리 문장 미저장',
  uncategorized_warning: '미분류 경고',
}

export default function UserRiskBoard({ days }: { days: number }) {
  const [users, setUsers] = useState<UserDist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/quality-failures?days=${days}`)
      .then(r => r.json())
      .then(json => { if (json.success && json.userDistribution) setUsers(json.userDistribution) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  if (loading) return <div className="text-center py-6 text-gray-500 dark:text-slate-400">사용자 리스크 로딩...</div>

  if (users.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-1">사용자/운영자 리스크 보드</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">기간 내 Q&A 생성 실패·경고가 많이 발생한 사용자별 건수와 주요 실패 유형을 보여줍니다. 특정 사용자 집중 점검이 필요할 때 참고하세요.</p>
        <p className="text-sm text-gray-500 dark:text-slate-400">기간 내 실패 이력이 있는 사용자가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
      <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-1">사용자/운영자 리스크 보드</h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">기간 내 Q&A 생성 실패·경고가 많이 발생한 사용자별 건수와 주요 실패 유형을 보여줍니다. 특정 사용자 집중 점검이 필요할 때 참고하세요.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 dark:border-slate-700 text-left text-gray-600 dark:text-slate-200">
            <th className="py-2 pr-4">사용자</th><th className="py-2 pr-4">실패 건수</th><th className="py-2">주요 실패 태그</th>
          </tr></thead>
          <tbody>
            {users.slice(0, 15).map(u => (
              <tr key={u.user_id} className="border-b border-gray-100 dark:border-slate-700 last:border-0">
                <td className="py-2 pr-4 font-medium text-gray-900 dark:text-slate-100">
                  {u.full_name ? `${u.username} (${u.full_name})` : u.username}
                </td>
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.failureCount >= 10 ? 'bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/40' : u.failureCount >= 5 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40' : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200'}`}>
                    {u.failureCount}
                  </span>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.topFailureTags.slice(0, 3).map(t => (
                      <span key={t} className="bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-slate-200 px-1.5 py-0.5 rounded text-xs font-medium">{TAG_SHORT[t] || t}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
