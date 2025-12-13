import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateQuestionPrompt, generateAnswerPrompt, generateConversationThreadPrompt, generateReviewMessagePrompt, generateReviewResponsePrompt, ConversationMessage } from '@/lib/prompts/qa-prompt'
import { createClient } from '@/lib/supabase/server'
import { searchGoogle, SearchResult } from '@/lib/google-search'

type TokenUsage = {
  model: string
  promptTokens: number
  candidatesTokens: number
  totalTokens: number
}

type CostEstimate = {
  currency: 'USD'
  totalCost: number | null
  details: Array<{
    model: string
    cost: number | null
    promptTokens: number
    completionTokens: number
  }>
}

type CostRate = {
  prompt: number | null
  completion: number | null
}

type CostRates = {
  [key: string]: CostRate
} & {
  'gemini-2.0-flash': CostRate
  'gemini-2.5-pro': CostRate
}

const getCostRates = (): CostRates => {
  const toNumber = (v?: string, defaultValue?: number) => {
    const n = v ? parseFloat(v) : defaultValue ?? NaN
    return Number.isFinite(n) ? n : null
  }

  return {
    'gemini-2.0-flash': {
      prompt: toNumber(process.env.GEMINI_FLASH_2_0_INPUT_COST_PER_1M, 0.10),
      completion: toNumber(process.env.GEMINI_FLASH_2_0_OUTPUT_COST_PER_1M, 0.40)
    },
    'gemini-2.5-pro': {
      prompt: toNumber(process.env.GEMINI_PRO_2_5_INPUT_COST_PER_1M, 1.25),
      completion: toNumber(process.env.GEMINI_PRO_2_5_OUTPUT_COST_PER_1M, 10.00)
    }
  }
}

