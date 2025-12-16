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
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[의료 이미지 분석] GEMINI_API_KEY가 설정되지 않았습니다!')
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다. 서버 설정을 확인해주세요.' },
        { status: 500 }
      )
    }
    
    const genAI = new GoogleGenerativeAI(apiKey)
    
    // Fallback 로직: Gemini만 사용
    // 순서: Gemini-2.5-Pro → Gemini-2.0-Flash
    const generateContentWithFallback = async (
      prompt: string,
      base64Data: string,
      mimeType: string
    ): Promise<{ text: string; provider: 'gemini' }> => {
      // Gemini 폴백 순서: Gemini-2.5-Pro → Gemini-2.0-Flash
      const models = [
        { provider: 'gemini' as const, model: 'gemini-2.5-pro' },
        { provider: 'gemini' as const, model: 'gemini-2.0-flash' }
      ]
      
      console.log(`[의료 이미지 분석] 🔄 Gemini 폴백 순서 시작: Gemini-2.5-Pro → Gemini-2.0-Flash`)
      
      for (let attempt = 0; attempt < models.length; attempt++) {
        const { provider, model: modelName } = models[attempt]
        
        try {
          console.log(`[의료 이미지 분석] ${provider.toUpperCase()} 모델 시도: ${modelName} (시도 ${attempt + 1}/${models.length})`)
          
          // Gemini만 사용
          const model = genAI.getGenerativeModel({ 
            model: modelName
          })
          
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
          const text = response.text().trim()
          
          if (text) {
            console.log(`[의료 이미지 분석] ✅ Gemini 성공! (${modelName})`)
            // RPM 150 제한 대응: 성공 후 1초 지연 (동시 요청 방지)
            await new Promise(resolve => setTimeout(resolve, 1000))
            return { text, provider: 'gemini' }
          }
        } catch (error: any) {
          const errorMessage = error?.message || ''
          const errorString = JSON.stringify(error || {})
          
          const isQuotaError = 
            errorMessage.includes('429') || 
            errorMessage.includes('quota') || 
            errorMessage.includes('rate limit') ||
            errorMessage.includes('Too Many Requests') ||
            errorMessage.includes('exceeded') ||
            errorMessage.includes('Resource has been exhausted') ||
            errorString.includes('free_tier') ||
            errorString.includes('QuotaFailure') ||
            errorMessage.includes('insufficient_quota')
          
          console.error(`[의료 이미지 분석] ${provider.toUpperCase()} ${modelName} 실패:`, {
            provider,
            model: modelName,
            error: errorMessage.substring(0, 500),
            isQuotaError
          })
          
          // 할당량 에러이고 마지막 모델이 아니면 다음 모델로 시도
          if (isQuotaError && attempt < models.length - 1) {
            const nextModel = models[attempt + 1]
            console.log(`[의료 이미지 분석] ⚠️ ${modelName} 할당량 초과 → ${nextModel.provider.toUpperCase()} ${nextModel.model} 모델로 폴백 시도...`)
            // RPM 150 제한 대응: 할당량 초과 시 1초 지연 후 재시도
            console.log(`[의료 이미지 분석] ⏳ 1초 대기 후 재시도...`)
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
          }
          
          // 마지막 모델이 아니면 다음 모델로 시도
          if (attempt < models.length - 1) {
            const nextModel = models[attempt + 1]
            console.log(`[의료 이미지 분석] ⚠️ ${modelName} 실패 → ${nextModel.provider.toUpperCase()} ${nextModel.model} 모델로 폴백 시도...`)
            // RPM 150 제한 대응: 실패 시 1초 지연 후 재시도
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
          }
        }
      }
      
      throw new Error('모든 모델 시도 실패 (Gemini-2.5-Pro → Gemini-2.0-Flash)')
    }

    // Base64에서 데이터 부분만 추출 (data:image/...;base64, 제거)
    const base64Data = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64

    // 프롬프트: 의료 영수증/병리 보고서 분석
    const prompt = `이 이미지는 의료 영수증(진료비 세부산정내역) 또는 병리 검사 보고서입니다. **영문 기록지가 많으므로 영문 의료 용어를 정확히 인식하고 한글로 번역하여** 이미지를 정확히 분석하여 다음 정보를 매우 상세하게 추출해주세요.

**[영문 의료 문서 처리 지침]**
- 영문 의료 용어를 정확히 인식하고 한글로 번역 (예: "Consultation Fee" → "진찰료", "Medication" → "투약료", "Laboratory Test" → "검사료")
- 영문 약어도 정확히 해석 (예: "CBC" → "전혈구계산", "CT" → "전산화단층촬영", "MRI" → "자기공명영상")
- 진단명은 영문과 한글 병기 (예: "Hypertension" → "고혈압 (Hypertension)")
- 모든 숫자와 금액을 정확히 인식 (천 단위 구분 기호, 소수점 등)
- 테이블 형식의 데이터도 모든 행을 빠짐없이 추출

**[이미지 분석 단계]**

1단계: 문서 종류 판단
- 진료비 세부산정내역서인지 확인
- 조직병리 진단 보고서인지 확인
- 입원비 세부산정내역서인지 확인
- 기타 의료 문서인지 확인

2단계: 핵심 정보 추출 (진료비 세부산정내역서인 경우)
- **환자 정보**: 환자성명, 생년월일, 성별, 나이, 주민등록번호(일부)
- **진료 정보**: 
  * 진료기간 (시작일, 종료일)
  * 진료과 (내과, 외과, 정형외과 등)
  * 진료의 (담당의사명)
  * 병원명 (정확한 병원명)
  * 입원/통원 여부
  * 입원일수 (입원인 경우)
- **진료비 내역 (매우 상세하게 - 모든 항목을 빠짐없이 추출)**:
  * **진찰료 소계 및 세부 항목**:
    - 내과진찰료, 외과진찰료, 정형외과진찰료, 소아과진찰료 등 모든 진찰료 항목
    - 각 진찰료 항목별 금액 (급여/비급여 구분)
    - 진찰 횟수 (통원인 경우)
  * **투약료 소계 및 세부 항목**:
    - 처방약제비 (각 약품명과 금액)
    - 조제료
    - 약국 조제료 (있는 경우)
    - 각 약품별 급여/비급여 구분
  * **주사료 소계 및 세부 항목**:
    - 주사료 (정맥주사, 근육주사 등)
    - 각 주사 항목별 금액
  * **검사료 소계 및 세부 항목 (매우 상세하게)**:
    - 혈액검사 (CBC, 혈액화학검사, 종양표지자 등 각 검사명과 금액)
    - 영상검사 (X-ray, CT, MRI, 초음파 등 각 검사명과 금액)
    - 내시경 검사 (위내시경, 대장내시경 등)
    - 기타 검사 (심전도, 폐기능검사 등)
    - 각 검사별 급여/비급여 구분
    - 비급여 검사는 특별히 표시 (MRI, 특수 초음파 등)
  * **처치 및 수술료 소계 및 세부 항목**:
    - 수술명 (정확한 수술명, 영문인 경우 한글 번역)
    - 수술료 (급여/비급여 구분)
    - 처치명 (봉합, 드레싱, 소독 등)
    - 처치료 (각 처치별 금액)
    - 마취료 (전신마취, 국소마취 등)
  * **입원료 (입원인 경우, 매우 상세하게)**:
    - 입원일수 (정확한 일수)
    - 1일당 입원료
    - 입원료 총액
    - 병실 유형 (일반병실, 특실 등)
    - 상급병실 차액 (있는 경우)
  * **재료비 및 기타 항목**:
    - 재료비 (수술재료, 처치재료 등)
    - 기타 항목 (의료용품, 기타비용 등)
    - 각 항목별 급여/비급여 구분
  * **항목별 합계 검증**:
    - 각 카테고리별 소계 합산이 총액과 일치하는지 확인
    - 불일치 시 경고 표시
- **보험 적용 내역 (매우 상세하게 - 데이터 검증 포함)**:
  * 급여 총액 (공단 부담금) - 정확한 금액
  * 본인부담금 총액 - 정확한 금액
  * 비급여 총액 - 정확한 금액
  * 총 진료비 = 급여 총액 + 본인부담금 + 비급여 총액 (합계 검증)
  * 본인부담률 계산: (본인부담금 / 급여 총액) × 100
  * 본인부담률 추정 (실손보험 세대별 기준 적용):
    - 1세대: 0% (100% 보장)
    - 2세대 이상: 10% 또는 20% 또는 30%
    - 계산된 본인부담률과 비교하여 세대 추정
  * 실손보험 세대 구분 가능 여부 (가능하면 명시)
  * 데이터 검증:
    - 급여 항목 합계 = 급여 총액 일치 여부
    - 비급여 항목 합계 = 비급여 총액 일치 여부
    - 본인부담금 계산 검증 (급여 총액 × 본인부담률)
    - 불일치 시 경고 및 원인 분석
- **진단명/질병명 (매우 상세하게 - 영문 진단명도 포함)**: 
  * 주진단명 (Primary Diagnosis) - 영문과 한글 병기
  * 부진단명 (Secondary Diagnosis) - 모든 부진단명 리스트
  * ICD 코드 (있는 경우, ICD-10 형식)
  * 질병 분류:
    - 암 여부 (악성종양, 양성종양, 경계성 종양)
    - 중대질병 여부 (뇌혈관질환, 허혈성심장질환 등)
    - 특정질병 여부 (당뇨, 고혈압 등)
    - 상해 여부 (사고, 외상 등)
    - 일반질병 여부
  * 진단명 영문 원문 (영문 기록지인 경우)
  * 진단명 한글 번역 (영문인 경우)

3단계: 핵심 정보 추출 (병리 검사 보고서인 경우)
- **환자 정보**: 수진자명, 생년월일, 성별, 나이
- **검사 정보**: 
  * 검체종류 (조직, 세포 등)
  * 채취일시 (정확한 날짜)
  * 검사일시 (정확한 날짜)
  * 검사 방법
- **병리 진단 (매우 상세하게 - 영문 원문 포함)**: 
  * GROSS DESCRIPTION (육안 소견) - 전체 내용 (영문인 경우 한글 번역 포함)
  * PATHOLOGIC DIAGNOSIS (병리 진단) - 전체 내용 (영문인 경우 한글 번역 포함)
  * MICROSCOPIC DESCRIPTION (현미경 소견) - 전체 내용 (있는 경우)
  * 질병명 (정확한 병명, 영문과 한글 병기)
  * 종양 여부 (양성/악성/경계성)
  * 종양 크기 (있는 경우, mm 단위)
  * 침윤 깊이 (있는 경우, mm 단위)
  * 림프절 전이 여부 (있는 경우, 전이된 개수)
  * TNM 분류 (있는 경우, T, N, M 각각)
  * 분화도 (Grade, 있는 경우)
  * 추가 검사 필요 여부
  * 영문 원문 전체 내용 (영문 기록지인 경우)
- **의뢰기관**: 병원명, 담당의사, 병리과

4단계: 보험금 계산 정보 (매우 상세하게)
- **질병 분류**: 
  * 실손보험 적용 가능 여부 (적용 가능/불가능, 이유)
  * 특정 질병 보험 적용 가능 여부 (적용 가능한 특정 질병명)
  * 암보험 적용 가능 여부 (암 진단인 경우)
  * 중대질병보험 적용 가능 여부
  * 상해보험 적용 가능 여부
- **예상 보험금 (매우 상세하게 - 실손보험 세대별 기준 적용)**:
  * 실손보험 예상 보험금 (세대별로 각각 계산):
    - **1세대 (2003.10~2009.9)**: 
      * 입원: 자기부담금 0% (100% 보장) 또는 약국 5,000원
      * 통원: 약 5,000원
      * 보장 비율: 손보 100% / 생보 80%
      * 실제 지급 가능한 보험금 추정
    - **2세대 표준화 I (2009.10~2013.3)**:
      * 입원: 자기부담금 10% (연간 한도 200만원)
      * 통원: 통원 10,000-20,000원, 약국 8,000원 (10% 또는 그 이상)
      * 보장 비율: 90%
      * 실제 지급 가능한 보험금 추정
    - **2세대 표준화 II (2013.4~2015.8)**:
      * 입원: 자기부담금 10% 또는 20% 선택 (연간 한도 200만원)
      * 통원: 통원 10,000-20,000원, 약국 8,000원 (10% 또는 20% 또는 그 이상)
      * 보장 비율: 90% 또는 80% 선택
      * 실제 지급 가능한 보험금 추정 (선택 기준에 따라)
    - **2세대 표준화 III (2015.9~2017.3)**:
      * 입원: 급여 10% / 비급여 20% (연간 한도 200만원)
      * 통원: 통원 10,000-20,000원, 약국 8,000원 (급여 10% / 비급여 20% 또는 그 이상)
      * 보장 비율: 90% 또는 80% 선택
      * 실제 지급 가능한 보험금 추정
    - **3세대 (2017.4~2021.6)**:
      * 입원: 급여 10% / 비급여 20% (연간 한도 200만원)
      * 통원: 통원 10,000-20,000원, 약국 8,000원 [특약] 30% (최소 20,000원)
      * 보장 비율: 급여 90% / 비급여 80% / 특약 70%
      * 실제 지급 가능한 보험금 추정
    - **4세대 (2021.7~현재)**:
      * 입원: 급여 20% / 비급여 30% (급여는 건강보험 상한금액 적용)
      * 통원: 급여 10,000-20,000원 / 비급여 30,000원 (급여 20% / 비급여 30% 또는 그 이상)
      * 보장 비율: 급여 80% / 비급여 70%
      * 실제 지급 가능한 보험금 추정
    - 면책금 적용 여부 (세대별 면책기간 확인)
    - 연간 한도 초과 여부 (세대별 한도 확인)
    - 입원/통원 구분하여 계산
  * 암보험 예상 보험금 (암 진단인 경우):
    - 암진단비 지급 가능 여부
    - 암수술비 지급 가능 여부
    - 암입원비 지급 가능 여부
  * 특정 질병보험 예상 보험금:
    - 해당 질병명
    - 진단비 지급 가능 여부
  * 각 보험별 지급 조건 및 제한사항

**[출력 형식 - 반드시 JSON만 출력]**
{
  "documentType": "진료비 세부산정내역서" 또는 "조직병리 진단 보고서" 또는 "기타",
  "patientInfo": {
    "name": "환자명",
    "birthDate": "생년월일",
    "gender": "성별",
    "age": "나이",
    "patientId": "환자번호 또는 주민등록번호 일부"
  },
  "medicalInfo": {
    "hospitalName": "병원명",
    "department": "진료과",
    "doctor": "의사명",
    "treatmentPeriod": "진료기간 (시작일 ~ 종료일)",
    "treatmentType": "입원" 또는 "통원",
    "admissionDays": "입원일수 (입원인 경우)",
    "diagnosis": [
      {
        "mainDiagnosis": "주진단명 (한글)",
        "mainDiagnosisEnglish": "주진단명 영문 원문 (영문 기록지인 경우)",
        "subDiagnosis": ["부진단명1 (한글)", "부진단명2 (한글)"],
        "subDiagnosisEnglish": ["부진단명1 영문", "부진단명2 영문"],
        "icdCode": "ICD 코드 (있는 경우, ICD-10 형식)",
        "diseaseCategory": "질병 분류 (암/중대질병/특정질병/일반질병/상해 등)",
        "isCancer": true 또는 false,
        "isMajorDisease": true 또는 false,
        "isSpecificDisease": true 또는 false,
        "isInjury": true 또는 false
      }
    ],
    "diseaseCategory": "주요 질병 분류 (암/중대질병/일반질병/상해 등)"
  },
  "expenses": {
    "totalAmount": "총 진료비 (숫자만)",
    "coveredAmount": "급여 총액 (공단 부담, 숫자만)",
    "patientShare": "본인부담금 총액 (숫자만)",
    "nonCoveredAmount": "비급여 총액 (숫자만)",
    "patientShareRate": "본인부담률 (%) - 계산값",
    "estimatedGeneration": "추정 실손보험 세대 (1세대/2세대 표준화 I/II/III/3세대/4세대)",
    "dataValidation": {
      "isValid": true 또는 false,
      "totalCheck": "총액 검증 (급여+본인부담+비급여 = 총액 일치 여부)",
      "categorySumCheck": "카테고리별 합계 검증",
      "patientShareRateCheck": "본인부담률 계산 검증 (계산값과 실제값 비교)",
      "warnings": ["검증 경고 사항 1", "검증 경고 사항 2"],
      "dataQuality": {
        "overall": "높음" 또는 "중간" 또는 "낮음",
        "itemQuality": [
          {
            "item": "항목명",
            "quality": "높음/중간/낮음",
            "reason": "품질 평가 이유"
          }
        ]
      }
    },
    "nonCoveredMajorItems": {
      "mri": {
        "applicable": true 또는 false,
        "amount": "MRI 비급여 금액 (있는 경우)",
        "limit": "3대 비급여 특약 한도 (3세대: 300만원, 4세대: 동일)"
      },
      "manualTherapy": {
        "applicable": true 또는 false,
        "amount": "도수치료/체외충격파/증식치료 비급여 금액 (있는 경우)",
        "limit": "3대 비급여 특약 한도 (3세대: 350만원, 4세대: 동일)"
      },
      "nonCoveredInjection": {
        "applicable": true 또는 false,
        "amount": "비급여 주사 비급여 금액 (있는 경우)",
        "limit": "3대 비급여 특약 한도 (3세대: 250만원, 4세대: 동일)"
      }
    },
    "details": [
      {
        "category": "항목 분류 (진찰료/투약료/검사료/수술료/입원료/재료비 등)",
        "subCategory": "세부 분류 (내과진찰/외과진찰 등)",
        "item": "세부 항목명 (영문인 경우 한글 번역 포함)",
        "itemEnglish": "영문 원문 (영문 기록지인 경우)",
        "amount": "금액 (숫자만)",
        "coverageType": "급여" 또는 "비급여",
        "quantity": "수량 (있는 경우)",
        "unitPrice": "단가 (있는 경우)"
      }
    ],
    "breakdown": {
      "consultationFee": {
        "total": "진찰료 소계 (숫자만)",
        "covered": "급여 진찰료 (숫자만)",
        "nonCovered": "비급여 진찰료 (숫자만)",
        "items": [
          {
            "name": "진찰료 항목명",
            "amount": "금액",
            "coverageType": "급여/비급여"
          }
        ]
      },
      "medicationFee": {
        "total": "투약료 소계 (숫자만)",
        "covered": "급여 투약료 (숫자만)",
        "nonCovered": "비급여 투약료 (숫자만)",
        "items": [
          {
            "name": "약품명 (영문인 경우 한글 번역)",
            "amount": "금액",
            "coverageType": "급여/비급여"
          }
        ]
      },
      "injectionFee": {
        "total": "주사료 소계 (숫자만)",
        "covered": "급여 주사료 (숫자만)",
        "nonCovered": "비급여 주사료 (숫자만)",
        "items": [
          {
            "name": "주사 항목명",
            "amount": "금액",
            "coverageType": "급여/비급여"
          }
        ]
      },
      "examinationFee": {
        "total": "검사료 소계 (숫자만)",
        "covered": "급여 검사료 (숫자만)",
        "nonCovered": "비급여 검사료 (숫자만)",
        "items": [
          {
            "name": "검사명 (영문인 경우 한글 번역, 예: CT, MRI 등)",
            "amount": "금액",
            "coverageType": "급여/비급여",
            "isNonCoveredMajor": "3대 비급여 특약 해당 여부 (MRI, 도수치료, 체외충격파 등)"
          }
        ]
      },
      "surgeryFee": {
        "total": "수술료 소계 (숫자만)",
        "covered": "급여 수술료 (숫자만)",
        "nonCovered": "비급여 수술료 (숫자만)",
        "items": [
          {
            "name": "수술명 (영문인 경우 한글 번역)",
            "amount": "금액",
            "coverageType": "급여/비급여"
          }
        ]
      },
      "admissionFee": {
        "total": "입원료 소계 (숫자만, 입원인 경우)",
        "days": "입원일수",
        "dailyRate": "1일당 입원료",
        "roomType": "병실 유형",
        "premiumRoomDiff": "상급병실 차액 (있는 경우)"
      },
      "materialFee": {
        "total": "재료비 소계 (숫자만)",
        "items": [
          {
            "name": "재료명",
            "amount": "금액"
          }
        ]
      },
      "otherFee": {
        "total": "기타 항목 소계 (숫자만)",
        "items": [
          {
            "name": "기타 항목명",
            "amount": "금액"
          }
        ]
      }
    }
  },
  "pathologyInfo": {
    "specimenType": "검체종류 (영문인 경우 한글 번역)",
    "specimenTypeEnglish": "검체종류 영문 원문",
    "collectionDate": "채취일시 (YYYY-MM-DD 형식)",
    "examinationDate": "검사일시 (YYYY-MM-DD 형식)",
    "grossDescription": "육안 소견 (전체 내용, 영문인 경우 한글 번역 포함)",
    "grossDescriptionEnglish": "육안 소견 영문 원문 (영문 기록지인 경우)",
    "microscopicDescription": "현미경 소견 (전체 내용, 있는 경우)",
    "microscopicDescriptionEnglish": "현미경 소견 영문 원문 (영문 기록지인 경우)",
    "pathologicDiagnosis": "병리 진단 (전체 내용, 영문인 경우 한글 번역 포함)",
    "pathologicDiagnosisEnglish": "병리 진단 영문 원문 (영문 기록지인 경우)",
    "diseaseName": "정확한 병명 (한글)",
    "diseaseNameEnglish": "병명 영문 원문",
    "tumorType": "양성/악성/경계성",
    "tumorSize": "종양 크기 (있는 경우, mm 단위)",
    "invasionDepth": "침윤 깊이 (있는 경우, mm 단위)",
    "lymphNodeMetastasis": "림프절 전이 여부 (있는 경우)",
    "lymphNodeCount": "전이된 림프절 개수 (있는 경우)",
    "tnmClassification": {
      "T": "T 분류 (있는 경우)",
      "N": "N 분류 (있는 경우)",
      "M": "M 분류 (있는 경우)"
    },
    "grade": "분화도 (Grade, 있는 경우)",
    "additionalTests": "추가 검사 필요 여부",
    "fullEnglishText": "영문 원문 전체 내용 (영문 기록지인 경우)"
  },
  "insuranceAnalysis": {
    "applicableInsurance": [
      {
        "type": "보험 종류 (실손보험/암보험/특정질병보험/중대질병보험/상해보험)",
        "applicable": true 또는 false,
        "reason": "적용 가능/불가능 이유"
      }
    ],
    "realInsurance": {
      "applicable": true 또는 false,
      "estimatedGeneration": "추정 실손보험 세대 (1세대/2세대 표준화 I/II/III/3세대/4세대)",
      "generationDetails": {
        "1stGen": {
          "period": "2003.10 ~ 2009.9",
          "inpatientDeductible": "입원 자기부담금 0% (100% 보장) 또는 약국 5,000원",
          "outpatientDeductible": "통원 약 5,000원",
          "coverageRatio": "손보 100% / 생보 80%",
          "estimatedAmount": "예상 보험금 (숫자만)",
          "calculationBasis": "계산 근거"
        },
        "2ndGen1": {
          "period": "2009.10 ~ 2013.3 (표준화 I)",
          "inpatientDeductible": "입원 자기부담금 10% (연간 한도 200만원)",
          "outpatientDeductible": "통원 10,000-20,000원, 약국 8,000원 (10% 또는 그 이상)",
          "coverageRatio": "90%",
          "estimatedAmount": "예상 보험금 (숫자만)",
          "calculationBasis": "계산 근거"
        },
        "2ndGen2": {
          "period": "2013.4 ~ 2015.8 (표준화 II)",
          "inpatientDeductible": "입원 자기부담금 10% 또는 20% 선택 (연간 한도 200만원)",
          "outpatientDeductible": "통원 10,000-20,000원, 약국 8,000원 (10% 또는 20% 또는 그 이상)",
          "coverageRatio": "90% 또는 80% 선택",
          "estimatedAmount10": "10% 선택 시 예상 보험금 (숫자만)",
          "estimatedAmount20": "20% 선택 시 예상 보험금 (숫자만)",
          "calculationBasis": "계산 근거"
        },
        "2ndGen3": {
          "period": "2015.9 ~ 2017.3 (표준화 III)",
          "inpatientDeductible": "입원 급여 10% / 비급여 20% (연간 한도 200만원)",
          "outpatientDeductible": "통원 10,000-20,000원, 약국 8,000원 (급여 10% / 비급여 20% 또는 그 이상)",
          "coverageRatio": "90% 또는 80% 선택",
          "estimatedAmount": "예상 보험금 (숫자만)",
          "calculationBasis": "계산 근거"
        },
        "3rdGen": {
          "period": "2017.4 ~ 2021.6 (착한 실손)",
          "inpatientDeductible": "입원 급여 10% / 비급여 20% (연간 한도 200만원)",
          "outpatientDeductible": "통원 10,000-20,000원, 약국 8,000원 [특약] 30% (최소 20,000원)",
          "coverageRatio": "급여 90% / 비급여 80% / 특약 70%",
          "estimatedAmount": "예상 보험금 (숫자만)",
          "calculationBasis": "계산 근거"
        },
        "4thGen": {
          "period": "2021.7 ~ 현재 (신실손)",
          "inpatientDeductible": "입원 급여 20% / 비급여 30% (급여는 건강보험 상한금액 적용)",
          "outpatientDeductible": "통원 급여 10,000-20,000원 / 비급여 30,000원 (급여 20% / 비급여 30% 또는 그 이상)",
          "coverageRatio": "급여 80% / 비급여 70%",
          "estimatedAmount": "예상 보험금 (숫자만)",
          "calculationBasis": "계산 근거"
        }
      },
      "deductible": "면책금 적용 여부 및 금액 (세대별 면책기간: 1세대/2세대 표준화 I 180일, 2세대 표준화 II/III/3세대 90일, 4세대 없음)",
      "annualLimit": "연간 한도 초과 여부 (세대별 한도 확인)",
      "treatmentType": "입원/통원 구분",
      "calculationBasis": "보험금 계산 근거 (매우 상세하게, 세대별 기준 명시)"
    },
    "cancerInsurance": {
      "applicable": true 또는 false,
      "diagnosisBenefit": "암진단비 지급 가능 여부 및 예상 금액",
      "surgeryBenefit": "암수술비 지급 가능 여부 및 예상 금액",
      "admissionBenefit": "암입원비 지급 가능 여부 및 예상 금액",
      "calculationBasis": "암보험금 계산 근거"
    },
    "specificDiseaseInsurance": {
      "applicable": true 또는 false,
      "diseaseName": "해당 질병명",
      "diagnosisBenefit": "진단비 지급 가능 여부 및 예상 금액",
      "calculationBasis": "특정질병보험금 계산 근거"
    },
    "notes": "특이사항 및 주의사항 (매우 상세하게)"
  },
  "customerGuidance": {
    "summary": "한눈에 보는 요약 (3-5줄, 핵심 정보만)",
    "explanation": "고객에게 설명할 내용 (매우 상세하고 친절하게, 전문 용어 설명 포함, 영문 용어는 한글로 번역하여 설명)",
    "insuranceExplanation": "보험 적용 상세 설명 (각 보험별로 구체적으로, 실손보험 세대별 차이 설명 포함)",
    "whyPatientShare": "본인부담금이 발생한 이유 설명 (왜 이 금액이 본인부담인지)",
    "insuranceAmountBreakdown": "보험금 상세 내역 (실손보험 얼마, 암보험 얼마 등 각각 구체적으로)",
    "requiredDocuments": ["필요한 서류 1", "필요한 서류 2", "필요한 서류 3"],
    "nextSteps": [
      "다음 단계 1 (구체적으로, 예: '보험금 청구를 위해 진료비 영수증 원본을 보험사에 제출하세요')",
      "다음 단계 2 (구체적으로)",
      "다음 단계 3 (구체적으로)",
      "다음 단계 4 (구체적으로)"
    ],
    "importantNotes": [
      "주의사항 1 (매우 구체적으로, 예: '면책기간 90일 이내 진료는 보험금 지급이 안 됩니다')",
      "주의사항 2 (매우 구체적으로)",
      "주의사항 3 (매우 구체적으로)",
      "주의사항 4 (매우 구체적으로)"
    ],
    "faq": [
      {
        "question": "자주 묻는 질문 1 (예: '실손보험에서 얼마나 받을 수 있나요?')",
        "answer": "답변 (구체적으로, 세대별 차이 설명 포함)"
      },
      {
        "question": "자주 묻는 질문 2 (예: '비급여 항목도 보장되나요?')",
        "answer": "답변 (구체적으로)"
      },
      {
        "question": "자주 묻는 질문 3 (예: '추가로 준비할 서류가 있나요?')",
        "answer": "답변 (구체적으로)"
      },
      {
        "question": "자주 묻는 질문 4",
        "answer": "답변 (구체적으로)"
      }
    ]
  }
}

**[중요 지침]**
- **영문 기록지 처리 (매우 중요!)**:
  * 영문 의료 용어를 정확히 인식하고 한글로 번역 (예: "Consultation" → "진찰", "Medication" → "투약", "Laboratory" → "검사")
  * 영문 약어도 정확히 해석 (예: "CBC" → "전혈구계산", "CT" → "전산화단층촬영", "MRI" → "자기공명영상", "US" → "초음파")
  * 진단명은 영문과 한글 병기 (예: "Hypertension" → "고혈압 (Hypertension)")
  * 수술명, 처치명도 영문과 한글 병기
  * 모든 영문 항목에 대해 한글 번역과 영문 원문을 모두 포함
- 모든 금액은 숫자만 추출 (예: "16,130원" → "16130", 쉼표 제거, 영문 기록지의 경우 "$" 또는 "USD" 등 통화 기호 제거)
- 진단명은 정확히 추출 (ICD 코드가 있으면 반드시 포함, 영문 진단명도 한글로 번역)
- 진료비 항목은 가능한 한 상세하게 추출 (모든 항목을 빠짐없이, 영문 항목명도 한글로 번역)
- 테이블 형식의 데이터도 모든 행을 빠짐없이 추출 (영문 테이블도 포함)
- 보험금 계산은 실제 보험 약관 기준으로 추정 (실손보험 세대별 기준 반드시 적용):
  * 실손보험 세대별 자기부담금 및 보장 비율:
    - 1세대 (2003.10~2009.9): 입원 0% (100% 보장) 또는 약국 5,000원, 통원 약 5,000원, 보장 비율 손보 100% / 생보 80%
    - 2세대 표준화 I (2009.10~2013.3): 입원 10% (연간 한도 200만원), 통원 10,000-20,000원/약국 8,000원 (10% 또는 그 이상), 보장 비율 90%
    - 2세대 표준화 II (2013.4~2015.8): 입원 10% 또는 20% 선택 (연간 한도 200만원), 통원 10,000-20,000원/약국 8,000원 (10% 또는 20% 또는 그 이상), 보장 비율 90% 또는 80% 선택
    - 2세대 표준화 III (2015.9~2017.3): 입원 급여 10% / 비급여 20% (연간 한도 200만원), 통원 10,000-20,000원/약국 8,000원 (급여 10% / 비급여 20% 또는 그 이상), 보장 비율 90% 또는 80% 선택
    - 3세대 (2017.4~2021.6): 입원 급여 10% / 비급여 20% (연간 한도 200만원), 통원 10,000-20,000원/약국 8,000원 [특약] 30% (최소 20,000원), 보장 비율 급여 90% / 비급여 80% / 특약 70%
    - 4세대 (2021.7~현재): 입원 급여 20% / 비급여 30% (급여는 건강보험 상한금액 적용), 통원 급여 10,000-20,000원 / 비급여 30,000원 (급여 20% / 비급여 30% 또는 그 이상), 보장 비율 급여 80% / 비급여 70%
    - 면책기간: 1세대/2세대 표준화 I 180일, 2세대 표준화 II/III/3세대 90일, 4세대 없음
    - 입원/통원 구분하여 각각 계산
    - 급여/비급여 구분하여 각각 계산
  * 암보험: 진단명이 암인 경우에만 적용
  * 특정질병보험: 해당 질병명이 특정질병에 해당하는 경우
- **데이터 검증 (매우 중요!)**:
  * 총 진료비 = 급여 총액 + 본인부담금 + 비급여 총액 (합계 일치 여부 확인)
  * 각 카테고리별 소계 합산이 총액과 일치하는지 확인 (진찰료+투약료+검사료+수술료+입원료+기타 = 총액)
  * 본인부담률 계산 검증: (본인부담금 / 급여 총액) × 100
  * 계산된 본인부담률과 실손보험 세대별 기준 비교하여 일치 여부 확인
  * 불일치 시 경고 표시 및 원인 분석
- 고객 설명은 전문 용어를 피하고 쉽게 설명하되, 중요한 정보는 빠짐없이 포함 (영문 용어는 한글로 번역하여 설명)
- 모든 정보는 이미지에서 직접 읽은 내용만 사용 (추측하지 말 것, 영문 기록지도 정확히 인식)
- 진료비 항목별로 급여/비급여 구분을 정확히 표시 (영문 기록지에서도 구분 가능)
- 병리 보고서인 경우 모든 진단 내용을 상세히 추출 (영문 원문도 포함)
- 보험금 계산 근거를 매우 구체적으로 설명 (어떤 보험이 얼마나 지급되는지, 왜 그런지, 세대별 차이 설명)
- 고객 가이드는 실제로 고객에게 말할 수 있을 정도로 구체적이고 실용적으로 작성
- 3대 비급여 특약 항목 자동 감지 (MRI, 도수치료, 체외충격파, 증식치료, 비급여 주사 등)
- 항목별 데이터 품질 표시 (높음/중간/낮음) - 인식이 불확실한 항목 표시`

    // MIME 타입 자동 감지
    let mimeType = 'image/png'
    if (imageBase64.includes('data:image/jpeg') || imageBase64.includes('data:image/jpg')) {
      mimeType = 'image/jpeg'
    } else if (imageBase64.includes('data:image/png')) {
      mimeType = 'image/png'
    } else if (imageBase64.includes('data:image/webp')) {
      mimeType = 'image/webp'
    }

    // 이미지와 프롬프트를 함께 전송 (fallback 포함)
    const result = await generateContentWithFallback(prompt, base64Data, mimeType)
    let analysisText = result.text

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

