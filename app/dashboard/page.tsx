import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BlogGenerator from './BlogGenerator'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 프로필 정보 가져오기 (필요한 필드만 선택 - 성능 최적화)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, full_name, email, phone, membership_status, is_approved, role, created_at')
    .eq('id', user.id)
    .single()

  // 정지 상태면 안내 메시지 (pending도 정지로 처리)
  if (profile?.membership_status === 'pending' || profile?.membership_status === 'suspended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-gray-200 p-8 text-center space-y-4">
          <div className="text-5xl">🚫</div>
          <h1 className="text-2xl font-bold text-gray-800">정지 상태입니다</h1>
          <p className="text-gray-600">
            계정이 정지되었습니다.
            <br />
            관리자에게 문의해주세요.
          </p>
          <form action="/api/auth/signout" method="post" className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-gray-800 text-white font-semibold rounded-lg hover:bg-black transition-colors"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <BlogGenerator profile={profile} />
}

