/**
 * Customer Concern Engine
 *
 * 설계서에서 추출한 내부 신호(internal signals)를
 * - 고객 고민 후보군(concern candidates)
 * - 판매 포인트 family
 * 로 변환하는 중간 계층.
 *
 * A/B층(canonical, evidence, conflictAxis)은 건드리지 않고
 * C/D층에서만 사용한다.
 */

export type InternalSignalType =
  | 'refund_none'
  | 'long_payment'
  | 'maturity_fixed'
  | 'cancer_focus'
  | 'premium_low'
  | 'rider_complex'
  | 'coverage_narrow'
  | 'waiver_exists'
  | 'age_fit'
  | 'standard_compare_needed'

export interface InternalSignal {
  type: InternalSignalType
  weight: number
  source: string
}

export interface ExtractInternalSignalsOptions {
  productName?: string | null
  displayProductName?: string | null
  evidenceMap?: any
  coverages?: string[] | null
  specialClauses?: string[] | null
  premium?: number | null
  personaBucket?: string | null
  topicConcern?: string | null
  topicConcernSearch?: string | null
}

export interface ExtractInternalSignalsResult {
  signals: InternalSignal[]
}

export type ConcernFamily =
  | 'maintainability'
  | 'coverage_balance'
  | 'price_value'
  | 'fit_for_persona'
  | 'benefit_scope'
  | 'waiver_clarity'
  | 'comparison_need'
  | 'complexity_confusion'

export interface ConcernCandidate {
  id: string
  family: ConcernFamily
  publicLabel: string
  promptLabel: string
  weight: number
  reasons: string[]
}

export interface BuildConcernCandidatesOptions {
  signals: InternalSignal[]
  productName?: string | null
  displayProductName?: string | null
  personaBucket?: string | null
}

export interface BuildConcernCandidatesResult {
  candidates: ConcernCandidate[]
}

export interface RecentConcernHistoryItem {
  family: ConcernFamily
  publicLabel: string
}

export interface SelectDiverseConcernOptions {
  candidates: ConcernCandidate[]
  recentConcernHistory: RecentConcernHistoryItem[]
  productGroup?: string | null
  productName?: string | null
}

export interface SelectDiverseConcernResult {
  selectedConcern: ConcernCandidate | null
  backupConcern: ConcernCandidate | null
  diversityLog: string[]
}

export type SellingPointFamily =
  | 'affordability'
  | 'cancer_focus'
  | 'practical_balance'
  | 'long_term_value'
  | 'fit_for_age'
  | 'essential_only'
  | 'treatment_cost_focus'
  | 'waiver_help'

export interface SelectSellingPointFamilyOptions {
  signals: InternalSignal[]
  coverages?: string[] | null
  premium?: number | null
  personaBucket?: string | null
}

export interface SelectSellingPointFamilyResult {
  family: SellingPointFamily
  publicLabel: string
  angle: string
}

// ─────────────────────────────────────────────
// A. Internal signal 추출
// ─────────────────────────────────────────────

