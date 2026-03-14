/**
 * 보험 상품명 정답 교정 레이어
 *
 * OCR/모델 추출값을 실존 상품명 사전과 대조하여 가장 가까운 정답으로 교정한다.
 * 검색 결과에서 반복 등장하는 상품명이 있으면 그것을 우선 신뢰한다.
 *
 * 파이프라인:
 *   1) 검색 결과 빈도 기반 교정 (가장 강력한 시그널)
 *   2) alias 사전 기반 직접 매핑
 *   3) known product fuzzy matching (편집 거리)
 */

import type { SearchResult } from '@/lib/google-search'

// ─── 보험사 실존 상품 사전 ──────────────────────────
// name: 정답 상품명, aliases: OCR이 잘못 읽을 수 있는 변형들

interface KnownProduct {
  name: string
  aliases: string[]
  company: string
  category: 'health' | 'cancer' | 'silsan' | 'simple' | 'jongsin' | 'driver' | 'dental' | 'other'
}

const KNOWN_PRODUCTS: KnownProduct[] = [
  // 하나손보
  { name: '하나더퍼스트', aliases: ['하나퍼스트', '하나 퍼스트', '하나더 퍼스트', '하나더펏스트', '하나더피스트'], company: '하나손보', category: 'health' },
  { name: '하나원큐다이렉트', aliases: ['하나원큐', '하나 원큐'], company: '하나손보', category: 'other' },

  // 삼성생명
  { name: '삼성 건강보험', aliases: ['삼성건강보험', '삼성 건강 보험'], company: '삼성생명', category: 'health' },
  { name: '뉴인생설계', aliases: ['뉴 인생설계', '뉴인생 설계'], company: '삼성생명', category: 'jongsin' },

  // 삼성화재
  { name: '착한가격보험', aliases: ['착한 가격보험', '착한가격 보험'], company: '삼성화재', category: 'health' },

  // 한화생명
  { name: '건강파트너', aliases: ['건강 파트너'], company: '한화생명', category: 'health' },
  { name: '한화생명 건강보험', aliases: ['한화 건강보험'], company: '한화생명', category: 'health' },

  // 교보생명
  { name: '교보 건강보험', aliases: ['교보건강보험'], company: '교보생명', category: 'health' },
  { name: '플래닛라이프', aliases: ['플래닛 라이프', '플레닛라이프'], company: '교보생명', category: 'health' },

  // 현대해상
  { name: '굿앤굿', aliases: ['굿앤 굿', '굿엔굿', '굿앤꿋'], company: '현대해상', category: 'health' },
  { name: '하이카', aliases: ['하이 카', '하이카자동차'], company: '현대해상', category: 'driver' },

  // DB손보
  { name: '프로미라이프', aliases: ['프로미 라이프', '프로미라이브', '프로미라이트'], company: 'DB손보', category: 'health' },
  { name: '참좋은건강보험', aliases: ['참좋은 건강보험', '참 좋은 건강보험'], company: 'DB손보', category: 'health' },

  // 메리츠
  { name: '메리츠 건강보험', aliases: ['메리츠건강보험'], company: '메리츠', category: 'health' },

  // KB손보
  { name: 'KB 건강보험', aliases: ['KB건강보험', '케이비건강보험'], company: 'KB손보', category: 'health' },
  { name: 'KB 다이렉트', aliases: ['KB다이렉트', '케이비다이렉트'], company: 'KB손보', category: 'other' },

  // 라이나생명
  { name: '라이나 건강보험', aliases: ['라이나건강보험'], company: '라이나생명', category: 'health' },
  { name: 'TheK건강보험', aliases: ['더케이건강보험', 'The K 건강보험', 'TheK 건강보험', '더K건강보험'], company: '라이나생명', category: 'health' },

  // 동양생명
  { name: '수호천사', aliases: ['수호 천사'], company: '동양생명', category: 'health' },

  // 신한라이프
  { name: '신한 건강보험', aliases: ['신한건강보험'], company: '신한라이프', category: 'health' },

  // AIG
  { name: 'AIG 건강보험', aliases: ['AIG건강보험'], company: 'AIG손보', category: 'health' },

  // 흥국화재
  { name: '흥국화재 건강보험', aliases: ['흥국건강보험'], company: '흥국화재', category: 'health' },

  // NH농협
  { name: 'NH 건강보험', aliases: ['NH건강보험', '농협건강보험'], company: 'NH농협', category: 'health' },
]

// ─── 편집 거리 (Levenshtein) ──────────────────────────

