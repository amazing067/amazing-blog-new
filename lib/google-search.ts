/**
 * Google Custom Search API 유틸리티
 */

export interface SearchResult {
  title: string
  link: string
  snippet: string
  displayLink: string
}

export interface SearchResponse {
  success: boolean
  results: SearchResult[]
  totalResults?: number
  error?: string
}

/**
 * Google Custom Search API로 검색 수행
 */
export async function searchGoogle(
  query: string,
  maxResults: number = 5
): Promise<SearchResponse> {
  // 기존 GOOGLE_API_KEY를 우선 사용, 없으면 GOOGLE_CUSTOM_SEARCH_API_KEY 사용
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || process.env.GOOGLE_API_KEY
  const searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID

  if (!apiKey || !searchEngineId) {
    console.warn('⚠️ Google Custom Search API 키가 설정되지 않았습니다.')
    if (!apiKey) {
      console.warn('   GOOGLE_CUSTOM_SEARCH_API_KEY 또는 GOOGLE_API_KEY를 설정해주세요.')
    }
    if (!searchEngineId) {
      console.warn('   GOOGLE_CUSTOM_SEARCH_ENGINE_ID를 설정해주세요.')
    }
    return {
      success: false,
      results: [],
      error: 'API 키 또는 검색 엔진 ID가 설정되지 않았습니다.'
    }
  }

  try {
    console.log('🔍 Google Custom Search API 호출:', {
      query,
      searchEngineId: searchEngineId?.substring(0, 10) + '...', // ID 일부만 표시
      hasApiKey: !!apiKey
    })
    
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('cx', searchEngineId)
    url.searchParams.set('q', query)
    url.searchParams.set('num', Math.min(maxResults, 10).toString()) // 최대 10개
    url.searchParams.set('lr', 'lang_ko') // 한국어 결과만

    const response = await fetch(url.toString())
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Google Custom Search 성공:', {
        query,
        resultCount: data.items?.length || 0,
        totalResults: data.searchInformation?.totalResults || 0
      })
    } else {
      console.error('❌ Google Custom Search API 오류:', {
        status: response.status,
        error: data.error?.message || 'Unknown error'
      })
    }

    if (!response.ok) {
      console.error('Google Custom Search API 오류:', data)
      return {
        success: false,
        results: [],
        error: data.error?.message || '검색 중 오류가 발생했습니다.'
      }
    }

    const results: SearchResult[] = (data.items || []).map((item: any) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
      displayLink: item.displayLink || ''
    }))

    return {
      success: true,
      results,
      totalResults: parseInt(data.searchInformation?.totalResults || '0', 10)
    }
  } catch (error: any) {
    console.error('Google Custom Search 오류:', error)
    return {
      success: false,
      results: [],
      error: error.message || '검색 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 공신력 있는 기관 사이트 목록 (보험/건강 관련)
 */
const TRUSTED_SITES = [
  'kostat.go.kr',           // 통계청
  'cancer.go.kr',           // 국가암정보센터
  'hira.or.kr',             // 건강보험심사평가원
  'kdca.go.kr',             // 질병관리청
  'mohw.go.kr',             // 보건복지부
  'fss.or.kr',              // 금융감독원
  'fsc.go.kr',              // 금융위원회
  'kosis.kr',               // 통계청 KOSIS (국가통계포털)
  'nhis.or.kr',             // 국민건강보험공단
  'kdi.re.kr',              // 한국개발연구원
  'kihasa.re.kr'            // 한국보건사회연구원
]

/**
 * 공신력 있는 기관 사이트에서만 검색
 */
export async function searchTrustedSources(
  query: string,
  maxResults: number = 5
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = []
  const seenLinks = new Set<string>()

  // 각 공신력 있는 사이트에서 검색
  for (const site of TRUSTED_SITES) {
    try {
      const siteQuery = `${query} site:${site}`
      const response = await searchGoogle(siteQuery, 2) // 사이트당 2개씩
      
      if (response.success) {
        for (const result of response.results) {
          if (!seenLinks.has(result.link)) {
            seenLinks.add(result.link)
            allResults.push(result)
          }
        }
      }
      
      // API 호출 제한을 고려한 대기
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.warn(`⚠️ ${site} 검색 오류:`, error)
    }
  }

  return allResults.slice(0, maxResults)
}

/**
 * 보험 관련 주제로 여러 검색어를 조합하여 검색
 * 공신력 있는 기관 사이트와 전체 웹 검색을 병행
 */
export async function searchInsuranceTopics(
  topic: string,
  keywords: string,
  maxResultsPerQuery: number = 3
): Promise<SearchResult[]> {
  // 검색어 조합 생성
  const searchQueries = [
    `${topic} ${keywords}`,
    `${topic} 통계`,
    `${topic} 최신 정보`,
    `${keywords} 보험료 비교`
  ]

  const allResults: SearchResult[] = []
  const seenLinks = new Set<string>()

  // 1. 공신력 있는 기관 사이트에서 검색 (우선)
  try {
    const trustedQuery = `${topic} ${keywords}`
    const trustedResults = await searchTrustedSources(trustedQuery, 5)
    
    for (const result of trustedResults) {
      if (!seenLinks.has(result.link)) {
        seenLinks.add(result.link)
        allResults.push(result)
      }
    }
  } catch (error) {
    console.warn('⚠️ 공신력 있는 사이트 검색 오류:', error)
  }

  // 2. 전체 웹 검색 (보완)
  for (const query of searchQueries) {
    const response = await searchGoogle(query, maxResultsPerQuery)
    
    if (response.success) {
      for (const result of response.results) {
        // 중복 제거
        if (!seenLinks.has(result.link)) {
          seenLinks.add(result.link)
          allResults.push(result)
        }
      }
    }

    // API 호출 제한을 고려한 짧은 대기
    if (searchQueries.indexOf(query) < searchQueries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return allResults.slice(0, 10) // 최대 10개 반환
}

/**
 * 검색 결과를 프롬프트에 포함할 형식으로 변환
 */
export function formatSearchResultsForPrompt(results: SearchResult[]): string {
  if (results.length === 0) {
    return ''
  }

  let formatted = '\n\n## 📚 실시간 검색 결과 (참고 자료)\n\n'
  
  results.forEach((result, index) => {
    formatted += `${index + 1}. **${result.title}**\n`
    formatted += `   - URL: ${result.link}\n`
    formatted += `   - 요약: ${result.snippet}\n\n`
  })

  formatted += '\n위 검색 결과를 참고하여 최신 정보를 반영하되, 출처를 명확히 표기하세요.\n'

  return formatted
}

/**
 * 검색 결과에서 출처 정보 추출
 */
export function extractSourcesFromSearchResults(results: SearchResult[]): Array<{
  title: string
  url: string
  organization?: string
}> {
  return results.map(result => {
    // 도메인에서 기관명 추출
    let organization = ''
    const domain = result.displayLink || new URL(result.link).hostname
    
    if (domain.includes('cancer.go.kr')) organization = '국가암정보센터'
    else if (domain.includes('hira.or.kr')) organization = '건강보험심사평가원'
    else if (domain.includes('kdca.go.kr')) organization = '질병관리청'
    else if (domain.includes('fss.or.kr')) organization = '금융감독원'
    else if (domain.includes('mohw.go.kr')) organization = '보건복지부'
    else if (domain.includes('kostat.go.kr')) organization = '통계청'
    else if (domain.includes('kosis.kr')) organization = '통계청 KOSIS'
    else if (domain.includes('nhis.or.kr')) organization = '국민건강보험공단'
    else if (domain.includes('fss.or.kr')) organization = '금융감독원'
    else if (domain.includes('fsc.go.kr')) organization = '금융위원회'
    else {
      // 일반 도메인에서 기관명 추출 시도
      organization = domain.replace(/^www\./, '').split('.')[0]
    }

    return {
      title: result.title,
      url: result.link,
      organization: organization || undefined
    }
  })
}

