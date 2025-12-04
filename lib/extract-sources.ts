/**
 * 생성된 HTML에서 출처 추출
 */
export interface Source {
  title: string
  url?: string
  organization?: string
  date?: string
}

/**
 * HTML에서 출처 정보 추출
 */
export function extractSources(html: string): Source[] {
  const sources: Source[] = []
  
  // 1. 기본 출처 (항상 포함)
  sources.push({
    title: '보험료 데이터',
    organization: '자체 수집 데이터 (엑셀 7개 파일 분석)',
    date: new Date().toISOString().split('T')[0]
  })
  
  sources.push({
    title: '질병분류 코드',
    organization: '통계청 한국표준질병사인분류 KCD-9',
    url: 'https://www.koicd.kr/',
    date: '2025-07-01 버전'
  })
  
  // 2. HTML에서 링크 추출 (📚 참고 자료 섹션)
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi
  let match
  
  const extractedLinks = new Set<string>()  // 중복 방지
  
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1]
    const text = match[2].trim()
    
    // koicd.kr 제외 (기본 출처에 이미 있음)
    if (url.includes('koicd.kr')) continue
    
    // 공식 기관 URL만 추출
    const officialDomains = [
      'cancer.go.kr',
      'hira.or.kr', 
      'kdca.go.kr',
      'fss.or.kr',
      'mohw.go.kr',
      'kostat.go.kr',
      'kosis.kr',
      'nhis.or.kr'
    ]
    
    if (officialDomains.some(domain => url.includes(domain))) {
      const linkKey = `${text}|${url}`
      if (!extractedLinks.has(linkKey)) {
        extractedLinks.add(linkKey)
        
        // 기관명 추출
        let org = ''
        if (url.includes('cancer.go.kr')) org = '국가암정보센터'
        else if (url.includes('hira.or.kr')) org = '건강보험심사평가원'
        else if (url.includes('kdca.go.kr')) org = '질병관리청'
        else if (url.includes('fss.or.kr')) org = '금융감독원'
        else if (url.includes('mohw.go.kr')) org = '보건복지부'
        else if (url.includes('kostat.go.kr')) org = '통계청'
        
        sources.push({
          title: text,
          url: url,
          organization: org
        })
      }
    }
  }
  
  // 3. 텍스트에서 출처 추출 (출처: ... 형식)
  const sourceRegex = /\(출처:\s*([^,)]+)(?:,\s*([^)]+))?\)/gi
  
  while ((match = sourceRegex.exec(html)) !== null) {
    sources.push({
      title: match[2] || '통계 자료',
      organization: match[1]
    })
  }
  
  // 중복 제거
  const uniqueSources = sources.filter((source, index, self) =>
    index === self.findIndex(s => s.title === source.title && s.url === source.url)
  )
  
  return uniqueSources
}