function levenshtein(a: string, b: string): number {
  const la = a.length
  const lb = b.length
  if (la === 0) return lb
  if (lb === 0) return la

  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0))
  for (let i = 0; i <= la; i++) dp[i][0] = i
  for (let j = 0; j <= lb; j++) dp[0][j] = j

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[la][lb]
}

// ─── 검색 결과에서 상품명 빈도 추출 ──────────────────────

function extractCandidateNamesFromSearch(
  searchResults: SearchResult[],
  extractedName: string
): Array<{ name: string; count: number; source: 'title' | 'snippet' }> {
  if (!searchResults || searchResults.length === 0) return []

  const extractedNorm = extractedName.replace(/\s+/g, '').toLowerCase()
  const freq = new Map<string, { count: number; source: 'title' | 'snippet' }>()

  for (const r of searchResults) {
    const texts = [
      { text: r.title || '', source: 'title' as const },
      { text: r.snippet || '', source: 'snippet' as const },
    ]

    for (const { text, source } of texts) {
      if (!text) continue

      for (const product of KNOWN_PRODUCTS) {
        const pNorm = product.name.replace(/\s+/g, '').toLowerCase()

        if (text.replace(/\s+/g, '').toLowerCase().includes(pNorm)) {
          const key = product.name
          const existing = freq.get(key)
          if (existing) {
            existing.count++
            if (source === 'title') existing.source = 'title'
          } else {
            freq.set(key, { count: 1, source })
          }
        }
      }

      // 패턴 매칭: "하나더퍼스트 5N5" 같이 알려진 제품명이 텍스트에 있는지
      const koreanProductPattern = /(?:하나더퍼스트|굿앤굿|프로미라이프|플래닛라이프|수호천사|착한가격|TheK|뉴인생설계)/gi
      const matches = text.match(koreanProductPattern)
      if (matches) {
        for (const m of matches) {
          const normalized = m.trim()
          const known = KNOWN_PRODUCTS.find(p =>
            p.name.replace(/\s+/g, '').toLowerCase() === normalized.replace(/\s+/g, '').toLowerCase()
          )
          if (known) {
            const key = known.name
            const existing = freq.get(key)
            if (existing) {
              existing.count++
            } else {
              freq.set(key, { count: 1, source })
            }
          }
        }
      }
    }
  }

  // 추출명과 다른 것만 반환 (교정 후보)
  return Array.from(freq.entries())
    .map(([name, data]) => ({ name, ...data }))
    .filter(item => item.name.replace(/\s+/g, '').toLowerCase() !== extractedNorm)
    .sort((a, b) => b.count - a.count)
}

// ─── 메인 교정 함수 ──────────────────────────────────

export interface CorrectionResult {
  original: string
  corrected: string
  method: 'search_frequency' | 'alias_map' | 'fuzzy_match' | 'none'
  confidence: 'high' | 'medium' | 'low'
  detail: string
}

