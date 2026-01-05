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
  const [internalFilter, setInternalFilter] = useState<'all' | 'active' | 'suspended' | 'deleted' | 'expiring' | 'pending'>(initialFilter as any)
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string>('')

  // initialFilter가 변경되면 internalFilter도 업데이트 (동기화)
  useEffect(() => {
    setInternalFilter(initialFilter as any)
  }, [initialFilter])
  
  // 실제 사용할 필터 값 (initialFilter 우선 - URL 파라미터가 있으면 사용, 없으면 internalFilter 사용)
  const activeFilter = initialFilter || internalFilter

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
      case 'pending': return '승인대기'
      case 'suspended': return '정지'
      case 'deleted': return '삭제'
      default: return '승인대기'
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-300'
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'suspended': return 'bg-red-100 text-red-800 border-red-300'
      case 'deleted': return 'bg-gray-100 text-gray-800 border-gray-300'
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }
  }


  // 필터링된 사용자 목록
  const filteredUsers = users.filter(user => {
    // 디버깅: 필터 적용 확인 (첫 번째 사용자만)
    if (users.indexOf(user) === 0 && process.env.NODE_ENV === 'development') {
      console.log('[UsersTable] 필터 적용 확인:', {
        activeFilter,
        initialFilter,
        internalFilter,
        userStatus: user.membership_status,
        isApproved: user.is_approved,
        username: user.username,
        totalUsers: users.length
      })
    }
    
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

    // 상태 필터 (activeFilter 사용)
    if (activeFilter === 'all') return true
    
    if (activeFilter === 'active') {
      // 활성 사용자만
      return user.membership_status === 'active'
    }
    
    if (activeFilter === 'suspended') {
      // 정지된 사용자만 (suspended 상태만)
      const isSuspended = user.membership_status === 'suspended'
      if (users.indexOf(user) === 0 && process.env.NODE_ENV === 'development') {
        console.log('[UsersTable] suspended 필터 확인:', {
          username: user.username,
          membership_status: user.membership_status,
          isSuspended
        })
      }
      return isSuspended
    }
    
    if (activeFilter === 'pending') {
      // 승인 대기 사용자만 (pending 상태 또는 is_approved가 false이고 active/suspended가 아닌 경우)
      const isPending = user.membership_status === 'pending' || 
                       (!user.is_approved && 
                        user.membership_status !== 'active' && 
                        user.membership_status !== 'suspended' &&
                        user.membership_status !== 'deleted')
      return isPending
    }
    
    if (activeFilter === 'expiring') {
      // 결제 만료 임박 (활성 상태이고 7일 이내 만료)
      if (!user.paid_until || user.membership_status !== 'active') return false
      const paidUntil = new Date(user.paid_until)
      const sevenDaysLater = new Date()
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
      return paidUntil <= sevenDaysLater && paidUntil > new Date()
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
                    {(() => {
                      // 디버깅: paid_until 값 확인 (명확한 로그)
                      const paidUntilValue = user.paid_until
                      const hasPayment = !!paidUntilValue && paidUntilValue !== null && paidUntilValue !== undefined && paidUntilValue !== ''
                      
                      // 첫 번째 사용자만 상세 로그 출력 (너무 많은 로그 방지)
                      if (process.env.NODE_ENV === 'development' && user.username === 'test') {
                        console.log(`[UsersTable] ${user.username} 결제 만료일 상세:`, {
                          username: user.username,
                          paid_until: paidUntilValue,
                          paid_until_type: typeof paidUntilValue,
                          paid_until_string: String(paidUntilValue),
                          paid_until_json: JSON.stringify(paidUntilValue),
                          isNull: paidUntilValue === null,
                          isUndefined: paidUntilValue === undefined,
                          isEmpty: paidUntilValue === '',
                          hasPayment: hasPayment
                        })
                      }

                      // null, undefined, 빈 문자열 체크
                      if (!hasPayment) {
                        return <span className="text-gray-400">-</span>
                      }

                      try {
                        // ISO 형식의 날짜 문자열을 Date 객체로 변환
                        // 예: "2026-01-09T00:00:00+00:00" 또는 "2026-01-09T00:00:00.000Z"
                        const paidUntilDate = new Date(paidUntilValue)
                        
                        // 유효한 날짜인지 확인
                        if (isNaN(paidUntilDate.getTime())) {
                          if (user.username === 'coreabos' || process.env.NODE_ENV === 'development') {
                            console.warn('[UsersTable] 유효하지 않은 날짜:', {
                              username: user.username,
                              paid_until: paidUntilValue,
                              dateObject: paidUntilDate
                            })
                          }
                          return <span className="text-gray-400">-</span>
                        }

                        const now = new Date()
                        const isExpired = paidUntilDate < now
                        
                        // 날짜 포맷: 2026. 1. 9.
                        const formattedDate = paidUntilDate.toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric'
                        })

                        return (
                          <div>
                            <div className={isExpired ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                              {formattedDate}
                            </div>
                            {isExpired && (
                              <div className="text-xs text-red-500 mt-1">만료됨</div>
                            )}
                          </div>
                        )
                      } catch (error) {
                        if (user.username === 'coreabos' || process.env.NODE_ENV === 'development') {
                          console.error('[UsersTable] 날짜 파싱 오류:', {
                            username: user.username,
                            error: error,
                            paid_until: paidUntilValue,
                            paid_until_type: typeof paidUntilValue
                          })
                        }
                        return <span className="text-gray-400">-</span>
                      }
                    })()}
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

