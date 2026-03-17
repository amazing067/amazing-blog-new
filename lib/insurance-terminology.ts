/**
 * 보험 내부 용어 → 생활형 번역 사전
 * 설계서/약관에 나오는 전문 표기를 카페 게시글에 맞는 자연어로 변환
 */

export interface TermEntry {
  internal: string
  natural: string
  context?: string
}

// 설계서/상품 내부 구조어: 고객 노출 키워드에서 반드시 제거되어야 하는 표현들
export const INTERNAL_PRODUCT_TERMS: (string | RegExp)[] = [
  '해약환급금미지급형',
  '무해약',
  '세만기형',
  '20년납',
  '10년납',
  '2종',
  '1종',
  '5N5',
  'I',
  'II',
  'III',
  'Ⅰ',
  'Ⅱ',
  'Ⅲ',
  /\(\d{3,4}\)/, // (4165), (2601) 등 내부 코드
]

export type ProductGroup = 'cancer' | 'silsan' | 'simple' | 'jongsin' | 'driver' | 'health' | 'other'

// 상품군별 시장 대표 키워드 (검색량과 무관하게 고정 유지)
export const MARKET_HEAD_BY_GROUP: Record<ProductGroup, string> = {
  health: '건강보험',
  cancer: '암보험',
  silsan: '실손보험',
  simple: '간편보험',
  driver: '운전자보험',
  jongsin: '종신보험',
  other: '보험',
}

// 고객 판단 갈등 축(고객 고민 패밀리)
export const CUSTOMER_CONCERN_FAMILIES = {
  keepability_risk: [
    '지금 보험료는 괜찮은데 오래 유지할 수 있을지 걱정',
    '중간에 해지하게 되면 손해가 클까 고민',
    '끝까지 유지하지 못했을 때 낭비가 되는지 걱정',
  ],
  price_vs_structure: [
    '보험료가 구조에 비해 비싼 건 아닌지 고민',
    '조금 더 내고 구조를 단순하게 가는 게 나을지 헷갈림',
    '보험료를 아끼다 보니 보장 구조가 너무 공격적인지 걱정',
  ],
  coverage_balance: [
    '내 상황에 비해 보장이 과한지 혹은 부족한지 애매함',
    '암·입원·수술 보장 비율이 적당한지 고민',
    '실제 쓰게 될 보장에 맞춰져 있는지 헷갈림',
  ],
  age_fit: [
    '지금 나이에서 이 구조로 들어가는 게 맞는지 고민',
    '나중 연령대까지 고려하면 지금 가입이 유리한지 헷갈림',
    '언제까지 이 보험을 끌고 가는 게 좋을지 고민',
  ],
  switch_timing: [
    '지금 갈아타야 할지, 조금 더 기다렸다가 바꿀지 고민',
    '기존 보험을 유지하면서 추가로 들어가는 게 맞는지 헷갈림',
    '갈아타면 손해보는 부분이 없는지 걱정',
  ],
  judgment_confusion: [
    '설계서가 복잡해서 어디를 봐야 할지 모르겠음',
    '설계사가 좋다고 한 부분이 내 기준에도 좋은 건지 헷갈림',
    '이게 나한테 유리한 구조인지 스스로 판단이 잘 안 됨',
  ],
} as const

export type CustomerConcernFamilyKey = keyof typeof CUSTOMER_CONCERN_FAMILIES

export interface TranslateConcernOptions {
  internalConcern?: string | null
  productGroup?: ProductGroup
  targetPersona?: string
  coverages?: string[]
  evidenceMapQuestionFacts?: string[]
}

export interface CustomerConcernResult {
  internalConcern: string | null
  customerConcernCandidates: string[]
}

