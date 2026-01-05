import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 관리자 권한 확인 (선택사항 - 일반 사용자도 목록은 볼 수 있게 할 수도 있음)
    // 여기서는 관리자만 볼 수 있도록 설정
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!rawServiceRoleKey) {
      return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 })
    }

    const serviceRoleKey = rawServiceRoleKey.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )

    // Storage에서 PDF 목록 가져오기
    const { data: files, error } = await adminClient.storage
      .from('pdfs')
      .list('newsletters', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error('PDF 목록 조회 오류:', error)
      return NextResponse.json(
        { error: 'PDF 목록 조회 실패: ' + error.message },
        { status: 500 }
      )
    }

    // 파일 정보 정리
    const pdfList = (files || [])
      .filter(file => file.name.endsWith('.pdf'))
      .map(file => {
        const category = file.name.startsWith('damage-') ? 'damage' : 
                        file.name.startsWith('life-') ? 'life' : 'unknown'
        
        const { data: urlData } = adminClient.storage
          .from('pdfs')
          .getPublicUrl(`newsletters/${file.name}`)

        return {
          name: file.name,
          path: `newsletters/${file.name}`,
          publicUrl: urlData.publicUrl,
          category,
          size: file.metadata?.size || 0,
          createdAt: file.created_at,
          updatedAt: file.updated_at
        }
      })
      .sort((a, b) => {
        // 최신순 정렬
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime()
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime()
        return dateB - dateA
      })

    return NextResponse.json({
      success: true,
      pdfs: pdfList
    })
  } catch (error: any) {
    console.error('PDF 목록 조회 오류:', error)
    return NextResponse.json(
      { error: error?.message || 'PDF 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

