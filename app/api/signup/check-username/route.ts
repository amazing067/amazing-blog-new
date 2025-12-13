import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json()

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return NextResponse.json({ error: '아이디를 입력해주세요' }, { status: 400 })
    }

    // SERVICE_ROLE_KEY 사용 (RLS 우회)
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!rawServiceRoleKey) {
      return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 })
    }

    const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
    
    if (!serviceRoleKey || serviceRoleKey.length < 50 || !serviceRoleKey.startsWith('eyJ')) {
      return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    ) as any

    // 아이디 중복 확인
    const { data, error, count } = await adminClient
      .from('profiles')
      .select('username', { count: 'exact', head: false })
      .eq('username', username.trim())
      .is('deleted_at', null) // 삭제된 사용자는 제외

    if (error) {
      console.error('아이디 중복확인 오류:', error)
      return NextResponse.json({ 
        error: '아이디 확인 중 오류가 발생했습니다',
        details: error.message 
      }, { status: 500 })
    }

    // 데이터가 있으면 중복, 없으면 사용 가능
    const isAvailable = !data || data.length === 0

    return NextResponse.json({
      success: true,
      available: isAvailable,
      message: isAvailable ? '사용 가능한 아이디입니다' : '이미 사용 중인 아이디입니다'
    })
  } catch (error: any) {
    console.error('아이디 중복확인 API 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다',
      message: error?.message || '알 수 없는 오류'
    }, { status: 500 })
  }
}

