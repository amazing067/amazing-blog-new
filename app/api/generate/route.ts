import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { fetchSheetsData, getTopInsurance, getDiseasesByCategory } from '@/lib/google-sheets'
import { generateInsuranceBlogPrompt } from '@/lib/prompts/insurance-blog-prompt'
import { extractSources } from '@/lib/extract-sources'
import { sourcesToMarkdown } from '@/lib/generate-sources-pdf'
import { 
  searchInsuranceTopics, 
  formatSearchResultsForPrompt,
  extractSourcesFromSearchResults 
} from '@/lib/google-search'
import { findRelevantPrecedents } from '@/lib/precedents'

export async function POST(request: NextRequest) {
  try {
    let { topic, keywords, product, tone, designSheetImage, designSheetAnalysis, authorName } = await request.json()

    // 제안서만 있고 주제가 없으면 제안서 분석 결과로 자동 생성
    if (!topic && designSheetAnalysis) {
      // 제안서 분석 결과를 바탕으로 주제와 키워드 자동 생성
      const productName = designSheetAnalysis.productName || '보험'
      const targetPersona = designSheetAnalysis.targetPersona || ''
      
      // 주제 자동 생성: 상품명 + 대상 고객
      topic = `${productName} ${targetPersona ? targetPersona + ' ' : ''}가이드`
      
      // 키워드 자동 생성: 상품명에서 핵심 키워드 추출
      const productKeywords = productName.split(' ').filter((word: string) => word.length > 1)
      keywords = productKeywords.join(', ') || productName
      
      console.log('제안서 분석 결과로 주제/키워드 자동 생성:', { topic, keywords })
    }

    if (!topic) {
      return NextResponse.json(
        { error: '주제를 입력하거나 제안서 이미지를 첨부해주세요' },
        { status: 400 }
      )
    }

    console.log('블로그 생성 시작:', { topic, keywords, product, tone, hasDesignSheet: !!designSheetImage })

    // 1. Google Sheets에서 데이터 가져오기
    const sheetsData = await fetchSheetsData()
    
    // 2. 나이/성별 추출 (제안서 분석 결과에서도 추출 시도)
    let age = extractAge(topic, keywords) || 30
    let gender = extractGender(topic, keywords) || '남'
    
    // 제안서 분석 결과에서 나이/성별 추출 시도
    if (designSheetAnalysis?.targetPersona) {
      const personaAge = extractAge(designSheetAnalysis.targetPersona, '')
      const personaGender = extractGender(designSheetAnalysis.targetPersona, '')
      if (personaAge) age = personaAge
      if (personaGender) gender = personaGender
    }
    
    // 3. 관련 데이터 필터링
    const topInsurance = getTopInsurance(sheetsData.comparisons, age, gender)
    
    // 4. 담보별 보험료 필터링 (주제/템플릿에 맞는 담보만 표시)
    const filteredTopInsurance = filterRelevantCoverages(topInsurance, topic, keywords)
    
    const relatedDiseases = extractRelevantDiseases(topic, keywords, sheetsData.diseaseCodes)

    console.log('데이터 추출 완료:', {
      age,
      gender,
      insuranceCount: filteredTopInsurance.length,
      diseaseCount: relatedDiseases.length
    })

    // 5. 관련 판례 검색
    console.log('관련 판례 검색 시작...')
    const relevantPrecedents = findRelevantPrecedents(topic, keywords, 3)
    console.log(`관련 판례: ${relevantPrecedents.length}개 발견`)
    
    // 6. Google Custom Search로 최신 정보 검색
    console.log('🔍 Google Custom Search 시작:', { topic, keywords })
    const searchResults = await searchInsuranceTopics(topic, keywords, 3)
    console.log('✅ Google Custom Search 완료:', { 
      resultCount: searchResults.length,
      success: searchResults.length > 0 
    })
    
    // 검색 결과를 프롬프트 형식으로 변환
    const searchResultsText = formatSearchResultsForPrompt(searchResults)
    
    // 검색 결과에서 출처 추출 (나중에 출처 섹션에 추가)
    const searchSources = extractSourcesFromSearchResults(searchResults)

    // 6. Gemini API 호출
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro'  // 최고 품질 모델
    })

    // 7. 프롬프트 생성 (Google Custom Search 결과 + 판례 포함)
    const prompt = generateInsuranceBlogPrompt({
      topic,
      keywords,
      product,
      tone,
      age,
      gender,
      topInsurance: filteredTopInsurance,
      diseaseCodes: relatedDiseases,
      designSheetImage,
      designSheetAnalysis,
      authorName,
      searchResults: searchResultsText, // Google Custom Search 결과 추가
      precedents: relevantPrecedents, // 관련 판례 추가
    })

    console.log('프롬프트 생성 완료, Gemini 호출 중...')
    console.log('Google Custom Search 결과:', searchResults.length, '개')
    console.log('Google Grounding: 비활성화 (현재 SDK 버전에서 지원하지 않음, Custom Search만 사용)')

    // 7. 콘텐츠 생성
    // Google Custom Search 결과를 프롬프트에 포함하여 최신 정보 반영
    // 현재 SDK 버전에서는 Grounding API를 직접 지원하지 않으므로 Custom Search만 사용
    
    const result = await model.generateContent(prompt)
    const response = await result.response
    let htmlContent = response.text()

    // 코드 블록 제거
    htmlContent = htmlContent.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim()
    
    // HTML 검증
    if (!htmlContent.includes('<!DOCTYPE html>')) {
      console.warn('⚠️ DOCTYPE 없음. HTML 형식 아닐 수 있음')
    }

    // 8. 출처 추출 (기존 출처 + Google Custom Search 출처 + Grounding 출처)
    const extractedSources = extractSources(htmlContent)
    
    // 모든 출처 통합 (중복 제거)
    const allSources = [...extractedSources]
    
    // Google Custom Search 출처 추가
    searchSources.forEach(searchSource => {
      const isDuplicate = allSources.some(s => s.url === searchSource.url)
      if (!isDuplicate && searchSource.url) {
        allSources.push({
          title: searchSource.title,
          url: searchSource.url,
          organization: searchSource.organization
        })
      }
    })
    
    const sourcesMarkdown = sourcesToMarkdown(allSources)
    
    console.log('생성 완료! HTML 길이:', htmlContent.length)
    console.log('추출된 출처:', extractedSources.length, '개')
    console.log('Google Custom Search 출처:', searchSources.length, '개')
    console.log('총 출처:', allSources.length, '개')

    return NextResponse.json({
      success: true,
      html: htmlContent,
      sources: allSources,
      sourcesMarkdown: sourcesMarkdown,
      metadata: {
        topic,
        keywords,
        age,
        gender,
        wordCount: htmlContent.length,
        sourceCount: allSources.length,
        customSearchCount: searchResults.length,
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

/**
 * 주제/키워드에 맞는 담보만 필터링
 */
function filterRelevantCoverages(insuranceList: any[], topic: string, keywords: string): any[] {
  const topicLower = topic.toLowerCase()
  const keywordsLower = keywords.toLowerCase()
  const combined = (topicLower + ' ' + keywordsLower).toLowerCase()
  
  // 주제/키워드에서 보험 유형 추출
  const isCancerInsurance = combined.includes('암') && !combined.includes('종합')
  const isAccidentInsurance = combined.includes('상해') || combined.includes('운전자')
  const isDiseaseInsurance = combined.includes('질병') && !combined.includes('암')
  const isCirculatoryInsurance = combined.includes('뇌') || combined.includes('심장') || combined.includes('순환계')
  const isComprehensive = combined.includes('종합') || (!isCancerInsurance && !isAccidentInsurance && !isDiseaseInsurance && !isCirculatoryInsurance)
  
  // 필터링된 보험 목록 생성
  return insuranceList.map(ins => {
    if (!ins.detailPremiums || ins.detailPremiums.length === 0) {
      return ins // 담보 정보가 없으면 그대로 반환
    }
    
    // 담보 필터링
    let filteredPremiums = ins.detailPremiums
    
    if (isCancerInsurance) {
      // 암보험: 암 관련 담보만
      filteredPremiums = ins.detailPremiums.filter((dp: any) => 
        dp.coverageName.includes('암') || 
        dp.coverageName.includes('항암') ||
        dp.coverageName.includes('유사암')
      )
    } else if (isAccidentInsurance) {
      // 상해보험: 상해 관련 담보만
      filteredPremiums = ins.detailPremiums.filter((dp: any) => 
        dp.coverageName.includes('상해')
      )
    } else if (isDiseaseInsurance) {
      // 질병보험: 질병 관련 담보만 (암 제외)
      filteredPremiums = ins.detailPremiums.filter((dp: any) => 
        dp.coverageName.includes('질병') && !dp.coverageName.includes('암')
      )
    } else if (isCirculatoryInsurance) {
      // 순환계 질환: 뇌/심장 관련 담보만
      filteredPremiums = ins.detailPremiums.filter((dp: any) => 
        dp.coverageName.includes('뇌') || 
        dp.coverageName.includes('심장') ||
        dp.coverageName.includes('심근') ||
        dp.coverageName.includes('허혈')
      )
    } else if (isComprehensive) {
      // 종합보험: 주요 담보만 (상위 5-7개 정도)
      // 주요 담보 우선순위: 암, 뇌, 심장, 상해, 질병 등
      const priorityKeywords = ['암', '뇌', '심장', '심근', '허혈', '상해', '질병']
      
      // 우선순위가 높은 담보부터 필터링
      const prioritized = ins.detailPremiums.filter((dp: any) => 
        priorityKeywords.some(keyword => dp.coverageName.includes(keyword))
      )
      
      // 우선순위가 없는 담보도 일부 포함 (최대 7개까지)
      const others = ins.detailPremiums.filter((dp: any) => 
        !priorityKeywords.some(keyword => dp.coverageName.includes(keyword))
      )
      
      filteredPremiums = [...prioritized, ...others].slice(0, 7) // 최대 7개까지만
    }
    // 특정 보험이 아닌 경우도 주요 담보만 표시
    
    return {
      ...ins,
      detailPremiums: filteredPremiums.length > 0 ? filteredPremiums : undefined
    }
  })
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
