import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { searchGoogle, SearchResult } from '@/lib/google-search'
import { convertToCustomerTopicName, extractPersonaBucket } from '@/lib/topic-utils'
import { correctAndLog } from '@/lib/product-name-correction'
import {
  buildConflictAxis,
  buildCoverageEvidence,
  translateInternalConcernToCustomerCandidates,
  translateToNatural,
  MARKET_HEAD_BY_GROUP,
  ProductGroup,
  sanitizeCustomerFacingKeyword,
  isInternalProductTerm,
} from '@/lib/insurance-terminology'

type KeyCoverageRenewalType = 'renewal' | 'non_renewal' | 'unknown'
type KeyCoverageCategory = 'cancer' | 'brain' | 'heart' | 'surgery' | 'injury' | 'death' | 'disability' | 'other'

export interface KeyCoverage {
  rawName: string
  normalizedName: string
  amount: string
  renewalType: KeyCoverageRenewalType
  category: KeyCoverageCategory
  customerLabel: string
}

type ConcernSource = 'coverage' | 'balance' | 'special' | 'structure_fallback'

interface ConcernCandidate {
  source: ConcernSource
  key: string
  concern: string
  concernSearch: string
  score: number
  reason: string
}

// 고객 노출용 담보명 정규화
function normalizeCoverageNameForCustomer(raw: string): string {
  if (!raw) return ''
  let name = raw

  // 건강고지, 기타 내부 조건 문구 제거
  name = name.replace(/건강고지/g, '')
  name = name.replace(/기타피부암및갑상선암제외/g, '')

  // 괄호 안 설명(만기보장형, 수술1회당 등)은 기본적으로 제거
  name = name.replace(/\([^)]*\)/g, '')

  // 내부 코드/종/로마 숫자/버전 제거
  name = name.replace(/\b\d+N\d+\b/gi, '')       // 5N5 등
  name = name.replace(/\d+종(?=\s|$)/g, '')      // 1종, 2종
  name = name.replace(/[ⅠⅡⅢ]/g, '')
  name = name.replace(/\bI{1,3}\b/g, '')
  name = name.replace(/\(\d{3,5}\)/g, '')

  // 공백 정리
  name = name.replace(/\s+/g, ' ').trim()

  // 너무 긴 내부 표현을 translateToNatural로 한 번 더 축약 시도
  const natural = translateToNatural(name)
  const normalized = natural && natural.trim() !== '' ? natural.trim() : name

  return normalized
}

function inferCoverageCategory(normalizedName: string): KeyCoverageCategory {
  const n = normalizedName
  if (!n) return 'other'
  // 치매/뇌 관련 보장은 brain 축으로 강하게 묶는다
  if (/(치매|알츠하이머|CDR|인지기능|인지장애)/i.test(n)) return 'brain'
  if (/(암|유사암|종양|항암)/.test(n)) return 'cancer'
  if (/(뇌|뇌혈관|뇌졸중)/.test(n)) return 'brain'
  if (/(심장|허혈|급성심근경색)/.test(n)) return 'heart'
  if (/수술/.test(n)) return 'surgery'
  if (/상해/.test(n)) return 'injury'
  if (/사망/.test(n)) return 'death'
  if (/후유장해|장해/.test(n)) return 'disability'
  return 'other'
}

function inferRenewalTypeFromCoverageName(rawOrNormalized: string): KeyCoverageRenewalType {
  const t = (rawOrNormalized || '').replace(/\s+/g, '')
  if (!t) return 'unknown'
  if (/비갱신형|무갱신/.test(t)) return 'non_renewal'
  if (/갱신형|갱신/.test(t)) return 'renewal'
  return 'unknown'
}

function buildKeyCoverages(coverages: string[]): KeyCoverage[] {
  if (!Array.isArray(coverages) || coverages.length === 0) return []

  const seen = new Set<string>()
  const all: KeyCoverage[] = []

  for (const raw of coverages) {
    const normalizedName = normalizeCoverageNameForCustomer(raw)
    const key = normalizedName.replace(/\s+/g, '').toLowerCase()
    if (!normalizedName || seen.has(key)) continue
    seen.add(key)

    const category = inferCoverageCategory(normalizedName)
    const renewalType = inferRenewalTypeFromCoverageName(raw || normalizedName)

    // 고객 라벨 생성
    let customerLabel: string
    switch (category) {
      case 'cancer':
        customerLabel = '암 관련 치료비 보장'
        if (/진단/.test(normalizedName)) customerLabel = '암 진단비 보장'
        else if (/수술/.test(normalizedName)) customerLabel = '암 수술비 보장'
        else if (/항암/.test(normalizedName)) customerLabel = '항암 치료비 보장'
        break
      case 'brain':
        customerLabel = '뇌 질환 진단비 보장'
        break
      case 'heart':
        customerLabel = '심장 질환 진단비 보장'
        break
      case 'surgery':
        customerLabel = '수술비 보장'
        break
      case 'injury':
        customerLabel = '상해 사고 보장'
        break
      case 'death':
        customerLabel = '사망 보장'
        break
      case 'disability':
        customerLabel = '후유장해 보장'
        break
      default:
        customerLabel = `${normalizedName} 보장`
        break
    }

    all.push({
      rawName: raw,
      normalizedName,
      amount: '',
      renewalType,
      category,
      customerLabel,
    })
  }

  if (all.length === 0) return []

  const priority: Record<KeyCoverageCategory, number> = {
    cancer: 4,
    brain: 3,
    heart: 3,
    surgery: 2,
    injury: 1,
    death: 2,
    disability: 1,
    other: 0,
  }

  all.sort((a, b) => {
    const pa = priority[a.category] ?? 0
    const pb = priority[b.category] ?? 0
    if (pa !== pb) return pb - pa
    return a.normalizedName.localeCompare(b.normalizedName)
  })

  return all.slice(0, 5)
}

function buildCoverageConcernCandidates(keyCoverages: KeyCoverage[]): ConcernCandidate[] {
  const candidates: ConcernCandidate[] = []
  if (!Array.isArray(keyCoverages) || keyCoverages.length === 0) return candidates

  const counts: Record<KeyCoverageCategory, number> = {
    cancer: 0,
    brain: 0,
    heart: 0,
    surgery: 0,
    injury: 0,
    death: 0,
    disability: 0,
    other: 0,
  }
  for (const k of keyCoverages) {
    counts[k.category] = (counts[k.category] || 0) + 1
  }

  const hasCancer = counts.cancer > 0
  const hasBrain = counts.brain > 0
  const hasHeart = counts.heart > 0
  const hasSurgery = counts.surgery > 0
  const hasDeath = counts.death > 0
  const hasInjury = counts.injury > 0

  // 암 쪽만 두드러지고 다른 큰 질환이 약한 경우
  if (hasCancer && !hasBrain && !hasHeart) {
    candidates.push({
      source: 'coverage',
      key: 'cancer_only_focus',
      concern: '암 쪽 보장은 보이는데 다른 큰 질환 대비는 부족한 건 아닌지 걱정',
      concernSearch: '암만 강하고 다른 질환은 약한 보험',
      score: 85,
      reason: '암 category 비중이 높고 뇌·심장 축이 거의 없음',
    })
  }

  // 수술비 위주 구성
  if (hasSurgery && !hasCancer && !hasBrain && !hasHeart) {
    candidates.push({
      source: 'coverage',
      key: 'surgery_heavy',
      concern: '진단비보다 수술비 위주라 실제 상황에 맞는 구성인지 고민',
      concernSearch: '수술비 위주 보험 괜찮은지',
      score: 78,
      reason: '수술 category만 눈에 띄고 진단비 축이 약함',
    })
  }

  // 사망 위주 구성
  if (hasDeath && !hasCancer && !hasBrain && !hasHeart) {
    candidates.push({
      source: 'coverage',
      key: 'death_heavy',
      concern: '사망 보장은 큰데 실제 치료비 보장은 부족한 건 아닌지 걱정',
      concernSearch: '사망보장만 크고 치료비가 부족한 보험',
      score: 80,
      reason: '사망 category만 강하고 치료 관련 담보는 약함',
    })
  }

  // 상해 위주 구성
  if (
    counts.injury >= 2 && // 상해 담보가 최소 2개 이상일 때만
    counts.cancer === 0 &&
    counts.brain === 0 &&
    counts.heart === 0 &&
    (counts.other + counts.death + counts.disability) <= 1 // 다른 질환/기타 축이 거의 없을 때만
  ) {
    candidates.push({
      source: 'coverage',
      key: 'injury_only',
      concern: '상해 쪽 보장은 있는데 질병 대비가 부족한 건 아닌지 걱정',
      concernSearch: '상해보장만 있고 질병보장 부족한 보험',
      score: 77,
      reason: '상해 category는 있으나 질병 관련 담보가 거의 없음',
    })
  }

  // 암+수술 조합 (치료비 축 강조)
  if (hasCancer && hasSurgery) {
    candidates.push({
      source: 'coverage',
      key: 'cancer_surgery_combo',
      concern: '암 치료비 중심 구성이라 다른 위험에 대한 대비는 어떤지 한 번 더 보고 싶은 상태',
      concernSearch: '암 치료비 중심 보험 균형',
      score: 82,
      reason: '암·수술 category 조합이 두드러짐',
    })
  }

  // 치매(brain) 축이 두드러질 때: 치매 전용 concern 후보 (simple 설계서에서 치매 축 고정용)
  const total = keyCoverages.length
  const brainRatio = total > 0 ? counts.brain / total : 0
  if (hasBrain && brainRatio >= 0.5) {
    candidates.push({
      source: 'coverage',
      key: 'dementia_focus',
      concern: '치매 진단/장기요양 보장을 이 설계처럼 따로 준비하는 게 내 상황에 맞는지 고민',
      concernSearch: '치매보험 보장을 이 정도면 충분한지 고민',
      score: 88,
      reason: '치매(brain) category 비중이 높음',
    })
  }

  return candidates
}

