import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shield, LogOut, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import FCStatsTable from './FCStatsTable'

export default async function FCStatsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // FC 권한 확인 (fc 또는 user 역할)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'fc') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-[#1e293b] shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold text-white">
              내 통계
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
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
            <div className="bg-green-100 p-3 rounded-xl">
              <BarChart3 className="w-6 h-6 text-green-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {profile.full_name || '내'} 활동 통계
              </h2>
              <p className="text-sm text-gray-500">
                내가 작성한 글 수와 Q&A 수를 확인하세요. (토큰 정보는 관리자만 조회 가능합니다)
              </p>
            </div>
          </div>

          <FCStatsTable />
        </div>
      </main>
    </div>
  )
}