export function correctProductName(
  extractedName: string,
  searchResults?: SearchResult[]
): CorrectionResult {
  if (!extractedName || extractedName === '보험 상품') {
    return { original: extractedName, corrected: extractedName, method: 'none', confidence: 'low', detail: '추출명 없음' }
  }

  const norm = extractedName.replace(/\s+/g, '').toLowerCase()

  // ── 0단계: 이미 정답 사전에 있으면 그대로 ──
  const exactMatch = KNOWN_PRODUCTS.find(p =>
    p.name.replace(/\s+/g, '').toLowerCase() === norm
  )
  if (exactMatch) {
    return { original: extractedName, corrected: exactMatch.name, method: 'none', confidence: 'high', detail: '이미 정답' }
  }

  // ── 1단계: 검색 결과 빈도 기반 교정 (가장 강력) ──
  if (searchResults && searchResults.length > 0) {
    const candidates = extractCandidateNamesFromSearch(searchResults, extractedName)

    if (candidates.length > 0) {
      const best = candidates[0]

      // 검색 결과에서 2회 이상 등장하고, 추출명과 편집 거리가 가까우면 교정
      const dist = levenshtein(norm, best.name.replace(/\s+/g, '').toLowerCase())
      const maxLen = Math.max(norm.length, best.name.replace(/\s+/g, '').length)
      const similarity = 1 - dist / maxLen

      if (best.count >= 3 && similarity >= 0.4) {
        return {
          original: extractedName,
          corrected: best.name,
          method: 'search_frequency',
          confidence: 'high',
          detail: `검색 ${best.count}회 등장, 유사도 ${(similarity * 100).toFixed(0)}%`
        }
      }

      if (best.count >= 2 && similarity >= 0.5) {
        return {
          original: extractedName,
          corrected: best.name,
          method: 'search_frequency',
          confidence: 'medium',
          detail: `검색 ${best.count}회 등장, 유사도 ${(similarity * 100).toFixed(0)}%`
        }
      }

      if (best.count >= 1 && similarity >= 0.7) {
        return {
          original: extractedName,
          corrected: best.name,
          method: 'search_frequency',
          confidence: 'medium',
          detail: `검색 ${best.count}회 등장, 유사도 ${(similarity * 100).toFixed(0)}%`
        }
      }
    }
  }

  // ── 2단계: alias 사전 직접 매핑 ──
  for (const product of KNOWN_PRODUCTS) {
    for (const alias of product.aliases) {
      if (alias.replace(/\s+/g, '').toLowerCase() === norm) {
        return {
          original: extractedName,
          corrected: product.name,
          method: 'alias_map',
          confidence: 'high',
          detail: `alias "${alias}" → "${product.name}"`
        }
      }
    }
  }

  // ── 3단계: fuzzy matching (편집 거리 기반) ──
  let bestMatch: KnownProduct | null = null
  let bestDist = Infinity
  let bestSimilarity = 0

  for (const product of KNOWN_PRODUCTS) {
    const pNorm = product.name.replace(/\s+/g, '').toLowerCase()
    const dist = levenshtein(norm, pNorm)
    const maxLen = Math.max(norm.length, pNorm.length)
    const similarity = 1 - dist / maxLen

    if (dist < bestDist && similarity >= 0.65) {
      bestDist = dist
      bestMatch = product
      bestSimilarity = similarity
    }
  }

  if (bestMatch && bestSimilarity >= 0.75) {
    return {
      original: extractedName,
      corrected: bestMatch.name,
      method: 'fuzzy_match',
      confidence: bestSimilarity >= 0.85 ? 'high' : 'medium',
      detail: `편집거리 ${bestDist}, 유사도 ${(bestSimilarity * 100).toFixed(0)}%`
    }
  }

  // ── 4단계: 검색 결과 텍스트에서 직접 정규식 탐색 (사전에 없는 상품) ──
  if (searchResults && searchResults.length > 0) {
    const allText = searchResults
      .map(r => `${r.title || ''} ${r.snippet || ''}`)
      .join(' ')

    // 추출명의 핵심 단어 추출 (2글자 이상)
    const coreWords = extractedName.split(/\s+/).filter(w => w.length >= 2)

    for (const word of coreWords) {
      // 추출명 핵심 단어에 1글자가 빠지거나 추가된 패턴 탐색
      // 예: "퍼스트" → "더퍼스트" 패턴
      const extendedPattern = new RegExp(`[가-힣]{1,2}${escapeRegex(word)}|${escapeRegex(word)}[가-힣]{1,2}`, 'g')
      const extMatches = allText.match(extendedPattern)

      if (extMatches) {
        const countMap = new Map<string, number>()
        for (const m of extMatches) {
          const key = m.trim()
          if (key !== word && key.length > word.length) {
            countMap.set(key, (countMap.get(key) || 0) + 1)
          }
        }

        const sorted = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1])
        if (sorted.length > 0 && sorted[0][1] >= 2) {
          const correctedFull = extractedName.replace(word, sorted[0][0])
          return {
            original: extractedName,
            corrected: correctedFull,
            method: 'search_frequency',
            confidence: sorted[0][1] >= 3 ? 'medium' : 'low',
            detail: `검색 패턴 "${word}" → "${sorted[0][0]}" (${sorted[0][1]}회)`
          }
        }
      }
    }
  }

  return { original: extractedName, corrected: extractedName, method: 'none', confidence: 'low', detail: '교정 불필요 또는 매칭 실패' }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── 상품명 통합 교정 (분석 파이프라인용) ──────────────────

export function correctAndLog(
  extractedName: string,
  normalizedName: string,
  searchResults?: SearchResult[]
): { correctedRaw: string; correctedNormalized: string; correction: CorrectionResult } {
  const correction = correctProductName(normalizedName, searchResults)

  if (correction.method !== 'none') {
    console.log(`[상품명 교정] ✅ 교정 적용: "${correction.original}" → "${correction.corrected}" (${correction.method}, ${correction.confidence}, ${correction.detail})`)
  } else {
    console.log(`[상품명 교정] ℹ️ 교정 불필요: "${normalizedName}" (${correction.detail})`)
  }

  const correctedNormalized = correction.corrected
  const correctedRaw = correction.method !== 'none'
    ? extractedName.replace(
        new RegExp(escapeRegex(normalizedName), 'i'),
        correctedNormalized
      ) || correctedNormalized
    : extractedName

  return { correctedRaw, correctedNormalized, correction }
}
