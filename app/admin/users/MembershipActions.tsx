'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { DEPARTMENTS_WITHOUT_EXPIRY } from '@/lib/constants/departments'

interface MembershipActionsProps {
  userId: string
  currentStatus: 'active' | 'pending' | 'suspended' | 'deleted' | null
  paidUntil: string | null
  departmentId?: string | null
  role?: string
  username?: string
  onUpdate: () => void
}

export default function MembershipActions({ userId, currentStatus, paidUntil, departmentId, role, username, onUpdate }: MembershipActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  const isSuperAdmin = role === 'admin' || username === 'amazing'
  const isNoExpiryDepartment = !!departmentId && DEPARTMENTS_WITHOUT_EXPIRY.includes(departmentId as any)

  // 승인 처리 (ApprovalButton 로직 통합)
  const handleApprove = async () => {
    if (isSuperAdmin) {
      alert('이 계정은 항상 활성 상태이며 변경할 수 없습니다.')
      return
    }
    if (!confirm('이 사용자를 승인하시겠습니까?\n승인일 기준으로 1개월 후까지 사용 가능합니다.')) {
      return
    }

    setIsLoading(true)
    try {
      // 승인일 기준으로 1개월 후 만료일 계산
      const paidUntil = new Date()
      paidUntil.setMonth(paidUntil.getMonth() + 1)

      const response = await fetch('/api/admin/update-membership-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          status: 'active',
          note: '관리자 승인'
        })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || '승인 실패')
      }

      // 결제 정보도 함께 업데이트
      await fetch('/api/admin/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          paidUntil: paidUntil.toISOString(),
          paymentNote: '승인 시 자동 설정'
        })
      })

      alert(`사용자가 승인되었습니다.\n결제 만료일: ${paidUntil.toLocaleDateString('ko-KR')}`)
      setTimeout(() => {
        onUpdate()
      }, 500)
    } catch (error: any) {
      console.error('승인 오류:', error)
      alert(`오류: ${error.message || '승인 중 오류가 발생했습니다'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (status: 'active' | 'suspended' | 'deleted', note?: string) => {
    if (isSuperAdmin) {
      alert('이 계정은 항상 활성 상태이며 변경할 수 없습니다.')
      return
    }
    if (!confirm(`정말로 상태를 "${getStatusLabel(status)}"로 변경하시겠습니까?`)) {
      return
    }

    setIsLoading(true)
    try {
      console.log('[상태 변경] 요청 시작:', { userId, status, note })
      
      const response = await fetch('/api/admin/update-membership-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status, note })
      })

      let data
      try {
        const text = await response.text()
        data = text ? JSON.parse(text) : {}
      } catch (parseError) {
        console.error('[상태 변경] JSON 파싱 오류:', parseError)
        throw new Error('서버 응답을 파싱할 수 없습니다.')
      }

      if (!response.ok) {
        const errorMessage = data?.error || data?.message || `상태 변경 실패 (${response.status})`
        throw new Error(errorMessage)
      }

      alert(`상태가 "${getStatusLabel(status)}"로 변경되었습니다`)
      setTimeout(() => {
        onUpdate()
      }, 500)
    } catch (error: any) {
      console.error('[상태 변경] 오류 발생:', error)
      const errorMessage = error?.message || '상태 변경 중 오류가 발생했습니다'
      alert(`오류: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePaymentConfirm = () => {
    if (isSuperAdmin) {
      alert('이 계정은 결제가 필요 없습니다.')
      return
    }
    if (!isNoExpiryDepartment && !paymentDate) {
      alert('결제 만료일을 입력해주세요')
      return
    }

    setIsLoading(true)
    const payload: any = {
      userId,
      paymentNote: paymentNote || null
    }

    if (!isNoExpiryDepartment) {
      const paidUntilDate = new Date(paymentDate)
      payload.paidUntil = paidUntilDate.toISOString()
    }

    fetch('/api/admin/confirm-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || '결제 확인 실패')
        }
        alert(
          isNoExpiryDepartment
            ? '결제가 확인되었습니다(만료일 없음 처리).'
            : `결제가 확인되었습니다.\n만료일: ${new Date(paymentDate).toLocaleDateString('ko-KR')}`,
        )
        setShowPaymentModal(false)
        setPaymentDate('')
        setPaymentNote('')
        onUpdate()
      })
      .catch((err: any) => {
        alert(`오류: ${err.message || err}`)
      })
      .finally(() => {
        setIsLoading(false)
      })
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

  // 결제 만료일 계산 (현재 날짜 기준 1개월 후)
  const getDefaultPaymentDate = () => {
    const date = new Date()
    date.setMonth(date.getMonth() + 1)
    return date.toISOString().split('T')[0]
  }

  if (isSuperAdmin) {
    return (
      <span className="text-xs text-gray-500">(관리 제외)</span>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* 승인 버튼 - pending일 때만 표시 */}
        {currentStatus === 'pending' && (
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '처리 중...' : '승인'}
          </button>
        )}

        {/* 정지 버튼 - active일 때만 표시 */}
        {currentStatus === 'active' && (
          <button
            onClick={() => handleStatusChange('suspended', '관리자 수동 정지')}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '처리 중...' : '정지'}
          </button>
        )}

        {/* 활성화 버튼 - suspended일 때만 표시 */}
        {currentStatus === 'suspended' && (
          <button
            onClick={() => handleStatusChange('active')}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '처리 중...' : '승인'}
          </button>
        )}

        {/* 삭제 버튼 - deleted가 아닐 때만 표시 */}
        {currentStatus !== 'deleted' && (
          <button
            onClick={() => handleStatusChange('deleted')}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '처리 중...' : '삭제'}
          </button>
        )}

        {/* 결제 확인 버튼 - 항상 표시 */}
        <button
          onClick={() => {
          setPaymentDate(isNoExpiryDepartment ? '' : getDefaultPaymentDate())
            setShowPaymentModal(true)
          }}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          결제확인
        </button>
      </div>

      {/* 결제 확인 모달 */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              결제 확인
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  결제 만료일 (기본값: 오늘 기준 1개월 후)
                </label>
                {isNoExpiryDepartment ? (
                  <div className="text-sm text-gray-600">
                    290/067/292 본부는 만료일이 필요 없습니다. (자동 처리)
                  </div>
                ) : (
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  메모 (선택사항)
                </label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="결제 관련 메모를 입력하세요"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handlePaymentConfirm}
                disabled={!isNoExpiryDepartment && !paymentDate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                확인 (안내 표시)
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setPaymentDate('')
                  setPaymentNote('')
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

