'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Check } from 'lucide-react'

export default function ApprovalButton({ userId }: { userId: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleApprove = async () => {
    if (!confirm('이 사용자를 승인하시겠습니까?\n승인일 기준으로 1개월 후까지 사용 가능합니다.')) {
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()

      // 승인일 기준으로 1개월 후 만료일 계산
      const paidUntil = new Date()
      paidUntil.setMonth(paidUntil.getMonth() + 1)

      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_approved: true,
          membership_status: 'active',
          paid_until: paidUntil.toISOString(),
          last_payment_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error

      alert(`사용자가 승인되었습니다.\n결제 만료일: ${paidUntil.toLocaleDateString('ko-KR')}`)
      router.refresh()
    } catch (err) {
      console.error('Approval error:', err)
      alert('승인 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleApprove}
      disabled={isLoading}
      className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:scale-105"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          승인 중...
        </>
      ) : (
        <>
          <Check className="w-4 h-4" />
          ✅ 승인하기
        </>
      )}
    </button>
  )
}

