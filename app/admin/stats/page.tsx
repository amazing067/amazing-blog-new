import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shield, LogOut, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import StatsTable from './StatsTable'

export default async function AdminStatsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 관리자 권한 확인 (SERVICE_ROLE_KEY 사용 시도 - RLS 우회)
  let profile: { id: string; role: string } | null = null
  let profileError: any = null

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

        const { data: profileData, error: err } = await adminClient
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .single()

        if (!err && profileData) {
          profile = profileData
        } else {
          profileError = err
        }
      }
    }

    // SERVICE_ROLE_KEY가 없거나 실패한 경우 일반 클라이언트 사용
    if (!profile) {
      const { data: profileData, error: err } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single()

      if (err) {
        profileError = err
      } else if (profileData) {
        profile = profileData
      }
    }
  } catch (error: any) {
    console.error('프로필 조회 중 오류:', error)
    profileError = error
  }

  if (!profile || profile.role !== 'admin') {
    console.error('관리자 권한 없음 또는 프로필 조회 실패:', { profile, profileError })
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-[#1e293b] shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold text-white">관리자 통계</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-lg hover:bg-white/20 transition-colors"
            >
              대시보드
            </Link>
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-xl">
              <BarChart3 className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">회원 활동/토큰 통계</h2>
              <p className="text-sm text-gray-500">글 수, Q&A 수, 토큰 사용량을 한눈에 확인하세요.</p>
            </div>
          </div>

          <StatsTable />
        </div>
      </main>
    </div>
  )
}