function buildBalanceConcernCandidates(
  keyCoverages: KeyCoverage[],
  premium: string,
  specialClauses: string[]
): ConcernCandidate[] {
  const candidates: ConcernCandidate[] = []
  if (!Array.isArray(keyCoverages) || keyCoverages.length === 0) return candidates

  const categories = new Set<KeyCoverageCategory>(keyCoverages.map(k => k.category))
  const distinctCount = categories.size
  const hasCancer = categories.has('cancer')
  const hasBrain = categories.has('brain')
  const hasHeart = categories.has('heart')

  const hasPremium = !!(premium && premium.trim())
  const hasSpecial = Array.isArray(specialClauses) && specialClauses.length > 0

  // 보장 종류가 적으면서 보험료가 낮은 경우
  if (distinctCount <= 2 && hasPremium) {
    candidates.push({
      source: 'balance',
      key: 'low_premium_narrow_cover',
      concern: '보험료는 낮지만 정작 필요한 보장이 빠진 건 아닌지 고민',
      concernSearch: '보험료는 싼데 보장이 부족한 보험',
      score: 70,
      reason: '보장 종류가 적고 보험료 정보가 있는 구성',
    })
  }

  // 암 쪽만 강한 경우
  if (hasCancer && !hasBrain && !hasHeart && distinctCount === 1) {
    candidates.push({
      source: 'balance',
      key: 'cancer_only_balance',
      concern: '암 쪽에만 치우친 구성이라 전체 균형이 맞는지 걱정',
      concernSearch: '암만 강한 보험 균형',
      score: 75,
      reason: '암 category 단일 중심 구성',
    })
  }

  // specialClauses가 적고 other 비중이 높은 경우
  const otherCount = keyCoverages.filter(k => k.category === 'other').length
  if (otherCount > 0 && (!hasCancer && !hasBrain && !hasHeart)) {
    candidates.push({
      source: 'balance',
      key: 'other_heavy',
      concern: '핵심 질환 대비는 충분한지 한 번 더 따져보고 싶은 구성',
      concernSearch: '핵심 질환 보장이 약한 보험',
      score: hasSpecial ? 72 : 68,
      reason: 'other category 비중이 높고 주요 질환 축이 약함',
    })
  }

  return candidates
}

function buildStructureConcernFallbacks(
  rawTopicConcern: string,
  rawTopicConcernSearch: string
): ConcernCandidate[] {
  const candidates: ConcernCandidate[] = []
  const base = `${rawTopicConcern} ${rawTopicConcernSearch}`

  if (!base) return candidates

  if (/해약환급금미지급형|무해약/.test(base)) {
    candidates.push({
      source: 'structure_fallback',
      key: 'no_refund_structure',
      concern: '중간에 해지하면 돌려받는 돈이 거의 없는 구조가 부담',
      concernSearch: '환급금 거의 없는 구조 보험 고민',
      score: 55,
      reason: '해지 시 환급금이 거의 없는 구조 감지',
    })
  }

  if (/세만기형|만기/.test(base)) {
    candidates.push({
      source: 'structure_fallback',
      key: 'term_fit',
      concern: '보장 기간과 납입 기간이 내 상황에 맞는지 고민',
      concernSearch: '보장 기간과 납입 기간이 맞는지 고민',
      score: 50,
      reason: '만기/세만기 구조 감지',
    })
  }

  if (/\b(20년납|30년납)\b/.test(base)) {
    candidates.push({
      source: 'structure_fallback',
      key: 'long_payment_term',
      concern: '오래 보험료를 내야 하는 구조라 끝까지 가져갈 수 있을지 고민',
      concernSearch: '납입 기간이 길어서 끝까지 낼 수 있을지 고민',
      score: 48,
      reason: '장기 납입 구조 감지',
    })
  }

  return candidates
}

function buildConcernSearchLabel(concern: string): string {
  let label = concern || ''
  label = label.replace(/\(\d{3,5}\)/g, '')
  label = label.replace(/\b\d+N\d+\b/gi, '')
  label = label.replace(/\d+종(?=\s|$)/g, '')
  label = label.replace(/[ⅠⅡⅢ]/g, '')
  label = label.replace(/\bI{1,3}\b/g, '')
  label = label.replace(/\s+/g, ' ').trim()
  if (label.length > 28) {
    label = label.slice(0, 28)
  }
  return label
}

// 해약환급금미지급형 등 구조어는 축·설명에서 완전히 제거 (노출 금지 — 질문/답변에 나오지 않도록)
// 치환이 아니라 해당 구절을 제거하여, 전문가 답변에 "중간에 해지하면 돌려받는 돈이 거의 없는…" 문구가 나오지 않게 함
function scrubNoRefundStructureTerm(text: string): string {
  if (!text) return text
  let result = text

  // 내부 구조어 → 제거 (생활형으로 치환하지 않음)
  result = result.replace(/해약\s*환급금\s*미지급형/gi, '')
  result = result.replace(/환급금\s*미지급형/gi, '')
  result = result.replace(/해약\s*환급금/gi, '')
  result = result.replace(/환급금/gi, '')
  result = result.replace(/\b환급\b/gi, '')

  // "해약환급금이 없는 대신" 같은 절 전체 제거 (뒤 문맥은 유지)
  result = result.replace(/[,.]?\s*해약\s*환급금이\s+없는\s+대신\s*/gi, ' ')
  result = result.replace(/\s*,\s*해지\s*시\s+환급금이\s+없[^\s.,]+/gi, '')
  result = result.replace(/\s+또한[^.,]*해지[^.,]*돌려받[^.,]*[.,]?/gi, ' ')
  result = result.replace(/\s*중간에\s+해지하면\s+돌려받는\s+돈이\s+[^.,]+/gi, '')
  result = result.replace(/\s*해지하면\s+돌려받는\s+돈이\s+[^.,]+/gi, '')
  result = result.replace(/\s*돌려받는\s+돈이\s+거의\s+없는[^.,]*/gi, '')
  result = result.replace(/\s*돌려받는\s+돈이\s+없는[^.,]*/gi, '')

  result = result.replace(/\s+/g, ' ').replace(/\s*,\s*,/g, ',').replace(/^\s*,\s*|,\s*$/g, '').trim()
  return result
}

// 답변/질문에 절대 노출되지 않도록: "중간에 해지하면 돌려받는 돈이…" 계열 문장·구절 완전 제거
function stripRefundStructureFromText(text: string): string {
  if (!text) return text
  let result = text
  result = result.replace(/\s*중간에\s+해지하면\s+돌려받는\s+돈이\s+거의\s+없는[^.]*\.?/g, '')
  result = result.replace(/\s*중간에\s+해지하면\s+돌려받는\s+돈이\s+없는[^.]*\.?/g, '')
  result = result.replace(/\s*해지하면\s+돌려받는\s+돈이\s+거의\s+없는[^.]*\.?/g, '')
  result = result.replace(/\s*해지하면\s+돌려받는\s+돈이\s+없는[^.]*\.?/g, '')
  result = result.replace(/\s*돌려받는\s+돈이\s+거의\s+없는\s+상품\s+구조[^.]*\.?/gi, '')
  result = result.replace(/\s*돌려받는\s+돈이\s+없는\s+구조[^.]*\.?/gi, '')
  result = result.replace(/\s*[,.]?\s*해약\s*환급금이\s+없는\s+대신[^.]*?([.,]|$)/gi, (_, p) => p || '')
  result = result.replace(/\s+/g, ' ').replace(/\s*,\s*,/g, ',').replace(/^\s*,\s*|,\s*$/g, '').trim()
  return result
}

function buildWorryPointFromConcern(candidate: ConcernCandidate, fallbackWorryPoint: string): string {
  if (!candidate) return fallbackWorryPoint
  const axis = candidate.concern
  const detail = (fallbackWorryPoint || '').trim()

  // 보장/균형 축(coverage·balance)일 때: 해지/환급 문구는 넣지 않음 (어떤 설계서든 핵심 포인트가 아님)
  const refundLike = /해지|환급|돌려받|미지급/
  if (candidate.source === 'coverage' || candidate.source === 'balance') {
    const sentences = detail.split(/[.!?]\s+/).filter(Boolean)
    const nonRefundPart = sentences.filter(s => !refundLike.test(s)).slice(0, 4).join('. ').trim().slice(0, 500)
    if (nonRefundPart.length > 20) return `${axis} ${nonRefundPart}`
    if (detail.length > 60 && detail !== axis) {
      const first = detail.slice(0, 400).trim()
      if (first.length > 20 && !refundLike.test(first)) return `${axis} ${first}`
    }
    return axis
  }

  // 3단계 AI가 생성한 긴 고민이 있으면, 축(axis) 뒤에 설계서 기준 세부 맥락을 붙여서 고민을 자세히 유지
  if (detail.length > 60 && detail !== axis) {
    const firstSentence = detail.split(/[.!?]\s+/)[0]?.trim() || ''
    const rest = firstSentence.length < detail.length ? detail.slice(firstSentence.length).trim().slice(0, 400) : ''
    const extra = (firstSentence + (rest ? ' ' + rest : '')).trim().slice(0, 500)
    if (extra.length > 20) {
      return `${axis} ${extra}`
    }
  }
  return axis
}

