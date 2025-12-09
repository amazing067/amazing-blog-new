'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Pause, Trash2, CreditCard, Calendar } from 'lucide-react'

interface MembershipActionsProps {
  userId: string
  currentStatus: 'active' | 'pending' | 'suspended' | 'deleted' | null
  paidUntil: string | null
  role?: string
  username?: string
  onUpdate: () => void
}

export default function MembershipActions({ userId, currentStatus, paidUntil, role, username, onUpdate }: MembershipActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  const isSuperAdmin = role === 'admin' || username === 'amazing'

  const handleStatusChange = async (status: 'active' | 'pending' | 'deleted', note?: string) => {
    if (isSuperAdmin) {
      alert('이 계정은 항상 활성 상태이며 변경할 수 없습니다.')
      return
    }
    if (!confirm(`정말로 상태를 "${getStatusLabel(status)}"로 변경하시겠습니까?`)) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/update-membership-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status, note })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '상태 변경 실패')
      }

      alert('상태가 변경되었습니다')
      onUpdate()
    } catch (error: any) {
      alert(`오류: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePaymentConfirm = () => {
    if (isSuperAdmin) {
      alert('이 계정은 결제가 필요 없습니다.')
      return
    }
    if (!paymentDate) {
      alert('결제 만료일을 입력해주세요')
      return
    }

    setIsLoading(true)
    const paidUntilDate = new Date(paymentDate)
    const payload = {
      userId,
      paidUntil: paidUntilDate.toISOString(),
      paymentNote: paymentNote || null
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
        alert(`결제가 확인되었습니다.\n만료일: ${paidUntilDate.toLocaleDateString('ko-KR')}`)
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
      case 'pending': return '대기'
      case 'suspended': return '대기'
      case 'deleted': return '삭제'
      default: return '알 수 없음'
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

  // 결제 만료일 계산 (현재 날짜 기준 1개월 후)
  const getDefaultPaymentDate = () => {
    const date = new Date()
    date.setMonth(date.getMonth() + 1)
    return date.toISOString().split('T')[0]
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* 현재 상태 표시 */}
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(currentStatus)}`}>
          {getStatusLabel(currentStatus)}
        </span>

        {isSuperAdmin && (
          <span className="text-[10px] text-gray-500">(관리 제외)</span>
        )}

        {/* 결제 만료일 표시 */}
        {paidUntil && (
          <span className="text-xs text-gray-500">
            만료: {new Date(paidUntil).toLocaleDateString('ko-KR')}
          </span>
        )}

        {/* 액션 버튼들 */}
        <div className="flex items-center gap-1 ml-2">
          {!isSuperAdmin && currentStatus !== 'active' && (
            <button
              onClick={() => handleStatusChange('active')}
              disabled={isLoading}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
              title="활성화"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}

          {!isSuperAdmin && currentStatus !== 'pending' && currentStatus !== 'deleted' && (
            <button
              onClick={() => handleStatusChange('pending', '관리자 수동 대기')}
              disabled={isLoading}
              className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded transition-colors disabled:opacity-50"
              title="대기"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}

          {!isSuperAdmin && currentStatus !== 'deleted' && (
            <button
              onClick={() => {
                const note = prompt('삭제 사유를 입력해주세요:')
                if (note !== null) {
                  handleStatusChange('deleted', note)
                }
              }}
              disabled={isLoading}
              className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* 결제 확인 버튼 */}
          {!isSuperAdmin && (
            <button
              onClick={() => {
                setPaymentDate(getDefaultPaymentDate())
                setShowPaymentModal(true)
              }}
              disabled={isLoading}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
              title="결제 확인"
            >
              <CreditCard className="w-4 h-4" />
            </button>
          )}
        </div>
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
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
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
                disabled={!paymentDate}
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

