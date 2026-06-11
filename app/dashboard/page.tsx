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

  // 프로필 정보 가져오기 (SERVICE_ROLE_KEY 사용 시도 - RLS 우회)
  let profile: any = null
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
          .select('id, username, full_name, phone, membership_status, is_approved, role, created_at')
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
        .select('id, username, full_name, phone, membership_status, is_approved, role, created_at')
        .eq('id', user.id)
        .single()

      if (err) {
        profileError = err
      } else {
        profile = profileData
      }
    }
  } catch (error: any) {
    console.error('프로필 조회 중 오류:', error)
    profileError = error
  }

  // 프로필 조회 실패 시 오류 표시
  if (profileError || !profile) {
    console.error('프로필 조회 실패:', profileError)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-gray-200 p-8 text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800">프로필 조회 실패</h1>
          <p className="text-gray-600">
            프로필 정보를 가져올 수 없습니다.
            <br />
            RLS 정책을 확인하거나 관리자에게 문의해주세요.
          </p>
          <p className="text-xs text-red-600 mt-2">
            {profileError?.message || '알 수 없는 오류'}
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

  // 콘텐츠 운영자는 FC용 대시보드(블로그 생성기)가 아니라 콘텐츠 허브로 보낸다.
  // 이렇게 해야 처음 로그인 외에도(뒤로가기·북마크·로고 클릭 등) 항상 콘텐츠로 진입된다.
  if (profile?.role === 'content_editor') {
    redirect('/admin/content/recruit')
  }

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

