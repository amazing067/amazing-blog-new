/**
 * 판례 검색 및 필터링 유틸리티
 * 
 * 주제와 키워드에 맞는 관련 판례를 찾아 반환합니다.
 */

export interface Precedent {
  caseNumber: string  // "제2023-1234호"
  title: string       // 판례 제목
  content: string     // 판례 내용
  keywords: string[]  // 키워드 목록
}

// 판례 데이터는 동적으로 로드 (빌드 시 포함 방지)
let precedentsCache: Precedent[] | null = null

/**
 * 판례 데이터 로드 (최초 1회만)
 */
function loadPrecedents(): Precedent[] {
  if (precedentsCache) {
    return precedentsCache
  }
  
  try {
    const fs = require('fs')
    const path = require('path')
    const precedentsPath = path.join(process.cwd(), 'data', 'precedents.json')
    
    if (fs.existsSync(precedentsPath)) {
      const data = fs.readFileSync(precedentsPath, 'utf-8')
      precedentsCache = JSON.parse(data)
      console.log(`✅ 판례 데이터 로드 완료: ${precedentsCache?.length || 0}개`)
    } else {
      console.warn('⚠️ 판례 데이터 파일을 찾을 수 없습니다. data/precedents.json 파일을 생성하세요.')
      precedentsCache = []
    }
  } catch (error) {
    console.error('❌ 판례 데이터 로드 오류:', error)
    precedentsCache = []
  }
  
  return precedentsCache || []
}

/**
 * 텍스트에서 검색어 매칭 점수 계산
 */
function calculateRelevanceScore(
  precedent: Precedent,
  searchTerms: string[]
): number {
  let score = 0
  
  // 대소문자 구분 없이 검색
  const titleLower = precedent.title.toLowerCase()
  const contentLower = precedent.content.toLowerCase()
  const keywordsLower = precedent.keywords.map(k => k.toLowerCase())
  
  searchTerms.forEach(term => {
    const termLower = term.toLowerCase()
    
    // 제목에 포함: 높은 점수 (3점)
    if (titleLower.includes(termLower)) {
      score += 3
    }
    
    // 키워드에 포함: 중간 점수 (2점)
    if (keywordsLower.some(k => k.includes(termLower))) {
      score += 2
    }
    
    // 내용에 포함: 낮은 점수 (1점)
    if (contentLower.includes(termLower)) {
      score += 1
    }
  })
  
  // 키워드 자체가 검색어와 정확히 일치하면 보너스 점수
  precedent.keywords.forEach(keyword => {
    if (searchTerms.some(term => keyword.toLowerCase() === term.toLowerCase())) {
      score += 5 // 큰 보너스
    }
  })
  
  return score
}

/**
 * 주제와 키워드에 맞는 관련 판례 찾기
 * 
 * @param topic 블로그 주제
 * @param keywords 핵심 키워드 (쉼표로 구분된 문자열)
 * @param maxResults 최대 반환 개수 (기본: 3)
 * @returns 관련 판례 배열
 */
export function findRelevantPrecedents(
  topic: string,
  keywords: string,
  maxResults: number = 3
): Precedent[] {
  // 판례 데이터 로드
  const precedents = loadPrecedents()
  
  if (precedents.length === 0) {
    return []
  }
  
  // 검색어 추출 (주제 + 키워드)
  const searchText = `${topic} ${keywords}`
  const searchTerms = searchText
    .split(/[\s,，、]+/)  // 공백, 쉼표, 한글 쉼표로 분리
    .filter(term => term.length > 1)  // 1글자 이하 제외
    .filter(term => !['의', '을', '를', '에', '에서', '와', '과', '는', '은', '이', '가'].includes(term))  // 조사 제외
  
  if (searchTerms.length === 0) {
    return []
  }
  
  // 각 판례에 대한 관련도 점수 계산
  const scoredPrecedents = precedents.map(precedent => ({
    precedent,
    score: calculateRelevanceScore(precedent, searchTerms)
  }))
  
  // 점수 순으로 정렬, 상위 N개만 반환
  const topPrecedents = scoredPrecedents
    .filter(item => item.score > 0)  // 점수가 0보다 큰 것만
    .sort((a, b) => b.score - a.score)  // 점수 내림차순
    .slice(0, maxResults)
    .map(item => item.precedent)
  
  if (topPrecedents.length > 0) {
    console.log(`✅ 관련 판례 ${topPrecedents.length}개 발견`)
    topPrecedents.forEach(p => {
      console.log(`  - ${p.caseNumber}: ${p.title.substring(0, 50)}...`)
    })
  }
  
  return topPrecedents
}

/**
 * 판례를 프롬프트용 텍스트로 포맷팅
 */
export function formatPrecedentsForPrompt(precedents: Precedent[]): string {
  if (precedents.length === 0) {
    return ''
  }
  
  let formatted = '\n\n### 관련 분쟁조정 사례:\n\n'
  
  precedents.forEach((precedent, index) => {
    formatted += `${index + 1}. **${precedent.caseNumber}**\n`
    formatted += `   - 제목: ${precedent.title}\n`
    formatted += `   - 요지: ${precedent.content.substring(0, 500)}${precedent.content.length > 500 ? '...' : ''}\n\n`
  })
  
  return formatted
}

