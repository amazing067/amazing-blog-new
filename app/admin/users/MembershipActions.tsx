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

      console.log('[상태 변경] API 응답 상태:', response.status, response.statusText)
      console.log('[상태 변경] API 응답 헤더:', Object.fromEntries(response.headers.entries()))

      let data
      try {
        const text = await response.text()
        console.log('[상태 변경] API 응답 원본 텍스트:', text)
        data = text ? JSON.parse(text) : {}
      } catch (parseError) {
        console.error('[상태 변경] JSON 파싱 오류:', parseError)
        throw new Error('서버 응답을 파싱할 수 없습니다.')
      }

      console.log('[상태 변경] API 응답 데이터:', data)

      if (!response.ok) {
        console.error('[상태 변경] API 오류:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
          error: data?.error,
          errorCode: data?.errorCode,
          details: data?.details
        })
        
        const errorMessage = data?.error || data?.message || `상태 변경 실패 (${response.status}: ${response.statusText})`
        throw new Error(errorMessage)
      }

      console.log('[상태 변경] 성공:', { userId, status, data })
      
      // 업데이트된 데이터 확인
      if (data.data) {
        console.log('[상태 변경] 업데이트된 데이터:', data.data)
        console.log('[상태 변경] 실제 상태:', data.data.membership_status)
      }
      
      // 성공 메시지 표시
      alert(`상태가 "${getStatusLabel(status)}"로 변경되었습니다`)
      
      // 상태 업데이트를 즉시 반영 (약간의 지연을 두어 DB 업데이트 완료 대기)
      // DB 업데이트가 완전히 반영되도록 충분한 시간 대기
      setTimeout(() => {
        console.log('[상태 변경] 페이지 새로고침 시작')
        onUpdate()
      }, 800)
    } catch (error: any) {
      console.error('[상태 변경] 오류 발생:', error)
      console.error('[상태 변경] 오류 상세:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        cause: error?.cause
      })
      
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

          {!isSuperAdmin && currentStatus !== 'suspended' && currentStatus !== 'deleted' && (
            <button
              onClick={() => handleStatusChange('suspended', '관리자 수동 정지')}
              disabled={isLoading}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              title="정지"
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

