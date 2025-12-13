import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shield, LogOut, UserCheck, UserX, ArrowLeft, CreditCard, AlertCircle, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import ApprovalButton from '../dashboard/ApprovalButton'
import MembershipActions from './MembershipActions'
import UsersTable from './UsersTable'
import ActionCard from './ActionCard'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 관리자 권한 확인 (SERVICE_ROLE_KEY 사용 시도 - RLS 우회)
  let profile: { id: string; role: string } | null = null

  try {
    // SERVICE_ROLE_KEY 사용 시도
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (rawServiceRoleKey) {
      const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      
      if (serviceRoleKey && serviceRoleKey.length >= 50 && serviceRoleKey.startsWith('eyJ')) {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js')
        const adminClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        ) as any

        const { data: profileData } = await adminClient
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .single()

        if (profileData) {
          profile = profileData
        }
      }
    }

    // SERVICE_ROLE_KEY가 없거나 실패한 경우 일반 클라이언트 사용
    if (!profile) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single()

      profile = profileData
    }
  } catch (error: any) {
    console.error('프로필 조회 중 오류:', error)
  }

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  // 모든 사용자 목록 조회 (SERVICE_ROLE_KEY 사용 - RLS 우회)
  let allUsers: any[] = []
  let usersError: any = null

  try {
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (rawServiceRoleKey) {
      const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      
      if (serviceRoleKey && serviceRoleKey.length >= 50 && serviceRoleKey.startsWith('eyJ')) {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js')
        const adminClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        ) as any

            const { data: usersData, error: err } = await adminClient
              .from('profiles')
              .select('id, username, full_name, phone, is_approved, role, membership_status, paid_until, suspended_at, deleted_at, last_payment_at, grace_period_until, payment_note, department_id, department_name, created_at')
              .is('deleted_at', null) // 삭제된 사용자는 제외
              .order('created_at', { ascending: false })
            
            // 디버깅: test 사용자 확인
            if (usersData) {
              const testUser = usersData.find((u: any) => u.username === 'test')
              if (testUser) {
                console.log('[AdminUsersPage] test 사용자 데이터:', {
                  id: testUser.id,
                  username: testUser.username,
                  department_id: testUser.department_id,
                  department_name: testUser.department_name
                })
              }
            }

        if (!err && usersData) {
          allUsers = usersData
        } else {
          usersError = err
        }
      }
    }

    // SERVICE_ROLE_KEY가 없거나 실패한 경우 일반 클라이언트 사용
    if (allUsers.length === 0 && !usersError) {
        const { data: usersData, error: err } = await supabase
          .from('profiles')
          .select('id, username, full_name, phone, is_approved, role, membership_status, paid_until, suspended_at, deleted_at, last_payment_at, grace_period_until, payment_note, department_id, department_name, created_at')
          .is('deleted_at', null) // 삭제된 사용자는 제외
          .order('created_at', { ascending: false })

      if (!err && usersData) {
        allUsers = usersData
      } else {
        usersError = err
        console.error('회원 목록 조회 실패:', err)
      }
    }
  } catch (error: any) {
    console.error('회원 목록 조회 중 오류:', error)
    usersError = error
  }

  // 통계 계산
  const totalUsers = allUsers.length
  const activeUsers = allUsers.filter(u => u.membership_status === 'active')
  const suspendedUsers = allUsers.filter(u => u.membership_status === 'pending' || u.membership_status === 'suspended' || (!u.membership_status && !u.is_approved))
  const pendingApprovalUsers = allUsers.filter(u => !u.is_approved || u.membership_status === 'pending')
  
  // 결제 만료 임박 사용자 (7일 이내)
  const expiringSoon = allUsers.filter(u => {
    if (!u.paid_until || u.membership_status !== 'active') return false
    const paidUntil = new Date(u.paid_until)
    const sevenDaysLater = new Date()
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
    return paidUntil <= sevenDaysLater && paidUntil > new Date()
  })

  // 결제 만료된 사용자 (승인일 기준 1개월 지난 회원)
  const expiredUsers = allUsers.filter(u => {
    if (!u.paid_until || u.membership_status === 'deleted') return false
    const paidUntil = new Date(u.paid_until)
    return paidUntil < new Date()
  })

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
          
          {/* 오류 메시지 */}
          {usersError && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                <AlertCircle className="w-5 h-5" />
                ⚠️ 회원 목록 조회 오류
              </div>
              <p className="text-sm text-red-700">
                {usersError.message || '회원 목록을 불러올 수 없습니다. RLS 정책 또는 SERVICE_ROLE_KEY를 확인해주세요.'}
              </p>
            </div>
          )}

          {/* 액션 카드 (통계 및 필터) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <ActionCard
              title="전체"
              count={totalUsers}
              color="blue"
              filter="all"
            />
            <ActionCard
              title="활성"
              count={activeUsers.length}
              color="green"
              filter="active"
            />
            <ActionCard
              title="정지"
              count={suspendedUsers.length}
              color="red"
              filter="suspended"
            />
            <ActionCard
              title="만료임박"
              count={expiringSoon.length}
              color="orange"
              filter="expiring"
            />
            <ActionCard
              title="승인대기"
              count={pendingApprovalUsers.length}
              color="yellow"
              filter="pending"
            />
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
          <UsersTable users={allUsers || []} initialFilter="all" />
        </div>
      </main>
    </div>
  )
}
