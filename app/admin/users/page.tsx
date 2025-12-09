import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shield, LogOut, UserCheck, UserX, ArrowLeft, CreditCard, AlertCircle, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import ApprovalButton from '../dashboard/ApprovalButton'
import MembershipActions from './MembershipActions'
import UsersTable from './UsersTable'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 관리자 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  // 모든 사용자 목록 (상태별로 필터링)
  const { data: allUsers } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // 상태별 통계
  const activeUsers = allUsers?.filter(u => u.membership_status === 'active') || []
  const pendingUsers = allUsers?.filter(u => u.membership_status === 'pending' || u.membership_status === 'suspended' || (!u.membership_status && !u.is_approved)) || []
  const deletedUsers = allUsers?.filter(u => u.membership_status === 'deleted') || []

  // 결제 만료 임박 사용자 (7일 이내)
  const expiringSoon = allUsers?.filter(u => {
    if (!u.paid_until || u.membership_status !== 'active') return false
    const paidUntil = new Date(u.paid_until)
    const sevenDaysLater = new Date()
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
    return paidUntil <= sevenDaysLater && paidUntil > new Date()
  }) || []

  // 결제 만료된 사용자 (승인일 기준 1개월 지난 회원)
  const expiredUsers = allUsers?.filter(u => {
    if (!u.paid_until || u.membership_status === 'deleted') return false
    const paidUntil = new Date(u.paid_until)
    return paidUntil < new Date()
  }) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-[#1e293b] shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-lg hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              대시보드
            </Link>
            <Link
              href="/admin/stats"
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              통계
            </Link>
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-white" />
              <h1 className="text-2xl font-bold text-white">회원 관리</h1>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-white text-[#1e293b] font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          
          {/* 통계 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-green-500">
              <div className="text-2xl font-bold text-gray-800">{activeUsers.length}</div>
              <div className="text-sm text-gray-500 mt-1">활성 회원</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-yellow-500">
              <div className="text-2xl font-bold text-gray-800">{pendingUsers.length}</div>
              <div className="text-sm text-gray-500 mt-1">대기/유예</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-orange-500">
              <div className="text-2xl font-bold text-orange-600">{expiringSoon.length}</div>
              <div className="text-sm text-gray-500 mt-1">만료 임박 (7일)</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-gray-500">
              <div className="text-2xl font-bold text-gray-800">{deletedUsers.length}</div>
              <div className="text-sm text-gray-500 mt-1">삭제됨</div>
            </div>
          </div>

          {/* 결제 만료 경고 */}
          {expiredUsers.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                <AlertCircle className="w-5 h-5" />
                ⚠️ 결제 만료된 회원: {expiredUsers.length}명
              </div>
              <p className="text-sm text-red-700">
                승인일(결제 확인일) 기준 1개월이 지난 회원입니다. 입금 확인 후 테이블에서 만료일을 직접 수정하세요.
              </p>
            </div>
          )}

          {/* 결제 만료 임박 경고 */}
          {expiringSoon.length > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-orange-800 font-semibold mb-2">
                <AlertCircle className="w-5 h-5" />
                ⏰ 결제 만료 임박: {expiringSoon.length}명 (7일 이내)
              </div>
              <p className="text-sm text-orange-700">
                만료일이 7일 이내로 다가온 회원입니다. 입금 확인 후 만료일을 수기로 연장해 주세요.
              </p>
            </div>
          )}

          {/* 회원 목록 테이블 */}
          <UsersTable users={allUsers || []} />
        </div>
      </main>
    </div>
  )
}