export function extractInternalSignals(options: ExtractInternalSignalsOptions): ExtractInternalSignalsResult {
  const {
    productName = '',
    displayProductName = '',
    evidenceMap,
    coverages = [],
    specialClauses = [],
    premium,
    personaBucket = '',
    topicConcern = '',
    topicConcernSearch = '',
  } = options || {}

  const textPool = [
    productName,
    displayProductName,
    ...(coverages || []),
    ...(specialClauses || []),
    topicConcern || '',
    topicConcernSearch || '',
  ]
    .filter(Boolean)
    .join(' ')

  const norm = textPool.replace(/\s+/g, ' ')

  const signals: InternalSignal[] = []

  const push = (type: InternalSignalType, weight: number, source: string) => {
    const existing = signals.find((s) => s.type === type)
    if (existing) {
      existing.weight = Math.max(existing.weight, weight)
      existing.source += `;${source}`
    } else {
      signals.push({ type, weight, source })
    }
  }

  // 환급 구조
  if (/해약환급금미지급형|무해약|순수보장형/.test(norm)) {
    push('refund_none', 0.9, 'productName/coverages')
  }

  // 납입/만기 구조
  if (/\d{2}년납|20년납|30년납|납입기간\s*\d+년/.test(norm)) {
    push('long_payment', 0.7, 'productName/clauses')
  }
  if (/세만기형|만기환급형|만기환급/.test(norm)) {
    push('maturity_fixed', 0.6, 'productName/clauses')
  }

  // 암 집중
  if (/암진단비|유사암진단비|일반암진단비|특정암진단비|항암방사선치료비|항암약물치료비/.test(norm)) {
    push('cancer_focus', 0.7, 'coverages')
  }

  // 보험료 수준 (대략적인 신호만)
  if (typeof premium === 'number') {
    if (premium <= 50000) push('premium_low', 0.6, 'premium')
  }

  // 특약 복잡도
  if ((coverages?.length || 0) + (specialClauses?.length || 0) >= 12) {
    push('rider_complex', 0.7, 'coverages/specialClauses')
  }

  // 보장 편중 (암 관련은 많은데 다른 진단/입원/수술이 거의 없는 경우 등)
  const hasCancer = /암진단비|유사암진단비|일반암진단비|특정암진단비/.test(norm)
  const hasNeuroCardio = /뇌혈관질환진단비|허혈성심장질환진단비|뇌졸중|심근경색/.test(norm)
  if (hasCancer && !hasNeuroCardio) {
    push('coverage_narrow', 0.6, 'coverage-balance')
  }

  // 납입면제
  if (/납입면제|보험료납입면제대상/.test(norm)) {
    push('waiver_exists', 0.6, 'specialClauses')
  }

  // 페르소나 적합성
  if (personaBucket) {
    push('age_fit', 0.5, 'personaBucket')
  }

  // 표준/비교 필요
  if (/간편심사|유병자|비갱신형|갱신형|실손의료비/.test(norm)) {
    push('standard_compare_needed', 0.5, 'structure')
  }

  // evidenceMap에서 암/3대질병 비중을 대략적으로 본다 (구조만 확인)
  if (evidenceMap && typeof evidenceMap === 'object') {
    const facts = [
      ...(Array.isArray(evidenceMap.questionFacts) ? evidenceMap.questionFacts : []),
      ...(Array.isArray(evidenceMap.answerFacts) ? evidenceMap.answerFacts : []),
    ]
      .map((f: any) => (typeof f?.text === 'string' ? f.text : ''))
      .join(' ')
    if (facts) {
      const n = facts.replace(/\s+/g, ' ')
      if (/암진단비|3대질병|암 치료비/.test(n) && !/실손의료비|입원일당/.test(n)) {
        push('cancer_focus', 0.8, 'evidenceMap')
        push('coverage_narrow', 0.7, 'evidenceMap')
      }
    }
  }

  return { signals }
}

// ─────────────────────────────────────────────
// B. 고객 고민 후보 생성
// ─────────────────────────────────────────────

