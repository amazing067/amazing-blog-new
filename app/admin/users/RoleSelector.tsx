'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Shield, Crown, Building2, MapPin, Users, User } from 'lucide-react'
import { ROLES, ROLE_LABELS, ASSIGNABLE_ROLES } from '@/lib/constants/roles'
import { DEPARTMENTS } from '@/lib/constants/departments'

interface RoleSelectorProps {
  userId: string
  currentRole: string | null
  currentDepartmentId: string | null
  onUpdate: () => void
}

export default function RoleSelector({
  userId,
  currentRole,
  currentDepartmentId,
  onUpdate
}: RoleSelectorProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  
  // currentRole이 'user'이거나 null이면 'fc'로 설정, 그 외에는 현재 역할 유지
  const normalizedCurrentRole = (currentRole === 'user' || !currentRole) ? ROLES.FC : currentRole
  const [selectedRole, setSelectedRole] = useState<string>(normalizedCurrentRole)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(currentDepartmentId || '')

  // 관리자는 역할 변경 불가
  const isAdmin = normalizedCurrentRole === ROLES.ADMIN

  // 역할별 색상 및 아이콘 설정
  const getRoleStyles = (role: string) => {
    switch (role) {
      case ROLES.ADMIN:
        return {
          bgColor: 'bg-amber-100',
          textColor: 'text-amber-800',
          hoverColor: 'hover:bg-amber-200',
          icon: Crown,
          iconColor: 'text-amber-600'
        }
      case ROLES.DEPARTMENT_HEAD:
        return {
          bgColor: 'bg-amber-100',
          textColor: 'text-amber-800',
          hoverColor: 'hover:bg-amber-200',
          icon: Crown,
          iconColor: 'text-amber-600'
        }
      case ROLES.BRANCH_HEAD:
        return {
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          hoverColor: 'hover:bg-green-200',
          icon: MapPin,
          iconColor: 'text-green-600'
        }
      case ROLES.TEAM_LEADER:
        return {
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-800',
          hoverColor: 'hover:bg-purple-200',
          icon: Users,
          iconColor: 'text-purple-600'
        }
      case ROLES.FC:
      default:
        return {
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-800',
          hoverColor: 'hover:bg-orange-200',
          icon: User,
          iconColor: 'text-orange-600'
        }
    }
  }

  const currentRoleStyles = getRoleStyles(normalizedCurrentRole)
  const RoleIcon = currentRoleStyles.icon

  const handleUpdate = async () => {
    // 관리자는 역할 변경 불가
    if (isAdmin) {
      alert('관리자의 역할은 변경할 수 없습니다')
      return
    }

    if (!selectedRole) {
      alert('역할을 선택해주세요')
      return
    }

    // 본부장, 지사장, 팀장은 본부 선택 필수
    if ([ROLES.DEPARTMENT_HEAD, ROLES.BRANCH_HEAD, ROLES.TEAM_LEADER].includes(selectedRole as any) && !selectedDepartmentId) {
      alert('본부장, 지사장, 팀장 역할은 본부 선택이 필수입니다')
      return
    }

    // 관리자 역할 선택 시 290본부로 자동 설정
    if (selectedRole === ROLES.ADMIN) {
      setSelectedDepartmentId('290')
    }

    setIsLoading(true)

    try {
      // selectedRole이 'user'인 경우 'fc'로 변환 (안전장치)
      const finalRole = selectedRole === 'user' ? ROLES.FC : selectedRole
      
      const payload = {
        userId,
        role: finalRole,
        department_id: selectedDepartmentId || null,
        department_name: selectedDepartmentId ? DEPARTMENTS.find(d => d.id === selectedDepartmentId)?.name || null : null,
      }
      
      console.log('[RoleSelector] 역할 변경 요청:', { 
        originalSelectedRole: selectedRole,
        finalRole,
        payload 
      })
      
      const response = await fetch('/api/admin/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '역할 변경 실패')
      }

      alert('역할이 변경되었습니다')
      setShowModal(false)
      onUpdate()
    } catch (error: any) {
      console.error('Role update error:', error)
      alert(`오류: ${error.message || '역할 변경 중 오류가 발생했습니다'}`)
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <>
      {isAdmin ? (
        <span className={`px-3 py-1.5 text-xs ${currentRoleStyles.bgColor} ${currentRoleStyles.textColor} rounded-lg flex items-center gap-1 cursor-not-allowed opacity-75`}>
          <RoleIcon className={`w-3 h-3 ${currentRoleStyles.iconColor}`} />
          {ROLE_LABELS[normalizedCurrentRole as keyof typeof ROLE_LABELS] || normalizedCurrentRole || 'FC'}
        </span>
      ) : (
        <button
          onClick={() => {
            // 모달 열 때 selectedRole을 현재 역할로 초기화 (user는 fc로 변환)
            setSelectedRole(normalizedCurrentRole)
            setShowModal(true)
          }}
          className={`px-3 py-1.5 text-xs ${currentRoleStyles.bgColor} ${currentRoleStyles.textColor} rounded-lg ${currentRoleStyles.hoverColor} transition-colors flex items-center gap-1`}
          title="역할 변경"
        >
          <RoleIcon className={`w-3 h-3 ${currentRoleStyles.iconColor}`} />
          {ROLE_LABELS[normalizedCurrentRole as keyof typeof ROLE_LABELS] || normalizedCurrentRole || 'FC'}
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              역할 변경
            </h3>

            <div className="space-y-4">
              {/* 역할 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  역할 *
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => {
                    setSelectedRole(e.target.value)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 본부 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  본부 *
                </label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => {
                    setSelectedDepartmentId(e.target.value)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">본부를 선택하세요</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleUpdate}
                disabled={isLoading || !selectedDepartmentId}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    변경 중...
                  </>
                ) : (
                  '변경하기'
                )}
              </button>
              <button
                onClick={() => {
                  setShowModal(false)
                  setSelectedRole(normalizedCurrentRole)
                  setSelectedDepartmentId(currentDepartmentId || '')
                }}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 font-semibold"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

