'use client'

import { useEffect, useState } from 'react'
import { DEPARTMENTS } from '@/lib/constants/departments'
import { getRoleLabel } from '@/lib/constants/roles'

type UserStat = {
  user_id: string
  username: string
  full_name: string
  phone: string | null
  role: string | null
  department_id: string | null
  department_name: string | null
  team_id: string | null
  team_name: string | null
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
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        // 관리자는 기존 API 사용 (토큰 포함)
        const res = await fetch('/api/admin/stats')
        const json = await res.json()
        
        console.log('관리자 통계 API 응답:', {
          ok: res.ok,
          status: res.status,
          json
        })
        
        if (!res.ok) {
          console.error('관리자 통계 API 오류:', json)
          throw new Error(json.error || '불러오기 실패')
        }
        
        setData(json.users || [])
      } catch (e: any) {
        console.error('관리자 통계 로딩 오류:', e)
        setError(e.message || '불러오기 실패')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const filtered = data.filter((u) => {
    // 본부 필터
    if (selectedDepartment) {
      if (u.department_id !== selectedDepartment) {
        return false
      }
    }
    
    // 검색어 필터
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      u.username.toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    )
  })

  // 역할별 정렬 순서: 관리자 > 본부장 > 지사장 > 팀장 > FC
  const getRoleOrder = (role: string | null): number => {
    if (!role || role === 'user') return 5 // FC
    switch (role) {
      case 'admin': return 0 // 관리자
      case 'department_head': return 1 // 본부장
      case 'branch_head': return 2 // 지사장
      case 'team_leader': return 3 // 팀장
      case 'fc': return 4 // FC
      default: return 5
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

  const formatDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('ko-KR') : '-')
  const formatNumber = (n: number) => n.toLocaleString()
  const formatCost = (c: number) => {
    if (!c || c === 0) return '-'
    // KRW 형식으로 표시 (천 단위 구분)
    return `${Math.round(c).toLocaleString('ko-KR')}원`
  }

  // 본부 목록 (데이터에서 실제 사용된 본부만 추출)
  const departmentsInData = Array.from(
    new Set(data.map(u => u.department_id).filter(Boolean))
  ).sort()

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800">회원 통계</h2>
            <p className="text-sm text-gray-500">글 수 / Q&A 수 / 토큰·비용 (블로그·Q&A 분리)</p>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="아이디, 이름, 전화번호 검색"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        {/* 본부별 필터 버튼 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedDepartment(null)}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
              selectedDepartment === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {DEPARTMENTS.map((dept) => (
            <button
              key={dept.id}
              onClick={() => setSelectedDepartment(dept.id)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                selectedDepartment === dept.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {dept.name}
            </button>
          ))}
        </div>
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
                <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">전화번호</th>
                <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">본부</th>
                <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">역할</th>
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
              {sorted.map((u) => {
                const lastActivity = u.last_usage || u.last_blog || u.last_qa || u.created_at
                return (
                  <tr key={u.user_id} className="hover:bg-gray-50">
                    <td className="px-2 py-3 text-xs font-semibold text-gray-900 whitespace-nowrap">{u.username}</td>
                    <td className="px-2 py-3 text-xs text-gray-800 whitespace-nowrap">{u.full_name || '-'}</td>
                    <td className="px-2 py-3 text-xs text-gray-600 whitespace-nowrap">{u.phone || '-'}</td>
                    <td className="px-2 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {(() => {
                        // department_id가 있으면 본부명 찾기 (우선순위 1)
                        if (u.department_id) {
                          const dept = DEPARTMENTS.find(d => d.id === u.department_id)
                          if (dept) {
                            return dept.name
                          }
                        }
                        // department_name이 있으면 사용 (우선순위 2)
                        if (u.department_name) {
                          // 142 본부를 141 본부로 표시 (하위 호환성)
                          const deptName = u.department_name.replace('142 본부', '141 본부').replace('142본부', '141 본부')
                          return deptName
                        }
                        // 둘 다 없으면 "-" 표시
                        return '-'
                      })()}
                    </td>
                    <td className="px-2 py-3 text-xs whitespace-nowrap">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
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
            <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-300">
              <tr>
                <td colSpan={5} className="px-2 py-3 text-xs text-gray-700 text-right font-bold">
                  총합계
                </td>
                <td className="px-2 py-3 text-xs text-right text-gray-900 whitespace-nowrap">
                  {formatNumber(sorted.reduce((sum, u) => sum + (u.blog_count || 0), 0))}
                </td>
                <td className="px-2 py-3 text-xs text-right text-gray-900 whitespace-nowrap">
                  {formatNumber(sorted.reduce((sum, u) => sum + (u.qa_count || 0), 0))}
                </td>
                <td className="px-2 py-3 text-xs text-right text-blue-700 font-bold whitespace-nowrap">
                  {formatNumber(sorted.reduce((sum, u) => sum + (u.blog_token_total || 0), 0))}
                </td>
                <td className="px-2 py-3 text-xs text-right text-purple-700 font-bold whitespace-nowrap">
                  {formatNumber(sorted.reduce((sum, u) => sum + (u.qa_token_total || 0), 0))}
                </td>
                <td className="px-2 py-3 text-xs text-right text-gray-900 font-bold whitespace-nowrap">
                  {formatNumber(sorted.reduce((sum, u) => sum + (u.token_total || 0), 0))}
                </td>
                <td className="px-2 py-3 text-xs text-right text-blue-700 font-bold whitespace-nowrap">
                  {formatCost(sorted.reduce((sum, u) => sum + (u.blog_cost_total || 0), 0))}
                </td>
                <td className="px-2 py-3 text-xs text-right text-purple-700 font-bold whitespace-nowrap">
                  {formatCost(sorted.reduce((sum, u) => sum + (u.qa_cost_total || 0), 0))}
                </td>
                <td className="px-2 py-3 text-xs text-right text-green-700 font-bold whitespace-nowrap">
                  {formatCost(sorted.reduce((sum, u) => sum + (u.custom_search_cost || 0), 0))}
                </td>
                <td className="px-2 py-3 text-xs text-right text-gray-900 font-bold whitespace-nowrap">
                  {formatCost(sorted.reduce((sum, u) => sum + (u.cost_total || 0), 0))}
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


