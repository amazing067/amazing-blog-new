'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, UserX, AlertCircle, CreditCard } from 'lucide-react'
import MembershipActions from './MembershipActions'

import RoleSelector from './RoleSelector'
import { ROLE_LABELS } from '@/lib/constants/roles'
import { formatPhoneNumber } from '@/lib/utils/phone'
import { DEPARTMENTS } from '@/lib/constants/departments'

interface User {
  id: string
  username: string
  full_name: string
  phone: string
  role: string | null
  is_approved: boolean
  membership_status: 'active' | 'pending' | 'suspended' | 'deleted' | null
  paid_until: string | null
  suspended_at: string | null
  last_payment_at: string | null
  grace_period_until: string | null
  payment_note: string | null
  department_id: string | null
  department_name: string | null
  created_at: string
}

interface UsersTableProps {
  users: User[]
  initialFilter?: 'all' | 'active' | 'suspended' | 'expiring' | 'pending'
}

export default function UsersTable({ users: initialUsers, initialFilter = 'all' }: UsersTableProps) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended' | 'deleted' | 'expiring' | 'pending'>(initialFilter as any)
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string>('')

  // ActionCard에서 필터 변경 이벤트 수신
  useEffect(() => {
    const handleFilterChange = (event: CustomEvent) => {
      setFilter(event.detail.filter)
    }
    window.addEventListener('filterChange', handleFilterChange as EventListener)
    return () => {
      window.removeEventListener('filterChange', handleFilterChange as EventListener)
    }
  }, [])

  const handleUpdate = () => {
    // 페이지 새로고침으로 최신 데이터 가져오기
    // 약간의 지연을 두어 DB 업데이트가 완료되도록 함
    console.log('[UsersTable] handleUpdate 호출됨')
    setTimeout(() => {
      console.log('[UsersTable] 페이지 새로고침 실행')
      // router.refresh()와 window.location.reload() 모두 시도
      router.refresh()
      // router.refresh()가 즉시 반영되지 않을 수 있으므로 강제 새로고침도 시도
      setTimeout(() => {
        window.location.reload()
      }, 100)
    }, 500)
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'active': return '활성'
      case 'pending': return '정지' // pending도 정지로 표시
      case 'suspended': return '정지'
      case 'deleted': return '삭제'
      default: return '정지' // 기본값도 정지
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-300'
      case 'pending': return 'bg-red-100 text-red-800 border-red-300' // pending도 빨간색
      case 'suspended': return 'bg-red-100 text-red-800 border-red-300'
      case 'deleted': return 'bg-gray-100 text-gray-800 border-gray-300'
      default: return 'bg-red-100 text-red-800 border-red-300' // 기본값도 빨간색
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
        !user.phone.includes(searchTerm)
      ) {
        return false
      }
    }

    // 본부 필터
    if (departmentFilter && user.department_id !== departmentFilter) {
      return false
    }

    // 역할 필터
    if (roleFilter && user.role !== roleFilter) {
      return false
    }

    // 상태 필터
    if (filter === 'all') return true
    if (filter === 'active') {
      return user.membership_status === 'active'
    }
    if (filter === 'suspended') {
      return user.membership_status === 'pending' || user.membership_status === 'suspended' || (!user.membership_status && !user.is_approved)
    }
    if (filter === 'expiring') {
      if (!user.paid_until || user.membership_status !== 'active') return false
      const paidUntil = new Date(user.paid_until)
      const sevenDaysLater = new Date()
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
      return paidUntil <= sevenDaysLater && paidUntil > new Date()
    }
        if (filter === 'pending') {
          return !user.is_approved || user.membership_status === 'pending'
        }
        // deleted 필터 제거 (삭제된 사용자는 목록에 표시되지 않음)
        return false
  })

  // 고유한 본부 목록 추출
  const uniqueDepartments = Array.from(
    new Set(users.map(u => u.department_id).filter(Boolean))
  ).map(id => {
    const user = users.find(u => u.department_id === id)
    return { id: id!, name: user?.department_name || id! }
  })

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      {/* 필터 및 검색 */}
      <div className="mb-6 space-y-4">
        {/* 본부/역할 필터 및 검색 */}
        <div className="flex flex-col md:flex-row gap-3">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="">전체 본부</option>
            {uniqueDepartments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="">전체 역할</option>
            <option value="admin">관리자</option>
            <option value="department_head">본부장</option>
            <option value="branch_head">지사장</option>
            <option value="team_leader">팀장</option>
            <option value="fc">FC</option>
          </select>

          <input
            type="text"
            placeholder="아이디, 이름, 전화번호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
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
                  본부
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  역할
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
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
                {filteredUsers.map((user) => {
                return (
                  <tr 
                  key={user.id} 
                  className="hover:bg-blue-50 transition-colors"
                >
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
                    {(() => {
                      // 디버깅: test 사용자 확인
                      if (user.username === 'test') {
                        console.log('[UsersTable] test 사용자 본부 정보:', {
                          department_id: user.department_id,
                          department_name: user.department_name,
                          user: user
                        })
                      }
                      
                      // department_id가 있으면 본부명 찾기 (우선순위 1)
                      if (user.department_id) {
                        const dept = DEPARTMENTS.find(d => d.id === user.department_id)
                        if (dept) {
                          if (user.username === 'test') {
                            console.log('[UsersTable] test 사용자 - department_id로 찾은 본부:', dept.name)
                          }
                          return dept.name
                        } else {
                          if (user.username === 'test') {
                            console.log('[UsersTable] test 사용자 - department_id로 본부를 찾을 수 없음:', user.department_id)
                          }
                        }
                      }
                      // department_name이 있으면 사용 (우선순위 2)
                      if (user.department_name) {
                        // 142 본부를 141 본부로 표시 (하위 호환성)
                        const deptName = user.department_name.replace('142 본부', '141 본부').replace('142본부', '141 본부')
                        if (user.username === 'test') {
                          console.log('[UsersTable] test 사용자 - department_name 사용:', deptName)
                        }
                        return deptName
                      }
                      // 둘 다 없으면 "-" 표시
                      if (user.username === 'test') {
                        console.log('[UsersTable] test 사용자 - 본부 정보 없음')
                      }
                      return <span className="text-gray-400">-</span>
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <RoleSelector
                      userId={user.id}
                      currentRole={user.role}
                      currentDepartmentId={user.department_id}
                      onUpdate={handleUpdate}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatPhoneNumber(user.phone)}
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <MembershipActions
                      userId={user.id}
                      currentStatus={user.membership_status}
                      paidUntil={user.paid_until}
                      role={user.role || ''}
                      username={user.username}
                      onUpdate={handleUpdate}
                    />
                  </td>
                </tr>
              )})}
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