export const INSURANCE_TERM_DICTIONARY: TermEntry[] = [
  // ── 환급금/해지 관련 ──
  { internal: '해약환급금미지급형', natural: '환급금 없는 구조', context: '중도해지 시 환급금이 없어 보험료가 저렴한 타입' },
  { internal: '해약환급금미지급형 II', natural: '환급금 없는 구조', context: '중도해지 환급금 없음 (2세대)' },
  { internal: '저해지환급금형', natural: '해지하면 돌려받는 돈이 적은 구조' },
  { internal: '표준형', natural: '일반 환급 구조' },
  { internal: '세만기형', natural: '세만기형 (보험 기간이 세 번으로 나뉘는 구조)' },

  // ── 납입/면제 관련 ──
  { internal: '보험료납입면제', natural: '특정 조건에서 보험료 면제' },
  { internal: '보험료납입면제대상', natural: '보험료 면제 대상 조건' },
  { internal: '보험료납입면제대상Ⅱ', natural: '특정 질병 시 보험료 면제' },
  { internal: '납입기간', natural: '보험료 내는 기간' },

  // ── 보장/담보 관련 ──
  { internal: '일반상해사망', natural: '사고로 사망 시 보장' },
  { internal: '암사망', natural: '암으로 사망 시 보장' },
  { internal: '종합병원하이클래스암주요치료비', natural: '종합병원 암 주요 치료비 보장' },
  { internal: '항암방사선치료비', natural: '항암 방사선 치료비 보장' },
  { internal: '항암약물치료비', natural: '항암 약물 치료비 보장' },
  { internal: '암진단비', natural: '암 진단 시 일시금 보장' },
  { internal: '유사암진단비', natural: '유사암(경계성종양 등) 진단 시 보장' },
  { internal: '일반암진단비', natural: '일반 암 진단 시 보장' },
  { internal: '특정암진단비', natural: '특정 암(고액암 등) 진단 시 보장' },
  { internal: '뇌혈관질환진단비', natural: '뇌혈관 질환 진단 시 보장' },
  { internal: '허혈성심장질환진단비', natural: '심장 질환 진단 시 보장' },
  { internal: '골절진단비', natural: '골절 시 보장' },
  { internal: '상해입원일당', natural: '사고로 입원 시 일당 보장' },
  { internal: '질병입원일당', natural: '질병으로 입원 시 일당 보장' },
  { internal: '수술비', natural: '수술 시 보장' },
  { internal: '통원치료비', natural: '통원 치료 시 보장' },
  { internal: '실손의료비', natural: '실비 보장 (실제 치료비 보상)' },

  // ── 상품 구조 관련 ──
  { internal: '무배당', natural: '' },
  { internal: '갱신형', natural: '갱신되는 (일정 기간마다 보험료가 바뀌는)' },
  { internal: '비갱신형', natural: '비갱신 (보험료가 변하지 않는)' },
  { internal: '간편심사', natural: '간편 심사 (건강 조건이 까다롭지 않은)' },
  { internal: '간편가입', natural: '간편 가입 (가입 조건이 쉬운)' },
  { internal: '체증형', natural: '보장이 해마다 늘어나는' },
  { internal: '정액형', natural: '보장 금액이 고정된' },
  { internal: '면책기간', natural: '보장이 시작되기 전 대기 기간' },
  { internal: '감액기간', natural: '보장 금액이 줄어드는 초기 기간' },

  // ── 삭제 대상 (자연어에서 빠져야 할 내부 표기) ──
  { internal: '(주)', natural: '' },
  { internal: 'I', natural: '' },
  { internal: 'II', natural: '' },
  { internal: 'III', natural: '' },
  { internal: 'Ⅰ', natural: '' },
  { internal: 'Ⅱ', natural: '' },
  { internal: 'Ⅲ', natural: '' },
]

/**
 * 내부 표기 패턴 → 생활형 번역
 * 정확한 일치가 아닌 부분 일치도 처리
 */
export function translateToNatural(internalTerm: string): string {
  const normalized = internalTerm.replace(/\s+/g, '').trim()

  for (const entry of INSURANCE_TERM_DICTIONARY) {
    if (entry.natural === '') continue
    const entryNorm = entry.internal.replace(/\s+/g, '')
    if (normalized.includes(entryNorm) || entryNorm.includes(normalized)) {
      return entry.natural
    }
  }

  return internalTerm
}

/**
 * 텍스트에서 내부 표기를 제거하거나 번역
 */
