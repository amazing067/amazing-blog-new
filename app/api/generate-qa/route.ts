import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateQuestionPrompt, generateAnswerPrompt, generateConversationThreadPrompt, ConversationMessage } from '@/lib/prompts/qa-prompt'

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json()
    const { 
      productName, 
      targetPersona, 
      worryPoint, 
      sellingPoint, 
      feelingTone, 
      answerTone,
      customerStyle, // 고객 스타일: 'friendly' | 'cold' | 'brief' | 'curious'
      designSheetImage,
      designSheetAnalysis, // 설계서 분석 결과 (보험료, 담보, 특약 등)
      questionTitle, // 답변 재생성 시 사용
      questionContent, // 답변 재생성 시 사용
      conversationMode, // 대화형 모드 활성화 여부
      conversationLength // 대화 횟수 (6, 8, 10, 12 - 짝수만 허용, 항상 설계사가 마무리)
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
    interface TokenUsage {
      promptTokens: number
      candidatesTokens: number
      totalTokens: number
    }
    
    const tokenUsage: TokenUsage[] = []
    
    // API 호출 헬퍼 함수 (재시도 및 폴백 로직 포함, 이미지 지원)
    const generateContentWithFallback = async (prompt: string, imageBase64?: string | null): Promise<{ text: string; usage?: TokenUsage }> => {
      const models = ['gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash']
      
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
        const model = genAI.getGenerativeModel({ model: modelName })
        
        try {
          console.log(`모델 시도: ${modelName} (시도 ${attempt + 1}/${models.length})`)
          
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
          
          // 토큰 사용량 추출
          const usageMetadata = response.usageMetadata
          const usage: TokenUsage = {
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
        promptTokens: acc.promptTokens + usage.promptTokens,
        candidatesTokens: acc.candidatesTokens + usage.candidatesTokens,
        totalTokens: acc.totalTokens + usage.totalTokens
      }), { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 })
    }

    let finalQuestionTitle = questionTitle
    let finalQuestionContent = questionContent

    // Step 1: 질문 생성 (질문이 제공되지 않은 경우에만)
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
        designSheetAnalysis
      })

      const questionResult = await generateContentWithFallback(questionPrompt, designSheetImage)
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
      
      finalQuestionContent = contentMatch 
        ? contentMatch[1].trim().replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')
        : questionText.split('\n').slice(1).join('\n').trim().replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')

      console.log('Step 1 완료:', { questionTitle: finalQuestionTitle, questionContentLength: finalQuestionContent.length })
    } else {
      console.log('Step 1 생략: 기존 질문 사용')
    }

    // Step 2: 답변 생성 (Step 1 결과 사용)
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
        designSheetImage,
        designSheetAnalysis
      },
      finalQuestionTitle,
      finalQuestionContent
    )

    const answerResult = await generateContentWithFallback(answerPrompt, designSheetImage)
    let answerContent = answerResult.text

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

    // Step 3: 대화형 모드일 경우 추가 댓글 생성
    let conversationThread: ConversationMessage[] = []
    
    if (conversationMode && conversationLength) {
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
            designSheetAnalysis
          },
          {
            initialQuestion: {
              title: finalQuestionTitle,
              content: finalQuestionContent
            },
            firstAnswer: answerContent,
            conversationHistory: conversationHistory,
            totalSteps: totalSteps,
            currentStep: step
          }
        )
        
        const threadResult = await generateContentWithFallback(conversationPrompt, designSheetImage)
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
      
      console.log('Step 3 완료:', { totalThreads: conversationThread.length })
    }

    // ============================================
    // ⚠️ 테스트용: 토큰 사용량 계산 및 반환
    // 실제 운영 시에는 tokenUsage 필드를 제거해야 합니다
    // ============================================
    const totalUsage = calculateTotalUsage()
    console.log('📊 총 토큰 사용량:', totalUsage)

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
      // ⚠️ 테스트용: 실제 운영 시 이 필드 제거 필요
      tokenUsage: {
        promptTokens: totalUsage.promptTokens,
        candidatesTokens: totalUsage.candidatesTokens,
        totalTokens: totalUsage.totalTokens,
        breakdown: tokenUsage // 각 단계별 토큰 사용량
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

