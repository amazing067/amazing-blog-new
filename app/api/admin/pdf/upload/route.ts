import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 관리자 권한 확인
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!rawServiceRoleKey) {
      return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 })
    }

    const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )

    // 관리자 권한 확인
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    // FormData에서 PDF 파일 받기
    const formData = await request.formData()
    const file = formData.get('file') as File
    const category = formData.get('category') as string // 'damage' | 'life'

    if (!file) {
      return NextResponse.json({ error: 'PDF 파일이 필요합니다' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'PDF 파일만 업로드 가능합니다' }, { status: 400 })
    }

    if (!category || (category !== 'damage' && category !== 'life')) {
      return NextResponse.json({ error: '카테고리는 damage 또는 life여야 합니다' }, { status: 400 })
    }

    // 파일을 버퍼로 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Supabase Storage에 업로드
    const fileName = `${category}-newsletter-${Date.now()}.pdf`
    const filePath = `newsletters/${fileName}`

    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('pdfs')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: true // 같은 이름이면 덮어쓰기
      })

    if (uploadError) {
      console.error('PDF 업로드 오류:', uploadError)
      return NextResponse.json(
        { error: 'PDF 업로드 실패: ' + uploadError.message },
        { status: 500 }
      )
    }

    // Public URL 생성
    const { data: urlData } = adminClient.storage
      .from('pdfs')
      .getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      fileName,
      filePath,
      publicUrl: urlData.publicUrl,
      category,
      size: buffer.length
    })
  } catch (error: any) {
    console.error('PDF 업로드 오류:', error)
    return NextResponse.json(
      { error: error?.message || 'PDF 업로드 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

