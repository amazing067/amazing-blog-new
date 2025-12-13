'use client'

import { AlertCircle, CheckCircle, Clock, XCircle, CreditCard } from 'lucide-react'

interface MembershipStatusBannerProps {
  status: 'active' | 'pending' | 'suspended' | 'deleted' | null
  paidUntil: string | null
  gracePeriodUntil: string | null
}

export default function MembershipStatusBanner({ status, paidUntil, gracePeriodUntil }: MembershipStatusBannerProps) {
  // 삭제 상태나 문제 없는 상태면 표시 안 함
  if (status === 'deleted') return null

  const now = new Date()
  let kind: 'ok' | 'warn' | 'error' | 'info' = 'info'
  let text = ''
  let icon: React.ReactNode = <AlertCircle className="w-4 h-4" />

  if (status === 'active') {
    if (!paidUntil) {
      // 결제 정보가 없어도 배너를 표시하지 않음
      return null
    } else {
      const paidDate = new Date(paidUntil)
      const days = Math.ceil((paidDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (days < 0) {
        text = `결제 만료됨 · 만료일 ${paidDate.toLocaleDateString('ko-KR')}`
        kind = 'error'
        icon = <XCircle className="w-4 h-4 text-red-600" />
      } else if (days <= 7) {
        text = `결제 만료 ${days}일 전 · 만료일 ${paidDate.toLocaleDateString('ko-KR')}`
        kind = 'warn'
        icon = <Clock className="w-4 h-4 text-orange-600" />
      } else {
        return null
      }
    }
  } else if (status === 'pending' || status === 'suspended') {
    text = '대기 상태입니다. 관리자에게 문의해주세요.'
    kind = 'warn'
    icon = <Clock className="w-4 h-4 text-orange-600" />
  } else {
    text = '상태를 확인할 수 없습니다. 관리자에게 문의해주세요.'
    kind = 'info'
    icon = <AlertCircle className="w-4 h-4 text-gray-600" />
  }

  const stylesByKind: Record<'ok' | 'warn' | 'error' | 'info', string> = {
    ok: 'bg-green-50 text-green-800 border-green-200',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs sm:text-sm ${stylesByKind[kind]}`}>
        {icon}
        <span className="truncate">{text}</span>
      </div>
    </div>
  )
}

