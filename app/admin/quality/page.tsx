import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shield, LogOut, BarChart3, ClipboardCheck } from 'lucide-react'
import Link from 'next/link'
import QualityKpiPanel from './QualityKpiPanel'

export default async function AdminQualityPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let profile: { id: string; role: string } | null = null
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
        const { data: profileData, error } = await adminClient
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .single()
        if (!error && profileData) profile = profileData
      }
    }
    if (!profile) {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single()
      if (!error && profileData) profile = profileData
    }
  } catch (e) {
    console.error('프로필 조회 오류:', e)
  }

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-[#1e293b] shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold text-white">품질 · 실패 · KPI 관리</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-lg hover:bg-white/20 transition-colors"
            >
              대시보드
            </Link>
            <Link
              href="/admin/stats"
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              통계
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
            <div className="bg-amber-100 p-3 rounded-xl">
              <Shield className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">품질 게이트 · 실패 대응 · KPI</h2>
              <p className="text-sm text-gray-500">
                품질 경고 이력, KPI 요약, 실패 케이스 사전을 한 화면에서 확인하세요.
              </p>
            </div>
          </div>

          <QualityKpiPanel />
        </div>
      </main>
    </div>
  )
}
