import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shield, LogOut, UserCheck, UserX, Sparkles, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import ApprovalButton from './ApprovalButton'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 관리자 권한 확인 (필요한 필드만 선택)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  // 병렬로 쿼리 실행 (성능 최적화)
  const [pendingResult, approvedResult] = await Promise.all([
    // 승인 대기 중인 사용자 목록 (필요한 필드만 선택)
    supabase
      .from('profiles')
      .select('id, username, full_name, email, created_at, is_approved')
      .eq('is_approved', false)
      .order('created_at', { ascending: false }),
    // 승인된 사용자 목록 (필요한 필드만 선택)
    supabase
      .from('profiles')
      .select('id, username, full_name, email, created_at, is_approved')
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
  ])

  const pendingUsers = pendingResult.data
  const approvedUsers = approvedResult.data

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-[#1e293b] shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold text-white">어메이징사업부 (관리자)</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/users"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              회원관리
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          
          {/* 메인 카드 - 블로그 AI 생성 */}
          <Link
            href="/dashboard"
            className="block bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-3xl shadow-2xl p-12 text-white hover:shadow-3xl transition-all transform hover:scale-[1.02] relative overflow-hidden group"
          >
            {/* 배경 장식 */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-48 translate-x-48 group-hover:scale-110 transition-transform"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-32 -translate-x-32 group-hover:scale-110 transition-transform"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
                  <Sparkles className="w-12 h-12 text-yellow-300" />
                </div>
                <div>
                  <h2 className="text-4xl font-black mb-2">보험 블로그 AI 생성기</h2>
                  <p className="text-blue-100 text-lg">
                    30초 만에 전문가급 블로그 글 자동 작성
                  </p>
                </div>
              </div>

              {/* 기능 소개 */}
              <div className="grid grid-cols-3 gap-4 mt-8">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-3xl mb-2">📝</div>
                  <div className="font-semibold">고퀄리티 콘텐츠</div>
                  <div className="text-xs text-blue-100 mt-1">SEO 최적화</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-3xl mb-2">⚡</div>
                  <div className="font-semibold">빠른 생성</div>
                  <div className="text-xs text-blue-100 mt-1">평균 30초</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-3xl mb-2">🎨</div>
                  <div className="font-semibold">맞춤 디자인</div>
                  <div className="text-xs text-blue-100 mt-1">반응형 HTML</div>
                </div>
              </div>

              {/* CTA */}
              <div className="mt-8 flex items-center gap-3">
                <div className="px-6 py-3 bg-white text-blue-600 font-bold rounded-xl inline-flex items-center gap-2 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-5 h-5" />
                  지금 시작하기 →
                </div>
                <div className="text-sm text-blue-100">
                  이미 준비된 템플릿으로 빠르게 시작하세요
                </div>
              </div>
            </div>
          </Link>

          {/* 통계 카드 */}
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 p-3 rounded-xl">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-800">
                    {(pendingUsers?.length || 0) + (approvedUsers?.length || 0)}
                  </div>
                  <div className="text-sm text-gray-500">전체 회원</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-yellow-500">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-yellow-100 p-3 rounded-xl">
                  <UserX className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-800">
                    {pendingUsers?.length || 0}
                  </div>
                  <div className="text-sm text-gray-500">승인 대기</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-green-500">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 p-3 rounded-xl">
                  <UserCheck className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-800">
                    {approvedUsers?.length || 0}
                  </div>
                  <div className="text-sm text-gray-500">승인 완료</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

