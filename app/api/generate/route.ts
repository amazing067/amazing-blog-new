import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { fetchSheetsData, getTopInsurance, getDiseasesByCategory } from '@/lib/google-sheets'
import { generateInsuranceBlogPrompt } from '@/lib/prompts/insurance-blog-prompt'
import { extractSources } from '@/lib/extract-sources'
import { sourcesToMarkdown } from '@/lib/generate-sources-pdf'

export async function POST(request: NextRequest) {
  try {
    const { topic, keywords, product, tone } = await request.json()

    if (!topic) {
      return NextResponse.json(
        { error: '주제를 입력해주세요' },
        { status: 400 }
      )
    }

    console.log('블로그 생성 시작:', { topic, keywords, product, tone })

    // 1. Google Sheets에서 데이터 가져오기
    const sheetsData = await fetchSheetsData()
    
    // 2. 나이/성별 추출 (기본값: 30세 남성)
    const age = extractAge(topic, keywords) || 30
    const gender = extractGender(topic, keywords) || '남'
    
    // 3. 관련 데이터 필터링
    const topInsurance = getTopInsurance(sheetsData.comparisons, age, gender)
    const relatedDiseases = extractRelevantDiseases(topic, keywords, sheetsData.diseaseCodes)

    console.log('데이터 추출 완료:', {
      age,
      gender,
      insuranceCount: topInsurance.length,
      diseaseCount: relatedDiseases.length
    })

    // 4. Gemini API 호출
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro'  // 최신 모델로 변경
    })

    // 5. 프롬프트 생성
    const prompt = generateInsuranceBlogPrompt({
      topic,
      keywords,
      product,
      tone,
      age,
      gender,
      topInsurance,
      diseaseCodes: relatedDiseases,
    })

    console.log('프롬프트 생성 완료, Gemini 호출 중...')

    // 6. 콘텐츠 생성
    const result = await model.generateContent(prompt)
    const response = await result.response
    let htmlContent = response.text()

    // 코드 블록 제거
    htmlContent = htmlContent.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim()
    
    // HTML 검증
    if (!htmlContent.includes('<!DOCTYPE html>')) {
      console.warn('⚠️ DOCTYPE 없음. HTML 형식 아닐 수 있음')
    }

    // 7. 출처 추출
    const sources = extractSources(htmlContent)
    const sourcesMarkdown = sourcesToMarkdown(sources)
    
    console.log('생성 완료! HTML 길이:', htmlContent.length)
    console.log('추출된 출처:', sources.length, '개')

    return NextResponse.json({
      success: true,
      html: htmlContent,
      sources: sources,
      sourcesMarkdown: sourcesMarkdown,
      metadata: {
        topic,
        keywords,
        age,
        gender,
        wordCount: htmlContent.length,
        sourceCount: sources.length,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('생성 오류:', error)
    
    return NextResponse.json(
      { error: error.message || 'AI 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// 나이 추출
function extractAge(topic: string, keywords: string): number | null {
  const text = `${topic} ${keywords}`.toLowerCase()
  const match = text.match(/(\d+)세/)
  return match ? parseInt(match[1]) : null
}

// 성별 추출
function extractGender(topic: string, keywords: string): string | null {
  const text = `${topic} ${keywords}`.toLowerCase()
  if (text.includes('남성') || text.includes('남자')) return '남'
  if (text.includes('여성') || text.includes('여자')) return '여'
  return null
}

// 관련 질병 코드 추출
function extractRelevantDiseases(topic: string, keywords: string, allDiseases: any[]): any[] {
  const text = `${topic} ${keywords}`.toLowerCase()
  
  const categories = []
  if (text.includes('암')) categories.push('암')
  if (text.includes('뇌') || text.includes('뇌혈관') || text.includes('뇌경색')) categories.push('뇌혈관')
  if (text.includes('심장') || text.includes('심근경색')) categories.push('심장')
  if (text.includes('당뇨')) categories.push('당뇨')
  if (text.includes('고혈압')) categories.push('고혈압')
  
  if (categories.length === 0) {
    // 기본: 암 관련
    categories.push('암')
  }
  
  const diseases: any[] = []
  categories.forEach(cat => {
    const catDiseases = getDiseasesByCategory(allDiseases, cat)
    diseases.push(...catDiseases)
  })
  
  return diseases.slice(0, 20)  // 최대 20개
}
