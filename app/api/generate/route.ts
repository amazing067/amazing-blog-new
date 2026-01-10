import { NextRequest, NextResponse } from 'next/server'
// SDK 제거, REST API 직접 사용
import { createClient } from '@/lib/supabase/server'
import { fetchSheetsData, getTopInsurance, getDiseasesByCategory } from '@/lib/google-sheets'
import { generateInsuranceBlogPrompt } from '@/lib/prompts/insurance-blog-prompt'
import { extractSources } from '@/lib/extract-sources'
import { sourcesToMarkdown } from '@/lib/generate-sources-pdf'
import { 
  searchInsuranceTopics, 
  searchRecentPrecedents,
  formatSearchResultsForPrompt,
  extractSourcesFromSearchResults 
} from '@/lib/google-search'
import { findRelevantPrecedents } from '@/lib/precedents'

type TokenUsage = {
  model: string
  promptTokens: number
  completionTokens: number
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
  'gemini-2.5-flash': CostRate
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
    'gemini-2.5-flash': {
      prompt: toNumber(process.env.GEMINI_FLASH_2_5_INPUT_COST_PER_1M, 0.075),
      completion: toNumber(process.env.GEMINI_FLASH_2_5_OUTPUT_COST_PER_1M, 0.30)
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
        ? (u.promptTokens / 1_000_000) * rate.prompt + (u.completionTokens / 1_000_000) * rate.completion
        : null
    return {
      model: u.model,
      cost,
      promptTokens: u.promptTokens,
      completionTokens: u.completionTokens
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

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

    // 5. Google Custom Search로 최신 판례 검색 (최근 5년 이내)
    console.log('🔍 최신 판례 검색 시작 (최근 5년 이내)...')
    const recentPrecedentsResults = await searchRecentPrecedents(topic, keywords, 3)
    console.log(`✅ 최신 판례: ${recentPrecedentsResults.length}개 발견`)
    
    let relevantPrecedents: Array<{ caseNumber: string; title: string; content: string; url?: string }> = []
    
    // 최신 판례가 있으면 사용, 없으면 로컬 JSON 판례로 폴백
    if (recentPrecedentsResults.length > 0) {
      // SearchResult를 precedents 형식으로 변환
      relevantPrecedents = recentPrecedentsResults.map(result => {
        // 제목이나 스니펫에서 사건번호 추출 (예: "제2023-1234호", "2023-1234" 등)
        const text = `${result.title} ${result.snippet}`
        const caseNumberMatch = text.match(/제?\s*(\d{4})[-\s](\d+)\s*호?/) || text.match(/(\d{4})[-\s](\d+)/)
        const caseNumber = caseNumberMatch 
          ? `제${caseNumberMatch[1]}-${caseNumberMatch[2]}호`
          : `제${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}호` // 추출 실패 시 임시 번호
        
        return {
          caseNumber,
          title: result.title,
          content: result.snippet,
          url: result.link
        }
      })
      console.log('✅ 최신 판례 사용:', relevantPrecedents.length, '개')
    } else {
      // 최신 판례가 없으면 로컬 JSON 판례로 폴백
      console.log('⚠️ 최신 판례 없음 → 로컬 JSON 판례로 폴백')
      const localPrecedents = findRelevantPrecedents(topic, keywords, 3)
      relevantPrecedents = localPrecedents.map(p => ({
        caseNumber: p.caseNumber,
        title: p.title,
        content: p.content
      }))
      console.log('✅ 로컬 판례 사용:', relevantPrecedents.length, '개')
    }
    
    // 6. Google Custom Search로 최신 정보 검색
    console.log('🔍 Google Custom Search 시작:', { topic, keywords })
    let searchResults = await searchInsuranceTopics(topic, keywords, 3)
    console.log('✅ Google Custom Search 완료:', { 
      resultCount: searchResults.length,
      success: searchResults.length > 0 
    })
    
    // 6-1. 상품명 감지 및 상품별 추가 검색
    const detectProductName = (text: string): string | null => {
      // 보험사명 패턴 감지 (주요 보험사)
      const insuranceCompanies = [
        '하나생명', '삼성생명', '교보생명', '한화생명', '동부화재', '흥국화재',
        '메리츠화재', '롯데손해보험', '현대해상', 'KB생명', '신한생명', 'NH농협생명',
        'MG손해보험', 'AXA손해보험', 'DB손해보험', '삼성화재', '한화손해보험'
      ]
      
      for (const company of insuranceCompanies) {
        if (text.includes(company)) {
          // 상품명 추출 시도 (보험사명 + 특약명/상품명)
          const match = text.match(new RegExp(`${company}[\\s]*([^\\s]+(?:\\s+[^\\s]+)?)`))
          if (match) {
            return `${company} ${match[1]}`.trim()
          }
          return company
        }
      }
      return null
    }
    
    const productName = detectProductName(`${topic} ${keywords}`)
    let productSearchResults: typeof searchResults = []
    
    if (productName) {
      console.log('🔍 상품명 감지됨, 상품별 추가 검색 수행:', productName)
      
      // 상품별 장단점 검색
      const productQueries = [
        `${productName} 장단점`,
        `${productName} 특약 장점`,
        `${productName} 보장내용`,
        `${productName} 가입 전 확인사항`
      ]
      
      const allProductResults: typeof searchResults = []
      const seenLinks = new Set(searchResults.map(r => r.link))
      
      for (const query of productQueries) {
        try {
          const response = await searchInsuranceTopics(query, '', 2)
          for (const result of response) {
            if (!seenLinks.has(result.link)) {
              seenLinks.add(result.link)
              allProductResults.push(result)
            }
          }
          // API 호출 제한 고려
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error) {
          console.warn('⚠️ 상품별 검색 오류:', error)
        }
      }
      
      productSearchResults = allProductResults.slice(0, 5)
      console.log('✅ 상품별 검색 완료:', { 
        productName,
        resultCount: productSearchResults.length 
      })
      
      // 기존 검색 결과와 통합 (중복 제거)
      const combinedResults = [...searchResults]
      for (const result of productSearchResults) {
        if (!seenLinks.has(result.link)) {
          combinedResults.push(result)
        }
      }
      searchResults = combinedResults
    }
    
    // 검색 결과를 프롬프트 형식으로 변환
    const searchResultsText = formatSearchResultsForPrompt(searchResults)
    
    // 검색 결과에서 출처 추출 (나중에 출처 섹션에 추가)
    const searchSources = extractSourcesFromSearchResults(searchResults)

    // 6. Gemini REST API 직접 호출 (Grounding 활성화)
    const apiKey = process.env.GEMINI_API_KEY!
    const tokenUsage: TokenUsage[] = []
    let customSearchCount = 0 // 커스텀 서치 횟수 추적 (searchInsuranceTopics가 내부적으로 여러 번 호출)
    const groundingSources: Array<{ title: string; url: string; organization?: string }> = []
    
    // REST API 호출 헬퍼 함수 (재시도 및 폴백 로직 포함, Grounding 활성화)
    const generateContentWithFallback = async (prompt: string) => {
      const models = ['gemini-2.5-pro', 'gemini-2.0-flash'] // 1.5 모델 제거
      
      for (let attempt = 0; attempt < models.length; attempt++) {
        const modelName = models[attempt]
        
        try {
          console.log(`모델 시도: ${modelName} (시도 ${attempt + 1}/${models.length}) - Grounding 활성화`)
          
          // REST API 엔드포인트
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
          
          // Grounding 설정 포함 요청 본문
          const requestBody = {
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192,
            },
            // Grounding 활성화 (Google Search 사용 - 내장 기능, 별도 API 키 불필요)
            // 최신 API: google_search 필드만 사용 (dynamicRetrievalConfig 제거)
            tools: [{
              googleSearch: {}
            }]
          }
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          })
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`)
          }
          
          const data = await response.json()
          
          // 응답에서 텍스트 추출
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          
          // 토큰 사용량 추출
          const usageMeta = data.usageMetadata
          const usage: TokenUsage = {
            model: modelName,
            promptTokens: usageMeta?.promptTokenCount || 0,
            completionTokens: usageMeta?.candidatesTokenCount || 0,
            totalTokens: usageMeta?.totalTokenCount || 0
          }
          
          if (usage.totalTokens > 0) {
            tokenUsage.push(usage)
          }
          
          // Grounding 출처 추출
          const groundingMetadata = data.candidates?.[0]?.groundingMetadata
          if (groundingMetadata?.groundingChunks) {
            console.log('✅ Grounding 출처 발견:', groundingMetadata.groundingChunks.length, '개')
            
            groundingMetadata.groundingChunks.forEach((chunk: any) => {
              // web.uri가 있는 경우
              if (chunk.web?.uri && chunk.web.uri.trim() !== '') {
                const url = chunk.web.uri.trim()
                // 유효한 URL인지 확인 (http:// 또는 https://로 시작)
                if (url.startsWith('http://') || url.startsWith('https://')) {
                  groundingSources.push({
                    title: chunk.web?.title || chunk.web?.uri || 'Grounding 검색 결과',
                    url: url,
                    organization: chunk.web?.siteName
                  })
                  console.log('✅ Grounding 출처 추가:', url)
                } else {
                  console.warn('⚠️ Grounding URL 형식 오류:', url)
                }
              } else {
                console.warn('⚠️ Grounding chunk에 URI 없음:', chunk)
              }
            })
          } else {
            console.log('⚠️ Grounding 메타데이터 없음')
          }
          
          return text.trim()
        } catch (error: any) {
          const errorMessage = error?.message || ''
          const errorString = JSON.stringify(error || {})
          
          // 429 에러 또는 할당량 관련 에러 감지
          const isQuotaError = 
            errorMessage.includes('429') || 
            errorMessage.includes('quota') || 
            errorMessage.includes('rate limit') ||
            errorMessage.includes('Too Many Requests') ||
            errorMessage.includes('exceeded') ||
            errorString.includes('free_tier') ||
            errorString.includes('QuotaFailure')
          
          console.error(`${modelName} 모델 호출 실패:`, {
            model: modelName,
            error: errorMessage.substring(0, 500),
            isQuotaError
          })
          
          // 할당량 에러이고 마지막 모델이 아니면 다음 모델로 시도
          if (isQuotaError && attempt < models.length - 1) {
            const nextModel = models[attempt + 1]
            console.log(`⚠️ ${modelName} 할당량 초과 → ${nextModel} 모델로 폴백 시도...`)
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
            continue
          }
          
          // 마지막 모델이거나 할당량 에러가 아니면 에러 던지기
          if (attempt === models.length - 1) {
            throw error
          }
        }
      }
      
      throw new Error('모든 모델에서 실패했습니다')
    }

    // 7. 프롬프트 생성 (Google Custom Search 결과 + 최신 판례 포함)
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
      precedents: relevantPrecedents, // 최신 판례 추가 (최근 5년 이내)
      detectedProductName: productName || undefined, // 감지된 상품명 전달
    })

    console.log('프롬프트 생성 완료, Gemini REST API 호출 중...')
    console.log('✅ Google Grounding 활성화 (내장 검색 기능 사용)')
    console.log('Google Custom Search 결과:', searchResults.length, '개 (프롬프트에 포함)')
    
    // 7. 콘텐츠 생성 (REST API + Grounding 활성화)
    // Grounding은 Gemini API의 내장 실시간 검색 기능으로 별도 API 키 불필요
    let htmlContent = await generateContentWithFallback(prompt)

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
    
    // Google Custom Search 출처 추가 (URL이 있는 것만)
    searchSources.forEach(searchSource => {
      const isDuplicate = allSources.some(s => s.url === searchSource.url)
      if (!isDuplicate && searchSource.url && searchSource.url.trim() !== '') {
        allSources.push({
          title: searchSource.title || '검색 결과',
          url: searchSource.url.trim(),
          organization: searchSource.organization
        })
        console.log('✅ Custom Search 출처 추가:', searchSource.url)
      } else if (!searchSource.url || searchSource.url.trim() === '') {
        console.warn('⚠️ Custom Search 출처 URL 없음:', searchSource)
      }
    })
    
    // Grounding 출처 추가 (REST API 응답에서 추출됨, URL이 있는 것만)
    groundingSources.forEach(groundingSource => {
      const isDuplicate = allSources.some(s => s.url === groundingSource.url)
      if (!isDuplicate && groundingSource.url && groundingSource.url.trim() !== '') {
        allSources.push({
          title: groundingSource.title || 'Grounding 검색 결과',
          url: groundingSource.url.trim(),
          organization: groundingSource.organization
        })
        console.log('✅ Grounding 출처 추가:', groundingSource.url)
      } else if (!groundingSource.url || groundingSource.url.trim() === '') {
        console.warn('⚠️ Grounding 출처 URL 없음:', groundingSource)
      }
    })
    
    const sourcesMarkdown = sourcesToMarkdown(allSources)
    
    console.log('생성 완료! HTML 길이:', htmlContent.length)
    console.log('추출된 출처:', extractedSources.length, '개')
    console.log('Google Custom Search 출처:', searchSources.length, '개')
    console.log('총 출처:', allSources.length, '개')

    // 토큰 사용량 합산 및 비용 추정
    const totalUsage = tokenUsage.reduce(
      (acc, u) => ({
        promptTokens: acc.promptTokens + u.promptTokens,
        completionTokens: acc.completionTokens + u.completionTokens,
        totalTokens: acc.totalTokens + u.totalTokens,
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    )
    const costEstimate = estimateCost(tokenUsage)
    
    // 커스텀 서치 횟수 추정
    // searchInsuranceTopics는 내부적으로 여러 번 검색:
    // - searchTrustedSources: TRUSTED_SITES.length (11개 사이트) = 11회
    // - searchQueries.length (4개 쿼리) = 4회
    // 상품별 검색: productQueries.length (4개 쿼리) * searchInsuranceTopics 내부 호출 = 약 60회
    // 총 약 75회 (추정치)
    customSearchCount = 75 // 추정치 (실제로는 함수 내부에서 추적해야 정확함)

    // 사용량 로그 (실패해도 본문 응답은 진행)
    console.log('📊 토큰 사용량 로깅 시작:', {
      userId: user.id,
      type: 'blog',
      totalTokens: totalUsage.totalTokens,
      tokenBreakdown: tokenUsage,
      costEstimate: costEstimate.totalCost,
      customSearchCount: customSearchCount
    })
    
    Promise.resolve(
      supabase
        .from('usage_logs')
        .insert({
          user_id: user.id,
          type: 'blog',
          prompt_tokens: totalUsage.promptTokens,
          completion_tokens: totalUsage.completionTokens,
          total_tokens: totalUsage.totalTokens,
          meta: {
            topic,
            keywords,
            product,
            tokenBreakdown: tokenUsage, // 모델별 토큰 사용량 (비용 계산용)
            costEstimate: costEstimate.totalCost, // 총 비용 (USD)
            customSearchCount: customSearchCount, // 커스텀 서치 횟수 (추정치)
            customSearchCost: customSearchCount * 0.0005, // 커스텀 서치 비용 (USD)
          },
        })
    )
      .then((result: any) => {
        if (result?.error) {
          console.error('❌ usage_logs insert 실패:', result.error)
          console.error('에러 상세:', JSON.stringify(result.error, null, 2))
        } else {
          console.log('✅ usage_logs insert 성공:', result?.data)
        }
      })
      .catch((err) => {
        console.error('❌ usage_logs insert 예외:', err)
        console.error('예외 상세:', JSON.stringify(err, null, 2))
      })

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
        usage: {
          promptTokens: totalUsage.promptTokens,
          completionTokens: totalUsage.completionTokens,
          totalTokens: totalUsage.totalTokens,
          costEstimate,
        },
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
