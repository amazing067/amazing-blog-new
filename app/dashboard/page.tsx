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

  // 프로필 정보 가져오기
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return <BlogGenerator profile={profile} />
}

