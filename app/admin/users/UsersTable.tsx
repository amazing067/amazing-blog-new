'use client'

import { useState } from 'react'
import { UserCheck, UserX, AlertCircle, CreditCard } from 'lucide-react'
import MembershipActions from './MembershipActions'

interface User {
  id: string
  username: string
  full_name: string
  email: string
  phone: string
  role: string
  is_approved: boolean
  membership_status: 'active' | 'pending' | 'suspended' | 'deleted' | null
  paid_until: string | null
  suspended_at: string | null
  last_payment_at: string | null
  grace_period_until: string | null
  payment_note: string | null
  created_at: string
}

interface UsersTableProps {
  users: User[]
}

export default function UsersTable({ users: initialUsers }: UsersTableProps) {
  const [users, setUsers] = useState(initialUsers)
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'deleted' | 'expiring'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const handleUpdate = () => {
    // 페이지 새로고침으로 최신 데이터 가져오기
    window.location.reload()
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'active': return '활성'
      case 'pending': return '대기'
      case 'suspended': return '대기'
      case 'deleted': return '삭제'
      default: return '대기'
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-300'
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'suspended': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'deleted': return 'bg-gray-100 text-gray-800 border-gray-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  // 필터링된 사용자 목록
  const filteredUsers = users.filter(user => {
    // 검색어 필터
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      if (
        !user.username.toLowerCase().includes(searchLower) &&
        !user.full_name.toLowerCase().includes(searchLower) &&
        !user.email.toLowerCase().includes(searchLower) &&
        !user.phone.includes(searchTerm)
      ) {
        return false
      }
    }

    // 상태 필터
    if (filter === 'all') return true
    if (filter === 'expiring') {
      if (!user.paid_until || user.membership_status !== 'active') return false
      const paidUntil = new Date(user.paid_until)
      const sevenDaysLater = new Date()
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
      return paidUntil <= sevenDaysLater && paidUntil > new Date()
    }
    // suspended도 pending과 동일하게 필터
    if (filter === 'pending') {
      return user.membership_status === 'pending' || user.membership_status === 'suspended'
    }
    return user.membership_status === filter
  })

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      {/* 필터 및 검색 */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              filter === 'active'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            활성
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              filter === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            대기
          </button>
          <button
            onClick={() => setFilter('expiring')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              filter === 'expiring'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            만료 임박
          </button>
        </div>

        <input
          type="text"
          placeholder="아이디, 이름, 이메일, 전화번호 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64"
        />
      </div>

      {/* 테이블 */}
      {filteredUsers.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  아이디
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  이름
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  전화번호
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  결제 만료일
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  가입일
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {user.username}
                    {user.role === 'admin' && (
                      <span className="ml-2 text-xs text-purple-600">👑</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                    {user.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {user.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(user.membership_status)}`}>
                      {getStatusLabel(user.membership_status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {user.paid_until ? (
                      <div>
                        <div className={user.paid_until && new Date(user.paid_until) < new Date() ? 'text-red-600 font-semibold' : ''}>
                          {new Date(user.paid_until).toLocaleDateString('ko-KR')}
                        </div>
                        {user.paid_until && new Date(user.paid_until) < new Date() && (
                          <div className="text-xs text-red-500 mt-1">만료됨</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <MembershipActions
                      userId={user.id}
                      currentStatus={user.membership_status}
                      paidUntil={user.paid_until}
                      role={user.role}
                      username={user.username}
                      onUpdate={handleUpdate}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-500 text-lg font-medium">
            검색 결과가 없습니다
          </p>
        </div>
      )}
    </div>
  )
}