function buildSellingPointFromConcern(candidate: ConcernCandidate, fallbackSellingPoint: string): string {
  if (!candidate) return fallbackSellingPoint
  // 치매 축: 답변강조포인트를 구체적으로 (CDR·장기요양·갱신)
  if (candidate.key === 'dementia_focus') {
    return '치매 진단 기준(CDR)·장기요양 등급·갱신 조건을 설계서에서 꼭 확인해보시면 좋고, 경증부터 중증까지 단계별 보장이 있어 치매 전 단계 대비에 적합한 구성이에요'
  }
  // coverage 선택 시: 3단계 AI sellingPoint가 구체적이면 그대로 사용
  if (candidate.source === 'coverage') {
    const fallback = (fallbackSellingPoint || '').trim()
    if (fallback.length >= 80 && /암|특약|유병|진단|치료|보장|뇌|심장|간편/.test(fallback)) {
      return fallback
    }
    return '필요한 질환과 치료비 축을 잘 맞춰두면 위험 대비에는 도움이 될 수 있는 구성입니다'
  }
  // balance 선택 시: 3단계 AI sellingPoint가 구체적이면 그대로 사용(덮어쓰지 않음)
  if (candidate.source === 'balance') {
    const fallback = (fallbackSellingPoint || '').trim()
    if (fallback.length >= 80 && /암|특약|유병|진단|치료|보장|간편/.test(fallback)) {
      return fallback
    }
    return '내 상황에 맞게 필요한 보장만 골라 담으면 보험료 대비 효율은 나쁘지 않을 수 있습니다'
  }
  if (candidate.source === 'special') {
    return '특약을 어떻게 채우느냐에 따라 부족한 부분을 충분히 보완할 여지가 있는 구조입니다'
  }
  if (candidate.source === 'structure_fallback') {
    return '끝까지 유지할 수 있는지만 잘 점검하면 보험료 측면에서는 유리할 수 있는 구조입니다'
  }
  return fallbackSellingPoint
}

function chooseBestConcernCandidate(
  coverageCandidates: ConcernCandidate[],
  balanceCandidates: ConcernCandidate[],
  structureFallbacks: ConcernCandidate[],
  specialCandidates: ConcernCandidate[],
  keyCoverages: KeyCoverage[],
  premium: string,
  specialClauses: string[]
): { selected: ConcernCandidate | null; all: ConcernCandidate[] } {
  const all: ConcernCandidate[] = [
    ...coverageCandidates,
    ...balanceCandidates,
    ...specialCandidates,
    ...structureFallbacks,
  ]
  if (all.length === 0) return { selected: null, all: [] }

  const sourcePriority: Record<ConcernSource, number> = {
    coverage: 3,
    balance: 2,
    special: 1,
    structure_fallback: 0,
  }

  // tie-breaker용 간단한 신호: 카테고리 다양성, premium/특약 존재 여부
  const hasPremium = !!(premium && premium.trim())
  const hasSpecial = Array.isArray(specialClauses) && specialClauses.length > 0
  const categorySet = new Set<KeyCoverageCategory>(keyCoverages.map(k => k.category))
  const categoryDiversity = categorySet.size
  // 메인 보장 축 추론 (치매/뇌, 암, 심장, 수술, 상해 순으로 가중)
  const axisCounts: Record<KeyCoverageCategory, number> = {
    cancer: 0,
    brain: 0,
    heart: 0,
    surgery: 0,
    injury: 0,
    death: 0,
    disability: 0,
    other: 0,
  }
  for (const k of keyCoverages) {
    axisCounts[k.category] = (axisCounts[k.category] || 0) + 1
  }
  let mainAxis: KeyCoverageCategory | null = null
  let maxAxisScore = -1
  const axisWeight: Record<KeyCoverageCategory, number> = {
    brain: 4,
    cancer: 3,
    heart: 3,
    surgery: 2,
    injury: 1,
    death: 1,
    disability: 1,
    other: 0,
  }
  ;(Object.keys(axisCounts) as KeyCoverageCategory[]).forEach(cat => {
    const score = axisCounts[cat] * (axisWeight[cat] ?? 1)
    if (score > maxAxisScore) {
      maxAxisScore = score
      mainAxis = score > 0 ? cat : null
    }
  })

  const scored = all.map(c => {
    let extra = 0
    if (c.source === 'coverage' && categoryDiversity >= 2) extra += 3
    if (c.source === 'balance' && hasPremium) extra += 2
    if (c.source === 'special' && hasSpecial) extra += 2

    // 메인 보장 축과 어긋나는 coverage concern에는 페널티
    if (c.source === 'coverage' && mainAxis) {
      if (c.key === 'injury_only' && (mainAxis === 'brain' || mainAxis === 'cancer' || mainAxis === 'heart')) {
        extra -= 40
      }
      // 치매 축일 때 dementia_focus는 우선 선택되도록 보너스
      if (c.key === 'dementia_focus' && mainAxis === 'brain') extra += 8
    }

    // simple + 치매(brain) 축일 때 환급/구조 축은 보조로만: no_refund_structure 점수 대폭 감소
    if (c.source === 'structure_fallback' && c.key === 'no_refund_structure' && mainAxis === 'brain') {
      extra -= 35
    }

    return {
      ...c,
      _priority: sourcePriority[c.source] ?? 0,
      _finalScore: c.score + extra,
    }
  })

  scored.sort((a, b) => {
    if (a._priority !== b._priority) return b._priority - a._priority
    if (a._finalScore !== b._finalScore) return b._finalScore - a._finalScore
    // tie-break: key 문자열과 source로 안정적인 정렬
    if (a.source !== b.source) return a.source.localeCompare(b.source)
    return a.key.localeCompare(b.key)
  })

  const selected = scored[0] || null
  return { selected, all }
}

// 설계서 분석 결과의 productName 기본 정규화
// generate-qa의 convertToCustomerTopicName보다 가벼운 1차 정리
const normalizeExtractedProductName = (raw: string): string => {
  if (!raw || raw === '보험 상품') return raw
  let name = raw
  // 중복 단어 제거 (예: "하나퍼스트 무배당 하나퍼스트" → "하나퍼스트 무배당")
  const words = name.split(/\s+/)
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const w of words) {
    if (!seen.has(w)) { seen.add(w); deduped.push(w) }
  }
  name = deduped.join(' ')
  // "무배당" 제거
  name = name.replace(/무배당\s*/g, '')
  // 내부 코드 제거: (4165), (2601), 5N5 등
  name = name.replace(/\(\d{3,5}\)/g, '')
  name = name.replace(/\b\d+N\d+\b/g, '')
  // "2종", "1종" 등 제거
  name = name.replace(/\d+종(?:\s|$)/g, ' ')
  // 로마 숫자 제거: II, III, IV, Ⅱ, Ⅲ
  name = name.replace(/\s+(I{2,3}|IV|V|VI{0,3}|Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ)(?=[\s,.\)]|[가-힣]|$)/g, '')
  // 다중 공백 정리
  name = name.replace(/\s+/g, ' ').trim()
  return name
}

