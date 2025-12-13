'use client'

import { useEffect, useState } from 'react'

type UserStat = {
  user_id: string
  username: string
  full_name: string
  phone: string | null
  created_at: string
  blog_count: number
  qa_count: number
  last_blog: string | null
  last_qa: string | null
  last_usage: string | null
}

export default function FCStatsTable() {
  const [data, setData] = useState<UserStat | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/stats')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || '불러오기 실패')
        // FC는 자신의 통계만 보므로 첫 번째 항목만 사용
        setData(json.users?.[0] || null)
      } catch (e: any) {
        setError(e.message || '불러오기 실패')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const formatDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('ko-KR') : '-')
  const formatNumber = (n: number) => n.toLocaleString()

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="text-center py-12 text-red-600 font-semibold">⚠ {error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="text-center py-12 text-gray-500">통계 데이터가 없습니다.</div>
      </div>
    )
  }

  const lastActivity = data.last_usage || data.last_blog || data.last_qa || data.created_at

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 글 수 카드 */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-700">작성한 글</h3>
            <span className="text-2xl">📝</span>
          </div>
          <div className="text-3xl font-bold text-blue-900">{formatNumber(data.blog_count || 0)}</div>
          <div className="text-xs text-blue-600 mt-2">
            최근 작성: {formatDate(data.last_blog)}
          </div>
        </div>

        {/* Q&A 수 카드 */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-purple-700">작성한 Q&A</h3>
            <span className="text-2xl">💬</span>
          </div>
          <div className="text-3xl font-bold text-purple-900">{formatNumber(data.qa_count || 0)}</div>
          <div className="text-xs text-purple-600 mt-2">
            최근 작성: {formatDate(data.last_qa)}
          </div>
        </div>

        {/* 총 활동 카드 */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-green-700">총 활동</h3>
            <span className="text-2xl">📊</span>
          </div>
          <div className="text-3xl font-bold text-green-900">
            {formatNumber((data.blog_count || 0) + (data.qa_count || 0))}
          </div>
          <div className="text-xs text-green-600 mt-2">
            최근 활동: {formatDate(lastActivity)}
          </div>
        </div>
      </div>

      {/* 상세 정보 테이블 */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">상세 정보</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">아이디</td>
                <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{data.username}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">이름</td>
                <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{data.full_name || '-'}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">이메일</td>
                <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{data.phone || '-'}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">가입일</td>
                <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{formatDate(data.created_at)}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">최근 활동</td>
                <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{formatDate(lastActivity)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

