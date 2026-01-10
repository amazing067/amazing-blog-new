import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { searchGoogle, searchGoogleImages } from '@/lib/google-search'

export async function POST(request: NextRequest) {
  try {
    const { productName } = await request.json()

    if (!productName || !productName.trim()) {
      return NextResponse.json(
        { error: '상품명이 필요합니다' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API 키가 설정되지 않았습니다' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash'
    })

    console.log('[상품명 기반 질문글 생성] 시작:', productName)

    // 1단계: 웹 검색으로 질문 패턴 및 설계서 정보 수집
    const searchQueries = [
      `"${productName}" 질문`,
      `"${productName}" 궁금`,
      `"${productName}" 후기`,
      `"${productName}" 가입 고민`,
      `"${productName}" 설계서`,
      `"${productName}" 보장내용`,
      `"${productName}" 특약`,
      `"${productName}" 보험료`
    ]

    console.log('[상품명 기반 질문글 생성] 웹 검색 시작...')
    const searchResults: string[] = []
    
    // 각 검색 쿼리로 검색 (최대 3개씩)
    for (const query of searchQueries.slice(0, 4)) { // 처음 4개만 검색 (비용 절감)
      try {
        const result = await searchGoogle(query, 3)
        if (result.success && result.results.length > 0) {
          const snippets = result.results.map(r => `${r.title}: ${r.snippet}`).join('\n')
          searchResults.push(snippets)
          console.log(`[상품명 기반 질문글 생성] 검색 완료: ${query} (${result.results.length}개 결과)`)
        }
      } catch (error: any) {
        console.error(`[상품명 기반 질문글 생성] 검색 오류 (${query}):`, error.message)
        // 검색 실패해도 계속 진행
      }
      
      // API 호출 제한을 고려하여 약간의 지연
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    const searchText = searchResults.join('\n\n---\n\n')
    console.log(`[상품명 기반 질문글 생성] 검색 완료 (총 ${searchResults.length}개 쿼리)`)

    // 1.5단계: 설계서 이미지 검색 (전문적인 실제 설계서 우선 검색)
    let designSheetImageBase64: string | null = null
    let designSheetImageUrl: string | null = null // 원본 URL 저장 (다운로드용)
    let designSheetImageTitle: string | null = null // 이미지 제목 저장
    
    try {
      console.log('[상품명 기반 질문글 생성] 설계서 이미지 검색 시작...')
      
      // 상품명에서 보험사명 추출 (일치 여부 확인용)
      const extractInsuranceCompany = (productName: string): string[] => {
        const companies = [
          '삼성생명', '삼성화재', '한화생명', '한화화재', '교보생명', 'DB생명', 'DB손해보험',
          'KB생명', 'KB손해보험', '신한생명', '신한화재', 'NH농협생명', 'NH농협손해보험',
          '현대생명', '현대해상', '메리츠생명', '메리츠화재', '미래에셋생명', 'DB생명'
        ]
        const found = companies.filter(company => productName.includes(company))
        return found.length > 0 ? found : []
      }
      
      const productCompanies = extractInsuranceCompany(productName)
      console.log(`[상품명 기반 질문글 생성] 추출된 보험사명: ${productCompanies.join(', ') || '없음'}`)
      
      // 더 전문적인 검색 쿼리 시도 (실제 제안서/설계서 문서 스타일 우선)
      // 보장명, 가입금액, 보험료, 납입기간이 포함된 표 형식 제안서를 찾도록
      const imageQueries = [
        `"${productName}" 제안서 가입내용 보장명 보험료`, // 제안서 스타일 (가장 전문적)
        `"${productName}" 상품제안서 가입담보`, // 상품제안서 키워드
        `"${productName}" 가입내용 보장명 가입금액`, // 가입내용 스타일
        `"${productName}" 보험료표 PDF`, // PDF 우선 (전문적인 문서)
        `"${productName}" 설계서 PDF`,
        `"${productName}" 제안서 PDF`,
        `"${productName}" 가입설계서 보장내용`, // 가입설계서 (더 전문적)
        `"${productName}" 보험료표 이미지 특약 담보`, // 특약/담보 포함 강조
        `"${productName}" 보장내용표 특약`, // 보장내용표
        `"${productName}" 보험료표 이미지`
      ]
      
      let selectedImage: { url: string; title: string; link: string; score: number } | null = null
      const candidateImages: Array<{ url: string; title: string; link: string; score: number }> = []
      
      // 각 검색 쿼리를 시도하여 가장 적합한 이미지 찾기
      for (const imageQuery of imageQueries) {
        try {
          const imageSearchResult = await searchGoogleImages(imageQuery, 8) // 더 많은 결과 수집
          
          if (imageSearchResult.success && imageSearchResult.results.length > 0) {
            // 각 결과에 대해 점수 매기기 (품질 평가)
            for (const result of imageSearchResult.results) {
              const titleLower = (result.title || '').toLowerCase()
              const linkLower = (result.link || '').toLowerCase()
              const imageUrlLower = (result.imageUrl || '').toLowerCase()
              
              // 강화된 제외 키워드 체크 (로고, 브랜드, 아이콘, 비교사이트, 그래픽 등)
              const excludeKeywords = [
                '로고', 'logo', '브랜드', 'brand', '아이콘', 'icon',
                '마크', 'mark', '심볼', 'symbol', '이모지', 'emoji',
                '썸네일', 'thumbnail', '프로필', 'profile', '사진', 'photo',
                '비교사이트', '비교', 'comparison', 'site', '웹사이트', 'website',
                '그래픽', 'graphic', '배너', 'banner', '이미지', 'image',
                '메리츠', 'meritz', '삼성', 'samsung', '한화', 'hanwha',
                '교보', 'kyobo', 'KB', '신한', 'shinhan', 'NH', '농협',
                '현대', 'hyundai', 'DB', '미래에셋', 'mirae'
              ]
              
              // 비교사이트, 그래픽, 배너, 홍보, 홈페이지 등 쓸데없는 이미지 제외
              const uselessImageKeywords = [
                '비교사이트', '비교', 'comparison', 'site',
                '그래픽', 'graphic', '배너', 'banner',
                '아이콘', 'icon', '이모지', 'emoji',
                '썸네일', 'thumbnail',
                '홈페이지', 'homepage', 'main', '메인',
                '홍보', 'promotion', '프로모션', '광고', 'ad',
                '로보텔러', 'roboteller', 'AI로보텔러',
                '서비스소개', '소개', 'introduction'
              ]
              const isUselessImage = uselessImageKeywords.some(keyword =>
                titleLower.includes(keyword) || linkLower.includes(keyword) || imageUrlLower.includes(keyword)
              )
              
              if (isUselessImage) {
                console.log(`[상품명 기반 질문글 생성] 쓸데없는 이미지 제외: ${result.title} (비교사이트/그래픽/홍보 등)`)
                continue
              }
              
              // 로고/브랜드 키워드와 보험사명이 함께 있으면 제외 (예: "메리츠 로고", "삼성 브랜드")
              const hasLogoWithCompany = excludeKeywords.some(keyword => {
                if (['로고', 'logo', '브랜드', 'brand', '마크', 'mark'].includes(keyword)) {
                  // 로고/브랜드 키워드와 함께 보험사명이 있으면 제외
                  const hasCompanyName = productCompanies.some(company => 
                    titleLower.includes(company.toLowerCase()) || 
                    linkLower.includes(company.toLowerCase())
                  )
                  if (hasCompanyName && (titleLower.includes(keyword) || linkLower.includes(keyword))) {
                    return true
                  }
                }
                return false
              })
              
              // 일반적인 제외 키워드 체크
              const isExcluded = excludeKeywords.some(keyword => 
                (titleLower.includes(keyword) || linkLower.includes(keyword) || imageUrlLower.includes(keyword)) &&
                // 단, 보험사명만 있는 것은 제외하지 않음 (설계서에 보험사명이 포함될 수 있음)
                !['메리츠', 'meritz', '삼성', 'samsung', '한화', 'hanwha', '교보', 'kyobo', 'KB', '신한', 'shinhan', 'NH', '농협', '현대', 'hyundai', 'DB', '미래에셋', 'mirae'].includes(keyword)
              )
              
              // 상품명과 다른 보험사 로고는 완전히 제외
              if (productCompanies.length > 0) {
                const otherCompanies = [
                  '메리츠', 'meritz', '삼성', 'samsung', '한화', 'hanwha',
                  '교보', 'kyobo', 'KB', '신한', 'shinhan', 'NH', '농협',
                  '현대', 'hyundai', 'DB', '미래에셋', 'mirae'
                ].filter(company => 
                  !productCompanies.some(pc => pc.toLowerCase().includes(company.toLowerCase()) || company.toLowerCase().includes(pc.toLowerCase()))
                )
                
                const hasOtherCompanyLogo = otherCompanies.some(company => {
                  const hasCompany = titleLower.includes(company) || linkLower.includes(company) || imageUrlLower.includes(company)
                  const hasLogo = titleLower.includes('로고') || titleLower.includes('logo') || linkLower.includes('logo') || imageUrlLower.includes('logo')
                  return hasCompany && hasLogo
                })
                
                if (hasOtherCompanyLogo) {
                  console.log(`[상품명 기반 질문글 생성] 다른 보험사 로고 제외: ${result.title}`)
                  continue
                }
              }
              
              if (hasLogoWithCompany || isExcluded || !result.imageUrl) {
                console.log(`[상품명 기반 질문글 생성] 제외된 이미지: ${result.title} (로고/브랜드 포함)`)
                continue // 제외된 이미지 건너뛰기
              }
              
              // 점수 계산 (높을수록 더 전문적인 이미지)
              let score = 0
              
              // 상품명/보험사명 일치 여부 확인 (매우 중요)
              if (productCompanies.length > 0) {
                const hasMatchingCompany = productCompanies.some(company => {
                  const companyLower = company.toLowerCase()
                  return titleLower.includes(companyLower) || linkLower.includes(companyLower) || imageUrlLower.includes(companyLower)
                })
                if (hasMatchingCompany) {
                  score += 80 // 보험사명 일치 시 매우 높은 점수
                } else {
                  // 보험사명이 일치하지 않으면 점수 감점
                  score -= 50
                }
              }
              
              // 상품명이 제목/URL에 포함되어 있는지 확인
              const productNameWords = productName.split(/\s+/).filter((w: string) => w.length > 1)
              const hasProductName = productNameWords.some((word: string) => 
                titleLower.includes(word.toLowerCase()) || linkLower.includes(word.toLowerCase())
              )
              if (hasProductName) {
                score += 40 // 상품명 포함 시 높은 점수
              }
              
              // PDF 관련 키워드 (매우 높은 점수)
              if (titleLower.includes('pdf') || linkLower.includes('pdf') || result.link.endsWith('.pdf')) {
                score += 100
              }
              
              // 전문적인 문서 키워드 (실제 제안서/설계서 형식 우선)
              const professionalKeywords = [
                { keywords: ['가입내용', '피보험자', '가입담보'], weight: 60 }, // 제안서 형식 (가장 높은 점수)
                { keywords: ['상품제안서', '제안서'], weight: 55 },
                { keywords: ['보장명', '가입금액', '납입기간', '보험기간'], weight: 50 }, // 제안서 표 항목
                { keywords: ['설계서', '가입설계서'], weight: 50 },
                { keywords: ['보험료표', '보험료', 'premium'], weight: 40 },
                { keywords: ['특약', '담보', '보장내용'], weight: 35 },
                { keywords: ['상품설명서', 'product'], weight: 30 },
                { keywords: ['보장', 'coverage'], weight: 25 }
              ]
              
              for (const { keywords, weight } of professionalKeywords) {
                if (keywords.some(kw => titleLower.includes(kw) || linkLower.includes(kw))) {
                  score += weight
                }
              }
              
              // URL 패턴 분석
              if (linkLower.includes('design') || linkLower.includes('proposal') || linkLower.includes('sheet')) {
                score += 20
              }
              
              // 이미지 파일 확장자 체크 (PDF 우선, PNG/JPG는 낮은 점수)
              if (result.imageUrl.endsWith('.pdf')) {
                score += 50
              } else if (result.imageUrl.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
                score += 10 // 일반 이미지는 낮은 점수
              }
              
              // 쿼리 우선순위에 따른 보너스 점수 (제안서 형식 우선)
              if (imageQuery.includes('가입내용') || imageQuery.includes('가입담보')) {
                score += 40 // 제안서 형식 (가장 높은 보너스)
              } else if (imageQuery.includes('상품제안서')) {
                score += 35
              } else if (imageQuery.includes('PDF')) {
                score += 30
              } else if (imageQuery.includes('보험료표')) {
                score += 20
              } else if (imageQuery.includes('특약') || imageQuery.includes('담보')) {
                score += 15
              }
              
              // 제안서 형식 키워드 추가 확인 (보장명, 가입금액 등이 있으면 더 높은 점수)
              const proposalFormatKeywords = ['보장명', '가입금액', '납입기간', '보험기간', '피보험자', '가입내용', '가입담보']
              const hasProposalFormat = proposalFormatKeywords.some(kw => 
                titleLower.includes(kw) || linkLower.includes(kw)
              )
              if (hasProposalFormat) {
                score += 50 // 제안서 형식 키워드 보너스 (더 높게)
              }
              
              // 제안서 형식이 확실히 아닌 이미지는 점수 감점
              // 비교사이트, 그래픽, 배너, 홍보, 홈페이지 등은 이미 위에서 제외되지만, 혹시 모를 경우를 대비
              const nonProposalKeywords = [
                '비교', 'comparison', '그래픽', 'graphic', '배너', 'banner', '아이콘', 'icon',
                '홈페이지', 'homepage', 'main', '메인', '홍보', 'promotion', '프로모션',
                '광고', 'ad', '로보텔러', 'roboteller', '서비스소개', '소개', 'introduction'
              ]
              const hasNonProposalKeyword = nonProposalKeywords.some(kw =>
                titleLower.includes(kw) || linkLower.includes(kw)
              )
              if (hasNonProposalKeyword) {
                score -= 150 // 쓸데없는 이미지는 강력하게 감점 (완전히 제외)
                console.log(`[상품명 기반 질문글 생성] 홍보/홈페이지 이미지 감점: ${result.title}`)
              }
              
              // 점수가 음수면 제외 (보험사명 불일치 등)
              if (score < 0) {
                console.log(`[상품명 기반 질문글 생성] 점수 미달로 제외: ${result.title} (점수: ${score})`)
                continue
              }
              
              candidateImages.push({
                url: result.imageUrl,
                title: result.title || '',
                link: result.link || '',
                score
              })
            }
            
            // API 호출 제한을 고려하여 약간의 지연
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        } catch (queryError: any) {
          console.error(`[상품명 기반 질문글 생성] 이미지 검색 쿼리 오류 (${imageQuery}):`, queryError.message)
          continue // 다음 쿼리 시도
        }
      }
      
      // 점수 기준으로 정렬하여 가장 적합한 이미지 선택
      if (candidateImages.length > 0) {
        // 중복 제거 (같은 URL은 한 번만)
        const uniqueImages = Array.from(
          new Map(candidateImages.map(img => [img.url, img])).values()
        )
        
        // 점수 기준으로 정렬 (높은 점수 우선)
        uniqueImages.sort((a, b) => b.score - a.score)
        
        console.log(`[상품명 기반 질문글 생성] 전체 후보 이미지 수: ${uniqueImages.length}`)
        console.log(`[상품명 기반 질문글 생성] 상위 5개 이미지:`)
        uniqueImages.slice(0, 5).forEach((img, idx) => {
          console.log(`  ${idx + 1}. ${img.title} (점수: ${img.score}) - ${img.link}`)
        })
        
        // 제안서 형식 키워드(가입내용, 보장명 등)가 포함된 이미지 필터링
        const proposalFormatImages = uniqueImages.filter(img => {
          const titleLower = img.title.toLowerCase()
          const linkLower = img.link.toLowerCase()
          const proposalKeywords = ['가입내용', '보장명', '가입금액', '납입기간', '보험기간', '피보험자', '가입담보', '상품제안서']
          return proposalKeywords.some(kw => titleLower.includes(kw) || linkLower.includes(kw))
        })
        
        console.log(`[상품명 기반 질문글 생성] 제안서 형식 이미지 수: ${proposalFormatImages.length}`)
        if (proposalFormatImages.length > 0) {
          console.log(`[상품명 기반 질문글 생성] 제안서 형식 이미지 목록:`)
          proposalFormatImages.forEach((img, idx) => {
            console.log(`  ${idx + 1}. ${img.title} (점수: ${img.score})`)
          })
        }
        
        // 제안서 형식 이미지만 선택 (매우 엄격한 기준)
        // 제안서 형식 키워드(가입내용, 보장명, 가입금액 등)가 반드시 포함되어야 함
        if (proposalFormatImages.length > 0) {
          // 제안서 형식 이미지 중 점수가 50 이상인 것만 선택 (엄격한 기준)
          selectedImage = proposalFormatImages.find(img => img.score >= 80) ||
                         proposalFormatImages.find(img => img.score >= 50) ||
                         null // 점수가 50점 미만이면 선택하지 않음 (너무 낮은 점수는 제외)
          
          if (selectedImage) {
            console.log(`[상품명 기반 질문글 생성] ✅ 제안서 형식 이미지 선택: ${selectedImage.title} (점수: ${selectedImage.score})`)
          } else {
            console.log(`[상품명 기반 질문글 생성] ❌ 제안서 형식 이미지가 있지만 점수가 너무 낮음 (최소 50점 필요)`)
            console.log(`[상품명 기반 질문글 생성] 최고 점수 제안서 형식: ${proposalFormatImages[0]?.score || 0}`)
            selectedImage = null
          }
        } else {
          // 제안서 형식 이미지가 없으면 무조건 이미지 첨부 안 함 (엄격한 기준)
          console.log(`[상품명 기반 질문글 생성] ❌ 제안서 형식 이미지 없음 - 이미지 첨부 안 함`)
          if (uniqueImages.length > 0) {
            console.log(`[상품명 기반 질문글 생성] 후보 이미지는 있으나 제안서 형식 아님:`)
            uniqueImages.slice(0, 3).forEach((img, idx) => {
              console.log(`  ${idx + 1}. ${img.title} (점수: ${img.score}) - 제안서 키워드 없음`)
            })
          }
          selectedImage = null
        }
        
        if (selectedImage) {
          console.log(`[상품명 기반 질문글 생성] 최종 선택된 이미지: ${selectedImage.title} (점수: ${selectedImage.score})`)
        } else {
          console.log(`[상품명 기반 질문글 생성] 최종 결과: 이미지 없음`)
        }
      } else {
        console.log('[상품명 기반 질문글 생성] ❌ 후보 이미지가 전혀 없음 (검색 결과 없음 또는 모두 필터링됨)')
      }
      
      // 선택된 이미지 다운로드
      if (selectedImage && selectedImage.url) {
        try {
          console.log('[상품명 기반 질문글 생성] 설계서 이미지 다운로드 시작:', selectedImage.title, selectedImage.url)
          
          // PDF인 경우 PDF로 다운로드, 이미지인 경우 이미지로 다운로드
          const isPdf = selectedImage.url.endsWith('.pdf') || selectedImage.url.includes('.pdf')
          
          const imageResponse = await fetch(selectedImage.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': isPdf ? 'application/pdf' : 'image/*'
            }
          })
          
          if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            
            // base64로 변환
            const base64 = buffer.toString('base64')
            const contentType = imageResponse.headers.get('content-type') || (isPdf ? 'application/pdf' : 'image/jpeg')
            
            // PDF는 data URI로 변환하지 않고 URL만 저장 (브라우저에서 직접 다운로드)
            if (isPdf) {
              designSheetImageUrl = selectedImage.url
              designSheetImageTitle = selectedImage.title
              // PDF는 base64로 변환하지 않음 (용량이 크고, 브라우저에서 직접 열 수 없을 수 있음)
              console.log('[상품명 기반 질문글 생성] PDF 설계서 발견, URL만 저장:', selectedImage.url)
            } else {
              designSheetImageBase64 = `data:${contentType};base64,${base64}`
              designSheetImageUrl = selectedImage.url
              designSheetImageTitle = selectedImage.title
              console.log('[상품명 기반 질문글 생성] 설계서 이미지 다운로드 완료:', selectedImage.title)
            }
          } else {
            console.warn('[상품명 기반 질문글 생성] 이미지 다운로드 실패:', imageResponse.status)
          }
        } catch (imageError: any) {
          console.error('[상품명 기반 질문글 생성] 이미지 다운로드 오류:', imageError.message)
          // 이미지 다운로드 실패해도 계속 진행
        }
      } else {
        console.log('[상품명 기반 질문글 생성] 설계서 이미지 검색 결과 없음 (품질 기준 미달)')
      }
    } catch (imageSearchError: any) {
      console.error('[상품명 기반 질문글 생성] 이미지 검색 오류:', imageSearchError.message)
      // 이미지 검색 실패해도 계속 진행
    }

    // 2단계: Gemini AI로 검색 결과 분석 및 질문글 + 답변 강조 포인트 생성
    const prompt = `보험 상품에 대한 실제 고객들의 질문 패턴과 설계서 정보를 분석하여 자연스러운 질문글과 답변 강조 포인트를 생성해주세요.

**[상품 정보]**
- 상품명: ${productName}

**[웹 검색 결과]**
${searchText || '검색 결과가 없습니다. 일반적인 보험 상품 질문 패턴을 기반으로 생성해주세요.'}

**[작성 지침]**

1. **제목 작성**:
   - 상품명을 포함한 자연스러운 질문 형식
   - 예: "${productName} 가입 고민 있어요"
   - 15-25자 내외
   - 물음표 사용 권장

2. **본문 작성**:
   - 2-3개 단락으로 구성 (단락 사이는 빈 줄로 구분)
   - 실제 고객이 작성할 법한 자연스러운 문체 (해요체/하십시오체)
   - 검색 결과에서 찾은 실제 고민 포인트 반영
   - 설계서 정보가 있다면 보험료, 보장내용, 특약 등 언급
   - 300-500자 내외
   - **⚠️ 마침표(.)와 쉼표(,) 절대 금지** (줄바꿈이나 물음표로만 문장 구분)
   - **⚠️ 제목과 본문 내용 중복 금지** (제목에서 이미 말한 내용을 본문에서 다시 반복하지 않음)

3. **본문 구조 (권장)**:
   - [1단락] 상황 및 배경 설명 (왜 이 글을 썼는지)
   - [2단락] 구체적 정보 및 고민 (설계서 정보, 고민 포인트)
   - [3단락] 질문 및 마무리 (구체적인 질문이나 조언 요청)

4. **답변 강조 포인트 작성**:
   - 검색 결과와 상품 정보를 바탕으로 이 상품의 강점 3-5개를 추출
   - 예: "보장 범위가 넓고, 보험료 대비 합리적이며, 특약 구성이 탄탄함"
   - 실제 설계사가 고객에게 강조할 만한 포인트 위주로 작성
   - 각 포인트는 10-20자 내외로 간결하게
   - 포인트는 쉼표(,)로 구분하여 한 줄로 작성

**[출력 형식]**
다음 형식으로 출력하세요:

제목:
(제목만 출력)

본문:
(본문만 출력, 단락 사이는 빈 줄로 구분)

답변강조포인트:
(답변 강조 포인트만 출력, 쉼표로 구분하여 한 줄로)`

    console.log('[상품명 기반 질문글 생성] Gemini AI 생성 시작...')
    const result = await model.generateContent(prompt)
    const response = await result.response
    const generatedText = response.text()

    console.log('[상품명 기반 질문글 생성] Gemini AI 생성 완료')

    // 3단계: 생성된 텍스트에서 제목, 본문, 답변 강조 포인트 분리
    const titleMatch = generatedText.match(/제목:\s*([^\n]+)/i)
    const bodyMatch = generatedText.match(/본문:\s*([\s\S]*?)(?=\n\n답변강조포인트:|$)/i)
    const sellingPointMatch = generatedText.match(/답변강조포인트:\s*([^\n]+)/i)

    let title = titleMatch?.[1]?.trim() || `${productName} 가입 고민 있어요`
    let body = bodyMatch?.[1]?.trim() || generatedText.split('\n').slice(2).join('\n').trim()
    let sellingPoint = sellingPointMatch?.[1]?.trim() || ''

    // 본문에서 "본문:" 제거
    body = body.replace(/^본문:\s*/i, '').trim()

    // 제목에서 "제목:" 제거
    title = title.replace(/^제목:\s*/i, '').trim()

    // 답변 강조 포인트에서 "답변강조포인트:" 제거
    sellingPoint = sellingPoint.replace(/^답변강조포인트:\s*/i, '').trim()

    // 본문이 너무 짧으면 기본 템플릿 사용
    if (body.length < 50) {
      body = `안녕하세요 ${productName}에 대해 알아보고 있는데요
설계서를 받아봤는데 몇 가지 궁금한 점이 있어서요
보험료나 보장내용에 대해 더 자세히 알고 싶어서 문의드립니다
알려주시면 감사하겠습니다`
    }

    // 답변 강조 포인트가 없으면 기본값 생성
    if (!sellingPoint || sellingPoint.length < 10) {
      sellingPoint = `보장 범위가 넓고, 보험료 대비 합리적이며, 특약 구성이 탄탄함, 전문가 추천 상품`
    }

    console.log('[상품명 기반 질문글 생성] 완료:', { 
      titleLength: title.length, 
      bodyLength: body.length,
      sellingPointLength: sellingPoint.length 
    })

    return NextResponse.json({
      success: true,
      question: {
        title,
        content: body
      },
      sellingPoint: sellingPoint, // 답변 강조 포인트
      designSheetImage: designSheetImageBase64, // 설계서 이미지 (base64)
      designSheetImageUrl: designSheetImageUrl, // 설계서 이미지 원본 URL (다운로드용)
      designSheetImageTitle: designSheetImageTitle // 설계서 이미지 제목 (다운로드용)
    })
  } catch (error: any) {
    console.error('[상품명 기반 질문글 생성] 오류:', error)
    return NextResponse.json(
      { 
        error: '질문글 생성 중 오류가 발생했습니다',
        message: error.message 
      },
      { status: 500 }
    )
  }
}
