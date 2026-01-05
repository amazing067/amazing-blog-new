import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
// pdf-parse는 동적 import로 변경 (빌드 시 테스트 파일 참조 오류 방지)
// import pdfParse from 'pdf-parse'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // FormData에서 PDF 파일 받기
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'PDF 파일이 필요합니다' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'PDF 파일만 업로드 가능합니다' }, { status: 400 })
    }

    // PDF 파일을 버퍼로 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // PDF 파싱 (동적 import)
    console.log('[PDF 파싱] PDF 파일 파싱 시작...')
    const pdfParse = (await import('pdf-parse')).default
    const pdfData = await pdfParse(buffer)
    const pdfText = pdfData.text

    if (!pdfText || pdfText.trim().length === 0) {
      return NextResponse.json({ error: 'PDF에서 텍스트를 추출할 수 없습니다' }, { status: 400 })
    }

    console.log('[PDF 파싱] PDF 텍스트 추출 완료:', pdfText.length, '자')

    // Gemini API로 상품명, 회사명 등 정보 추출
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash' // 비용 절감을 위해 Flash 사용
    })

    // 정보 추출 프롬프트
    const extractionPrompt = `다음은 보험 소식지 PDF에서 추출한 텍스트입니다. 이 텍스트에서 다음 정보를 추출해주세요:

1. 상품명 (보험 상품의 정확한 이름)
2. 회사명 (보험사 이름)
3. 주요 특징 (보장 내용, 특약, 보험료 관련 정보 등)
4. 대상 고객 (나이, 성별, 직업 등)
5. 판매 포인트 (이 상품의 장점이나 특징)

PDF 텍스트:
${pdfText.substring(0, 8000)} ${pdfText.length > 8000 ? '...(중략)...' : ''}

다음 JSON 형식으로 응답해주세요:
{
  "products": [
    {
      "name": "상품명",
      "company": "회사명",
      "features": ["특징1", "특징2", "특징3"],
      "targetCustomer": "대상 고객 설명",
      "sellingPoints": "판매 포인트 설명"
    }
  ]
}

만약 여러 상품이 있다면 모두 포함해주세요. JSON 형식만 응답하고 다른 설명은 하지 마세요.`

    console.log('[PDF 파싱] 정보 추출 시작...')
    const result = await model.generateContent(extractionPrompt)
    const response = await result.response
    const extractedText = response.text().trim()

    // JSON 파싱 시도
    let extractedData
    try {
      // JSON 코드 블록 제거
      const jsonText = extractedText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      
      extractedData = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('[PDF 파싱] JSON 파싱 실패:', parseError)
      // JSON 파싱 실패 시 텍스트만 반환
      return NextResponse.json({
        success: true,
        text: pdfText,
        extracted: extractedText,
        error: 'JSON 파싱 실패 (텍스트는 추출됨)'
      })
    }

    console.log('[PDF 파싱] 정보 추출 완료:', extractedData)

    return NextResponse.json({
      success: true,
      text: pdfText,
      extracted: extractedData,
      metadata: {
        pages: pdfData.numpages,
        info: pdfData.info
      }
    })
  } catch (error: any) {
    console.error('[PDF 파싱] 오류:', error)
    return NextResponse.json(
      { 
        error: error?.message || 'PDF 파싱 중 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    )
  }
}