export function buildConcernCandidates(options: BuildConcernCandidatesOptions): BuildConcernCandidatesResult {
  const { signals, personaBucket = '' } = options

  const byType = new Map<InternalSignalType, InternalSignal>()
  for (const s of signals) {
    const existing = byType.get(s.type)
    if (!existing || existing.weight < s.weight) {
      byType.set(s.type, s)
    }
  }

  const get = (type: InternalSignalType): number => byType.get(type)?.weight ?? 0

  const candidates: ConcernCandidate[] = []
  const push = (family: ConcernFamily, publicLabel: string, promptLabel: string, baseWeight: number, reasons: string[]) => {
    candidates.push({
      id: `${family}_${candidates.length}`,
      family,
      publicLabel,
      promptLabel,
      weight: baseWeight,
      reasons,
    })
  }

  // 유지 가능성 (maintainability)
  {
    const score = Math.max(get('refund_none'), get('long_payment'))
    if (score > 0) {
      push(
        'maintainability',
        '이 보험을 끝까지 유지해도 부담이 없는지',
        '계속 유지했을 때 중간에 그만두고 싶어질 만한 부담이 있는지',
        0.5 + score * 0.5,
        ['환급 구조', '납입 기간']
      )
    }
  }

  // 보장 밸런스 (coverage_balance)
  {
    const score = Math.max(get('cancer_focus'), get('coverage_narrow'))
    push(
      'coverage_balance',
      '암 쪽은 괜찮은데 다른 보장은 부족하지 않은지',
      '암 보장에 비해 다른 질병/사고 보장이 너무 약하지는 않은지',
      0.4 + score * 0.6,
      ['암 집중도', '다른 진단/입원 보장']
    )
  }

  // 가격 대비 가치 (price_value)
  {
    const score = get('premium_low')
    push(
      'price_value',
      '보험료가 싼 대신 빠지는 부분이 없는지',
      '월 보험료 수준에 비해 보장 구성이 실속 있는지',
      0.4 + score * 0.6,
      ['보험료 수준', '보장 범위']
    )
  }

  // 페르소나 적합성 (fit_for_persona)
  {
    const score = get('age_fit')
    if (personaBucket || score > 0) {
      push(
        'fit_for_persona',
        `${personaBucket || '내 상황'} 기준으로 이 구성이 실속 있는지`,
        '지금 나이/상황에서 이 구성으로 가는 것이 과하지도 부족하지도 않은지',
        0.3 + score * 0.7,
        ['타겟 페르소나', '연령/상황']
      )
    }
  }

  // 보장 범위/특약 이해도 (benefit_scope / complexity_confusion)
  {
    const complex = get('rider_complex')
    push(
      'benefit_scope',
      '보장 범위에 빈틈이 없는지',
      '자주 쓰일 보장이 빠져 있거나 겹치는 보장이 과하게 들어가 있지는 않은지',
      0.5,
      ['보장 범위', '담보 구성']
    )
    if (complex > 0) {
      push(
        'complexity_confusion',
        '특약이 복잡해서 놓치는 부분은 없는지',
        '특약 구조가 복잡해서 실제로 어떤 상황에서 얼마를 받는지 헷갈리지는 않는지',
        0.4 + complex * 0.6,
        ['특약 개수/구조']
      )
    }
  }

  // 납입면제 명확성 (waiver_clarity)
  {
    const waiver = get('waiver_exists')
    if (waiver > 0) {
      push(
        'waiver_clarity',
        '납입면제 조건이 실제로 어떻게 적용되는지',
        '어떤 상황에서 보험료 납입이 면제되는지, 현실적으로 적용받기 쉬운지',
        0.4 + waiver * 0.6,
        ['납입면제 특약']
      )
    }
  }

  // 일반형과 비교 필요성 (comparison_need)
  {
    const compare = get('standard_compare_needed')
    if (compare > 0) {
      push(
        'comparison_need',
        '비슷한 일반 건강보험과 비교해도 괜찮은지',
        '일반형/다른 회사 상품과 비교했을 때 이 구성이 유리한지',
        0.4 + compare * 0.6,
        ['간편심사/유병자/갱신 구조']
      )
    }
  }

  // 최소 6개 이상 유지: weight가 낮아도 보조 후보로 남겨둔다.
  // 가중치 정규화는 selector 단계에서 처리한다.
  return { candidates }
}

// ─────────────────────────────────────────────
// C. Concern 다양성 선택
// ─────────────────────────────────────────────

