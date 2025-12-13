import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { title, productName, tokenTotal, data } = body

    if (!title || !productName || !data) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다: title, productName, data' },
        { status: 400 }
      )
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

    // qa_sets 테이블에 저장 (SERVICE_ROLE_KEY 사용으로 RLS 우회)
    const { data: savedQA, error } = await adminClient
      .from('qa_sets')
      .insert({
        user_id: user.id,
        title,
        product_name: productName,
        token_total: tokenTotal || 0,
        data: data // JSONB 형식으로 저장
      })
      .select()
      .single()

    if (error) {
      console.error('Q&A 저장 오류:', error)
      return NextResponse.json(
        { error: `Q&A 저장 실패: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id: savedQA.id,
      message: 'Q&A가 성공적으로 저장되었습니다'
    })
  } catch (error: any) {
    console.error('API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

