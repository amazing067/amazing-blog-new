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

    console.log('의료 이미지 분석 시작...')

    // Gemini Vision API 초기화
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro'
    })

    // Base64에서 데이터 부분만 추출 (data:image/...;base64, 제거)
    const base64Data = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64

    // 프롬프트: 의료 영수증/병리 보고서 분석
    const prompt = `이 이미지는 의료 영수증(진료비 세부산정내역) 또는 병리 검사 보고서입니다. 이미지를 정확히 분석하여 다음 정보를 추출해주세요.

**[이미지 분석 단계]**

1단계: 문서 종류 판단
- 진료비 세부산정내역서인지 확인
- 조직병리 진단 보고서인지 확인
- 기타 의료 문서인지 확인

2단계: 핵심 정보 추출 (진료비 세부산정내역서인 경우)
- **환자 정보**: 환자성명, 생년월일, 성별, 나이
- **진료 정보**: 진료기간, 진료과, 진료의, 병원명
- **진료비 내역**:
  * 진찰료 소계
  * 투약료 소계
  * 기타 항목별 금액
- **보험 적용 내역**:
  * 급여 총액 (공단 부담금)
  * 본인부담금 총액
  * 비급여 총액
- **진단명/질병명**: 진단서에 명시된 질병명, ICD 코드 등

3단계: 핵심 정보 추출 (병리 검사 보고서인 경우)
- **환자 정보**: 수진자명, 생년월일, 성별, 나이
- **검사 정보**: 검체종류, 채취일시, 검사일시
- **병리 진단**: 
  * GROSS DESCRIPTION (육안 소견)
  * PATHOLOGIC DIAGNOSIS (병리 진단)
  * 질병명, 종양 여부, 악성/양성 여부
- **의뢰기관**: 병원명, 담당의사

4단계: 보험금 계산 정보
- **질병 분류**: 
  * 실손보험 적용 가능 여부
  * 특정 질병 보험 적용 가능 여부
  * 암보험 적용 가능 여부
- **예상 보험금**:
  * 본인부담금 기준 보험금 계산
  * 보험 종류별 적용 가능 여부
  * 실제 지급 가능한 보험금 추정

**[출력 형식 - 반드시 JSON만 출력]**
{
  "documentType": "진료비 세부산정내역서" 또는 "조직병리 진단 보고서" 또는 "기타",
  "patientInfo": {
    "name": "환자명",
    "birthDate": "생년월일",
    "gender": "성별",
    "age": "나이"
  },
  "medicalInfo": {
    "hospitalName": "병원명",
    "department": "진료과",
    "doctor": "의사명",
    "treatmentPeriod": "진료기간",
    "diagnosis": ["진단명1", "진단명2"]
  },
  "expenses": {
    "totalAmount": "총 진료비",
    "coveredAmount": "급여 총액 (공단 부담)",
    "patientShare": "본인부담금 총액",
    "nonCoveredAmount": "비급여 총액",
    "details": [
      {
        "item": "항목명",
        "amount": "금액"
      }
    ]
  },
  "pathologyInfo": {
    "specimenType": "검체종류",
    "grossDescription": "육안 소견",
    "pathologicDiagnosis": "병리 진단",
    "tumorType": "양성/악성 여부"
  },
  "insuranceAnalysis": {
    "applicableInsurance": ["실손보험", "암보험", "특정질병보험"],
    "estimatedInsuranceAmount": "예상 보험금",
    "calculationBasis": "보험금 계산 근거",
    "notes": "특이사항 및 주의사항"
  },
  "customerGuidance": {
    "explanation": "고객에게 설명할 내용 (친절하고 이해하기 쉽게)",
    "nextSteps": ["다음 단계 1", "다음 단계 2"],
    "importantNotes": ["주의사항 1", "주의사항 2"]
  }
}

**[중요 지침]**
- 모든 금액은 숫자만 추출 (예: "16,130원" → "16130")
- 진단명은 정확히 추출 (ICD 코드가 있으면 포함)
- 보험금 계산은 실제 보험 약관 기준으로 추정
- 고객 설명은 전문 용어를 피하고 쉽게 설명
- 모든 정보는 이미지에서 직접 읽은 내용만 사용`

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
      console.error('JSON 파싱 실패:', parseError)
      console.log('원본 텍스트:', analysisText.substring(0, 1000))
      
      // 기본 구조 반환
      analysisData = {
        documentType: '기타',
        patientInfo: {},
        medicalInfo: {},
        expenses: {},
        pathologyInfo: {},
        insuranceAnalysis: {},
        customerGuidance: {
          explanation: '이미지 분석 중 오류가 발생했습니다. 다시 시도해주세요.',
          nextSteps: [],
          importantNotes: []
        }
      }
    }

    console.log('의료 이미지 분석 완료:', analysisData)

    return NextResponse.json({
      success: true,
      data: analysisData
    })
  } catch (error: any) {
    console.error('의료 이미지 분석 오류:', error)
    
    return NextResponse.json(
      { error: error.message || '이미지 분석 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

