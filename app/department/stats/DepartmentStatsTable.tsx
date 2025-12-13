'use client'

import { useEffect, useState } from 'react'

type UserStat = {
  user_id: string
  username: string
  full_name: string
  phone: string | null
  role: string | null
  department_name: string | null
  team_name: string | null
  created_at: string
  blog_count: number
  qa_count: number
  last_blog: string | null
  last_qa: string | null
  last_usage: string | null
}

export default function DepartmentStatsTable() {
  const [data, setData] = useState<UserStat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/stats')
        const json = await res.json()
        
        console.log('본부 통계 API 응답:', {
          ok: res.ok,
          status: res.status,
          json
        })
        
        if (!res.ok) {
          console.error('본부 통계 API 오류:', json)
          throw new Error(json.error || '불러오기 실패')
        }
        
        setData(json.users || [])
      } catch (e: any) {
        console.error('본부 통계 로딩 오류:', e)
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
      (u.phone || '').toLowerCase().includes(q)
    )
  })

  // 역할별 정렬 순서: 본부장 > 지사장 > 팀장 > FC
  const getRoleOrder = (role: string | null): number => {
    if (!role || role === 'user') return 4 // FC
    switch (role) {
      case 'admin': return 0
      case 'department_head': return 1 // 본부장
      case 'branch_head': return 2 // 지사장
      case 'team_leader': return 3 // 팀장
      case 'fc': return 4 // FC
      default: return 4
    }
  }

  // 역할 순서로 정렬
  const sorted = [...filtered].sort((a, b) => {
    const orderA = getRoleOrder(a.role)
    const orderB = getRoleOrder(b.role)
    if (orderA !== orderB) {
      return orderA - orderB
    }
    // 같은 역할이면 이름순으로 정렬
    return (a.full_name || a.username).localeCompare(b.full_name || b.username, 'ko')
  })

  // 합계 계산 (정렬 전 filtered 사용)
  const totalBlogs = filtered.reduce((sum, u) => sum + (u.blog_count || 0), 0)
  const totalQAs = filtered.reduce((sum, u) => sum + (u.qa_count || 0), 0)

  const formatDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('ko-KR') : '-')
  const formatNumber = (n: number) => n.toLocaleString()

  const getRoleLabel = (role: string | null) => {
    if (!role || role === 'user') return 'FC'
    switch (role) {
      case 'admin': return '관리자'
      case 'department_head': return '본부장'
      case 'branch_head': return '지사장'
      case 'team_leader': return '팀장'
      case 'fc': return 'FC'
      default: return 'FC'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">팀원 통계</h2>
          <p className="text-sm text-gray-500">
            총 {filtered.length}명 | 글: {formatNumber(totalBlogs)}건 | Q&A: {formatNumber(totalQAs)}건
          </p>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="아이디, 이름, 전화번호 검색"
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">이름</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">역할</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">글 수</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">Q&A 수</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">최근 활동</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((u) => {
                const lastActivity = u.last_usage || u.last_blog || u.last_qa || u.created_at
                return (
                  <tr key={u.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {u.full_name || u.username}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-800 font-semibold whitespace-nowrap">
                      {formatNumber(u.blog_count || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-800 font-semibold whitespace-nowrap">
                      {formatNumber(u.qa_count || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(lastActivity)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-sm text-gray-700 text-right">
                  합계
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                  {formatNumber(totalBlogs)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                  {formatNumber(totalQAs)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

