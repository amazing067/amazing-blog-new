/**
 * 상품명 → 고객 검색형 주제 구조화 유틸
 * analyze-design-sheet와 generate-qa 모두에서 사용
 */

export interface TopicStructure {
  topicName: string
  displayProductName: string
  /** 답변/설계사 댓글 전용 노출명: 회사명 + 원본 코드/괄호 모두 제거된 짧은 상품 코어 */
  agentSafeName: string
  /** 답변/설계사 댓글 sanitize용 차단 키워드 (회사명 + 원본 상품명 변형) */
  agentBlockedTerms: string[]
  companyShort: string
  cleanProductCore: string
  topicConcern: string
  topicConcernSearch: string
}

export const COMPANY_MAP: Array<{ pattern: RegExp; short: string }> = [
  { pattern: /라이나생명보험주식회사|라이나생명보험\(주\)|라이나생명보험/, short: '라이나생명' },
  { pattern: /삼성생명보험\(주\)|삼성생명보험/, short: '삼성생명' },
  { pattern: /삼성화재해상보험\(주\)|삼성화재/, short: '삼성화재' },
  { pattern: /한화생명보험\(주\)|한화생명보험/, short: '한화생명' },
  { pattern: /한화손해보험\(주\)|한화손해보험/, short: '한화손보' },
  { pattern: /교보생명보험\(주\)|교보생명보험/, short: '교보생명' },
  { pattern: /현대해상화재보험\(주\)|현대해상보험\(주\)|현대해상/, short: '현대해상' },
  { pattern: /DB손해보험\(주\)|DB손해보험/, short: 'DB손보' },
  { pattern: /DB생명보험\(주\)|DB생명/, short: 'DB생명' },
  { pattern: /메리츠화재해상보험\(주\)|메리츠화재|메리츠손해보험/, short: '메리츠' },
  { pattern: /흥국화재해상보험\(주\)|흥국화재/, short: '흥국화재' },
  { pattern: /KB손해보험\(주\)|KB손해보험/, short: 'KB손보' },
  { pattern: /KB라이프보험\(주\)|KB라이프생명\(주\)|KB라이프/, short: 'KB라이프' },
  { pattern: /하나손해보험\(주\)|하나손해보험|하나퍼스트/, short: '하나손보' },
  { pattern: /하나생명보험\(주\)|하나생명보험|하나생명/, short: '하나생명' },
  { pattern: /동양생명보험\(주\)|동양생명보험|동양생명/, short: '동양생명' },
  { pattern: /신한라이프생명보험\(주\)|신한라이프/, short: '신한라이프' },
  { pattern: /NH농협생명보험\(주\)|NH농협생명/, short: 'NH농협' },
  { pattern: /AIG손해보험\(주\)|AIG손해보험/, short: 'AIG손보' },
  { pattern: /푸본현대생명보험\(주\)|푸본현대생명/, short: '푸본현대' },
  { pattern: /처브라이프생명보험\(주\)|처브라이프/, short: '처브라이프' },
  { pattern: /미래에셋생명보험\(주\)|미래에셋생명보험|미래에셋생명|미래에셋/, short: '미래에셋' },
  { pattern: /교보라이프플래닛생명보험\(주\)|교보라이프플래닛/, short: '교보라플' },
  { pattern: /라이나손해보험\(주\)/, short: '라이나손보' },
  { pattern: /동부화재해상보험\(주\)|동부화재/, short: '동부화재' },
  { pattern: /MG손해보험\(주\)|MG손해보험/, short: 'MG손보' },
  { pattern: /AXA손해보험\(주\)|AXA손해보험/, short: 'AXA손보' },
  { pattern: /AIA생명보험\(주\)|AIA생명/, short: 'AIA생명' },
]

// 답변/agent 측 노출 가능한 일반 보험 카테고리 (브랜드명 제거 후 사용)
const GENERIC_CATEGORIES = [
  '간편종합보험', '간편건강보험', '간편보험',
  '통합건강보험', '건강보험',
  '암보험', '치아보험', '치매보험', '간병보험',
  '종합보험', '실비보험', '실손의료비보험', '실손보험',
  '저축보험', '연금보험', '종신보험', '정기보험',
  '운전자보험', '여행자보험',
  '어린이보험', '태아보험', '자녀보험',
] as const

