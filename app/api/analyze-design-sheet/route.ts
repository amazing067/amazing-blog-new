import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: NextRequest) {
  try {
    const { imageBase64 } = await request.json()

    if (!imageBase64) {
      return NextResponse.json(
        { error: '이미지가 제공되지 않았습니다' },
        { status: 400 }
      )
    }

    console.log('설계서 분석 시작...')

    // Gemini Vision API 초기화
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro'
    })

    // Base64에서 데이터 부분만 추출 (data:image/...;base64, 제거)
    const base64Data = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64

    // 프롬프트: 설계서 이미지 분석 (Vision API 최적화)
    const prompt = `이 이미지는 보험 설계서/제안서입니다. 이미지를 자세히 읽고, 표시된 모든 텍스트와 데이터를 정확히 추출해주세요.

**[이미지 분석 단계]**

1단계: 이미지의 모든 텍스트를 OCR로 읽기
- 보험사 로고 주변의 텍스트 확인
- 제목, 부제목, 표 제목 등 모든 텍스트 읽기
- 표 안의 숫자와 텍스트 정확히 인식

2단계: 핵심 정보 추출
- **보험사명**: 로고 아래나 상단에 명시된 보험사 이름 (예: "삼성생명", "한화생명", "DB손해보험")
- **보험 상품명**: 제목이나 상품명란에 적힌 정확한 상품명 (예: "운전자보험", "실손의료비보험", "종신보험")
- **가입자 정보**: 나이, 성별, 직업이 표시된 부분 찾기
- **보험료**: 금액이 표시된 부분 (월보험료, 연보험료 등)
- **특약/보장 내용**: 특약명, 보장금액 등이 나열된 부분

3단계: 보험 종류 판단
- 이미지에 "운전자보험"이라고 명시되어 있으면 → 운전자보험
- 이미지에 "실손의료비"라고 명시되어 있으면 → 실손의료비보험
- 이미지에 "치아보험"이라고 명시되어 있으면 → 치아보험
- **⚠️ 절대 추정하지 말고, 이미지에 명시된 정확한 상품명만 사용하세요!**

**[출력 형식 - 반드시 JSON만 출력]**
{
  "productName": "보험사명 + 보험상품명",
  "targetPersona": "나이대 + 성별 + 직업",
  "worryPoint": "이 보험을 고려하는 고객의 고민",
  "sellingPoint": "이 보험의 주요 장점 2-3개",
  "premium": "월보험료 또는 연보험료 (예: '월 3만원', '연 36만원')",
  "coverages": ["담보명1", "담보명2", "담보명3"],
  "specialClauses": ["특약명1", "특약명2"]
}

**[최종 확인]**
- productName: 이미지에 실제로 보이는 보험사명과 상품명인가?
- 보험 종류: 이미지에 명시된 보험 종류와 일치하는가?
- 모든 정보는 이미지에서 직접 읽은 내용만 사용하세요.

**[예시]**
만약 이미지에 "DB손해보험 운전자보험"이라고 명시되어 있다면:
- productName: "DB손해보험 운전자보험" (정확히 그대로)
- worryPoint: 운전자보험에 대한 고민 (보험료, 벌금특약, 형사합의금 등)
- sellingPoint: 운전자보험의 실제 장점 (벌금특약, 형사합의금 보장 등)`

    // MIME 타입 자동 감지
    let mimeType = 'image/png'
    if (imageBase64.includes('data:image/jpeg') || imageBase64.includes('data:image/jpg')) {
      mimeType = 'image/jpeg'
    } else if (imageBase64.includes('data:image/png')) {
      mimeType = 'image/png'
    } else if (imageBase64.includes('data:image/webp')) {
      mimeType = 'image/webp'
    }

    // 이미지와 프롬프트를 함께 전송
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      },
      prompt
    ])

    const response = await result.response
    let analysisText = response.text().trim()

    // JSON 추출 (코드 블록 제거)
    analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    // 제어 문자 제거
    analysisText = analysisText.replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')

    // JSON 파싱 시도
    let analysisData
    try {
      // JSON 추출 (중괄호 포함 부분 찾기)
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('JSON 형식을 찾을 수 없습니다')
      }
    } catch (parseError) {
      // JSON 파싱 실패 시 텍스트에서 추출 시도
      console.warn('JSON 파싱 실패, 텍스트에서 추출 시도:', parseError)
      console.log('원본 텍스트:', analysisText.substring(0, 500))
      
      // 다양한 패턴으로 추출 시도
      const productMatch = analysisText.match(/"productName"\s*:\s*"([^"]+)"/) || 
                          analysisText.match(/productName["\s]*:\s*"([^"]+)"/i) ||
                          analysisText.match(/상품명["\s]*[:：]\s*([^\n"]+)/)
      
      const targetMatch = analysisText.match(/"targetPersona"\s*:\s*"([^"]+)"/) || 
                         analysisText.match(/targetPersona["\s]*:\s*"([^"]+)"/i) ||
                         analysisText.match(/타겟["\s]*[:：]\s*([^\n"]+)/)
      
      const worryMatch = analysisText.match(/"worryPoint"\s*:\s*"([^"]+)"/) || 
                        analysisText.match(/worryPoint["\s]*:\s*"([^"]+)"/i)
      
      const sellingMatch = analysisText.match(/"sellingPoint"\s*:\s*"([^"]+)"/) || 
                          analysisText.match(/sellingPoint["\s]*:\s*"([^"]+)"/i)

      const premiumMatch = analysisText.match(/"premium"\s*:\s*"([^"]+)"/) || 
                           analysisText.match(/premium["\s]*:\s*"([^"]+)"/i) ||
                           analysisText.match(/보험료["\s]*[:：]\s*([^\n"]+)/)
      
      const coveragesMatch = analysisText.match(/"coverages"\s*:\s*\[([^\]]+)\]/) ||
                            analysisText.match(/coverages["\s]*:\s*\[([^\]]+)\]/i)
      
      const specialClausesMatch = analysisText.match(/"specialClauses"\s*:\s*\[([^\]]+)\]/) ||
                                  analysisText.match(/specialClauses["\s]*:\s*\[([^\]]+)\]/i)

      analysisData = {
        productName: productMatch?.[1]?.trim() || '보험 상품',
        targetPersona: targetMatch?.[1]?.trim() || '30대 직장인',
        worryPoint: worryMatch?.[1]?.trim() || '보험료와 보장 범위가 적절한지 궁금합니다',
        sellingPoint: sellingMatch?.[1]?.trim() || '보장 범위가 넓고 합리적인 보험료입니다',
        premium: premiumMatch?.[1]?.trim() || '',
        coverages: coveragesMatch?.[1]?.split(',').map(s => s.trim().replace(/"/g, '')) || [],
        specialClauses: specialClausesMatch?.[1]?.split(',').map(s => s.trim().replace(/"/g, '')) || []
      }
      
      console.log('추출된 데이터:', analysisData)
    }

    console.log('설계서 분석 완료:', analysisData)

    return NextResponse.json({
      success: true,
      data: {
        productName: analysisData.productName || '보험 상품',
        targetPersona: analysisData.targetPersona || '30대 직장인',
        worryPoint: analysisData.worryPoint || '보험료와 보장 범위가 적절한지 궁금합니다',
        sellingPoint: analysisData.sellingPoint || '보장 범위가 넓고 합리적인 보험료입니다',
        premium: analysisData.premium || '',
        coverages: analysisData.coverages || [],
        specialClauses: analysisData.specialClauses || []
      }
    })
  } catch (error: any) {
    console.error('설계서 분석 오류:', error)
    
    return NextResponse.json(
      { error: error.message || '설계서 분석 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