export function cleanInternalTerms(text: string): string {
  let result = text

  for (const entry of INSURANCE_TERM_DICTIONARY) {
    if (entry.natural === '') {
      // 삭제 대상: 의미 없는 접미사 제거
      const pattern = new RegExp(`\\s*${escapeRegex(entry.internal)}(?=[\\s,.]|[가-힣]|$)`, 'g')
      result = result.replace(pattern, '')
    }
  }

  return result.replace(/\s{2,}/g, ' ').trim()
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 내부 상품 구조어 여부 판별
export function isInternalProductTerm(keyword: string | null | undefined): boolean {
  if (!keyword) return false
  const text = keyword.replace(/\s+/g, '').trim()
  if (!text) return false
  for (const term of INTERNAL_PRODUCT_TERMS) {
    if (typeof term === 'string') {
      if (text.includes(term.replace(/\s+/g, ''))) return true
    } else {
      if (term.test(text)) return true
    }
  }
  return false
}

// 고객 노출용 키워드 정제: 내부어/괄호/종류 코드 제거 후 자연어만 남김
export function sanitizeCustomerFacingKeyword(keyword: string | null | undefined): string | null {
  if (!keyword) return null
  let k = keyword

  // 괄호 코드 제거
  k = k.replace(/\(\d{3,4}\)/g, '')

  // 5N5, 3N4 등 내부 코드 제거
  k = k.replace(/\b\d+N\d+\b/g, '')

  // 1종, 2종 등 제거
  k = k.replace(/\d+종(?=\s|$)/g, '')

  // 로마 숫자/한글 로마 숫자 제거
  k = k.replace(/\s+(I{1,3}|Ⅴ|Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ)(?=[\s,.\)]|[가-힣]|$)/g, '')

  // 명시된 내부어 문자열 제거
  for (const term of INTERNAL_PRODUCT_TERMS) {
    if (typeof term === 'string' && term.length > 0) {
      const pattern = new RegExp(escapeRegex(term), 'g')
      k = k.replace(pattern, '')
    }
  }

  // 괄호만 남은 조각 제거
  k = k.replace(/[()]/g, '')

  // 공백 정리
  k = k.replace(/\s{2,}/g, ' ').trim()

  if (!k) return null
  return k
}

// 설계서 모드에서 고객에게 노출하기 전에, 해약환급금/환급 관련 표현을 생활어로 치환
export function scrubNoRefundStructureTerm(text: string): string {
  if (!text) return text
  let result = text

  result = result.replace(/해약\s*환급금\s*미지급형/gi, '중간에 해지하면 돌려받는 돈이 거의 없는 상품 구조')
  result = result.replace(/환급금\s*미지급형/gi, '중간에 해지하면 돌려받는 돈이 거의 없는 상품 구조')
  result = result.replace(/해약\s*환급금/gi, '중간에 해지하면 돌려받는 돈')
  result = result.replace(/환급금/gi, '돌려받는 돈')
  result = result.replace(/환급/gi, '돌려받는 돈')

  return result
}

/**
 * concern 동의어 사전: 같은 의미를 다양한 생활형 표현으로 변주
 * 제목에는 원본 concern/search concern 우선, 본문/답변/댓글에서 variant 사용
 */
export const CONCERN_SYNONYM_MAP: Record<string, string[]> = {
  '해약환급금미지급형': [
    '중간에 해지하면 돌려받는 돈이 없는 구조',
    '중간에 해지하면 돌려받는 돈이 없는 형태',
    '끝까지 유지해야 의미가 있는 구조',
    '중도해지 부담이 큰 상품 구조',
    '보험료는 낮지만 중간에 해지하면 손해가 큰 형태',
    '유지 자신 있을 때 유리한 구조',
  ],
  '갱신형': [
    '나중에 보험료가 올라갈 수 있는 구조',
    '처음엔 싸지만 갱신할 때마다 비싸지는 형태',
    '갱신 시기마다 보험료 부담이 달라지는 구조',
  ],
  '간편심사': [
    '병력이 있어도 가입이 쉬운 구조',
    '심사가 간단한 대신 보험료가 좀 비싼 형태',
    '건강 조건이 까다롭지 않은 구조',
  ],
  '납입면제': [
    '아플 때 보험료를 안 내도 되는 조건',
    '면제 조건이 붙어 있는 구조',
    '특정 상황에서 보험료 납입이 면제되는 형태',
  ],
  '세만기형': [
    '보험 기간이 나뉘어져 있는 구조',
    '단계별로 보장 내용이 달라지는 형태',
  ],
}

export function pickConcernVariant(concern: string): string {
  const norm = concern.replace(/\s+/g, '')
  for (const [key, variants] of Object.entries(CONCERN_SYNONYM_MAP)) {
    if (norm.includes(key) || key.includes(norm)) {
      return variants[Math.floor(Math.random() * variants.length)]
    }
  }
  return concern
}

/**
 * concern 키워드를 갈등 축(conflict axis)으로 변환
 * 단순 키워드가 아니라 "A이면 장점 / B이면 단점" 구조로 만듦
 */