/** 답변/agent용 안전한 노출명 생성: 회사명·브랜드 제거, 일반 카테고리만 남김 */
const buildAgentSafeName = (rawProductName: string, cleanCore: string): string => {
  const haystack = (rawProductName + ' ' + cleanCore).replace(/\s+/g, ' ')
  for (const cat of GENERIC_CATEGORIES) {
    if (haystack.includes(cat)) return `이 ${cat}`
  }
  return '이 상품'
}

export const convertToCustomerTopicName = (rawProductName: string): TopicStructure => {
  if (!rawProductName) return { topicName: '', displayProductName: '', agentSafeName: '', agentBlockedTerms: [], companyShort: '', cleanProductCore: '', topicConcern: '', topicConcernSearch: '' }

  let name = rawProductName.trim()

  // 1. 보험사명 추출 & 축약
  let companyShort = ''
  for (const { pattern, short } of COMPANY_MAP) {
    if (pattern.test(name)) {
      companyShort = short
      name = name.replace(pattern, '').trim()
      break
    }
  }
  name = name.replace(/\(주\)/g, '').replace(/주식회사/g, '')

  // 2. '무배당' 제거
  name = name.replace(/무배당/g, '')

  // ── display 단계 ──
  // 정책 변경: 괄호 내부의 구조어("해약환급금 미지급형", "납입면제" 등)는 절대 displayProductName에 포함하지 않는다.
  // 이유: LLM이 본문 첫 언급에 displayName을 그대로 사용 → "해약환급금 미지급형" 같은 표기가
  //       카페 글에 노출되거나, LLM이 자연어로 풀어쓰면서 "중간에 해지하면 돌려받는 돈이 거의 없는"
  //       같은 절대 금지 표현이 자동 생성되는 문제(테스트 12회 중 6회 발생) 차단.
  // 구조 정보는 topicConcern/topicConcernSearch로 별도 채널에 분리되어 있으므로 displayProductName은
  //   "회사명 + 깔끔한 상품 코어"만 유지하면 충분.
  let displayCore = name
  // 1) 괄호 전체 제거 (코드, 구조어, 로마숫자, 코어 코드 모두 한 번에)
  displayCore = displayCore.replace(/\([^)]*\)/g, '')
  // 2) 점 포함된 숫자 시퀀스 제거 (3.10.5, 26.01 등 — "3105"나 ".5"로 깨지지 않게 통째)
  displayCore = displayCore.replace(/\b\d+(?:\.\d+)+\b/g, '')
  // 3) 로마숫자 단독 등장 시 제거
  displayCore = displayCore.replace(/\s+(I{2,3}|IV|VI{0,3})(?=[\s,.]|[가-힣]|$)/g, '')
  displayCore = displayCore.replace(/\s+(Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ)(?=[\s,.]|[가-힣]|$)/g, '')
  // 4) 코드성 토큰 (5N5, 3N5, 1종, 2종 등)
  displayCore = displayCore.replace(/\s*\d+N\d+/gi, '')
  displayCore = displayCore.replace(/\s*\d+종(?=[\s,.]|[가-힣]|$)/g, '')
  // 5) 부자연 토큰 정리: 언더스코어, 콤마, 다중 공백
  displayCore = displayCore.replace(/[_]+/g, ' ')
  displayCore = displayCore.replace(/[,，]/g, ' ')
  displayCore = displayCore.replace(/\s+/g, ' ').trim()

  const displayProductName = companyShort && companyShort.length <= 6
    ? `${companyShort} ${displayCore}`.trim()
    : displayCore

  // ── topic 단계 ──
  let topicCore = name
  topicCore = topicCore.replace(/\([^)]*\)/g, '')
  topicCore = topicCore.replace(/\s*(I{1,3}|IV|V|VI{0,3})\s*$/g, '')
  topicCore = topicCore.replace(/\s*(Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ)\s*$/g, '')
  topicCore = topicCore.replace(/(I{1,3}|IV|V|VI{0,3})$/g, '')
  // 점 포함된 숫자 시퀀스 통째 제거 (3.10.5 → "" / 이전엔 "3.10"만 매치되어 ".5"가 남던 버그 수정)
  topicCore = topicCore.replace(/\b\d+(?:\.\d+)+\b/g, '')
  topicCore = topicCore.replace(/\s*\d+종(?:\s|$)/g, ' ')
  topicCore = topicCore.replace(/\s*\d+N\d+(?:\s|$)/gi, ' ')
  // 부자연 토큰 정리
  topicCore = topicCore.replace(/[_]+/g, ' ')
  topicCore = topicCore.replace(/[,，]/g, ' ')
  topicCore = topicCore.replace(/\s+/g, ' ').trim()

  const cleanProductCore = topicCore
  const topicName = companyShort && companyShort.length <= 6
    ? `${companyShort} ${cleanProductCore}`.trim()
    : cleanProductCore

  // ── topicConcern 2층: raw(내부 구조어) + search(고객 생활형 검색어) ──
  const CONCERN_PATTERNS: Array<{ test: RegExp; concern: string; search: string; extract?: RegExp }> = [
    { test: /해약환급금미지급형|해약환급금|무해약/, concern: '환급구조', search: '환급금 없는 보험' },
    { test: /간편심사/, concern: '간편심사', search: '병력 있어도 가입 가능한 보험' },
    { test: /유병자/, concern: '유병자', search: '아파도 들 수 있는 보험' },
    { test: /고지의무/, concern: '고지의무', search: '병원 기록 있으면 보험 가입' },
    { test: /납입면제/, concern: '납입면제', search: '보험료 납입면제 조건' },
    { test: /특정\d대질병제외/, concern: '', search: '일부 질병 빠지는 보험', extract: /특정\d대질병제외/ },
    { test: /질병제외/, concern: '질병제외', search: '질병제외형 보험 장단점' },
    { test: /비갱신/, concern: '비갱신형', search: '보험료 안 오르는 보험' },
    { test: /갱신형|갱신/, concern: '갱신형', search: '갱신되면 보험료 얼마나 오르나' },
    { test: /만기환급/, concern: '만기환급형', search: '만기에 돈 돌려받는 보험' },
    { test: /순수보장/, concern: '순수보장형', search: '보험료 싼 대신 환급 없는 보험' },
    { test: /감액/, concern: '감액형', search: '감액형 보험 보험료' },
    { test: /고액암/, concern: '고액암', search: '고액암 진단비 얼마' },
    { test: /3대질병|3대진단/, concern: '3대질병', search: '암 뇌 심장 보험 보장' },
  ]
  let topicConcern = ''
  let topicConcernSearch = ''
  // 검사 대상: 정규화 전 원본 name (괄호 안 구조어 포함). displayCore는 깔끔하게 만들어졌으므로 더 이상 구조어 검출 못 함.
  for (const p of CONCERN_PATTERNS) {
    if (p.test.test(name)) {
      topicConcern = p.extract ? (name.match(p.extract)?.[0] || p.concern) : p.concern
      topicConcernSearch = p.search
      break
    }
  }

  // ── 답변/설계사 댓글 전용: 회사명 + 브랜드명 모두 제거, 일반 카테고리만 남김 ──
  // 정책: 질문(고객) 측은 회사명/원본 상품명 노출 OK, 답변(설계사/agent) 측은 금지
  // 답변은 "이 건강보험은~", "이 간편종합보험은~" 같이 일반 카테고리로만 지칭
  const agentSafeName = buildAgentSafeName(rawProductName, cleanProductCore)

  // sanitize용 차단 키워드: 답변/agent 메시지에서 발견 시 agentSafeName으로 치환
  const agentBlockedTerms: string[] = []
  // 1) companyShort
  if (companyShort) agentBlockedTerms.push(companyShort)
  // 2) COMPANY_MAP에서 매칭된 모든 풀네임/변형
  for (const { pattern, short } of COMPANY_MAP) {
    if (pattern.test(rawProductName)) {
      const variants = pattern.source.split('|').map(s => s.replace(/\\\(/g, '(').replace(/\\\)/g, ')'))
      for (const v of variants) {
        if (v && !agentBlockedTerms.includes(v)) agentBlockedTerms.push(v)
      }
      if (short && !agentBlockedTerms.includes(short)) agentBlockedTerms.push(short)
      break
    }
  }
  // 3) topicName / displayProductName / cleanProductCore — 회사+브랜드 결합형
  for (const v of [topicName, displayProductName, cleanProductCore]) {
    if (v && v !== agentSafeName && !agentBlockedTerms.includes(v)) agentBlockedTerms.push(v)
  }
  // 4) 원본 productName 자체 (전체 통째)
  if (rawProductName && !agentBlockedTerms.includes(rawProductName)) {
    agentBlockedTerms.push(rawProductName)
  }
  // 5) 브랜드 토큰 (cleanProductCore에서 일반 카테고리 단어 제거하면 브랜드만 남음)
  let brandTokens = cleanProductCore || ''
  for (const cat of GENERIC_CATEGORIES) brandTokens = brandTokens.replace(cat, ' ')
  brandTokens = brandTokens.replace(/\s+/g, ' ').trim()

  // 흔한 한국어 형용사·일반어는 brand로 차단하면 답변 자연어 손상 → 제외
  // 영어 단독 3자 이하도 다른 단어와 충돌 가능 → 제외
  const BRAND_STOPWORDS = new Set([
    '든든한', '안전한', '편안한', '꼼꼼한', '확실한', '간편한', '튼튼한', '스마트한',
    '굿', '베스트', '플러스', '프리미엄', '스페셜', '뉴', '슈퍼', '메가', '울트라',
    'ONE', 'TWO', 'PLUS', 'NEW', 'PRO', 'MAX', 'V1', 'V2',
  ])
  if (brandTokens) {
    for (const tok of brandTokens.split(/\s+/)) {
      // 한글 2자 이하 제외, 한글 stopword 제외
      if (BRAND_STOPWORDS.has(tok)) continue
      // 영어/숫자 토큰: 4자 이상만 차단 (3자 이하는 너무 흔함)
      const isAlphaOnly = /^[A-Za-z0-9-]+$/.test(tok)
      if (isAlphaOnly && tok.length < 4) continue
      // 한글 토큰: 3자 이상만 (2자는 일반 명사일 가능성 높음)
      const hasKorean = /[가-힣]/.test(tok)
      if (hasKorean && tok.length < 3) continue
      if (!agentBlockedTerms.includes(tok)) agentBlockedTerms.push(tok)
    }
    // 브랜드 토막 통째 (2개 이상의 토큰 결합형)도 추가 (예: "흥Good 든든한", "M-케어 건강")
    // 단, 단일 토큰이면서 stopword 였다면 추가 안 함
    const composite = brandTokens.trim()
    if (composite && composite.includes(' ') && !agentBlockedTerms.includes(composite)) {
      agentBlockedTerms.push(composite)
    }
  }
  // 6) 괄호 안 + 점 시퀀스 (3.10.5)
  const parens = rawProductName.match(/\([^)]+\)/g) || []
  for (const p of parens) {
    const inner = p.slice(1, -1).trim()
    if (inner && !agentBlockedTerms.includes(inner)) agentBlockedTerms.push(inner)
  }
  const dotSeqs = rawProductName.match(/\b\d+(?:\.\d+)+\b/g) || []
  for (const d of dotSeqs) {
    if (!agentBlockedTerms.includes(d)) agentBlockedTerms.push(d)
  }
  // 길이 내림차순 정렬 (긴 패턴부터 매칭하여 부분 매치 방지)
  agentBlockedTerms.sort((a, b) => b.length - a.length)

  return { topicName, displayProductName, agentSafeName, agentBlockedTerms, companyShort, cleanProductCore, topicConcern, topicConcernSearch }
}

/**
 * targetPersona에서 검색/제목용 personaBucket 추출 (연령대+성별만)
 */
export const extractPersonaBucket = (targetPersona: string): string => {
  if (!targetPersona) return ''
  const norm = targetPersona.replace(/\s+/g, ' ').trim()
    .replace(/(\d{1,2})세/g, (_: string, n: string) => `${Math.floor(parseInt(n, 10) / 10) * 10}대`)
  const ageGender = norm.match(/(\d+대)\s*(남성|여성|남자|여자|남|여)/)
  return ageGender ? `${ageGender[1]} ${ageGender[2]}` : ''
}
