'use client'

import { useEffect, useState } from 'react'

type UserDist = { user_id: string; username: string; failureCount: number; topFailureTags: string[] }

const TAG_SHORT: Record<string, string> = {
  answer_role_leakage: '역할누수', thread_sales_ending: '영업종결', human_self_intro: '자기소개',
  body_no_paragraph: '문단없음', answer_no_judgment: '판단없음', keyword_missing: '키워드없음',
  body_formal_tone: '격식체', human_excessive_cta: 'CTA과다', evidence_outside_facts: 'Evidence이탈',
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

  if (loading) return <div className="text-center py-6 text-gray-400">사용자 리스크 로딩...</div>

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">사용자 리스크 보드</h2>
        <p className="text-sm text-gray-500">기간 내 실패 이력이 있는 사용자가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4">사용자/운영자 리스크 보드</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-4">사용자</th><th className="py-2 pr-4">실패 건수</th><th className="py-2">주요 실패 태그</th>
          </tr></thead>
          <tbody>
            {users.slice(0, 15).map(u => (
              <tr key={u.user_id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{u.username}</td>
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.failureCount >= 10 ? 'bg-red-100 text-red-700' : u.failureCount >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                    {u.failureCount}
                  </span>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.topFailureTags.slice(0, 3).map(t => (
                      <span key={t} className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs">{TAG_SHORT[t] || t}</span>
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
