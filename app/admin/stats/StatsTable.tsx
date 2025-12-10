'use client'

import { useEffect, useState } from 'react'

type UserStat = {
  user_id: string
  username: string
  full_name: string
  email: string
  created_at: string
  blog_count: number
  qa_count: number
  token_total: number
  cost_total: number
  blog_token_total: number
  qa_token_total: number
  blog_cost_total: number
  qa_cost_total: number
  custom_search_count?: number
  custom_search_cost?: number
  last_blog: string | null
  last_qa: string | null
  last_usage: string | null
}

export default function StatsTable() {
  const [data, setData] = useState<UserStat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/stats')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || '불러오기 실패')
        setData(json.users || [])
      } catch (e: any) {
        setError(e.message || '불러오기 실패')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const filtered = data.filter((u) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      u.username.toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    )
  })

  const formatDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('ko-KR') : '-')
  const formatNumber = (n: number) => n.toLocaleString()
  const formatCost = (c: number) => {
    if (!c || c === 0) return '-'
    // KRW 형식으로 표시 (천 단위 구분)
    return `${Math.round(c).toLocaleString('ko-KR')}원`
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">회원 통계</h2>
          <p className="text-sm text-gray-500">글 수 / Q&A 수 / 토큰·비용 (블로그·Q&A 분리)</p>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="아이디, 이름, 이메일 검색"
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-600 font-semibold">⚠ {error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">검색 결과가 없습니다.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">아이디</th>
                <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">이름</th>
                <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">이메일</th>
                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">글 수</th>
                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">Q&A</th>
                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">블로그 토큰</th>
                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">Q&A 토큰</th>
                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">총 토큰</th>
                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">블로그 비용</th>
                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">Q&A 비용</th>
                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">서치 비용</th>
                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">총 비용</th>
                <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">최근 활동</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => {
                const lastActivity = u.last_usage || u.last_blog || u.last_qa || u.created_at
                return (
                  <tr key={u.user_id} className="hover:bg-gray-50">
                    <td className="px-2 py-3 text-xs font-semibold text-gray-900 whitespace-nowrap">{u.username}</td>
                    <td className="px-2 py-3 text-xs text-gray-800 whitespace-nowrap">{u.full_name || '-'}</td>
                    <td className="px-2 py-3 text-xs text-gray-600 whitespace-nowrap">{u.email || '-'}</td>
                    <td className="px-2 py-3 text-xs text-right text-gray-800 whitespace-nowrap">{formatNumber(u.blog_count || 0)}</td>
                    <td className="px-2 py-3 text-xs text-right text-gray-800 whitespace-nowrap">{formatNumber(u.qa_count || 0)}</td>
                    <td className="px-2 py-3 text-xs text-right text-blue-700 font-bold whitespace-nowrap">{formatNumber(u.blog_token_total || 0)}</td>
                    <td className="px-2 py-3 text-xs text-right text-purple-700 font-bold whitespace-nowrap">{formatNumber(u.qa_token_total || 0)}</td>
                    <td className="px-2 py-3 text-xs text-right text-gray-800 font-bold whitespace-nowrap">{formatNumber(u.token_total || 0)}</td>
                    <td className="px-2 py-3 text-xs text-right text-blue-700 font-bold whitespace-nowrap">{formatCost(u.blog_cost_total || 0)}</td>
                    <td className="px-2 py-3 text-xs text-right text-purple-700 font-bold whitespace-nowrap">{formatCost(u.qa_cost_total || 0)}</td>
                    <td className="px-2 py-3 text-xs text-right text-green-700 font-bold whitespace-nowrap" title={`서치 ${u.custom_search_count || 0}회`}>
                      {formatCost(u.custom_search_cost || 0)}
                    </td>
                    <td className="px-2 py-3 text-xs text-right text-gray-900 font-bold whitespace-nowrap">{formatCost(u.cost_total || 0)}</td>
                    <td className="px-2 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(lastActivity)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