const estimateCost = (usages: TokenUsage[]): CostEstimate => {
  const rates = getCostRates()
  const details: CostEstimate['details'] = usages.map((u) => {
    const rate = rates[u.model] || { prompt: null, completion: null }
    const cost =
      rate.prompt !== null && rate.completion !== null
        ? (u.promptTokens / 1_000_000) * rate.prompt + (u.candidatesTokens / 1_000_000) * rate.completion
        : null
    return {
      model: u.model,
      cost,
      promptTokens: u.promptTokens,
      completionTokens: u.candidatesTokens
    }
  })

  const totalCost = details.some((d) => d.cost !== null)
    ? details.reduce((sum, d) => sum + (d.cost || 0), 0)
    : null

  return {
    currency: 'USD',
    totalCost,
    details
  }
}

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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const requestBody = await request.json()
    const { 
      productName, 
      targetPersona, 
      worryPoint, 
      sellingPoint, 
      feelingTone, 
      answerTone,
      customerStyle, // 고객 스타일: 'friendly' | 'cold' | 'brief' | 'curious'
      answerLength, // 답변 길이: 'short' (150-250자) | 'default' (300-700자)
      designSheetImage,
      designSheetAnalysis, // 설계서 분석 결과 (보험료, 담보, 특약 등)
      questionTitle, // 답변 재생성 시 사용
      questionContent, // 답변 재생성 시 사용
      conversationMode, // 대화형 모드 활성화 여부
      conversationLength, // 대화 횟수 (6, 8, 10, 12 - 짝수만 허용, 항상 설계사가 마무리)
      generateStep // 생성 단계: 'question' | 'answer' | 'conversation' | 'all' (기본값: 'all')
    } = requestBody

    // 필수 입력 검증
    if (!productName || !targetPersona || !worryPoint || !sellingPoint) {
      return NextResponse.json(
        { error: '필수 입력 항목을 모두 입력해주세요' },
        { status: 400 }
      )
    }

    console.log('Q&A 생성 시작:', { productName, targetPersona, worryPoint, sellingPoint })
    
    // 환경 변수 확인 (디버깅용)
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY가 설정되지 않았습니다!')
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다. 서버 설정을 확인해주세요.' },
        { status: 500 }
      )
    }
    
    // API 키 일부만 로그 (보안)
    const apiKeyPreview = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4)
    console.log('Gemini API 키 확인:', apiKeyPreview, '(길이:', apiKey.length, ')')
    console.log('환경:', process.env.NODE_ENV || 'unknown')

    // Gemini API 초기화
    const genAI = new GoogleGenerativeAI(apiKey)
    
    // ============================================
    // ⚠️ 테스트용: 토큰 사용량 추적
    // 실제 운영 시에는 이 부분을 제거해야 합니다
    // ============================================
    const tokenUsage: TokenUsage[] = []
    let customSearchCount = 0 // 커스텀 서치 횟수 추적
    
    // ============================================
    // Q&A 전용 최신 검색 요약 (뉴스/블로그/커뮤니티 포함, 출처 표기 없음)
    // ============================================
    let searchResultsText = ''
    try {
      const searchQueries = Array.from(new Set([
        `${productName} 후기`,
        `${productName} 특약`,
        `${productName} 장점`,
        `${productName} ${targetPersona}`,
        `${productName} ${worryPoint}`,
        `${productName} ${sellingPoint}`
      ]))
      
      const collected: SearchResult[] = []
      const seen = new Set<string>()
      
      console.log('[Q&A 생성] 검색 시작 - 검색 쿼리 개수:', searchQueries.length)
      
      for (const q of searchQueries) {
        try {
          const res = await searchGoogle(q, 3)
          customSearchCount++ // 커스텀 서치 횟수 추적 (호출당 1회)
          console.log('[Q&A 생성] 검색 완료:', q, '- 커스텀 서치 횟수:', customSearchCount)
          
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
          console.warn('[Q&A 생성] ⚠️ 검색 오류:', q, err)
          // 에러가 나도 검색 시도는 했으므로 카운트는 이미 증가됨
        }
      }
      
      searchResultsText = formatSearchResultsForPrompt(collected)
      console.log('[Q&A 생성] 🔍 검색 완료 - 수집된 결과:', collected.length, '건, 커스텀 서치 총 횟수:', customSearchCount)
    } catch (searchError) {
      console.error('[Q&A 생성] ⚠️ 검색 요약 생성 중 오류:', searchError)
      searchResultsText = ''
      console.log('[Q&A 생성] 검색 오류 발생했지만 커스텀 서치 횟수:', customSearchCount)
    }
    
    console.log('[Q&A 생성] 최종 커스텀 서치 횟수:', customSearchCount)
    
    // API 호출 헬퍼 함수 (재시도 및 폴백 로직 포함, 이미지 지원, 하이브리드 모델 선택)
    // 
    // Flash 사용 위치 (비용 절감):
    // - 질문 생성 (Step 1)
    // - 고객 댓글 (대화형 모드, 홀수 step)
    //
    // Pro 사용 위치 (품질 유지):
    // - 답변 생성 (Step 2)
    // - 설계사 댓글 (대화형 모드, 짝수 step)
    //
    // 폴백 로직: 할당량 초과 시에만 다른 모델로 폴백
    const generateContentWithFallback = async (
      prompt: string, 
      imageBase64?: string | null,
      useFlash: boolean = false // true: Flash 사용, false: Pro 사용
    ): Promise<{ text: string; usage?: TokenUsage }> => {
      // 하이브리드 방식: useFlash가 true면 Flash 우선, false면 Pro 우선
      // 할당량 초과 시에만 폴백 (일반 에러는 즉시 실패)
      const models = useFlash 
        ? ['gemini-2.0-flash', 'gemini-2.5-pro'] // Flash 우선 → 할당량 초과 시 Pro 폴백
        : ['gemini-2.5-pro', 'gemini-2.0-flash'] // Pro 우선 → 할당량 초과 시 Flash 폴백
      
      // 이미지가 있으면 MIME 타입 감지
      let mimeType = 'image/png'
      let base64Data = ''
      if (imageBase64) {
        base64Data = imageBase64.includes(',') 
          ? imageBase64.split(',')[1] 
          : imageBase64
        
        if (imageBase64.includes('data:image/jpeg') || imageBase64.includes('data:image/jpg')) {
          mimeType = 'image/jpeg'
        } else if (imageBase64.includes('data:image/png')) {
          mimeType = 'image/png'
        } else if (imageBase64.includes('data:image/webp')) {
          mimeType = 'image/webp'
        }
      }
      
      for (let attempt = 0; attempt < models.length; attempt++) {
        const modelName = models[attempt]
        // 그라운딩 활성화 (Google Search 통합)
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          tools: [{ googleSearch: {} }] as any // Google Grounding 활성화 (타입 체크 우회)
        })
        
        try {
          console.log(`모델 시도: ${modelName} (시도 ${attempt + 1}/${models.length}, 그라운딩: 활성화)`)
          
          // 이미지가 있으면 이미지와 텍스트를 함께 전송
          let result
          if (imageBase64 && base64Data) {
            result = await model.generateContent([
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              },
              prompt
            ])
          } else {
            // 이미지가 없으면 텍스트만 전송
            result = await model.generateContent(prompt)
          }
          
          const response = await result.response
          const text = response.text().trim()
          
          // 그라운딩 결과 확인 및 로그 출력
          const groundingMetadata = response.candidates?.[0]?.groundingMetadata as any
          if (groundingMetadata) {
            console.log(`[${modelName}] 🔍 그라운딩 결과:`)
            console.log(`  - 웹 검색 쿼리:`, groundingMetadata.webSearchQueries || [])
            const chunks = groundingMetadata.groundingChunks || groundingMetadata.groundingChuncks || []
            console.log(`  - 검색된 청크 수:`, chunks.length)
            if (chunks.length > 0) {
              console.log(`  - 검색된 청크 샘플:`)
              chunks.slice(0, 3).forEach((chunk: any, idx: number) => {
                console.log(`    [${idx + 1}] ${chunk.web?.uri || chunk.retrievalMetadata?.uri || '알 수 없음'}`)
              })
            }
          } else {
            console.log(`[${modelName}] ⚠️ 그라운딩 메타데이터가 없습니다. (그라운딩이 실행되지 않았을 수 있음)`)
          }
          
          // 토큰 사용량 추출
          const usageMetadata = response.usageMetadata
          const usage: TokenUsage = {
            model: modelName,
            promptTokens: usageMetadata?.promptTokenCount || 0,
            candidatesTokens: usageMetadata?.candidatesTokenCount || 0,
            totalTokens: usageMetadata?.totalTokenCount || 0
          }
          
          if (usage.totalTokens > 0) {
            console.log(`토큰 사용량 (${modelName}):`, usage)
            tokenUsage.push(usage)
          }
          
          return { text, usage }
        } catch (error: any) {
          const errorMessage = error?.message || ''
          const errorString = JSON.stringify(error || {})
          
          // 429 에러 또는 할당량 관련 에러 감지 (더 포괄적으로)
          const isQuotaError = 
            errorMessage.includes('429') || 
            errorMessage.includes('quota') || 
            errorMessage.includes('rate limit') ||
            errorMessage.includes('Too Many Requests') ||
            errorMessage.includes('exceeded') ||
            errorString.includes('free_tier') ||
            errorString.includes('QuotaFailure')
          
          const errorCode = error?.code || error?.status || 'unknown'
          console.error(`${modelName} 모델 호출 실패:`, {
            model: modelName,
            error: errorMessage.substring(0, 500), // 처음 500자만
            code: errorCode,
            isQuotaError,
            hasFreeTier: errorString.includes('free_tier')
          })
          
          // 할당량 에러이고 마지막 모델이 아니면 다음 모델로 시도
          if (isQuotaError && attempt < models.length - 1) {
            const nextModel = models[attempt + 1]
            console.log(`⚠️ ${modelName} 할당량 초과 → ${nextModel} 모델로 폴백 시도...`)
            // 짧은 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
            continue
          }
          
          // 마지막 모델이거나 할당량 에러가 아니면 에러 던지기
          if (attempt === models.length - 1) {
            throw error
          }
        }
      }
      
      throw new Error('모든 모델 시도 실패')
    }
    
    // 토큰 사용량 합계 계산
    const calculateTotalUsage = (): TokenUsage => {
      return tokenUsage.reduce((acc, usage) => ({
        model: 'total',
        promptTokens: acc.promptTokens + usage.promptTokens,
        candidatesTokens: acc.candidatesTokens + usage.candidatesTokens,
        totalTokens: acc.totalTokens + usage.totalTokens
      }), { model: 'total', promptTokens: 0, candidatesTokens: 0, totalTokens: 0 })
    }

    // generateStep에 따라 생성 단계 결정
    const requestedStep = requestBody.generateStep || 'all' // 'question' | 'answer' | 'conversation' | 'all'
    
    let finalQuestionTitle = questionTitle
    let finalQuestionContent = questionContent
    let answerContent = '' // 답변 변수 미리 선언

    // Step 1: 질문 생성
    if (requestedStep === 'question' || requestedStep === 'all') {
      if (!questionTitle || !questionContent) {
        console.log('Step 1: 질문 생성 중...')
      const questionPrompt = generateQuestionPrompt({
        productName,
        targetPersona,
        worryPoint,
        sellingPoint,
        feelingTone: feelingTone || '고민',
        answerTone: answerTone || 'friendly',
        customerStyle: customerStyle || 'curious',
        designSheetImage,
        designSheetAnalysis,
        searchResultsText
      })

      // 하이브리드: 질문 생성은 Flash 사용 (비용 절감)
      const questionResult = await generateContentWithFallback(questionPrompt, designSheetImage, true)
      let questionText = questionResult.text

      // 제어 문자 제거 (<ctrl63>, <ctrl*> 등)
      questionText = questionText.replace(/<ctrl\d+>/gi, '')
      questionText = questionText.replace(/[\x00-\x1F\x7F]/g, '') // 기타 제어 문자 제거

      // 제목과 본문 분리
      const titleMatch = questionText.match(/제목:\s*([\s\S]+?)(?:\n|본문:)/)
      const contentMatch = questionText.match(/본문:\s*([\s\S]+?)$/)
      
      finalQuestionTitle = titleMatch 
        ? titleMatch[1].trim().replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')
        : questionText.split('\n')[0].trim().replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')
      
      const rawQuestionContent = contentMatch 
        ? contentMatch[1].trim().replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')
        : questionText.split('\n').slice(1).join('\n').trim().replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')

      // 질문 본문 줄단락 자동 재배치 (문단 최소 3개 확보)
      const formatQuestionContent = (text: string): string => {
        let cleaned = (text || '')
          .replace(/```[\s\S]*?```/g, '')
          .replace(/[ \t]+/g, ' ')
          .split('\n')
          .map(line => line.trim())
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()

        const existingParagraphs = cleaned.split(/\n\s*\n/).filter(p => p.trim().length > 0)
        if (existingParagraphs.length >= 3) {
          return existingParagraphs.join('\n\n').trim()
        }

        // 문장 단위 분리 (질문/감탄 위주 구두점)
        const sentenceCandidates = cleaned
          .replace(/\n+/g, ' ')
          .split(/(?<=[?!])\s+/)
          .filter(s => s.trim().length > 0)

        const buildParagraphsFromSentences = (sentences: string[], target: number): string[] => {
          if (sentences.length === 0) return []
          const sentencesPerParagraph = Math.max(1, Math.ceil(sentences.length / target))
          const grouped: string[] = []
          for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
            const chunk = sentences.slice(i, i + sentencesPerParagraph).join(' ').trim()
            if (chunk.length > 0) grouped.push(chunk)
          }
          return grouped
        }

        let paragraphs = sentenceCandidates.length > 0
          ? buildParagraphsFromSentences(sentenceCandidates, Math.min(4, Math.max(3, sentenceCandidates.length)))
          : []

        // 구두점이 거의 없을 때 단어 단위로 분리
        if (paragraphs.length < 3) {
          const words = cleaned.split(/\s+/).filter(Boolean)
          const wordsPerParagraph = Math.max(5, Math.ceil(words.length / 3))
          const wordParagraphs: string[] = []
          for (let i = 0; i < words.length; i += wordsPerParagraph) {
            const chunk = words.slice(i, i + wordsPerParagraph).join(' ').trim()
            if (chunk.length > 0) wordParagraphs.push(chunk)
          }
          paragraphs = wordParagraphs
        }

        if (paragraphs.length === 2 && paragraphs[1].length > 120) {
          // 2개만 만들어졌을 때는 두 번째 문단을 반으로 나눠 3개로 보정
          const second = paragraphs.pop() as string
          const words = second.split(/\s+/)
          const mid = Math.ceil(words.length / 2)
          paragraphs.push(words.slice(0, mid).join(' ').trim())
          paragraphs.push(words.slice(mid).join(' ').trim())
        }

        const finalParagraphs = paragraphs.filter(p => p.trim().length > 0)
        return finalParagraphs.length > 0 ? finalParagraphs.join('\n\n').trim() : cleaned
      }

      finalQuestionContent = formatQuestionContent(rawQuestionContent)

        console.log('Step 1 완료:', { questionTitle: finalQuestionTitle, questionContentLength: finalQuestionContent.length })
      } else {
        console.log('Step 1 생략: 기존 질문 사용')
      }
    } else {
      console.log('Step 1 생략: requestedStep이 question이 아님')
      if (!questionTitle || !questionContent) {
        return NextResponse.json(
          { error: '질문이 필요합니다. 먼저 질문을 생성해주세요.' },
          { status: 400 }
        )
      }
    }

    // Step 2: 답변 생성
    if (requestedStep === 'answer' || requestedStep === 'all') {
      if (!finalQuestionTitle || !finalQuestionContent) {
        return NextResponse.json(
          { error: '질문이 필요합니다. 먼저 질문을 생성해주세요.' },
          { status: 400 }
        )
      }
      
      console.log('Step 2: 답변 생성 중...')
      const answerPrompt = generateAnswerPrompt(
        {
          productName,
          targetPersona,
          worryPoint,
          sellingPoint,
          feelingTone: feelingTone || '고민',
          answerTone: answerTone || 'friendly',
          customerStyle: customerStyle || 'curious',
          answerLength: answerLength || 'default', // 답변 길이 추가
          designSheetImage,
          designSheetAnalysis,
          searchResultsText
        },
        finalQuestionTitle,
        finalQuestionContent
      )

      // 하이브리드: 답변 생성은 Pro 사용 (품질 유지)
      const answerResult = await generateContentWithFallback(answerPrompt, designSheetImage, false)
      answerContent = answerResult.text

      // 제어 문자 제거 (<ctrl63>, <ctrl*> 등) - 이모티콘 보존
      answerContent = answerContent.replace(/<ctrl\d+>/gi, '')
      // 제어 문자 제거 (단, 줄바꿈(\n), 캐리지 리턴(\r), 탭(\t)은 제외하고 이모티콘은 보존)
      answerContent = answerContent.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')

      // 마크다운이나 코드 블록 제거
      answerContent = answerContent.replace(/```[\s\S]*?```/g, '').trim()
      answerContent = answerContent.replace(/\[생성된 답변\]/g, '').trim()

      // 답변 포맷팅 개선 (띄어쓰기 및 문단 구분)
      // 1. 연속된 공백을 하나로 정리
      answerContent = answerContent.replace(/[ \t]+/g, ' ')
      
      // 2. 각 줄 앞뒤 공백 정리 (단, 줄바꿈은 유지)
      answerContent = answerContent.split('\n').map(line => line.trim()).join('\n')
      
      // 2-1. 만약 줄바꿈이 전혀 없거나 부족한 경우, 4-5문단으로 자동 분리
      const paragraphs = answerContent.split(/\n\s*\n/).filter(p => p.trim().length > 0)
      
      if (paragraphs.length < 4 && answerContent.length > 100) {
        // 문장 단위로 분리하여 4-5문단으로 재구성
        const sentences = answerContent
          .replace(/\n+/g, ' ') // 모든 줄바꿈을 공백으로
          .split(/([.!?]\s+)/) // 문장 단위로 분리
          .filter(s => s.trim().length > 0)
        
        // 문장들을 그룹화하여 4-5문단으로 나누기
        const targetParagraphs = 4 + Math.floor(Math.random() * 2) // 4 또는 5문단
        const sentencesPerParagraph = Math.ceil(sentences.length / targetParagraphs)
        const newParagraphs: string[] = []
        
        for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
          const paragraphSentences = sentences.slice(i, i + sentencesPerParagraph)
          const paragraph = paragraphSentences.join(' ').trim()
          if (paragraph.length > 0) {
            newParagraphs.push(paragraph)
          }
        }
        
        // 4-5문단이 안 되면 조정
        if (newParagraphs.length < 4 && newParagraphs.length > 0) {
          // 마지막 문단을 나누어 4개 이상 만들기
          const lastParagraph = newParagraphs[newParagraphs.length - 1]
          const lastSentences = lastParagraph.split(/([.!?]\s+)/).filter(s => s.trim().length > 0)
          if (lastSentences.length >= 2) {
            newParagraphs.pop()
            const midPoint = Math.ceil(lastSentences.length / 2)
            newParagraphs.push(lastSentences.slice(0, midPoint).join(' ').trim())
            newParagraphs.push(lastSentences.slice(midPoint).join(' ').trim())
          }
        }
        
        if (newParagraphs.length >= 4) {
          answerContent = newParagraphs.join('\n\n').trim()
        } else {
          // 그래도 안 되면 기존 방식 사용 (문장 끝 뒤에 빈 줄 추가)
          answerContent = answerContent.replace(/([.!?])\s+([가-힣A-Z])/g, '$1\n\n$2')
        }
      }
      
      // 3. 이모티콘 앞에 줄바꿈이 없으면 추가 (이모티콘을 문단 시작점에 배치)
      // 이모티콘을 안전하게 처리하기 위해 일반적인 이모티콘을 직접 매칭
      // 서로게이트 페어로 구성된 이모티콘도 올바르게 처리됨
      try {
        // 일반적으로 사용하는 이모티콘 목록 (프롬프트에서 사용하는 것들 + 추가)
        const commonEmojis = ['👍', '💡', '✅', '📊', '💰', '🎯', '💼', '📋', '📈', '📞', '◆', '⭐', '💎', '🔔', '📝', '📌', '🎉', '🔥', '💪', '✨', '📱', '🏆', '🎁', '💯']
        
        // 각 이모티콘에 대해 개별적으로 처리 (더 안전함)
        commonEmojis.forEach(emoji => {
          // 이모티콘 앞에 줄바꿈이 없고, 이전 문자가 줄바꿈이 아닌 경우 줄바꿈 추가
          // 이스케이프 처리하여 특수 문자로 인식되지 않도록 함
          const escapedEmoji = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          answerContent = answerContent.replace(new RegExp(`([^\\n])(${escapedEmoji})`, 'g'), '$1\n\n$2')
          
          // 이모티콘 뒤에 공백이 없으면 추가
          answerContent = answerContent.replace(new RegExp(`(${escapedEmoji})([^\\s\\n])`, 'g'), '$1 $2')
        })
      } catch (error) {
        console.error('이모티콘 처리 중 오류:', error)
        // 오류 발생 시 원본 내용 유지
      }
      
      // 4. 연속된 줄바꿈을 최대 2개로 정리 (과도한 줄바꿈 방지)
      answerContent = answerContent.replace(/\n{3,}/g, '\n\n')
      
      // 5. 문장 끝 부분에 자동 줄바꿈 추가하지 않음 (프롬프트에서 이미 적절히 처리하도록 함)
      // 과도한 줄바꿈을 방지하기 위해 자동 추가 로직 제거
      
      // 6. 최종 정리 (앞뒤 공백 제거)
      answerContent = answerContent.trim()

      console.log('Step 2 완료:', { answerContentLength: answerContent.length })
    } else {
      console.log('Step 2 생략: requestedStep이 answer가 아님')
      // answerContent는 이미 빈 문자열로 초기화됨
    }

    // Step 3: 대화형 모드일 경우 추가 댓글 생성
    let conversationThread: ConversationMessage[] = []
    
    if ((requestedStep === 'conversation' || requestedStep === 'all') && conversationMode && conversationLength) {
      if (!finalQuestionTitle || !finalQuestionContent || !answerContent) {
        return NextResponse.json(
          { error: '질문과 답변이 필요합니다. 먼저 질문과 답변을 생성해주세요.' },
          { status: 400 }
        )
      }
      console.log('Step 3: 대화형 스레드 생성 중...', { conversationLength })

      // 짝수만 허용 (6, 8, 10, 12) - 항상 설계사가 마무리하도록
      const validLengths = [6, 8, 10, 12]
      const totalSteps = validLengths.includes(conversationLength) 
        ? conversationLength 
        : 8 // 기본값: 8개
      const conversationHistory: ConversationMessage[] = []
      
      // 첫 질문과 답변을 히스토리에 추가
      conversationHistory.push({
        role: 'customer',
        content: `${finalQuestionTitle}\n\n${finalQuestionContent}`,
        step: 0
      })
      conversationHistory.push({
        role: 'agent',
        content: answerContent,
        step: 1
      })
      
      // 나머지 댓글들 생성 (3번째부터 시작)
      for (let step = 3; step <= totalSteps; step++) {
        const isCustomerTurn = step % 2 === 1 // 홀수: 고객, 짝수: 설계사
        
        // 토큰 절감: 최근 대화만 포함 (최대 6개 메시지 = 최근 3턴)
        // 전체 히스토리를 포함하면 토큰이 기하급수적으로 증가하므로 최근 대화만 사용
        const recentHistory = conversationHistory.slice(-6) // 최근 6개 메시지만 사용
        
        const conversationPrompt = generateConversationThreadPrompt(
          {
            productName,
            targetPersona,
            worryPoint,
            sellingPoint,
            feelingTone: feelingTone || '고민',
            answerTone: answerTone || 'friendly',
            customerStyle: customerStyle || 'curious',
            designSheetImage,
            designSheetAnalysis,
            searchResultsText: searchResultsText || undefined // 검색 결과 전달 (설계사 댓글에서만 활용)
          },
          {
            initialQuestion: {
              title: finalQuestionTitle,
              content: finalQuestionContent
            },
            firstAnswer: answerContent,
            conversationHistory: recentHistory, // 전체 히스토리 대신 최근 대화만 사용
            totalSteps: totalSteps,
            currentStep: step
          }
        )
        
        // 하이브리드: 고객 댓글은 Flash, 설계사 댓글은 Pro 사용
        const threadResult = await generateContentWithFallback(conversationPrompt, designSheetImage, isCustomerTurn)
        let threadContent = threadResult.text
        
        // 제어 문자 제거
        threadContent = threadContent.replace(/<ctrl\d+>/gi, '')
        threadContent = threadContent.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
        threadContent = threadContent.replace(/```[\s\S]*?```/g, '').trim()
        threadContent = threadContent.replace(/\[생성된 댓글\]/g, '').trim()
        threadContent = threadContent.trim()
        
        // 히스토리에 추가
        const newMessage: ConversationMessage = {
          role: isCustomerTurn ? 'customer' : 'agent',
          content: threadContent,
          step: step
        }
        
        conversationHistory.push(newMessage)
        conversationThread.push(newMessage)
        
        console.log(`Step 3-${step} 완료:`, { role: newMessage.role, contentLength: threadContent.length })
      }
      
      // 후기성 문구 자동 삽입 (대화 횟수에 포함되지 않음)
      // 중간 위치: 4-5번째 댓글 이후에 삽입
      const midInsertPosition = Math.min(5, Math.floor(totalSteps / 2))
      const midInsertIndex = conversationThread.findIndex(msg => msg.step >= midInsertPosition)
      
      if (midInsertIndex > 0 && midInsertIndex < conversationThread.length) {
        console.log('후기성 문구 1 (중간) 생성 중...')
        
        // 중간 후기성 문구 생성
        const midReviewPrompt = generateReviewMessagePrompt(
          {
            productName,
            targetPersona,
            worryPoint,
            sellingPoint,
            feelingTone: feelingTone || '고민',
            answerTone: answerTone || 'friendly',
            customerStyle: customerStyle || 'curious',
            designSheetImage,
            designSheetAnalysis,
            searchResultsText: searchResultsText || undefined
          },
          {
            initialQuestion: {
              title: finalQuestionTitle,
              content: finalQuestionContent
            },
            firstAnswer: answerContent,
            conversationHistory: conversationHistory.slice(0, midInsertIndex + 1),
            productName
          }
        )
        
        const midReviewResult = await generateContentWithFallback(midReviewPrompt, designSheetImage, true)
        let midReviewContent = midReviewResult.text
        midReviewContent = midReviewContent.replace(/<ctrl\d+>/gi, '')
        midReviewContent = midReviewContent.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
        midReviewContent = midReviewContent.replace(/```[\s\S]*?```/g, '').trim()
        midReviewContent = midReviewContent.replace(/\[생성된 후기성 문구\]/g, '').trim()
        midReviewContent = midReviewContent.trim()
        
        // 설계사 응답 생성
        const midResponsePrompt = generateReviewResponsePrompt(
          {
            productName,
            targetPersona,
            worryPoint,
            sellingPoint,
            feelingTone: feelingTone || '고민',
            answerTone: answerTone || 'friendly',
            customerStyle: customerStyle || 'curious',
            designSheetImage,
            designSheetAnalysis,
            searchResultsText: searchResultsText || undefined
          },
          {
            initialQuestion: {
              title: finalQuestionTitle,
              content: finalQuestionContent
            },
            firstAnswer: answerContent,
            conversationHistory: [...conversationHistory.slice(0, midInsertIndex + 1), {
              role: 'customer',
              content: midReviewContent,
              step: 999 // 임시 step
            }],
            reviewMessage: midReviewContent,
            productName
          }
        )
        
        const midResponseResult = await generateContentWithFallback(midResponsePrompt, designSheetImage, false)
        let midResponseContent = midResponseResult.text
        midResponseContent = midResponseContent.replace(/<ctrl\d+>/gi, '')
        midResponseContent = midResponseContent.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
        midResponseContent = midResponseContent.replace(/```[\s\S]*?```/g, '').trim()
        midResponseContent = midResponseContent.replace(/\[생성된 설계사 응답\]/g, '').trim()
        midResponseContent = midResponseContent.trim()
        
        // 중간 위치에 삽입
        const midReviewMessage: ConversationMessage = {
          role: 'customer',
          content: midReviewContent,
          step: 999 // 대화 횟수에 포함되지 않음
        }
        const midResponseMessage: ConversationMessage = {
          role: 'agent',
          content: midResponseContent,
          step: 1000 // 대화 횟수에 포함되지 않음
        }
        
        conversationThread.splice(midInsertIndex + 1, 0, midReviewMessage, midResponseMessage)
        conversationHistory.push(midReviewMessage, midResponseMessage)
        
        console.log('후기성 문구 1 (중간) 삽입 완료')
      }
      
      // 마지막 후기성 문구 (설계사 마무리 직전)
      console.log('후기성 문구 2 (마지막) 생성 중...')
      
      const lastReviewPrompt = generateReviewMessagePrompt(
        {
          productName,
          targetPersona,
          worryPoint,
          sellingPoint,
          feelingTone: feelingTone || '고민',
          answerTone: answerTone || 'friendly',
          customerStyle: customerStyle || 'curious',
          designSheetImage,
          designSheetAnalysis,
          searchResultsText: searchResultsText || undefined
        },
        {
          initialQuestion: {
            title: finalQuestionTitle,
            content: finalQuestionContent
          },
          firstAnswer: answerContent,
          conversationHistory: conversationHistory,
          productName
        }
      )
      
      const lastReviewResult = await generateContentWithFallback(lastReviewPrompt, designSheetImage, true)
      let lastReviewContent = lastReviewResult.text
      lastReviewContent = lastReviewContent.replace(/<ctrl\d+>/gi, '')
      lastReviewContent = lastReviewContent.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      lastReviewContent = lastReviewContent.replace(/```[\s\S]*?```/g, '').trim()
      lastReviewContent = lastReviewContent.replace(/\[생성된 후기성 문구\]/g, '').trim()
      lastReviewContent = lastReviewContent.trim()
      
      // 설계사 응답 생성
      const lastResponsePrompt = generateReviewResponsePrompt(
        {
          productName,
          targetPersona,
          worryPoint,
          sellingPoint,
          feelingTone: feelingTone || '고민',
          answerTone: answerTone || 'friendly',
          customerStyle: customerStyle || 'curious',
          designSheetImage,
          designSheetAnalysis,
          searchResultsText: searchResultsText || undefined
        },
        {
          initialQuestion: {
            title: finalQuestionTitle,
            content: finalQuestionContent
          },
          firstAnswer: answerContent,
          conversationHistory: [...conversationHistory, {
            role: 'customer',
            content: lastReviewContent,
            step: 1999 // 임시 step
          }],
          reviewMessage: lastReviewContent,
          productName
        }
      )
      
      const lastResponseResult = await generateContentWithFallback(lastResponsePrompt, designSheetImage, false)
      let lastResponseContent = lastResponseResult.text
      lastResponseContent = lastResponseContent.replace(/<ctrl\d+>/gi, '')
      lastResponseContent = lastResponseContent.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      lastResponseContent = lastResponseContent.replace(/```[\s\S]*?```/g, '').trim()
      lastResponseContent = lastResponseContent.replace(/\[생성된 설계사 응답\]/g, '').trim()
      lastResponseContent = lastResponseContent.trim()
      
      // 마지막 위치에 삽입 (설계사 마무리 직전)
      const lastReviewMessage: ConversationMessage = {
        role: 'customer',
        content: lastReviewContent,
        step: 1999 // 대화 횟수에 포함되지 않음
      }
      const lastResponseMessage: ConversationMessage = {
        role: 'agent',
        content: lastResponseContent,
        step: 2000 // 대화 횟수에 포함되지 않음
      }
      
      // 마지막 설계사 댓글 직전에 삽입
      const lastAgentIndex = conversationThread.map((msg, idx) => ({ msg, idx }))
        .filter(({ msg }) => msg.role === 'agent')
        .pop()?.idx
      
      if (lastAgentIndex !== undefined && lastAgentIndex >= 0) {
        conversationThread.splice(lastAgentIndex + 1, 0, lastReviewMessage, lastResponseMessage)
      } else {
        // 설계사 댓글이 없으면 맨 끝에 추가
        conversationThread.push(lastReviewMessage, lastResponseMessage)
      }
      
      conversationHistory.push(lastReviewMessage, lastResponseMessage)
      
      console.log('후기성 문구 2 (마지막) 삽입 완료')
      console.log('Step 3 완료:', { totalThreads: conversationThread.length })
    }

    // ============================================
    // ⚠️ 테스트용: 토큰 사용량 계산 및 반환
    // 실제 운영 시에는 tokenUsage 필드를 제거해야 합니다
    // ============================================
    const totalUsage = calculateTotalUsage()
    const costEstimate = estimateCost(tokenUsage)
    console.log('📊 총 토큰 사용량:', totalUsage)

    // 사용량 로그 (실패해도 응답은 진행)
    const usageLogMeta = {
      productName,
      conversationMode,
      generateStep: requestedStep,
      tokenBreakdown: tokenUsage, // 모델별 토큰 사용량 (비용 계산용)
      costEstimate: costEstimate.totalCost, // 총 비용 (USD)
      customSearchCount: customSearchCount, // 커스텀 서치 횟수
      customSearchCost: customSearchCount * 0.0005, // 커스텀 서치 비용 (USD, $0.0005 per search)
    }
    
    console.log('[Q&A 생성] usage_logs 저장할 데이터:', {
      customSearchCount,
      customSearchCost: customSearchCount * 0.0005,
      meta: JSON.stringify(usageLogMeta).substring(0, 300)
    })
    
    Promise.resolve(
      supabase
        .from('usage_logs')
        .insert({
          user_id: user.id,
          type: 'qa',
          prompt_tokens: totalUsage.promptTokens,
          completion_tokens: totalUsage.candidatesTokens,
          total_tokens: totalUsage.totalTokens,
          meta: usageLogMeta
        })
    )
      .then((result: any) => {
        if (result?.error) {
          console.error('[Q&A 생성] usage_logs insert 실패:', result.error)
        } else {
          console.log('[Q&A 생성] usage_logs insert 성공:', { customSearchCount, customSearchCost: customSearchCount * 0.0005 })
        }
      })
      .catch((err) => console.error('[Q&A 생성] usage_logs insert 예외:', err))

    return NextResponse.json({
      success: true,
      question: {
        title: finalQuestionTitle,
        content: finalQuestionContent,
        generatedAt: new Date().toISOString()
      },
      answer: {
        content: answerContent,
        generatedAt: new Date().toISOString()
      },
      conversation: conversationThread.length > 0 ? conversationThread : undefined,
      usage: {
        promptTokens: totalUsage.promptTokens,
        completionTokens: totalUsage.candidatesTokens,
        totalTokens: totalUsage.totalTokens,
        breakdown: tokenUsage,
        costEstimate
      },
      metadata: {
        productName,
        targetPersona,
        worryPoint,
        sellingPoint,
        feelingTone: feelingTone || '고민',
        answerTone: answerTone || 'friendly',
        conversationMode: conversationMode || false,
        conversationLength: conversationLength || 0
      }
    })
  } catch (error: any) {
    console.error('Q&A 생성 오류:', error)
    console.error('오류 상세:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      cause: error?.cause
    })
    
    // 더 자세한 에러 메시지 제공
    let errorMessage = 'Q&A 생성 중 오류가 발생했습니다'
    if (error?.message) {
      errorMessage = error.message
      // 할당량 에러인 경우 더 친절한 메시지
      if (error.message.includes('429') || error.message.includes('quota')) {
        errorMessage = 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.'
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    )
  }
}

