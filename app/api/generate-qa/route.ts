import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateQuestionPrompt, generateAnswerPrompt } from '@/lib/prompts/qa-prompt'

export async function POST(request: NextRequest) {
  try {
    const { 
      productName, 
      targetPersona, 
      worryPoint, 
      sellingPoint, 
      feelingTone, 
      answerTone,
      designSheetImage,
      designSheetAnalysis, // 설계서 분석 결과 (보험료, 담보, 특약 등)
      questionTitle, // 답변 재생성 시 사용
      questionContent // 답변 재생성 시 사용
    } = await request.json()

    // 필수 입력 검증
    if (!productName || !targetPersona || !worryPoint || !sellingPoint) {
      return NextResponse.json(
        { error: '필수 입력 항목을 모두 입력해주세요' },
        { status: 400 }
      )
    }

    console.log('Q&A 생성 시작:', { productName, targetPersona, worryPoint, sellingPoint })

    // Gemini API 초기화
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro'
    })

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
        designSheetImage,
        designSheetAnalysis
      })

      const questionResult = await model.generateContent(questionPrompt)
      const questionResponse = await questionResult.response
      let questionText = questionResponse.text().trim()

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
        designSheetImage,
        designSheetAnalysis
      },
      finalQuestionTitle,
      finalQuestionContent
    )

    const answerResult = await model.generateContent(answerPrompt)
    const answerResponse = await answerResult.response
    let answerContent = answerResponse.text().trim()

    // 제어 문자 제거 (<ctrl63>, <ctrl*> 등)
    answerContent = answerContent.replace(/<ctrl\d+>/gi, '')
    answerContent = answerContent.replace(/[\x00-\x1F\x7F]/g, '') // 기타 제어 문자 제거

    // 마크다운이나 코드 블록 제거
    answerContent = answerContent.replace(/```[\s\S]*?```/g, '').trim()
    answerContent = answerContent.replace(/\[생성된 답변\]/g, '').trim()

    // 답변 포맷팅 개선 (띄어쓰기 및 문단 구분)
    // 1. 연속된 공백을 하나로 정리
    answerContent = answerContent.replace(/[ \t]+/g, ' ')
    
    // 2. 각 줄 앞뒤 공백 정리
    answerContent = answerContent.split('\n').map(line => line.trim()).join('\n')
    
    // 3. 연속된 줄바꿈을 최대 2개로 정리 (과도한 줄바꿈 방지)
    answerContent = answerContent.replace(/\n{3,}/g, '\n\n')
    
    // 4. 문장 끝 부분에 자동 줄바꿈 추가하지 않음 (프롬프트에서 이미 적절히 처리하도록 함)
    // 과도한 줄바꿈을 방지하기 위해 자동 추가 로직 제거
    
    // 5. 최종 정리 (앞뒤 공백 제거)
    answerContent = answerContent.trim()

    console.log('Step 2 완료:', { answerContentLength: answerContent.length })

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
      metadata: {
        productName,
        targetPersona,
        worryPoint,
        sellingPoint,
        feelingTone: feelingTone || '고민',
        answerTone: answerTone || 'friendly'
      }
    })
  } catch (error: any) {
    console.error('Q&A 생성 오류:', error)
    
    return NextResponse.json(
      { error: error.message || 'Q&A 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

