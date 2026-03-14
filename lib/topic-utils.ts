/**
 * 상품명 → 고객 검색형 주제 구조화 유틸
 * analyze-design-sheet와 generate-qa 모두에서 사용
 */

export interface TopicStructure {
  topicName: string
  displayProductName: string
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
]

export const convertToCustomerTopicName = (rawProductName: string): TopicStructure => {
  if (!rawProductName) return { topicName: '', displayProductName: '', companyShort: '', cleanProductCore: '', topicConcern: '', topicConcernSearch: '' }

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
  let displayCore = name
  displayCore = displayCore.replace(/\(\s*\d[\d.]*\s*\)/g, '')
  displayCore = displayCore.replace(/\(([^)]*)\)/g, (_match, inner: string) => {
    if (/^\s*[\d.]+\s*$/.test(inner)) return ''
    if (/해약환급금|미지급|무해약|특정\d|질병제외|간편심사|3-2-5/.test(inner)) return ` ${inner.trim()}`
    return ''
  })
  displayCore = displayCore.replace(/\s+(I{2,3}|IV|VI{0,3})(?=[\s,.]|[가-힣]|$)/g, '')
  displayCore = displayCore.replace(/\s+(Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ)(?=[\s,.]|[가-힣]|$)/g, '')
  displayCore = displayCore.replace(/\s*\d+N\d+/gi, '')
  displayCore = displayCore.replace(/\s*\d+종(?=[\s,.]|[가-힣]|$)/g, '')
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
  topicCore = topicCore.replace(/\d+\.\d+/g, '')
  topicCore = topicCore.replace(/\s*\d+종(?:\s|$)/g, ' ')
  topicCore = topicCore.replace(/\s*\d+N\d+(?:\s|$)/gi, ' ')
  topicCore = topicCore.replace(/\s+/g, ' ').trim()

  const cleanProductCore = topicCore
  const topicName = companyShort && companyShort.length <= 6
    ? `${companyShort} ${cleanProductCore}`.trim()
    : cleanProductCore

  // ── topicConcern 2층: raw(내부 구조어) + search(고객 생활형 검색어) ──
  const CONCERN_PATTERNS: Array<{ test: RegExp; concern: string; search: string; extract?: RegExp }> = [
    { test: /해약환급금미지급형|해약환급금/, concern: '해약환급금미지급형', search: '환급금 없는 보험' },
    { test: /무해약/, concern: '무해약환급금', search: '해지해도 돈 못 받는 보험' },
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
  for (const p of CONCERN_PATTERNS) {
    if (p.test.test(displayCore)) {
      topicConcern = p.extract ? (displayCore.match(p.extract)?.[0] || p.concern) : p.concern
      topicConcernSearch = p.search
      break
    }
  }

  return { topicName, displayProductName, companyShort, cleanProductCore, topicConcern, topicConcernSearch }
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