export function buildConflictAxis(concern: string, concernSearch: string): {
  keyword: string
  keywordNatural: string
  proCondition: string
  conCondition: string
  summary: string
} | null {
  const axes: Record<string, { pro: string; con: string; summary: string }> = {
    '해약환급금미지급형': {
      pro: '끝까지 유지할 자신이 있으면 보험료가 저렴해서 유리',
      con: '중도해지 가능성이 있으면 낸 돈을 하나도 못 돌려받아 부담',
      summary: '유지 가능성이 판단의 핵심',
    },
    '갱신형': {
      pro: '초기 보험료가 저렴하고 필요할 때 갱신 가능',
      con: '갱신 시 보험료가 올라갈 수 있어 장기적으로 부담',
      summary: '장기 유지 비용이 판단의 핵심',
    },
    '간편심사': {
      pro: '건강 조건이 까다롭지 않아 가입이 쉬움',
      con: '일반 심사 상품보다 보험료가 비싸거나 보장이 제한적일 수 있음',
      summary: '가입 편의와 보장 범위 사이의 균형이 핵심',
    },
    '납입면제': {
      pro: '특정 질병 발생 시 보험료를 안 내도 보장이 유지됨',
      con: '면제 조건이 까다로우면 실제로 적용받기 어려울 수 있음',
      summary: '면제 조건의 구체적 범위가 판단의 핵심',
    },
    '세만기형': {
      pro: '보험 기간을 단계별로 나눠 관리할 수 있음',
      con: '구조가 복잡하고 중간에 보장 내용이 바뀔 수 있음',
      summary: '구조의 복잡도와 실제 보장 연속성이 핵심',
    },
  }

  const concernNorm = concern.replace(/\s+/g, '')
  for (const [key, axis] of Object.entries(axes)) {
    if (concernNorm.includes(key) || key.includes(concernNorm)) {
      return {
        keyword: concern,
        keywordNatural: concernSearch || translateToNatural(concern),
        proCondition: axis.pro,
        conCondition: axis.con,
        summary: axis.summary,
      }
    }
  }

  // 매칭되지 않는 경우 일반적인 구조
  if (concern) {
    return {
      keyword: concern,
      keywordNatural: concernSearch || concern,
      proCondition: `${concernSearch || concern}이 본인 상황에 맞으면 유리`,
      conCondition: `${concernSearch || concern}이 본인 상황에 안 맞으면 부담`,
      summary: '본인 상황과의 적합성이 판단의 핵심',
    }
  }

  return null
}

/**
 * 보장 항목을 자연어로 요약하여 evidence 생성
 */
export function buildCoverageEvidence(coverages: string[]): string[] {
  if (!coverages || coverages.length === 0) return []

  const evidence: string[] = []
  const categories: Record<string, string[]> = {}

  for (const cov of coverages) {
    if (/암|항암|종양/.test(cov)) {
      if (!categories['암치료']) categories['암치료'] = []
      categories['암치료'].push(cov)
    } else if (/사망/.test(cov)) {
      if (!categories['사망']) categories['사망'] = []
      categories['사망'].push(cov)
    } else if (/입원/.test(cov)) {
      if (!categories['입원']) categories['입원'] = []
      categories['입원'].push(cov)
    } else if (/수술/.test(cov)) {
      if (!categories['수술']) categories['수술'] = []
      categories['수술'].push(cov)
    } else if (/납입면제|보험료면제/.test(cov)) {
      if (!categories['납입면제']) categories['납입면제'] = []
      categories['납입면제'].push(cov)
    } else {
      if (!categories['기타']) categories['기타'] = []
      categories['기타'].push(cov)
    }
  }

  if (categories['암치료']) {
    evidence.push(`암 치료 관련 보장 ${categories['암치료'].length}개 (${categories['암치료'].slice(0, 3).map(c => translateToNatural(c)).join(', ')})`)
  }
  if (categories['사망']) {
    evidence.push(`사망 보장 ${categories['사망'].length}개 (${categories['사망'].map(c => translateToNatural(c)).join(', ')})`)
  }
  if (categories['입원']) {
    evidence.push(`입원 보장 ${categories['입원'].length}개`)
  }
  if (categories['수술']) {
    evidence.push(`수술 보장 ${categories['수술'].length}개`)
  }
  if (categories['납입면제']) {
    evidence.push(`납입면제 조건 존재`)
  }
  if (categories['기타'] && categories['기타'].length > 0) {
    evidence.push(`기타 보장 ${categories['기타'].length}개`)
  }

  return evidence
}

export interface ConflictAxisInput {
  concern: string
  concernSearch: string
}

export interface CustomerConcernUpstreamOptions {
  internalConcern?: string | null
  productGroup?: ProductGroup
  targetPersona?: string
  coverages?: string[]
}

export interface CustomerConcernUpstreamResult {
  internalConcern: string | null
  customerConcernCandidates: string[]
}

