import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { searchGoogle, SearchResult } from '@/lib/google-search'

// 검색 결과를 프롬프트용 불릿 문자열로 변환 (출처 표기 없이 내용만)
const formatSearchResultsForPrompt = (results: SearchResult[]): string => {
  if (!results || results.length === 0) return ''
  return results
    .slice(0, 5)
    .map((r, idx) => {
      const title = (r.title || '').replace(/\s+/g, ' ').trim().slice(0, 80)
      const snippet = (r.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 200)
      return `- (${idx + 1}) ${title} — ${snippet}`
    })
    .join('\n')
}

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
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[설계서 분석] GEMINI_API_KEY가 설정되지 않았습니다!')
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다. 서버 설정을 확인해주세요.' },
        { status: 500 }
      )
    }
    
    // API 키 일부만 로그 (디버깅용)
    const apiKeyPreview = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4)
    console.log('[설계서 분석] Gemini API 키 확인:', apiKeyPreview, '(길이:', apiKey.length, ')')
    console.log('[설계서 분석] 환경:', process.env.NODE_ENV || 'unknown')
    
    const genAI = new GoogleGenerativeAI(apiKey)
    
    // Fallback 로직: Gemini만 사용
    // 순서: Gemini-2.5-Pro → Gemini-2.0-Flash
    const generateContentWithFallback = async (
      prompt: string,
      base64Data: string,
      mimeType: string,
      usePro: boolean = true // 기본값: Pro 우선
    ): Promise<{ text: string; provider: 'gemini' }> => {
      // Gemini 폴백 순서: Gemini-2.5-Pro → Gemini-2.0-Flash
      const models = [
        { provider: 'gemini' as const, model: 'gemini-2.5-pro' },
        { provider: 'gemini' as const, model: 'gemini-2.0-flash' }
      ]
      
      console.log(`[설계서 분석] 🔄 Gemini 폴백 순서 시작: Gemini-2.5-Pro → Gemini-2.0-Flash`)
      
      for (let attempt = 0; attempt < models.length; attempt++) {
        const { provider, model: modelName } = models[attempt]
        
        try {
          console.log(`[설계서 분석] ${provider.toUpperCase()} 모델 시도: ${modelName} (시도 ${attempt + 1}/${models.length})`)
          
          // Gemini만 사용
          const model = genAI.getGenerativeModel({ 
            model: modelName,
            tools: [{ googleSearch: {} }] as any // Google Grounding 활성화
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
          
          // 그라운딩 결과 확인
          const groundingMetadata = response.candidates?.[0]?.groundingMetadata as any
          if (groundingMetadata) {
            console.log(`[설계서 분석] [${modelName}] 🔍 그라운딩 결과:`)
            console.log('  - 웹 검색 쿼리:', groundingMetadata.webSearchQueries || [])
            const chunks = groundingMetadata.groundingChunks || groundingMetadata.groundingChuncks || []
            console.log('  - 검색된 청크 수:', chunks.length)
          }
          
          if (text) {
            console.log(`[설계서 분석] ✅ Gemini 성공! (${modelName})`)
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
          
          console.error(`[설계서 분석] ${provider.toUpperCase()} ${modelName} 실패:`, {
            provider,
            model: modelName,
            error: errorMessage.substring(0, 500),
            isQuotaError
          })
          
          // 할당량 에러이고 마지막 모델이 아니면 다음 모델로 시도
          if (isQuotaError && attempt < models.length - 1) {
            const nextModel = models[attempt + 1]
            console.log(`[설계서 분석] ⚠️ ${modelName} 할당량 초과 → ${nextModel.provider.toUpperCase()} ${nextModel.model} 모델로 폴백 시도...`)
            // RPM 150 제한 대응: 할당량 초과 시 1초 지연 후 재시도
            console.log(`[설계서 분석] ⏳ 1초 대기 후 재시도...`)
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
          }
          
          // 마지막 모델이 아니면 다음 모델로 시도
          if (attempt < models.length - 1) {
            const nextModel = models[attempt + 1]
            console.log(`[설계서 분석] ⚠️ ${modelName} 실패 → ${nextModel.provider.toUpperCase()} ${nextModel.model} 모델로 폴백 시도...`)
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

    // 이미지 크기 확인 (디버깅용)
    const base64SizeKB = Math.round((base64Data.length * 3) / 4 / 1024) // Base64 크기 → 실제 바이트 크기 추정
    console.log(`[설계서 분석] 📊 이미지 크기: ${base64SizeKB} KB (Base64 길이: ${base64Data.length} 문자)`)
    
    // GPT-4o Vision API 제한: 최대 20MB (Base64 인코딩 후)
    // 참고: 실제로는 더 작은 크기에서도 거부할 수 있음
    if (base64SizeKB > 20000) {
      console.warn(`[설계서 분석] ⚠️ 이미지가 너무 큽니다 (${base64SizeKB} KB). GPT-4o는 20MB 제한이 있지만, 실제로는 더 작은 크기에서도 거부할 수 있습니다.`)
    }

    // MIME 타입 자동 감지
    let mimeType = 'image/png'
    if (imageBase64.includes('data:image/jpeg') || imageBase64.includes('data:image/jpg')) {
      mimeType = 'image/jpeg'
    } else if (imageBase64.includes('data:image/png')) {
      mimeType = 'image/png'
    } else if (imageBase64.includes('data:image/webp')) {
      mimeType = 'image/webp'
    }
    
    console.log(`[설계서 분석] 📋 이미지 형식: ${mimeType}`)

    // 1단계: 이미지에서 기본 정보 추출 (상품명 중심)
    // Flash 모델 사용 (기본 정보 추출은 Flash로 충분, Pro 할당량 절약)
    console.log('1단계: 이미지에서 기본 정보 추출 중... (Flash 모델 사용)')
    const basicInfoPrompt = `이 이미지는 보험 설계서/제안서입니다. 이미지에서 다음 정보만 추출해주세요:

**[추출할 정보]**
- 보험사명: 로고나 상단에 표시된 보험사 이름
- 보험 상품명: 제목이나 상품명란에 적힌 정확한 상품명
- 가입자 정보: 나이, 성별, 직업 (있는 경우)

**[출력 형식 - 반드시 JSON만 출력]**
{
  "productName": "보험사명 + 보험상품명",
  "targetPersona": "나이대 + 성별 + 직업 (있는 경우)",
  "premium": "월보험료 또는 연보험료 (있는 경우)",
  "coverages": ["담보명1", "담보명2"],
  "specialClauses": ["특약명1", "특약명2"]
}

⚠️ 이미지에 명시된 정확한 정보만 추출하세요. 추정하지 마세요.`

    // 1단계는 Flash/GPT-4o-mini 모델 사용 (Pro 할당량 절약, 50:50 분산)
    const basicResult = await generateContentWithFallback(basicInfoPrompt, base64Data, mimeType, false)
    console.log(`[설계서 분석] 1단계 완료 - 사용된 제공자: ${basicResult.provider.toUpperCase()}`)
    let basicAnalysisText = basicResult.text
    basicAnalysisText = basicAnalysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    basicAnalysisText = basicAnalysisText.replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')

    let basicData: any = {}
    try {
      const jsonMatch = basicAnalysisText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        basicData = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.warn('기본 정보 추출 실패, 텍스트에서 추출 시도')
      const productMatch = basicAnalysisText.match(/"productName"\s*:\s*"([^"]+)"/) || 
                          basicAnalysisText.match(/productName["\s]*:\s*"([^"]+)"/i)
      basicData = {
        productName: productMatch?.[1]?.trim() || '보험 상품'
      }
    }

    const extractedProductName = basicData.productName || '보험 상품'
    console.log('[설계서 분석] 추출된 상품명:', extractedProductName)

    // 2단계: 추출된 상품명으로 최신 정보 검색
    let searchResultsText = ''
    let customSearchCount = 0 // 커스텀 서치 횟수 추적
    
    console.log('[설계서 분석] 2단계 조건 확인:', {
      extractedProductName,
      isNotEmpty: !!extractedProductName,
      isNotDefault: extractedProductName !== '보험 상품',
      willSearch: extractedProductName && extractedProductName !== '보험 상품'
    })
    
    if (extractedProductName && extractedProductName !== '보험 상품') {
      console.log('[설계서 분석] 2단계: 최신 정보 검색 시작 - 상품명:', extractedProductName)
      try {
        const searchQueries = Array.from(new Set([
          `${extractedProductName} 후기`,
          `${extractedProductName} 특약`,
          `${extractedProductName} 장점`,
          `${extractedProductName} 가입`
        ]))
        
        const collected: SearchResult[] = []
        const seen = new Set<string>()
        
        for (const q of searchQueries) {
          try {
            const res = await searchGoogle(q, 3)
            customSearchCount++ // 커스텀 서치 횟수 추적
            if (res.success && res.results.length > 0) {
              for (const r of res.results) {
                if (r.link && !seen.has(r.link)) {
                  seen.add(r.link)
                  collected.push(r)
                }
              }
            }
            // 호출 간 짧은 대기 (쿼터 보호)
            await new Promise(resolve => setTimeout(resolve, 120))
          } catch (err) {
            console.warn('⚠️ 설계서 검색 오류:', q, err)
          }
        }
        
        console.log('[설계서 분석] 🔍 검색 완료 - 수집된 결과:', collected.length, '건')
        if (collected.length > 0) {
          console.log('[설계서 분석] 검색 결과 샘플:', collected.slice(0, 2).map(r => ({
            title: r.title?.substring(0, 50) || '(제목 없음)',
            snippet: r.snippet?.substring(0, 50) || '(스니펫 없음)',
            link: r.link?.substring(0, 50) || '(링크 없음)'
          })))
          
          searchResultsText = formatSearchResultsForPrompt(collected)
          console.log('[설계서 분석] 🔍 포맷된 검색 결과 텍스트 길이:', searchResultsText.length, '글자')
          if (searchResultsText.length > 0) {
            console.log('[설계서 분석] 포맷된 검색 결과 샘플 (처음 300자):', searchResultsText.substring(0, 300))
          } else {
            console.log('[설계서 분석] ⚠️ 포맷된 검색 결과가 비어있습니다! collected 배열 확인:', collected)
          }
        } else {
          console.log('[설계서 분석] ⚠️ 검색 결과가 비어있습니다!')
          searchResultsText = ''
        }
      } catch (searchError) {
        console.error('[설계서 분석] ⚠️ 검색 오류:', searchError)
        searchResultsText = ''
      }
    } else {
      console.log('[설계서 분석] 2단계 건너뜀 - 상품명이 없거나 기본값입니다.')
    }

    // 3단계: 검색 결과를 포함한 최종 분석 프롬프트
    // 1단계에서 추출한 기본 정보를 프롬프트에 포함
    const basicInfoContext = basicData.productName && basicData.productName !== '보험 상품' 
      ? `**[1단계에서 이미 추출한 정보 - 반드시 사용하세요!]**
다음은 이미지에서 이미 추출한 기본 정보입니다. 이 정보를 기반으로 더 상세한 분석을 수행해주세요:
- 상품명: ${basicData.productName || '미확인'}
- 대상: ${basicData.targetPersona || '미확인'}
- 보험료: ${basicData.premium || '미확인'}
- 담보: ${basicData.coverages?.length > 0 ? basicData.coverages.join(', ') : '미확인'}
- 특약: ${basicData.specialClauses?.length > 0 ? basicData.specialClauses.join(', ') : '미확인'}

⚠️ **중요**: 위 정보는 이미지에서 추출한 것이므로, 이를 기반으로 worryPoint와 sellingPoint를 더 구체적으로 작성해주세요. 이 정보를 무시하지 마세요!` 
      : ''
    
    // 검색 결과가 있는지 확인
    const hasSearchResults = searchResultsText && searchResultsText.length > 100
    console.log(`[설계서 분석] 검색 결과 포함 여부: ${hasSearchResults ? '예' : '아니오'} (길이: ${searchResultsText?.length || 0} 문자)`)
    
    const prompt = `이 이미지는 보험 설계서/제안서입니다. 이미지를 자세히 읽고, 표시된 모든 텍스트와 데이터를 정확히 추출해주세요.

${basicInfoContext}

${searchResultsText ? `**[최근 검색 요약]**
다음은 "${extractedProductName}"에 대한 최신 정보입니다. 이 정보를 참고하여 더 정확하고 현실적인 분석을 수행해주세요:
${searchResultsText}

⚠️ 검색 결과는 참고용이며, 이미지에 명시된 정보가 우선입니다.` : ''}

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

${searchResultsText ? `4단계: 검색 결과 활용
- 위의 검색 결과를 참고하여 이 상품에 대한 고객의 실제 고민점(worryPoint)을 파악하세요
- 검색 결과를 바탕으로 이 상품의 주요 장점(sellingPoint)을 현실적으로 정리하세요
- 검색 결과에 나온 최신 정보(후기, 특약, 장점 등)를 반영하여 더 정확한 분석을 제공하세요` : ''}

**[출력 형식 - 반드시 JSON만 출력]**
{
  "productName": "보험사명 + 보험상품명 (1단계에서 추출한 정보를 기반으로, 이미지에서 정확히 확인)",
  "targetPersona": "나이대 + 성별 + 직업 (1단계에서 추출한 정보를 기반으로, 이미지에서 정확히 확인)",
  "worryPoint": "이 보험을 고려하는 고객의 실제 고민 (검색 결과를 반드시 참고하여 구체적이고 현실적으로 작성. 예: '보험료 부담', '보장 범위 충분성', '특약 구성' 등)",
  "sellingPoint": "이 보험의 주요 장점 2-3개를 구체적으로 작성 (검색 결과를 반드시 참고하여 정확하게 작성. 예: '저렴한 보험료', '넓은 보장 범위', '특약 선택의 자유도' 등)",
  "premium": "월보험료 또는 연보험료 (1단계에서 추출한 정보를 기반으로, 예: '월 3만원', '연 36만원')",
  "coverages": ["담보명1", "담보명2", "담보명3"] (1단계에서 추출한 정보를 기반으로),
  "specialClauses": ["특약명1", "특약명2"] (1단계에서 추출한 정보를 기반으로)
}

⚠️ **중요**: 
- productName, targetPersona, premium, coverages, specialClauses는 1단계에서 이미 추출한 정보를 우선 사용하되, 이미지를 다시 확인하여 정확성을 검증하세요.
- worryPoint와 sellingPoint는 반드시 검색 결과를 참고하여 구체적이고 현실적으로 작성하세요. 일반적인 문구가 아닌, 이 상품에 특화된 내용을 작성하세요.

**[최종 확인]**
- productName: 이미지에 실제로 보이는 보험사명과 상품명인가?
- 보험 종류: 이미지에 명시된 보험 종류와 일치하는가?
- worryPoint: 검색 결과를 참고하여 실제 고객 고민을 반영했는가?
- sellingPoint: 검색 결과를 참고하여 현실적인 장점을 정리했는가?
- 모든 정보는 이미지에서 직접 읽은 내용을 우선하고, 검색 결과는 보완적으로 활용하세요.`

    // 3단계: 최종 분석 수행 (검색 결과 포함 + 그라운딩 활성화)
    // Pro 모델 사용 (고품질 분석 필요)
    console.log('[설계서 분석] 3단계: 최종 분석 시작 (Pro 모델 사용)')
    console.log('[설계서 분석]   - 검색 결과 포함 여부:', searchResultsText && searchResultsText.length > 0 ? '예' : '아니오')
    console.log('[설계서 분석]   - 검색 결과 텍스트 길이:', searchResultsText.length, '글자')
    console.log('[설계서 분석]   - 그라운딩: 활성화')
    
    // 1단계와 3단계 사이 최소 간격 보장 (RPM 제한 방지)
    await new Promise(resolve => setTimeout(resolve, 2000)) // 2초 대기
    
    // 이미지와 프롬프트를 함께 전송 (그라운딩 활성화, fallback 포함, Pro/GPT-4o 우선, 50:50 분산)
    const finalResult = await generateContentWithFallback(prompt, base64Data, mimeType, true)
    console.log(`[설계서 분석] 3단계 완료 - 사용된 제공자: ${finalResult.provider.toUpperCase()}`)
    let analysisText = finalResult.text

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
      
      // GPT 거부 메시지인지 확인
      const isRejectionMessage = 
        analysisText.toLowerCase().includes("i'm sorry") ||
        analysisText.toLowerCase().includes("i can't assist") ||
        analysisText.toLowerCase().includes("cannot assist") ||
        analysisText.toLowerCase().includes("unable to") ||
        analysisText.toLowerCase().includes("cannot help") ||
        analysisText.toLowerCase().includes("죄송합니다") ||
        analysisText.toLowerCase().includes("죄송하지만") ||
        analysisText.toLowerCase().includes("죄송") ||
        analysisText.toLowerCase().includes("도와드릴 수 없") ||
        analysisText.toLowerCase().includes("어려움이 있습니다") ||
        analysisText.toLowerCase().includes("제공되지 않습니다") ||
        analysisText.toLowerCase().includes("인식하고 분석하는 데") ||
        analysisText.toLowerCase().includes("이미지를 인식")
      
      if (isRejectionMessage) {
        console.warn('[설계서 분석] ⚠️ GPT 거부 메시지 감지됨. 1단계에서 추출한 정보와 검색 결과를 활용합니다.')
        
        // 검색 결과에서 worryPoint와 sellingPoint 자동 추출 시도
        let autoWorryPoint = '보험료와 보장 범위가 적절한지 궁금합니다'
        let autoSellingPoint = '보장 범위가 넓고 합리적인 보험료입니다'
        
        if (searchResultsText && searchResultsText.length > 100) {
          // 검색 결과에서 고민 관련 키워드 추출
          const worryKeywords = ['고민', '걱정', '우려', '부담', '비용', '보험료', '보장', '부족', '적합', '필요']
          const sellingKeywords = ['장점', '좋은', '추천', '유리', '저렴', '넓은', '다양', '특약', '보장']
          
          const worryMatches = worryKeywords.filter(kw => searchResultsText.includes(kw))
          const sellingMatches = sellingKeywords.filter(kw => searchResultsText.includes(kw))
          
          if (worryMatches.length > 0 || sellingMatches.length > 0) {
            // 검색 결과의 첫 500자를 기반으로 간단한 요약 생성
            const searchPreview = searchResultsText.substring(0, 500)
            
            // worryPoint 생성: 검색 결과에서 고민 관련 문구 찾기
            if (worryMatches.length > 0) {
              const worryContext = searchPreview.match(/(.{0,100}(?:고민|걱정|우려|부담|비용|보험료|보장|부족|적합|필요).{0,100})/i)
              if (worryContext) {
                autoWorryPoint = `${extractedProductName}에 대해 ${worryContext[1].substring(0, 80)}...`
              } else {
                autoWorryPoint = `${extractedProductName}의 보험료와 보장 범위에 대한 고민`
              }
            }
            
            // sellingPoint 생성: 검색 결과에서 장점 관련 문구 찾기
            if (sellingMatches.length > 0) {
              const sellingContext = searchPreview.match(/(.{0,100}(?:장점|좋은|추천|유리|저렴|넓은|다양|특약|보장).{0,100})/i)
              if (sellingContext) {
                autoSellingPoint = `${extractedProductName}의 ${sellingContext[1].substring(0, 80)}...`
              } else {
                autoSellingPoint = `${extractedProductName}의 합리적인 보험료와 넓은 보장 범위`
              }
            }
          } else {
            // 키워드가 없어도 검색 결과가 있으면 기본 문구 생성
            autoWorryPoint = `${extractedProductName}의 보험료와 보장 범위에 대한 고민`
            autoSellingPoint = `${extractedProductName}의 합리적인 보험료와 넓은 보장 범위`
          }
        }
        
        // 1단계에서 추출한 정보를 기반으로 최소한의 데이터 구성
        analysisData = {
          productName: basicData.productName || '보험 상품',
          targetPersona: basicData.targetPersona || '30대 직장인',
          worryPoint: autoWorryPoint,
          sellingPoint: autoSellingPoint,
          premium: basicData.premium || '',
          coverages: basicData.coverages || [],
          specialClauses: basicData.specialClauses || []
        }
        
        console.log('[설계서 분석] 🔄 검색 결과 기반 자동 생성:', {
          worryPoint: autoWorryPoint,
          sellingPoint: autoSellingPoint
        })
      } else {
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

        // 추출한 정보와 1단계 정보를 병합 (추출한 정보가 우선)
        analysisData = {
          productName: productMatch?.[1]?.trim() || basicData.productName || '보험 상품',
          targetPersona: targetMatch?.[1]?.trim() || basicData.targetPersona || '30대 직장인',
          worryPoint: worryMatch?.[1]?.trim() || (searchResultsText ? `${extractedProductName}에 대한 고객의 주요 고민점` : '보험료와 보장 범위가 적절한지 궁금합니다'),
          sellingPoint: sellingMatch?.[1]?.trim() || (searchResultsText ? `${extractedProductName}의 주요 장점` : '보장 범위가 넓고 합리적인 보험료입니다'),
          premium: premiumMatch?.[1]?.trim() || basicData.premium || '',
          coverages: coveragesMatch?.[1] ? coveragesMatch[1].split(',').map(s => s.trim().replace(/["']/g, '')).filter(Boolean) : (basicData.coverages || []),
          specialClauses: specialClausesMatch?.[1] ? specialClausesMatch[1].split(',').map(s => s.trim().replace(/["']/g, '')).filter(Boolean) : (basicData.specialClauses || [])
        }
        
        console.log('추출된 데이터:', analysisData)
      }
    }

    console.log('설계서 분석 완료:', analysisData)
    console.log('[설계서 분석] 커스텀 서치 횟수:', customSearchCount)

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
      },
      // 설계서 분석 비용 정보 (클라이언트에서 표시 가능)
      usage: {
        customSearchCount: customSearchCount,
        customSearchCost: customSearchCount * 0.0005 // USD
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