export function selectDiverseConcern(options: SelectDiverseConcernOptions): SelectDiverseConcernResult {
  const { candidates, recentConcernHistory = [] } = options
  const diversityLog: string[] = []

  if (!candidates || candidates.length === 0) {
    return { selectedConcern: null, backupConcern: null, diversityLog: ['no candidates'] }
  }

  const historyFamilies = recentConcernHistory.map((h) => h.family)
  const historyLabels = recentConcernHistory.map((h) => h.publicLabel)

  const familyCounts: Partial<Record<ConcernFamily, number>> = {}
  for (const f of historyFamilies) {
    familyCounts[f] = (familyCounts[f] || 0) + 1
  }

  function roughSimilarity(a: string, b: string): number {
    const ta = new Set(a.replace(/[^가-힣a-zA-Z0-9\s]/g, '').split(/\s+/).filter((t) => t.length > 1))
    const tb = new Set(b.replace(/[^가-힣a-zA-Z0-9\s]/g, '').split(/\s+/).filter((t) => t.length > 1))
    if (ta.size === 0 || tb.size === 0) return 0
    let inter = 0
    for (const t of ta) if (tb.has(t)) inter++
    const union = ta.size + tb.size - inter
    return union === 0 ? 0 : inter / union
  }

  const scored = candidates.map((c) => {
    let score = c.weight

    const repeatCount = familyCounts[c.family] || 0

    if (repeatCount >= 4) {
      score -= 0.3 // 최근 10개 중 같은 family 4회 이상이면 강한 패널티
      diversityLog.push(`family repeat penalty: ${c.family} x${repeatCount}`)
    } else if (repeatCount <= 2) {
      score += 0.05 // 최근 10개 중 2회 이하이면 소폭 보너스
    }

    // label 유사도 패널티
    let highSimCount = 0
    for (const past of historyLabels) {
      const sim = roughSimilarity(c.publicLabel, past)
      if (sim >= 0.7) highSimCount++
    }
    if (highSimCount >= 3) {
      score -= 0.25
      diversityLog.push(`label similarity penalty: "${c.publicLabel}" similar >=0.7 x${highSimCount}`)
    }

    // 최근 history에 없는 family면 보너스
    if (!historyFamilies.includes(c.family)) {
      score += 0.1
    }

    return { candidate: c, score }
  })

  scored.sort((a, b) => (b.score === a.score ? 0 : b.score - a.score))

  const selected = scored[0]?.candidate ?? null
  const backup = scored[1]?.candidate ?? null

  if (selected) {
    diversityLog.push(`selected: ${selected.family} / ${selected.publicLabel}`)
  }
  if (backup) {
    diversityLog.push(`backup: ${backup.family} / ${backup.publicLabel}`)
  }

  return { selectedConcern: selected, backupConcern: backup, diversityLog }
}

// ─────────────────────────────────────────────
// D. Selling Point family 선택
// ─────────────────────────────────────────────

export function selectSellingPointFamily(options: SelectSellingPointFamilyOptions): SelectSellingPointFamilyResult {
  const { signals, coverages = [], premium, personaBucket } = options

  const byType = new Map<InternalSignalType, InternalSignal>()
  for (const s of signals) {
    const existing = byType.get(s.type)
    if (!existing || existing.weight < s.weight) {
      byType.set(s.type, s)
    }
  }
  const get = (type: InternalSignalType): number => byType.get(type)?.weight ?? 0

  // 간단한 우선순위 매트릭스
  const cancerScore = get('cancer_focus')
  const refundScore = get('refund_none')
  const premiumScore = get('premium_low')
  const waiverScore = get('waiver_exists')
  const coverageNarrowScore = get('coverage_narrow')
  const ageScore = get('age_fit')

  const hasManyCoverages = (coverages?.length || 0) >= 10

  let family: SellingPointFamily = 'practical_balance'
  let publicLabel = '보장과 보험료를 함께 봤을 때 실속 있는 구성인지'
  let angle = '실속형 밸런스'

  if (cancerScore > 0.6 && coverageNarrowScore < 0.4) {
    family = 'cancer_focus'
    publicLabel = '암 치료비 대비에 집중한 구조인지'
    angle = '암 치료비 집중형'
  } else if (refundScore > 0.6 && premiumScore > 0.5) {
    family = 'affordability'
    publicLabel = '월 부담을 낮춰 가져가기 쉬운 구조인지'
    angle = '보험료 체감형'
  } else if (waiverScore > 0.5) {
    family = 'waiver_help'
    publicLabel = '아플 때 보험료를 안 내도 되는 안전장치가 얼마나 도움이 되는지'
    angle = '납입면제 안전장치형'
  } else if (coverageNarrowScore > 0.5 && hasManyCoverages) {
    family = 'essential_only'
    publicLabel = '자주 쓰일 보장 위주로만 깔끔하게 가져가는 구조인지'
    angle = '핵심보장 위주형'
  } else if (ageScore > 0.4 && personaBucket) {
    family = 'fit_for_age'
    publicLabel = `${personaBucket} 기준으로 과하지도 부족하지도 않은 구성인지`
    angle = '연령/상황 적합형'
  } else if (typeof premium === 'number' && premium > 70000) {
    family = 'long_term_value'
    publicLabel = '장기적으로 봤을 때 이 비용을 들일 만큼 가치가 있는지'
    angle = '장기 가치형'
  } else if (cancerScore > 0.3 && hasManyCoverages) {
    family = 'treatment_cost_focus'
    publicLabel = '실제 치료비 부담을 얼마나 줄여주는지'
    angle = '치료비 대비형'
  }

  return { family, publicLabel, angle }
}