// 내부 concern → 고객 고민 후보군 생성
export function translateInternalConcernToCustomerCandidates(
  options: CustomerConcernUpstreamOptions
): CustomerConcernUpstreamResult {
  const internalConcern = (options.internalConcern || '').trim()
  const result: string[] = []

  const families: CustomerConcernFamilyKey[] = [
    'keepability_risk',
    'price_vs_structure',
    'coverage_balance',
    'age_fit',
    'switch_timing',
    'judgment_confusion',
  ]

  // 상품군 기반 우선순위
  const pg = options.productGroup || 'other'
  const prioritizedFamilies: CustomerConcernFamilyKey[] = (() => {
    switch (pg) {
      case 'silsan':
        return ['keepability_risk', 'price_vs_structure', 'switch_timing', 'coverage_balance', 'judgment_confusion', 'age_fit']
      case 'cancer':
      case 'health':
        return ['coverage_balance', 'keepability_risk', 'price_vs_structure', 'age_fit', 'switch_timing', 'judgment_confusion']
      case 'simple':
        return ['price_vs_structure', 'keepability_risk', 'judgment_confusion', 'coverage_balance', 'age_fit', 'switch_timing']
      case 'jongsin':
        return ['age_fit', 'keepability_risk', 'switch_timing', 'price_vs_structure', 'coverage_balance', 'judgment_confusion']
      case 'driver':
        return ['price_vs_structure', 'coverage_balance', 'keepability_risk', 'judgment_confusion', 'age_fit', 'switch_timing']
      default:
        return families
    }
  })()

  // 내부 concern 패턴 기반 family 힌트
  const norm = internalConcern.replace(/\s+/g, '')
  const hintedFamilies = new Set<CustomerConcernFamilyKey>()
  if (/해약환급금|무해약/.test(norm)) {
    hintedFamilies.add('keepability_risk')
    hintedFamilies.add('price_vs_structure')
  }
  if (/세만기|만기|종신/.test(norm)) {
    hintedFamilies.add('age_fit')
  }
  if (/갱신|비갱신/.test(norm)) {
    hintedFamilies.add('keepability_risk')
    hintedFamilies.add('switch_timing')
  }

  // coverage 기반 coverage_balance 힌트
  const coveragesText = (options.coverages || []).join(' ')
  if (/암|입원|수술|사망|실손|실비/.test(coveragesText)) {
    hintedFamilies.add('coverage_balance')
  }

  // persona 기반 age_fit 힌트
  if (options.targetPersona && /(\d{2})대/.test(options.targetPersona)) {
    hintedFamilies.add('age_fit')
  }

  const orderedFamilies: CustomerConcernFamilyKey[] = []
  for (const f of prioritizedFamilies) {
    if (hintedFamilies.has(f) && !orderedFamilies.includes(f)) orderedFamilies.push(f)
  }
  for (const f of prioritizedFamilies) {
    if (!orderedFamilies.includes(f)) orderedFamilies.push(f)
  }

  for (const fam of orderedFamilies) {
    const variants = CUSTOMER_CONCERN_FAMILIES[fam]
    for (const v of variants) {
      if (result.length >= 5) break
      if (!result.includes(v)) result.push(v)
    }
    if (result.length >= 5) break
  }

  return {
    internalConcern: internalConcern || null,
    customerConcernCandidates: result,
  }
}

// 최근에 선택된 concern을 피하면서 후보 중 하나 선택
export function pickCustomerConcernCandidate(
  candidates: string[],
  seedOrRecent?: number | string[],
  recentMaybe?: string[]
): string | null {
  if (!candidates || candidates.length === 0) return null
  const unique = Array.from(new Set(candidates.map(c => c.trim()).filter(Boolean)))
  if (unique.length === 0) return null

  let seed: number | undefined
  let recent: string[] | undefined

  // 2-파라미터 사용 패턴 지원:
  // - pickCustomerConcernCandidate(candidates, recent[])
  // 3-파라미터 기존 패턴도 유지:
  // - pickCustomerConcernCandidate(candidates, seed, recent[])
  if (Array.isArray(seedOrRecent)) {
    recent = seedOrRecent
  } else {
    seed = seedOrRecent
    recent = recentMaybe
  }

  const recentSet = new Set((recent || []).map(r => r.trim()).filter(Boolean))
  const filtered = unique.filter(c => !recentSet.has(c))
  const pool = filtered.length > 0 ? filtered : unique

  const base = typeof seed === 'number' && !Number.isNaN(seed) ? seed : Math.random()
  const idx = Math.floor(base * pool.length) % pool.length
  return pool[idx]
}