// 검색 결과를 프롬프트용 불릿 문자열로 변환 (출처 표기 없이 내용만)
const formatSearchResultsForPrompt = (results: SearchResult[]): string => {
  if (!results || results.length === 0) return ''
  return results
    .slice(0, 5)
    .map((r, idx) => {
      const title = (r.title || '').replace(/\s+/g, ' ').trim().slice(0, 80)
      const snippet = (r.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 200)
      return `- (${idx + 1}) ${title} — ${snippet}`
    })
    .join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64 } = await request.json()

    if (!imageBase64) {
      return NextResponse.json(
        { error: '이미지가 제공되지 않았습니다' },
        { status: 400 }
      )
    }

    console.log('설계서 분석 시작...')

    // Gemini Vision API 초기화
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[설계서 분석] GEMINI_API_KEY가 설정되지 않았습니다!')
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다. 서버 설정을 확인해주세요.' },
        { status: 500 }
      )
    }
    
    // API 키 일부만 로그 (디버깅용)
    const apiKeyPreview = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4)
    console.log('[설계서 분석] Gemini API 키 확인:', apiKeyPreview, '(길이:', apiKey.length, ')')
    console.log('[설계서 분석] 환경:', process.env.NODE_ENV || 'unknown')
    
    const genAI = new GoogleGenerativeAI(apiKey)
    
    // Fallback 로직: Gemini만 사용
    // 1단계: gemini-2.5-flash → gemini-2.5-pro
    // 3단계: gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash
    const generateContentWithFallback = async (
      prompt: string,
      base64Data: string,
      mimeType: string,
      stage: 'basic' | 'final' = 'basic' // 'basic': 1단계, 'final': 3단계
    ): Promise<{ text: string; provider: 'gemini' }> => {
      // stage에 따라 모델 순서 결정
      // basic (1단계): gemini-2.5-flash → gemini-2.5-pro
      // final (3단계): gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash
      const models = stage === 'basic'
        ? [
            { provider: 'gemini' as const, model: 'gemini-2.5-flash' },
            { provider: 'gemini' as const, model: 'gemini-2.5-pro' }
          ]
        : [
            { provider: 'gemini' as const, model: 'gemini-2.5-pro' },
            { provider: 'gemini' as const, model: 'gemini-2.5-flash' },
            { provider: 'gemini' as const, model: 'gemini-2.0-flash' }
          ]
      
      const modelOrder = stage === 'basic'
        ? 'Gemini-2.5-Flash → Gemini-2.5-Pro'
        : 'Gemini-2.5-Pro → Gemini-2.5-Flash → Gemini-2.0-Flash'
      console.log(`[설계서 분석] 🔄 Gemini 폴백 순서 시작 (${stage}): ${modelOrder}`)
      
      for (let attempt = 0; attempt < models.length; attempt++) {
        const { provider, model: modelName } = models[attempt]
        
        try {
          console.log(`[설계서 분석] ${provider.toUpperCase()} 모델 시도: ${modelName} (시도 ${attempt + 1}/${models.length})`)
          
          // Gemini만 사용 (3단계는 긴 worryPoint/sellingPoint 방지를 위해 출력 토큰 확대)
          const model = genAI.getGenerativeModel({ 
            model: modelName,
            tools: [{ googleSearch: {} }] as any, // Google Grounding 활성화
            ...(stage === 'final' ? { generationConfig: { maxOutputTokens: 8192 } } : {})
          })
          
          const result = await model.generateContent([
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            prompt
          ])
          
          const response = await result.response
          const text = response.text().trim()
          
          // 그라운딩 결과 확인
          const groundingMetadata = response.candidates?.[0]?.groundingMetadata as any
          if (groundingMetadata) {
            console.log(`[설계서 분석] [${modelName}] 🔍 그라운딩 결과:`)
            console.log('  - 웹 검색 쿼리:', groundingMetadata.webSearchQueries || [])
            const chunks = groundingMetadata.groundingChunks || groundingMetadata.groundingChuncks || []
            console.log('  - 검색된 청크 수:', chunks.length)
          }
          
          if (text) {
            console.log(`[설계서 분석] ✅ Gemini 성공! (${modelName})`)
            // RPM 150 제한 대응: 성공 후 1초 지연 (동시 요청 방지)
            await new Promise(resolve => setTimeout(resolve, 1000))
            return { text, provider: 'gemini' }
          }
        } catch (error: any) {
          const errorMessage = error?.message || ''
          const errorString = JSON.stringify(error || {})
          
          const isQuotaError = 
            errorMessage.includes('429') || 
            errorMessage.includes('quota') || 
            errorMessage.includes('rate limit') ||
            errorMessage.includes('Too Many Requests') ||
            errorMessage.includes('exceeded') ||
            errorMessage.includes('Resource has been exhausted') ||
            errorString.includes('free_tier') ||
            errorString.includes('QuotaFailure') ||
            errorMessage.includes('insufficient_quota')
          
          console.error(`[설계서 분석] ${provider.toUpperCase()} ${modelName} 실패:`, {
            provider,
            model: modelName,
            error: errorMessage.substring(0, 500),
            isQuotaError
          })
          
          // 할당량 에러이고 마지막 모델이 아니면 다음 모델로 시도
          if (isQuotaError && attempt < models.length - 1) {
            const nextModel = models[attempt + 1]
            console.log(`[설계서 분석] ⚠️ ${modelName} 할당량 초과 → ${nextModel.provider.toUpperCase()} ${nextModel.model} 모델로 폴백 시도...`)
            // RPM 150 제한 대응: 할당량 초과 시 1초 지연 후 재시도
            console.log(`[설계서 분석] ⏳ 1초 대기 후 재시도...`)
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
          }
          
          // 마지막 모델이 아니면 다음 모델로 시도
          if (attempt < models.length - 1) {
            const nextModel = models[attempt + 1]
            console.log(`[설계서 분석] ⚠️ ${modelName} 실패 → ${nextModel.provider.toUpperCase()} ${nextModel.model} 모델로 폴백 시도...`)
            // RPM 150 제한 대응: 실패 시 1초 지연 후 재시도
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
          }
        }
      }
      
      const failedModels = models.map(m => m.model).join(' → ')
      throw new Error(`모든 모델 시도 실패 (${failedModels})`)
    }

    // Base64에서 데이터 부분만 추출 (data:image/...;base64, 제거)
    const base64Data = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64

    // 이미지 크기 확인 (디버깅용)
    const base64SizeKB = Math.round((base64Data.length * 3) / 4 / 1024) // Base64 크기 → 실제 바이트 크기 추정
    console.log(`[설계서 분석] 📊 이미지 크기: ${base64SizeKB} KB (Base64 길이: ${base64Data.length} 문자)`)
    
    // GPT-4o Vision API 제한: 최대 20MB (Base64 인코딩 후)
    // 참고: 실제로는 더 작은 크기에서도 거부할 수 있음
    if (base64SizeKB > 20000) {
      console.warn(`[설계서 분석] ⚠️ 이미지가 너무 큽니다 (${base64SizeKB} KB). GPT-4o는 20MB 제한이 있지만, 실제로는 더 작은 크기에서도 거부할 수 있습니다.`)
    }

    // MIME 타입 자동 감지
    let mimeType = 'image/png'
    if (imageBase64.includes('data:image/jpeg') || imageBase64.includes('data:image/jpg')) {
      mimeType = 'image/jpeg'
    } else if (imageBase64.includes('data:image/png')) {
      mimeType = 'image/png'
    } else if (imageBase64.includes('data:image/webp')) {
      mimeType = 'image/webp'
    }
    
    console.log(`[설계서 분석] 📋 이미지 형식: ${mimeType}`)

    // 1단계: 이미지에서 기본 정보 추출 (상품명 중심)
    // Flash 모델 사용 (기본 정보 추출은 Flash로 충분, Pro 할당량 절약)
    console.log('1단계: 이미지에서 기본 정보 추출 중... (Flash 모델 사용)')
    const basicInfoPrompt = `이 이미지는 보험 설계서/제안서입니다. 이미지에서 다음 정보만 추출해주세요:

**[추출할 정보]**
- 보험사명: 로고나 상단에 표시된 보험사 이름
- 보험 상품명: 제목이나 상품명란에 적힌 정확한 상품명
- 가입자 정보: 나이, 성별, 직업 (있는 경우)

**[출력 형식 - 반드시 JSON만 출력]**
{
  "productName": "보험사명 + 보험상품명",
  "targetPersona": "나이대 + 성별 + 직업 (있는 경우)",
  "premium": "월보험료 또는 연보험료 (있는 경우)",
  "coverages": ["담보명1", "담보명2"],
  "specialClauses": ["특약명1", "특약명2"]
}

⚠️ 이미지에 명시된 정확한 정보만 추출하세요. 추정하지 마세요.`

    // 1단계는 gemini-2.5-flash → gemini-2.5-pro 순서 사용
    const basicResult = await generateContentWithFallback(basicInfoPrompt, base64Data, mimeType, 'basic')
    console.log(`[설계서 분석] 1단계 완료 - 사용된 제공자: ${basicResult.provider.toUpperCase()}`)
    let basicAnalysisText = basicResult.text
    basicAnalysisText = basicAnalysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    basicAnalysisText = basicAnalysisText.replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')

    let basicData: any = {}
    try {
      const jsonMatch = basicAnalysisText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        basicData = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.warn('기본 정보 추출 실패, 텍스트에서 추출 시도')
      const productMatch = basicAnalysisText.match(/"productName"\s*:\s*"([^"]+)"/) || 
                          basicAnalysisText.match(/productName["\s]*:\s*"([^"]+)"/i)
      basicData = {
        productName: productMatch?.[1]?.trim() || '보험 상품'
      }
    }

    const extractedProductName = basicData.productName || '보험 상품'
    const searchFriendlyName = normalizeExtractedProductName(extractedProductName)
    console.log('[설계서 분석] 추출된 상품명:', extractedProductName)
    console.log('[설계서 분석] 검색용 정규화 상품명:', searchFriendlyName)

    // 2단계: 정규화된 상품명으로 최신 정보 검색
    let searchResultsText = ''
    let customSearchCount = 0
    
    console.log('[설계서 분석] 2단계 조건 확인:', {
      extractedProductName,
      searchFriendlyName,
      isNotEmpty: !!extractedProductName,
      isNotDefault: extractedProductName !== '보험 상품',
      willSearch: extractedProductName && extractedProductName !== '보험 상품'
    })
    
    // 검색은 3단계 분석 이후, 축이 잡힌 경우에만 축+브랜드로 1~2회 수행 (아래에서 처리)
    let collectedSearchResults: SearchResult[] = []

    // 3단계: 이미지 기반 최종 분석 (검색 없이 설계서만으로 worryPoint/sellingPoint/축 확정)
    // 1단계에서 추출한 기본 정보를 프롬프트에 포함
    const basicInfoContext = basicData.productName && basicData.productName !== '보험 상품' 
      ? `**[1단계에서 이미 추출한 정보 - 반드시 사용하세요!]**
다음은 이미지에서 이미 추출한 기본 정보입니다. 이 정보를 기반으로 더 상세한 분석을 수행해주세요:
- 상품명: ${basicData.productName || '미확인'}
- 대상: ${basicData.targetPersona || '미확인'}
- 보험료: ${basicData.premium || '미확인'}
- 담보: ${basicData.coverages?.length > 0 ? basicData.coverages.join(', ') : '미확인'}
- 특약: ${basicData.specialClauses?.length > 0 ? basicData.specialClauses.join(', ') : '미확인'}

⚠️ **중요**: 위 정보는 이미지에서 추출한 것이므로, 이를 기반으로 worryPoint와 sellingPoint를 더 구체적으로 작성해주세요. 이 정보를 무시하지 마세요!` 
      : ''
    
    // 검색 결과가 있는지 확인
    const hasSearchResults = searchResultsText && searchResultsText.length > 100
    console.log(`[설계서 분석] 검색 결과 포함 여부: ${hasSearchResults ? '예' : '아니오'} (길이: ${searchResultsText?.length || 0} 문자)`)
    
    const prompt = `이 이미지는 보험 설계서/제안서입니다. 이미지를 자세히 읽고, 표시된 모든 텍스트와 데이터를 정확히 추출해주세요.

${basicInfoContext}

${searchResultsText ? `**[최근 검색 요약]**
다음은 "${extractedProductName}"에 대한 최신 정보입니다. 이 정보를 참고하여 더 정확하고 현실적인 분석을 수행해주세요:
${searchResultsText}

⚠️ 검색 결과는 참고용이며, 이미지에 명시된 정보가 우선입니다.` : ''}

**[이미지 분석 단계]**

1단계: 이미지의 모든 텍스트를 OCR로 읽기
- 보험사 로고 주변의 텍스트 확인
- 제목, 부제목, 표 제목 등 모든 텍스트 읽기
- 표 안의 숫자와 텍스트 정확히 인식

2단계: 핵심 정보 추출
- **보험사명**: 로고 아래나 상단에 명시된 보험사 이름 (예: "삼성생명", "한화생명", "DB손해보험")
- **보험 상품명**: 제목이나 상품명란에 적힌 정확한 상품명 (예: "운전자보험", "실손의료비보험", "종신보험")
- **가입자 정보**: 나이, 성별, 직업이 표시된 부분 찾기
- **보험료**: 금액이 표시된 부분 (월보험료, 연보험료 등)
- **특약/보장 내용**: 특약명, 보장금액 등이 나열된 부분

3단계: 보험 종류 판단
- 이미지에 "운전자보험"이라고 명시되어 있으면 → 운전자보험
- 이미지에 "실손의료비"라고 명시되어 있으면 → 실손의료비보험
- 이미지에 "치아보험"이라고 명시되어 있으면 → 치아보험
- **⚠️ 절대 추정하지 말고, 이미지에 명시된 정확한 상품명만 사용하세요!**

${searchResultsText ? `4단계: 검색 결과 활용
- 위의 검색 결과를 참고하여 이 상품에 대한 고객의 실제 고민점(worryPoint)을 파악하세요
- 검색 결과를 바탕으로 이 상품의 주요 장점(sellingPoint)을 현실적으로 정리하세요
- 검색 결과에 나온 최신 정보(후기, 특약, 장점 등)를 반영하여 더 정확한 분석을 제공하세요` : ''}

**[출력 형식 - 반드시 JSON만 출력]**
{
  "productName": "보험사명 + 보험상품명 (1단계에서 추출한 정보를 기반으로, 이미지에서 정확히 확인)",
  "targetPersona": "나이대 + 성별 + 직업 (1단계에서 추출한 정보를 기반으로, 이미지에서 정확히 확인)",
  "worryPoint": "이 보험을 고려하는 고객의 실제 고민 (검색 결과를 반드시 참고하여 구체적으로 작성. 예: '보험료 부담', '보장 범위 충분성', '특약 구성' 등). 단, 해지·환급 구조(해약환급금, 중간 해지 시 돌려받는 돈, 해약환급금이 없는 대신 등)에 대한 문장은 절대 포함하지 마세요.",
  "sellingPoint": "이 보험의 주요 장점 2-3개를 구체적으로 작성 (검색 결과를 반드시 참고하여 정확하게 작성. 예: '저렴한 보험료', '넓은 보장 범위', '특약 선택의 자유도' 등). 단, 해지·환급 구조(해약환급금, 중간 해지 시 돌려받는 돈, 해약환급금이 없는 대신 등)에 대한 문장은 절대 포함하지 마세요.",
  "premium": "월보험료 또는 연보험료 (1단계에서 추출한 정보를 기반으로, 예: '월 3만원', '연 36만원')",
  "coverages": ["담보명1", "담보명2", "담보명3"] (1단계에서 추출한 정보를 기반으로),
  "specialClauses": ["특약명1", "특약명2"] (1단계에서 추출한 정보를 기반으로)
}

⚠️ **중요**: 
- productName, targetPersona, premium, coverages, specialClauses는 1단계에서 이미 추출한 정보를 우선 사용하되, 이미지를 다시 확인하여 정확성을 검증하세요.
- worryPoint와 sellingPoint는 반드시 검색 결과를 참고하여 구체적이고 현실적으로 작성하세요. 일반적인 문구가 아닌, 이 상품에 특화된 내용을 작성하세요.
- **worryPoint와 sellingPoint에는 다음 내용을 절대 포함하지 마세요**: 해약환급금, 환급금, 중간에 해지하면 돌려받는 돈, 해지하면 돌려받는 돈이 없는 구조, 해약환급금이 없는 대신, 해지 시 환급 등 해지·환급 구조에 대한 설명. (고객이 이 축으로 질문하지 않으므로 출력하지 마세요.)
- worryPoint와 sellingPoint는 문장이 끝까지 완결되도록 작성하세요 (중간에 끊기지 않도록).

**[최종 확인]**
- productName: 이미지에 실제로 보이는 보험사명과 상품명인가?
- 보험 종류: 이미지에 명시된 보험 종류와 일치하는가?
- worryPoint: 검색 결과를 참고하여 실제 고객 고민을 반영했는가?
- sellingPoint: 검색 결과를 참고하여 현실적인 장점을 정리했는가?
- 모든 정보는 이미지에서 직접 읽은 내용을 우선하고, 검색 결과는 보완적으로 활용하세요.`

    // 3단계: 최종 분석 수행 (검색 결과 포함 + 그라운딩 활성화)
    // Pro 모델 사용 (고품질 분석 필요)
    console.log('[설계서 분석] 3단계: 최종 분석 시작 (Pro 모델 사용)')
    console.log('[설계서 분석]   - 검색 결과 포함 여부:', searchResultsText && searchResultsText.length > 0 ? '예' : '아니오')
    console.log('[설계서 분석]   - 검색 결과 텍스트 길이:', searchResultsText.length, '글자')
    console.log('[설계서 분석]   - 그라운딩: 활성화')
    
    // 1단계와 3단계 사이 최소 간격 보장 (RPM 제한 방지)
    await new Promise(resolve => setTimeout(resolve, 2000)) // 2초 대기
    
    // 이미지와 프롬프트를 함께 전송 (그라운딩 활성화, fallback 포함)
    // 3단계: gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash 순서 사용
    const finalResult = await generateContentWithFallback(prompt, base64Data, mimeType, 'final')
    console.log(`[설계서 분석] 3단계 완료 - 사용된 제공자: ${finalResult.provider.toUpperCase()}`)
    let analysisText = finalResult.text

    // JSON 추출 (코드 블록 제거)
    analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    // 제어 문자 제거
    analysisText = analysisText.replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')

    // JSON 파싱 시도
    let analysisData
    try {
      // JSON 추출 (중괄호 포함 부분 찾기)
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('JSON 형식을 찾을 수 없습니다')
      }
    } catch (parseError) {
      // JSON 파싱 실패 시 텍스트에서 추출 시도
      console.warn('JSON 파싱 실패, 텍스트에서 추출 시도:', parseError)
      console.log('원본 텍스트:', analysisText.substring(0, 500))
      
      // GPT 거부 메시지인지 확인
      const isRejectionMessage = 
        analysisText.toLowerCase().includes("i'm sorry") ||
        analysisText.toLowerCase().includes("i can't assist") ||
        analysisText.toLowerCase().includes("cannot assist") ||
        analysisText.toLowerCase().includes("unable to") ||
        analysisText.toLowerCase().includes("cannot help") ||
        analysisText.toLowerCase().includes("죄송합니다") ||
        analysisText.toLowerCase().includes("죄송하지만") ||
        analysisText.toLowerCase().includes("죄송") ||
        analysisText.toLowerCase().includes("도와드릴 수 없") ||
        analysisText.toLowerCase().includes("어려움이 있습니다") ||
        analysisText.toLowerCase().includes("제공되지 않습니다") ||
        analysisText.toLowerCase().includes("인식하고 분석하는 데") ||
        analysisText.toLowerCase().includes("이미지를 인식")
      
      if (isRejectionMessage) {
        console.warn('[설계서 분석] ⚠️ GPT 거부 메시지 감지됨. 1단계에서 추출한 정보와 검색 결과를 활용합니다.')
        
        // 검색 결과에서 worryPoint와 sellingPoint 자동 추출 시도
        let autoWorryPoint = '보험료와 보장 범위가 적절한지 궁금합니다'
        let autoSellingPoint = '보장 범위가 넓고 합리적인 보험료입니다'
        
        if (searchResultsText && searchResultsText.length > 100) {
          // 검색 결과에서 고민 관련 키워드 추출
          const worryKeywords = ['고민', '걱정', '우려', '부담', '비용', '보험료', '보장', '부족', '적합', '필요']
          const sellingKeywords = ['장점', '좋은', '추천', '유리', '저렴', '넓은', '다양', '특약', '보장']
          
          const worryMatches = worryKeywords.filter(kw => searchResultsText.includes(kw))
          const sellingMatches = sellingKeywords.filter(kw => searchResultsText.includes(kw))
          
          if (worryMatches.length > 0 || sellingMatches.length > 0) {
            // 검색 결과의 첫 500자를 기반으로 간단한 요약 생성
            const searchPreview = searchResultsText.substring(0, 500)
            
            // worryPoint 생성: 검색 결과에서 고민 관련 문구 찾기
            if (worryMatches.length > 0) {
              const worryContext = searchPreview.match(/(.{0,100}(?:고민|걱정|우려|부담|비용|보험료|보장|부족|적합|필요).{0,100})/i)
              if (worryContext) {
                autoWorryPoint = `${extractedProductName}에 대해 ${worryContext[1].substring(0, 80)}...`
              } else {
                autoWorryPoint = `${extractedProductName}의 보험료와 보장 범위에 대한 고민`
              }
            }
            
            // sellingPoint 생성: 검색 결과에서 장점 관련 문구 찾기
            if (sellingMatches.length > 0) {
              const sellingContext = searchPreview.match(/(.{0,100}(?:장점|좋은|추천|유리|저렴|넓은|다양|특약|보장).{0,100})/i)
              if (sellingContext) {
                autoSellingPoint = `${extractedProductName}의 ${sellingContext[1].substring(0, 80)}...`
              } else {
                autoSellingPoint = `${extractedProductName}의 합리적인 보험료와 넓은 보장 범위`
              }
            }
          } else {
            // 키워드가 없어도 검색 결과가 있으면 기본 문구 생성
            autoWorryPoint = `${extractedProductName}의 보험료와 보장 범위에 대한 고민`
            autoSellingPoint = `${extractedProductName}의 합리적인 보험료와 넓은 보장 범위`
          }
        }
        
        // 1단계에서 추출한 정보를 기반으로 최소한의 데이터 구성
        analysisData = {
          productName: basicData.productName || '보험 상품',
          targetPersona: basicData.targetPersona || '30대 직장인',
          worryPoint: autoWorryPoint,
          sellingPoint: autoSellingPoint,
          premium: basicData.premium || '',
          coverages: basicData.coverages || [],
          specialClauses: basicData.specialClauses || []
        }
        
        console.log('[설계서 분석] 🔄 검색 결과 기반 자동 생성:', {
          worryPoint: autoWorryPoint,
          sellingPoint: autoSellingPoint
        })
      } else {
        // 다양한 패턴으로 추출 시도
        const productMatch = analysisText.match(/"productName"\s*:\s*"([^"]+)"/) || 
                            analysisText.match(/productName["\s]*:\s*"([^"]+)"/i) ||
                            analysisText.match(/상품명["\s]*[:：]\s*([^\n"]+)/)
        
        const targetMatch = analysisText.match(/"targetPersona"\s*:\s*"([^"]+)"/) || 
                           analysisText.match(/targetPersona["\s]*:\s*"([^"]+)"/i) ||
                           analysisText.match(/타겟["\s]*[:：]\s*([^\n"]+)/)
        
        const worryMatch = analysisText.match(/"worryPoint"\s*:\s*"([^"]+)"/) || 
                          analysisText.match(/worryPoint["\s]*:\s*"([^"]+)"/i)
        
        const sellingMatch = analysisText.match(/"sellingPoint"\s*:\s*"([^"]+)"/) || 
                            analysisText.match(/sellingPoint["\s]*:\s*"([^"]+)"/i)

        const premiumMatch = analysisText.match(/"premium"\s*:\s*"([^"]+)"/) || 
                             analysisText.match(/premium["\s]*:\s*"([^"]+)"/i) ||
                             analysisText.match(/보험료["\s]*[:：]\s*([^\n"]+)/)
        
        const coveragesMatch = analysisText.match(/"coverages"\s*:\s*\[([^\]]+)\]/) ||
                              analysisText.match(/coverages["\s]*:\s*\[([^\]]+)\]/i)
        
        const specialClausesMatch = analysisText.match(/"specialClauses"\s*:\s*\[([^\]]+)\]/) ||
                                    analysisText.match(/specialClauses["\s]*:\s*\[([^\]]+)\]/i)

        // 추출한 정보와 1단계 정보를 병합 (추출한 정보가 우선)
        analysisData = {
          productName: productMatch?.[1]?.trim() || basicData.productName || '보험 상품',
          targetPersona: targetMatch?.[1]?.trim() || basicData.targetPersona || '30대 직장인',
          worryPoint: worryMatch?.[1]?.trim() || (searchResultsText ? `${extractedProductName}에 대한 고객의 주요 고민점` : '보험료와 보장 범위가 적절한지 궁금합니다'),
          sellingPoint: sellingMatch?.[1]?.trim() || (searchResultsText ? `${extractedProductName}의 주요 장점` : '보장 범위가 넓고 합리적인 보험료입니다'),
          premium: premiumMatch?.[1]?.trim() || basicData.premium || '',
          coverages: coveragesMatch?.[1] ? coveragesMatch[1].split(',').map(s => s.trim().replace(/["']/g, '')).filter(Boolean) : (basicData.coverages || []),
          specialClauses: specialClausesMatch?.[1] ? specialClausesMatch[1].split(',').map(s => s.trim().replace(/["']/g, '')).filter(Boolean) : (basicData.specialClauses || [])
        }
        
        console.log('추출된 데이터:', analysisData)
      }
    }

    console.log('설계서 분석 완료:', analysisData)
    console.log('[설계서 분석] worryPoint 길이:', analysisData.worryPoint?.length ?? 0, 'sellingPoint 길이:', analysisData.sellingPoint?.length ?? 0)
    console.log('[설계서 분석] 커스텀 서치 횟수:', customSearchCount)

    const rawProductName = analysisData.productName || '보험 상품'

    // ── Ground Truth Validation: 잠그기 전 교차 검증 ──
    let validatedProductName = rawProductName
    let validationReason = '3단계 Gemini 분석 결과 그대로 사용'
    let validationConfidence: 'high' | 'medium' | 'low' = 'medium'

    if (collectedSearchResults.length > 0) {
      console.log('[설계서 분석] Ground Truth Validation 시작')
      const stage1Name = extractedProductName || ''
      const stage3Name = rawProductName

      const searchTitleTokens = new Map<string, number>()
      for (const sr of collectedSearchResults) {
        const combinedText = `${sr.title || ''} ${sr.snippet || ''}`
        const tokens = combinedText.replace(/[^가-힣a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length >= 2)
        for (const token of tokens) {
          searchTitleTokens.set(token, (searchTitleTokens.get(token) || 0) + 1)
        }
      }

      const stage1Core = normalizeExtractedProductName(stage1Name).replace(/\s+/g, '').toLowerCase()
      const stage3Core = normalizeExtractedProductName(stage3Name).replace(/\s+/g, '').toLowerCase()

      if (stage1Core !== stage3Core && stage1Core.length > 3 && stage3Core.length > 3) {
        const stage1Tokens = stage1Core.split('').filter((_, i) => i % 2 === 0 ? true : false)
        const stage3Tokens = stage3Core.split('').filter((_, i) => i % 2 === 0 ? true : false)

        let stage1Freq = 0
        let stage3Freq = 0
        for (const [token, count] of searchTitleTokens.entries()) {
          const tokenNorm = token.toLowerCase()
          if (stage1Name.toLowerCase().includes(tokenNorm) && tokenNorm.length >= 3) stage1Freq += count
          if (stage3Name.toLowerCase().includes(tokenNorm) && tokenNorm.length >= 3) stage3Freq += count
        }

        console.log(`[설계서 분석] Validation 후보 비교: 1단계="${stage1Name}" (freq=${stage1Freq}) vs 3단계="${stage3Name}" (freq=${stage3Freq})`)

        if (stage1Freq > stage3Freq * 1.5 && stage1Freq >= 3) {
          validatedProductName = stage1Name
          validationReason = `1단계 OCR 이름이 검색 결과에서 더 빈번 (${stage1Freq} vs ${stage3Freq})`
          validationConfidence = 'medium'
          console.log(`[설계서 분석] ⚠️ Ground Truth 교정: "${stage3Name}" → "${stage1Name}" (1단계 우선)`)
        } else {
          validationReason = `3단계 결과 유지 (검색빈도 stage1=${stage1Freq}, stage3=${stage3Freq})`
          validationConfidence = stage3Freq >= 3 ? 'high' : 'medium'
        }
      } else {
        validationReason = '1단계/3단계 이름이 동일하므로 검증 불필요'
        validationConfidence = 'high'
      }

      console.log(`[설계서 분석] Ground Truth Validation 확정: "${validatedProductName}" (${validationConfidence}, ${validationReason})`)
    }

    const normalizedBeforeCorrection = normalizeExtractedProductName(validatedProductName)

    // ── 상품명 정답 교정 레이어 (검색 결과 + alias 사전 + fuzzy matching) ──
    const { correctedRaw, correctedNormalized, correction } = correctAndLog(
      validatedProductName,
      normalizedBeforeCorrection,
      collectedSearchResults.length > 0 ? collectedSearchResults : undefined
    )
    const finalRawProductName = correctedRaw
    const normalizedProductName = correctedNormalized

    const topicData = convertToCustomerTopicName(normalizedProductName)
    let topicConcern = topicData.topicConcern || ''
    let topicConcernSearch = topicData.topicConcernSearch || ''
    const personaBucket = extractPersonaBucket(analysisData.targetPersona || '')
    console.log('[설계서 분석] 정규화된 상품명:', { raw: rawProductName, normalized: normalizedProductName, correctionApplied: correction.method !== 'none' })
    console.log('[설계서 분석] 구조화된 주제:', { ...topicData, personaBucket })

    // coverages dedupe + normalize (로마숫자 제거, 중복 제거, 너무 긴 특약명 축약)
    let cleanCoverages: string[] = (analysisData.coverages || []).map((c: string) =>
      c.replace(/\s+(I{2,3}|IV|VI{0,3})(?=[\s,.]|[가-힣]|$)/g, '')
       .replace(/\s+(Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ)(?=[\s,.]|[가-힣]|$)/g, '')
       .replace(/\s+/g, ' ').trim()
    )
    const coverageSeen = new Set<string>()
    cleanCoverages = cleanCoverages.filter((c: string) => {
      const norm = c.replace(/\s+/g, '').toLowerCase()
      if (coverageSeen.has(norm)) return false
      coverageSeen.add(norm)
      return true
    })

    let cleanSpecialClauses: string[] = (analysisData.specialClauses || []).map((c: string) =>
      c.replace(/\s+(I{2,3}|IV|VI{0,3})(?=[\s,.]|[가-힣]|$)/g, '')
       .replace(/\s+(Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ)(?=[\s,.]|[가-힣]|$)/g, '')
       .replace(/\s+/g, ' ').trim()
    )
    const clauseSeen = new Set<string>()
    cleanSpecialClauses = cleanSpecialClauses.filter((c: string) => {
      const norm = c.replace(/\s+/g, '').toLowerCase()
      if (clauseSeen.has(norm)) return false
      clauseSeen.add(norm)
      return true
    })

    // ── Evidence Map 구축: 질문/답변/금지 용도별 사실 분리 ──
    const coverageEvidence = buildCoverageEvidence(cleanCoverages)
    const premium = analysisData.premium || ''
    let worryPoint = analysisData.worryPoint || '보험료와 보장 범위가 적절한지 궁금합니다'
    let sellingPoint = analysisData.sellingPoint || '보장 범위가 넓고 합리적인 보험료입니다'

    const questionFacts: string[] = []
    const answerFacts: string[] = []
    const forbiddenPatterns: string[] = []

    // 금지 패턴: 내부 코드, 설계사 표현, 삭제 대상 용어
    forbiddenPatterns.push('무배당')
    forbiddenPatterns.push('(주)')
    // 로마 숫자 접미사
    forbiddenPatterns.push('Ⅰ', 'Ⅱ', 'Ⅲ', 'II', 'III')
    // 상품 내부 코드 패턴
    if (rawProductName !== normalizedProductName) {
      const codeMatches = rawProductName.match(/\(\d{3,5}\)/g)
      if (codeMatches) forbiddenPatterns.push(...codeMatches)
    }
    forbiddenPatterns.push('종 해약환급금미지급형')
    forbiddenPatterns.push('설계사 전문 상담')
    forbiddenPatterns.push('약관을 참고하세요')
    forbiddenPatterns.push('자세한 내용은 약관')

    // coverages만으로는 축이 안 나올 수 있음(3단계가 주계약 1개만 넣고 특약은 specialClauses에만 넣는 경우) → specialClauses 병합해 축·designFocusLabel 산출
    const mergedForKeyCoverages = [...cleanCoverages, ...(cleanSpecialClauses || []).slice(0, 15)]
    const keyCoverages = buildKeyCoverages(mergedForKeyCoverages)
    const keyCoveragesCount = keyCoverages.length
    console.log('[설계서 분석] keyCoverages 생성:', {
      fromCoverages: cleanCoverages.length,
      fromSpecialClauses: (cleanSpecialClauses || []).length,
      finalKeyCoverages: keyCoveragesCount,
      names: keyCoverages.map(k => k.normalizedName),
    })

    const coverageConcernCandidates = buildCoverageConcernCandidates(keyCoverages)
    const balanceConcernCandidates = buildBalanceConcernCandidates(keyCoverages, premium, cleanSpecialClauses)
    const structureFallbackCandidates = buildStructureConcernFallbacks(topicData.topicConcern || '', topicData.topicConcernSearch || '')
    const specialConcernCandidates: ConcernCandidate[] = []

    console.log('[설계서 분석] concern 후보(coverage):', coverageConcernCandidates)
    console.log('[설계서 분석] concern 후보(balance):', balanceConcernCandidates)
    console.log('[설계서 분석] concern 후보(structure fallback):', structureFallbackCandidates)

    const { selected: selectedConcernCandidate, all: allConcernCandidates } = chooseBestConcernCandidate(
      coverageConcernCandidates,
      balanceConcernCandidates,
      structureFallbackCandidates,
      specialConcernCandidates,
      keyCoverages,
      premium,
      cleanSpecialClauses
    )

    const concernCandidatesCount = allConcernCandidates.length

    if (selectedConcernCandidate) {
      topicConcern = selectedConcernCandidate.concern
      topicConcernSearch = buildConcernSearchLabel(selectedConcernCandidate.concernSearch || selectedConcernCandidate.concern)
      worryPoint = buildWorryPointFromConcern(selectedConcernCandidate, worryPoint)
      sellingPoint = buildSellingPointFromConcern(selectedConcernCandidate, sellingPoint)
    }

    // 내부 구조어 금지: 최종 concern 텍스트에서 제거/우회
    const bannedPatterns = [
      /해약환급금미지급형/,
      /20년납/,
      /30년납/,
      /\b2종\b/,
      /\b1종\b/,
      /\b5N5\b/i,
      /무배당/,
      /세만기형/,
      /표준형/,
      /\bII\b/,
      /Ⅱ/,
      /\(\d{3,5}\)/,
    ]
    const hasBanned = (text: string) => bannedPatterns.some(p => p.test(text))
    if (topicConcern && hasBanned(topicConcern)) {
      topicConcern = '보험 구조보다는 실제로 어떤 보장을 얼마나 받는지가 더 중요해서 고민'
    }
    if (topicConcernSearch && hasBanned(topicConcernSearch)) {
      topicConcernSearch = '보장 구성이 내 상황에 맞는지 고민'
    }

    // 축(topicConcern/topicConcernSearch)에서만 구조어 제거. worryPoint/sellingPoint는 3단계 프롬프트에서 처음부터 뽑지 않도록 지시했으므로 후처리 없음
    topicConcern = scrubNoRefundStructureTerm(topicConcern)
    topicConcernSearch = scrubNoRefundStructureTerm(topicConcernSearch)

    // Evidence Map: 선택된 축(최종 topicConcern/worryPoint/sellingPoint) 기준으로 구성 — 질문/답변 생성이 핵심고민과 일치하도록
    if (premium) questionFacts.push(`월 보험료 ${premium}`)
    if (worryPoint) questionFacts.push(worryPoint)
    if (coverageEvidence.length > 0) questionFacts.push(`주요 보장: ${coverageEvidence.slice(0, 3).join(', ')}`)
    if (topicConcern) {
      const naturalConcern = translateToNatural(topicConcern)
      questionFacts.push(`핵심 고민: ${naturalConcern}`)
    }
    if (premium) answerFacts.push(`월 보험료 ${premium}`)
    if (sellingPoint) answerFacts.push(sellingPoint)
    coverageEvidence.forEach(ev => answerFacts.push(ev))
    if (cleanSpecialClauses.length > 0) {
      answerFacts.push(`특약: ${cleanSpecialClauses.slice(0, 5).map(c => translateToNatural(c)).join(', ')}`)
    }
    if (topicConcern) {
      const naturalConcern = translateToNatural(topicConcern)
      answerFacts.push(`concern 구조: ${naturalConcern}`)
    }
    // 설계서 공통: 질문/답변 본문에 해지·환급 구조 문구가 나오지 않도록 금지 (어떤 설계서든 중요한 포인트가 아님)
    forbiddenPatterns.push('중간에 해지하면 돌려받는 돈이 거의 없는')
    forbiddenPatterns.push('해지하면 돌려받는 돈이 없는 구조')
    forbiddenPatterns.push('중도에 해지하면 돌려받는 돈')

    const conflictAxis = buildConflictAxis(
      topicConcern || '',
      topicConcernSearch || ''
    )

    // ── internalConcern → customer-facing concern 후보군, market head, seed profile ──
    const detectProductGroup = (name: string): ProductGroup => {
      const lower = name.toLowerCase()
      if (/암|유사암|암보험/.test(lower) || name.includes('암')) return 'cancer'
      if (/실손|실비|의료비/.test(lower) || name.includes('실손')) return 'silsan'
      if (/간편|유병/.test(lower)) return 'simple'
      if (/종신|만기|연금/.test(lower) || name.includes('종신')) return 'jongsin'
      if (/자동차|운전자|차량/.test(lower) || name.includes('자동차')) return 'driver'
      if (/건강보험|상해보험|질병보험|3대질환|종합보험|어린이보험|자녀보험|건강/.test(lower)) return 'health'
      return 'other'
    }

    const productGroup: ProductGroup = detectProductGroup(normalizedProductName || topicData.cleanProductCore || rawProductName)
    const internalConcern = topicData.topicConcern || ''

    const upstreamByInternal = translateInternalConcernToCustomerCandidates({
      internalConcern,
      productGroup,
      targetPersona: analysisData.targetPersona || '',
      coverages: cleanCoverages,
    })

    const sanitizeCandidates = (candidates: string[]): string[] => {
      const cleaned = candidates
        .map((c) => sanitizeCustomerFacingKeyword(c) || '')
        .map((c) => c.trim())
        .filter((c) => c.length > 0 && !isInternalProductTerm(c))
        .map((c) => scrubNoRefundStructureTerm(c))
      const unique = Array.from(new Set(cleaned))
      return unique
    }

    let customerConcernCandidates = sanitizeCandidates(upstreamByInternal.customerConcernCandidates || [])

    // 고객형 후보군이 비었을 때만: 안전한 일반 고민 패밀리 기반 fallback
    if (customerConcernCandidates.length === 0) {
      const upstreamFallback = translateInternalConcernToCustomerCandidates({
        internalConcern: '',
        productGroup,
        targetPersona: analysisData.targetPersona || '',
        coverages: cleanCoverages,
      })
      customerConcernCandidates = sanitizeCandidates(upstreamFallback.customerConcernCandidates || [])
    }

    // 최종 길이 3~5개 맞추기 (있다면 최소 3개, 최대 5개)
    if (customerConcernCandidates.length > 5) {
      customerConcernCandidates = customerConcernCandidates.slice(0, 5)
    } else if (customerConcernCandidates.length > 0 && customerConcernCandidates.length < 3) {
      const upstreamGeneric = translateInternalConcernToCustomerCandidates({
        internalConcern: '',
        productGroup,
        targetPersona: analysisData.targetPersona || '',
        coverages: cleanCoverages,
      })
      const generic = sanitizeCandidates(upstreamGeneric.customerConcernCandidates || [])
      for (const g of generic) {
        if (!customerConcernCandidates.includes(g)) {
          customerConcernCandidates.push(g)
          if (customerConcernCandidates.length >= 3) break
        }
      }
      if (customerConcernCandidates.length > 5) {
        customerConcernCandidates = customerConcernCandidates.slice(0, 5)
      }
    }

    const recommendedMarketHead = MARKET_HEAD_BY_GROUP[productGroup] || MARKET_HEAD_BY_GROUP.other

    // 설계 초점 라벨: 담보 구성을 바탕으로 주제가 "상품명만"이 아니라 "무엇 보장 중심인지" 드러나도록
    const axisWeight: Record<KeyCoverageCategory, number> = {
      brain: 4, cancer: 3, heart: 3, surgery: 2, injury: 1, death: 1, disability: 1, other: 0,
    }
    const axisCounts: Record<KeyCoverageCategory, number> = {
      cancer: 0, brain: 0, heart: 0, surgery: 0, injury: 0, death: 0, disability: 0, other: 0,
    }
    for (const k of keyCoverages) {
      axisCounts[k.category] = (axisCounts[k.category] || 0) + 1
    }
    let mainAxisForLabel: KeyCoverageCategory | null = null
    let maxAxisScore = 0
    ;(Object.keys(axisCounts) as KeyCoverageCategory[]).forEach(cat => {
      const score = axisCounts[cat] * (axisWeight[cat] ?? 0)
      if (score > maxAxisScore) {
        maxAxisScore = score
        mainAxisForLabel = score > 0 ? cat : null
      }
    })
    const designFocusLabelMap: Record<KeyCoverageCategory, string> = {
      brain: '치매 보장 중심',
      cancer: '암 보장 중심',
      heart: '심장 보장 중심',
      surgery: '수술비 보장 중심',
      injury: '상해 보장 중심',
      death: '사망 보장 중심',
      disability: '장해 보장 중심',
      other: '',
    }
    const designFocusLabel = mainAxisForLabel ? (designFocusLabelMap[mainAxisForLabel] || '') : ''

    const keywordSeedProfile = {
      marketHead: recommendedMarketHead,
      productCore: topicData.cleanProductCore || normalizedProductName || '보험',
      personaLongtail: personaBucket || (analysisData.targetPersona || ''),
      intentHead: `${recommendedMarketHead} 보험료`,
      concernCandidates: customerConcernCandidates,
    }

    // 축 기반 검색: 분석 결과에서 축이 명확할 때만 브랜드+축으로 1~2회 검색, 결과 없으면 바로 포기
    let axisSearchSummary = ''
    const searchKeywordHintsValue: string[] = []
    const companyShortForSearch = (topicData.companyShort || '').trim()
    const axisLabel = (topicConcernSearch || topicConcern || '').trim()
    const axisClear = companyShortForSearch.length >= 2 && axisLabel.length >= 2

    if (axisClear) {
      const seen = new Set<string>()
      const axisResults: SearchResult[] = []
      const query1 = `${companyShortForSearch} ${axisLabel}`
      try {
        const res1 = await searchGoogle(query1, 5)
        customSearchCount++
        if (res1.success && res1.results.length > 0) {
          for (const r of res1.results) {
            if (r.link && !seen.has(r.link)) {
              seen.add(r.link)
              axisResults.push(r)
            }
          }
          searchKeywordHintsValue.push(query1)
        }
      } catch (e) {
        console.warn('[설계서 분석] 축 기반 검색 오류:', query1, e)
      }
      if (axisResults.length === 0 && keyCoverages.length > 0) {
        const firstCoverage = keyCoverages[0].normalizedName.replace(/\s+/g, ' ').trim().slice(0, 25)
        const query2 = `${companyShortForSearch} ${firstCoverage}`
        try {
          const res2 = await searchGoogle(query2, 5)
          customSearchCount++
          if (res2.success && res2.results.length > 0) {
            for (const r of res2.results) {
              if (r.link && !seen.has(r.link)) {
                seen.add(r.link)
                axisResults.push(r)
              }
            }
            searchKeywordHintsValue.push(query2)
          }
        } catch (e) {
          console.warn('[설계서 분석] 축 기반 검색(2) 오류:', query2, e)
        }
      }
      if (axisResults.length > 0) {
        axisSearchSummary = formatSearchResultsForPrompt(axisResults)
        console.log('[설계서 분석] 축 기반 검색 완료:', axisResults.length, '건, 쿼리 1~2회')
      } else {
        console.log('[설계서 분석] 축 기반 검색 결과 없음 → 포기')
      }
    } else {
      console.log('[설계서 분석] 축 미확정으로 검색 생략 (브랜드 또는 축 라벨 부족)')
    }

    return NextResponse.json({
      success: true,
      data: {
        productName: normalizedProductName,
        rawProductName: finalRawProductName,
        topicCore: topicData.cleanProductCore,
        topicConcern,
        topicConcernSearch,
        displayProductName: topicData.displayProductName,
        designFocusLabel: designFocusLabel || undefined,
        companyShort: topicData.companyShort,
        personaBucket,
        targetPersona: analysisData.targetPersona || '30대 직장인',
        worryPoint,
        sellingPoint,
        premium,
        coverages: cleanCoverages,
        specialClauses: cleanSpecialClauses,
        nameCorrection: correction.method !== 'none' ? {
          original: correction.original,
          corrected: correction.corrected,
          method: correction.method,
          confidence: correction.confidence,
        } : null,
        analysisSource: 'design_sheet',
        validatedProductName: validatedProductName,
        validationReason,
        validationConfidence,
        searchSummary: axisSearchSummary,
        searchKeywordHints: searchKeywordHintsValue.length > 0 ? searchKeywordHintsValue : (searchFriendlyName ? [`${searchFriendlyName} 후기`, `${searchFriendlyName} 특약`] : []),
        // ── 신규: Evidence Map (사실 잠금) ──
        evidenceMap: {
          questionFacts,
          answerFacts,
          forbiddenPatterns,
        },
        // ── 신규: Conflict Axis (갈등 축) ──
        conflictAxis,
        // ── 신규: concern/키워드 상류 정보 ──
        internalConcern: internalConcern || null,
        customerConcernCandidates,
        recommendedMarketHead,
        keywordSeedProfile,
        keyCoverages,
        keyCoveragesCount,
        selectedConcernSource: selectedConcernCandidate?.source || null,
        selectedConcernReason: selectedConcernCandidate?.reason || null,
        concernCandidatesCount,
      },
      usage: {
        customSearchCount: customSearchCount,
        customSearchCost: customSearchCount * 0.0005
      }
    })
  } catch (error: any) {
    console.error('설계서 분석 오류:', error)
    
    return NextResponse.json(
      { error: error.message || '설계서 분석 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

