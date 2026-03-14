# Q&A 시스템 전체 레퍼런스 — Part 1-A: 라이브러리 유틸리티

> **이 문서는 Q&A 시스템에 사용되는 모든 코드·로직·프롬프트를 빠짐없이 수록합니다.**
> 총 3파트로 구성: Part 1-A (유틸 라이브러리) / Part 1-B (프롬프트) / Part 2 (API 라우트)

---

## 파일 목차

| # | 파일 | 줄 수 | 역할 |
|---|------|-------|------|
| 1 | `lib/insurance-terminology.ts` | 223 | 보험 내부 용어 → 생활형 번역, Evidence Map / Conflict Axis 빌더 |
| 2 | `lib/quality-gate.ts` | 332 | 필드별 로컬 품질 게이트 (제목·본문·답변·스레드) |
| 3 | `lib/title-family.ts` | 371 | Title Family 시스템 (12개 family, 채점, 도입 family) |
| 4 | `lib/topic-utils.ts` | 133 | 상품명 → 고객 검색형 주제 구조화 유틸 |

---

## 1. `lib/insurance-terminology.ts` (223줄)

```typescript
/**
 * 보험 내부 용어 → 생활형 번역 사전
 * 설계서/약관에 나오는 전문 표기를 카페 게시글에 맞는 자연어로 변환
 */

export interface TermEntry {
  internal: string
  natural: string
  context?: string
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
      const pattern = new RegExp(`\\s*${escapeRegex(entry.internal)}(?=[\\s,.]|[가-힣]|$)`, 'g')
      result = result.replace(pattern, '')
    }
  }

  return result.replace(/\s{2,}/g, ' ').trim()
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
```

---

## 2. `lib/quality-gate.ts` (332줄)

```typescript
/**
 * 필드별 로컬 품질 게이트
 * 모델에게 맡기지 않고 로컬 룰로 각 필드를 검증
 * 실패 시 해당 필드만 재생성하도록 호출측에 알림
 */

export interface GateResult {
  passed: boolean
  field: string
  failures: string[]
  score: number // 0~100
}

// ── 제목 게이트 ──
export function gateTitle(
  title: string,
  recentTitles?: string[],
  options?: { forbiddenPatterns?: string[] }
): GateResult {
  const failures: string[] = []
  let score = 100

  // 길이: 22~34자
  if (title.length < 22) {
    failures.push(`제목 너무 짧음: ${title.length}자 (최소 22자)`)
    score -= 20
  }
  if (title.length > 40) {
    failures.push(`제목 너무 김: ${title.length}자 (최대 40자)`)
    score -= 15
  }

  // 질문형 여부: 물음표 또는 의문형 종결어미
  const isQuestion = /[?？]/.test(title) || /[가나까]요\s*$/.test(title) || /인가요|인지|일까|할까|된건지|되나요|맞나요|건가요|인데요|할까요|좋을까/.test(title)
  if (!isQuestion) {
    failures.push('제목이 질문형이 아님')
    score -= 25
  }

  // 내부 표기 금지
  const internalPatterns = [
    /무배당/,
    /\(\d{3,5}\)/,
    /\bI{2,3}\b/,
    /[ⅠⅡⅢ]/,
    /\d+종\s/,
    /\(주\)/,
  ]
  if (options?.forbiddenPatterns) {
    for (const p of options.forbiddenPatterns) {
      if (p && title.includes(p)) {
        failures.push(`제목에 금지 패턴 포함: "${p}"`)
        score -= 15
      }
    }
  }
  for (const pat of internalPatterns) {
    if (pat.test(title)) {
      failures.push(`제목에 내부 표기 포함: ${pat}`)
      score -= 15
    }
  }

  // 마침표 금지
  if (/\.$/.test(title.trim())) {
    failures.push('제목이 마침표로 끝남')
    score -= 10
  }

  // 최근 제목 유사도 (간단한 자카드 유사도)
  if (recentTitles && recentTitles.length > 0) {
    const titleWords = new Set(title.replace(/[?？!~]/g, '').split(/\s+/).filter(w => w.length > 1))
    for (const recent of recentTitles.slice(0, 5)) {
      const recentWords = new Set(recent.replace(/[?？!~]/g, '').split(/\s+/).filter(w => w.length > 1))
      const intersection = [...titleWords].filter(w => recentWords.has(w))
      const union = new Set([...titleWords, ...recentWords])
      const similarity = union.size > 0 ? intersection.length / union.size : 0
      if (similarity > 0.6) {
        failures.push(`최근 제목과 유사도 ${(similarity * 100).toFixed(0)}% ("${recent.substring(0, 20)}...")`)
        score -= 20
        break
      }
    }
  }

  return { passed: failures.length === 0, field: 'title', failures, score: Math.max(0, score) }
}

// ── 질문 본문 게이트 ──
export function gateQuestionBody(
  body: string,
  options?: { forbiddenPatterns?: string[] }
): GateResult {
  const failures: string[] = []
  let score = 100

  if (body.length < 200) {
    failures.push(`본문 너무 짧음: ${body.length}자 (최소 200자)`)
    score -= 25
  }
  if (body.length > 700) {
    failures.push(`본문 너무 김: ${body.length}자 (최대 700자)`)
    score -= 10
  }

  const firstSentence = body.split(/[?？!!\n]/)[0] || ''
  const formalPatterns = [
    /합리적인 선택/,
    /검토 중입니다/,
    /장기 납입/,
    /예기치 않은/,
    /경제적 상황/,
    /포함되어 있습니다/,
    /보장이 구성되어/,
    /상품을 분석/,
  ]
  for (const pat of formalPatterns) {
    if (pat.test(firstSentence)) {
      failures.push(`첫 문장이 설계서 문체: "${firstSentence.substring(0, 40)}..."`)
      score -= 15
      break
    }
  }

  if (options?.forbiddenPatterns) {
    for (const p of options.forbiddenPatterns) {
      if (p && p.length > 1 && body.includes(p)) {
        failures.push(`본문에 금지 패턴 포함: "${p}"`)
        score -= 10
      }
    }
  }

  const periodCount = (body.match(/\.\s/g) || []).length + (body.match(/\.$/g) || []).length
  if (periodCount > 2) {
    failures.push(`마침표 과다 사용: ${periodCount}개`)
    score -= 10
  }

  const hasParagraphs = /\n\s*\n/.test(body)
  if (!hasParagraphs && body.length > 200) {
    failures.push('문단 구분 없음 (200자 이상인데 빈 줄이 없음)')
    score -= 10
  }

  return { passed: failures.length === 0, field: 'questionBody', failures, score: Math.max(0, score) }
}

// ── 답변 게이트 ──
export function gateAnswer(
  answer: string,
  options?: {
    conflictAxis?: { keywordNatural: string } | null
    forbiddenPatterns?: string[]
  }
): GateResult {
  const failures: string[] = []
  let score = 100

  if (answer.length < 280) {
    failures.push(`답변 너무 짧음: ${answer.length}자 (최소 300자)`)
    score -= 30
  }
  if (answer.length > 550) {
    failures.push(`답변 너무 김: ${answer.length}자 (최대 500자)`)
    score -= 10
  }

  const judgmentPatterns = [
    /자신이 있으면|자신 있으면/,
    /가능성이 있으면|경우라면|경우엔/,
    /유리|불리/,
    /장점|단점|약점/,
    /괜찮|아쉬|조심/,
    /유지.*자신|유지.*가능/,
    /해지.*가능성|해지.*경우/,
    /판단.*기준|기준.*판단/,
  ]
  const hasJudgment = judgmentPatterns.some(p => p.test(answer))
  if (!hasJudgment) {
    failures.push('답변에 판단문(판단 한 줄)이 없음')
    score -= 25
  }

  if (options?.conflictAxis?.keywordNatural) {
    const kw = options.conflictAxis.keywordNatural
    if (!answer.includes(kw) && !answer.includes(kw.replace(/\s+/g, ''))) {
      const kwParts = kw.split(/\s+/).filter(w => w.length > 1)
      const hasRelated = kwParts.some(part => answer.includes(part))
      if (!hasRelated) {
        failures.push(`답변에 갈등 축 키워드("${kw}") 관련 내용 없음`)
        score -= 15
      }
    }
  }

  if (options?.forbiddenPatterns) {
    for (const p of options.forbiddenPatterns) {
      if (p && p.length > 1 && answer.includes(p)) {
        failures.push(`답변에 금지 패턴 포함: "${p}"`)
        score -= 10
      }
    }
  }

  const formalWords = ['정리해드리면', '핵심은', '따라서', '검토해보세요', '고려하시면']
  for (const word of formalWords) {
    if (answer.includes(word)) {
      failures.push(`정리문체 표현 사용: "${word}"`)
      score -= 5
    }
  }

  const periodCount = (answer.match(/\.\s/g) || []).length + (answer.match(/\.$/g) || []).length
  if (periodCount > 3) {
    failures.push(`마침표 과다 사용: ${periodCount}개`)
    score -= 10
  }

  return { passed: failures.length === 0, field: 'answer', failures, score: Math.max(0, score) }
}

// ── 댓글 스레드 게이트 ──
export function gateThread(
  messages: Array<{ role: string; content: string }>,
  options?: { forbiddenPatterns?: string[] }
): GateResult {
  const failures: string[] = []
  let score = 100

  if (messages.length === 0) {
    return { passed: true, field: 'thread', failures: [], score: 100 }
  }

  for (let i = 0; i < messages.length; i++) {
    const expectedRole = i % 2 === 0 ? 'customer' : 'agent'
    if (messages[i].role !== expectedRole) {
      failures.push(`댓글 ${i + 1}: role 흐름 이상 (예상: ${expectedRole}, 실제: ${messages[i].role})`)
      score -= 20
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.content.length < 50) {
      failures.push(`댓글 ${i + 1}(${msg.role}): 너무 짧음 ${msg.content.length}자`)
      score -= 15
    }
    if (msg.content.length > 400) {
      failures.push(`댓글 ${i + 1}(${msg.role}): 너무 김 ${msg.content.length}자`)
      score -= 10
    }
  }

  const allText = messages.map(m => m.content).join(' ')
  const hasConcern = /걱정|고민|궁금|불안|환급금|보험료|보장|해지|유지/.test(allText)
  if (!hasConcern) {
    failures.push('스레드에서 concern 관련 내용 없음')
    score -= 15
  }

  if (options?.forbiddenPatterns) {
    for (const p of options.forbiddenPatterns) {
      if (p && p.length > 1 && allText.includes(p)) {
        failures.push(`스레드에 금지 패턴 포함: "${p}"`)
        score -= 10
      }
    }
  }

  return { passed: failures.length === 0, field: 'thread', failures, score: Math.max(0, score) }
}

// ── 전체 품질 점수 계산 ──
export function calculateOverallScore(gates: GateResult[]): {
  totalScore: number
  breakdown: Record<string, number>
  allPassed: boolean
  criticalFailures: string[]
} {
  const breakdown: Record<string, number> = {}
  const criticalFailures: string[] = []

  const weights: Record<string, number> = {
    title: 20,
    questionBody: 15,
    answer: 20,
    thread: 10,
  }

  let weightedSum = 0
  let totalWeight = 0

  for (const gate of gates) {
    const weight = weights[gate.field] || 5
    breakdown[gate.field] = gate.score
    weightedSum += gate.score * weight
    totalWeight += weight

    if (gate.score < 70) {
      criticalFailures.push(`${gate.field}: ${gate.score}점 — ${gate.failures.join(', ')}`)
    }
  }

  const totalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

  return {
    totalScore,
    breakdown,
    allPassed: criticalFailures.length === 0,
    criticalFailures,
  }
}
```

---

## 3. `lib/title-family.ts` (371줄)

```typescript
/**
 * Title Family 시스템
 * 3축 고정 출력 대신, 12개 family 중 매번 다른 패턴으로 제목을 분산 생성
 *
 * 원칙:
 *   - 3축(페르소나형/고민형/상품형)은 "평가 기준"으로만 사용
 *   - 최종 제목 포맷을 3개로 제한하지 않음
 *   - 제목 생성은 "여러 family 후보 생성 → 채점 → 선택"
 */

// ─── Title Family 정의 ───────────────────────────────

export interface TitleFamily {
  id: string
  name: string
  guide: string
  example: string
  weight: number
}

export const TITLE_FAMILIES: TitleFamily[] = [
  {
    id: 'worry_direct',
    name: '고민 직접형',
    guide: '핵심 고민을 직접 질문형으로 던진다. 상품명 또는 고민 키워드 1개 + 질문 종결',
    example: '환급금 없는 건강보험, 이대로 들어도 될까요',
    weight: 12,
  },
  {
    id: 'experience_ask',
    name: '경험 문의형',
    guide: '같은 상품/상황 경험자에게 물어보는 형태. "~해보신 분", "~드시나요" 같은 표현 사용',
    example: '이 상품 가입해보신 분들 계실까요',
    weight: 10,
  },
  {
    id: 'compare_hesitate',
    name: '비교 망설임형',
    guide: '두 가지 선택지 사이에서 갈팡질팡하는 톤. A랑 B 중 뭐가 나은지 묻는 구조',
    example: '일반 건강보험이랑 뭐가 더 나은 걸까요',
    weight: 8,
  },
  {
    id: 'design_review',
    name: '설계서 검토형',
    guide: '"설계서 받았는데" 로 시작하거나, 설계서 내용을 기반으로 검토를 요청하는 톤',
    example: '설계서 받았는데 이 정도면 무난한 편인가요',
    weight: 10,
  },
  {
    id: 'cost_feel',
    name: '비용 체감형',
    guide: '월 보험료 금액이나 비용 부담을 중심으로 질문. "월 ~원", "~만원대" 등 가격 표현 포함',
    example: '월 1만원대면 괜찮은 편인지 궁금해요',
    weight: 9,
  },
  {
    id: 'cancel_risk',
    name: '해지 리스크형',
    guide: '중간 해지, 환급금 손해, 유지 부담 등 해지 관련 불안을 중심으로 질문',
    example: '중간에 해지하면 손해가 너무 큰 구조일까요',
    weight: 9,
  },
  {
    id: 'coverage_interpret',
    name: '보장 해석형',
    guide: '특정 보장 항목이나 특약 문구의 실제 의미를 묻는 형태',
    example: '이 보장 문구는 실제로 어디까지 되는 걸까요',
    weight: 7,
  },
  {
    id: 'target_empathy',
    name: '타깃 공감형',
    guide: '연령대/성별 등 타깃을 명시하고, 같은 조건의 사람들에게 공감을 구하는 형태',
    example: '50대 여성 기준으로 이런 건강보험 많이 드시나요',
    weight: 10,
  },
  {
    id: 'fit_check',
    name: '가입 적합성형',
    guide: '"저 같은 조건이면", "제 경우엔" 등으로 자신의 상황에 맞는지 확인하는 형태',
    example: '저 같은 조건이면 이 상품이 맞는 걸까요',
    weight: 9,
  },
  {
    id: 'condition_verify',
    name: '조건 확인형',
    guide: '특정 조건(할인, 면제, 심사 등)의 실제 적용 여부를 구체적으로 묻는 형태',
    example: '건강할인 조건이 실제로 까다로운 편인가요',
    weight: 8,
  },
  {
    id: 'life_vent',
    name: '생활형 하소연형',
    guide: '보험이 어렵다, 헷갈린다는 생활형 하소연 톤. 가벼운 넋두리 + 질문',
    example: '보험은 어렵고 이건 더 헷갈리네요',
    weight: 7,
  },
  {
    id: 'final_check',
    name: '결정 직전형',
    guide: '거의 가입 직전이지만 마지막 확인을 하는 톤. "거의 가입하려는데", "마지막으로" 등',
    example: '거의 가입하려는데 마지막으로 체크할 게 있을까요',
    weight: 8,
  },
]

// ─── Family 샘플링 ───────────────────────────────

export function sampleFamilies(
  count: number,
  recentFamilyIds: string[] = []
): TitleFamily[] {
  const recentSet = new Set(recentFamilyIds)
  const pool = TITLE_FAMILIES.map(f => ({
    ...f,
    adjustedWeight: recentSet.has(f.id) ? f.weight * 0.3 : f.weight,
  }))

  const selected: TitleFamily[] = []
  const used = new Set<string>()

  for (let i = 0; i < count && pool.length > 0; i++) {
    const available = pool.filter(f => !used.has(f.id))
    if (available.length === 0) break

    const totalWeight = available.reduce((s, f) => s + f.adjustedWeight, 0)
    let rand = Math.random() * totalWeight
    let pick = available[0]
    for (const f of available) {
      rand -= f.adjustedWeight
      if (rand <= 0) { pick = f; break }
    }
    selected.push(pick)
    used.add(pick.id)
  }

  return selected
}

// ─── 제목 채점 (family 다양성 포함) ───────────────────

export interface TitleScoreInput {
  title: string
  familyId: string
  searchKeywords: string[]
  topicName: string
  rawProductName: string
  cleanProductCore?: string
  recentTitles?: string[]
  recentOpenings?: string[]
}

function wordJaccard(a: string, b: string): number {
  const wa = new Set(a.replace(/[?!,]/g, '').split(/\s+/).filter(w => w.length > 1))
  const wb = new Set(b.replace(/[?!,]/g, '').split(/\s+/).filter(w => w.length > 1))
  if (wa.size === 0 || wb.size === 0) return 0
  let inter = 0
  for (const w of wa) if (wb.has(w)) inter++
  return inter / (wa.size + wb.size - inter)
}

const normalizeForCompare = (s: string): string => s.replace(/\s+/g, '').toLowerCase()

export function scoreTitleCandidate(input: TitleScoreInput): { score: number; reasons: string[] } {
  const { title, searchKeywords, topicName, rawProductName, cleanProductCore, recentTitles, recentOpenings } = input
  let score = 0
  const reasons: string[] = []
  const titleNorm = normalizeForCompare(title)

  // A. 질문형 평가
  if (/까요|없나요|맞나요|어떤가요|인가요|될까요|할까요|일까요|좋을까요|괜찮을까요|아닌가요|건가요|던가요|드시나요|계실까요|싶어요|모르겠어요/.test(title)) {
    score += 25; reasons.push('+25 의문형 종결')
  } else if (/[?]/.test(title)) {
    score += 15; reasons.push('+15 물음표')
  }

  // B. 고민 포인트 평가
  if (/환급금|해지|해약|보험료|보장|납입면제|가입|적당|괜찮|부담|손해|유지|갱신|심사|고지/.test(title)) {
    score += 18; reasons.push('+18 고민어 포함')
  }

  // C. 핵심키워드 적절성 평가
  const kwMatches = searchKeywords.filter(kw => kw && titleNorm.includes(normalizeForCompare(kw)))
  if (kwMatches.length === 1 || kwMatches.length === 2) {
    score += 18; reasons.push(`+18 키워드 ${kwMatches.length}개 적절`)
  } else if (kwMatches.length >= 3) {
    score -= 15; reasons.push(`-15 키워드 ${kwMatches.length}개 과다`)
  }

  // D. 상품 개별성 평가
  if (cleanProductCore && cleanProductCore.length > 3 && titleNorm.includes(normalizeForCompare(cleanProductCore))) {
    score += 12; reasons.push('+12 상품명 포함')
  }

  // E. 타깃 페르소나 평가
  if (/\d+대\s*(남성|여성|남자|여자|남|여)/.test(title)) {
    score += 8; reasons.push('+8 페르소나 포함')
  }

  // F. 길이 평가
  if (title.length >= 18 && title.length <= 38) {
    score += 8; reasons.push('+8 적절 길이')
  } else if (title.length < 12 || title.length > 45) {
    score -= 10; reasons.push('-10 길이 부적절')
  }

  // G. 자연스러움
  if (!/[()]/.test(title) && !/(I{2,3}|Ⅱ|Ⅲ)/.test(title) && !/\d+\.\d+/.test(title)) {
    score += 5; reasons.push('+5 깔끔')
  }

  // H. 카페 생활형 표현 가산
  if (/이대로|이거|괜찮|어떤가요|될까요|진짜|좀|그냥|들어도|해도|맞는 건지|이 정도면/.test(title)) {
    score += 8; reasons.push('+8 카페 생활형')
  }

  // 감점: SEO/블로그형 표현
  if (/진짜\s*이유|완전\s*정리|총정리|꼭\s*알아야|반드시|놓치면|비교하세요|알아보니|꿀팁|필수|주목|추천해요|추천합니다/.test(title)) {
    score -= 30; reasons.push('-30 SEO/블로그형')
  }

  // 감점: 설명문형
  if (!/[?]/.test(title) && !/까요|나요|죠|가요|던데|어요|해요|싶어요|네요/.test(title)) {
    score -= 15; reasons.push('-15 설명문형')
  }

  // 감점: 정식 상품명 그대로
  if (rawProductName.length > 15 && title.includes(rawProductName)) {
    score -= 30; reasons.push('-30 raw상품명 노출')
  }

  // 감점: 인삿말/본문형
  if (/안녕하세요|글\s*남겨|언니들|가입했습니다/.test(title)) {
    score -= 40; reasons.push('-40 인삿말형')
  }

  // I. 최근 제목 중복 감점
  if (recentTitles && recentTitles.length > 0) {
    let maxSim = 0
    for (const rt of recentTitles) {
      const sim = wordJaccard(title, rt)
      if (sim > maxSim) maxSim = sim
    }
    if (maxSim >= 0.6) {
      score -= 25; reasons.push(`-25 최근 제목 유사도 ${(maxSim * 100).toFixed(0)}%`)
    } else if (maxSim >= 0.4) {
      score -= 12; reasons.push(`-12 최근 제목 유사도 ${(maxSim * 100).toFixed(0)}%`)
    }
  }

  return { score, reasons }
}

// ─── 본문 도입 Family (첫 2문장 다양화) ──────────────

export interface OpeningFamily {
  id: string
  name: string
  template: string
}

export const OPENING_FAMILIES: OpeningFamily[] = [
  { id: 'design_sheet', name: '설계서 기반', template: '설계서 받고 보험료 보니까 고민이 되더라고요' },
  { id: 'someone_said', name: '주변 소문형', template: '지인이 이 상품 가입했다길래 저도 알아보는 중인데요' },
  { id: 'online_search', name: '검색 중 발견형', template: '인터넷으로 이것저것 찾아보다가 이 상품이 눈에 들어왔어요' },
  { id: 'worry_start', name: '걱정 시작형', template: '요즘 건강 문제로 보험 알아보기 시작했는데요' },
  { id: 'agent_recommend', name: '설계사 추천형', template: '설계사분이 이걸 추천해주셨는데 제가 잘 몰라서요' },
  { id: 'comparison_stuck', name: '비교 중 막힘형', template: '여러 상품 비교하다가 머리가 복잡해져서 여기 물어봅니다' },
  { id: 'renewal_concern', name: '갱신 불안형', template: '기존 보험 갱신 시기가 다가오는데 갈아타야 하나 고민이에요' },
  { id: 'family_trigger', name: '가족 계기형', template: '가족이 아파서 보험 필요성을 느꼈는데요' },
  { id: 'budget_tight', name: '예산 고민형', template: '보험료가 부담이 되는데 이 정도면 적당한 건지 모르겠어요' },
  { id: 'almost_decided', name: '거의 결정형', template: '거의 가입하려고 하는데 마지막으로 한 가지만 더 확인하고 싶어요' },
]

export function pickOpeningFamily(recentOpeningIds: string[] = []): OpeningFamily {
  const recentSet = new Set(recentOpeningIds)
  const available = OPENING_FAMILIES.filter(o => !recentSet.has(o.id))
  const pool = available.length > 0 ? available : OPENING_FAMILIES
  return pool[Math.floor(Math.random() * pool.length)]
}

// ─── 제목 AI 프롬프트 빌더 ──────────────────────────

export interface TitlePromptInput {
  families: TitleFamily[]
  cleanProductCore: string
  topicConcern: string
  topicConcernSearch: string
  personaBucket: string
  searchKeywords: string[]
  worrySummary: string
  sellingSummary: string
  premiumInfo?: string
}

export function buildTitlePrompt(input: TitlePromptInput): string {
  const {
    families, cleanProductCore, topicConcern, topicConcernSearch,
    personaBucket, searchKeywords, worrySummary, sellingSummary, premiumInfo,
  } = input

  const familyBlock = families.map((f, i) =>
    `${i + 1}. [${f.name}] ${f.guide}\n   예시: "${f.example}"`
  ).join('\n')

  const hasBothConcerns = topicConcern && topicConcernSearch
  const concernMixGuide = hasBothConcerns
    ? `\n고민 표현 교차 사용 (다양성 확보):
- 내부 고민어: "${topicConcern}" (전문적, 예: "해약환급금미지급형 건강보험, 유지 괜찮을까요")
- 생활형 고민어: "${topicConcernSearch}" (쉬운 말, 예: "${topicConcernSearch}, 이거 괜찮은 건지")
- ${families.length}개 제목 중 절반은 내부 고민어를, 나머지는 생활형 고민어를 사용하세요
- 둘 다 안 쓰는 제목도 1~2개 있어야 합니다 (상품명+고민만으로 구성)`
    : ''

  return `너는 네이버 카페 보험 Q&A 게시판에서 실제 회원이 올리는 질문 제목을 만드는 전문가다

핵심 원칙:
- 아래 ${families.length}개 "제목 패밀리" 각각에 맞는 제목을 1개씩 생성한다 (총 ${families.length}개)
- 모든 제목은 카페 회원이 실제로 쓸 법한 "자연스러운 질문"이어야 한다
- 각 제목은 반드시 서로 다른 문장 구조와 어조를 가져야 한다
- 최소 ${Math.max(families.length - 2, 3)}개는 의문형(~까요, ~없나요, ~건가요, ~드시나요 등)이어야 한다
- 18~38자 사이를 권장한다
${concernMixGuide}

제목 패밀리 (각 패밀리별 1개씩 생성):
${familyBlock}

절대 금지:
- "진짜 이유", "완전정리", "꿀팁", "비교하세요", "추천합니다" 같은 블로그/SEO/광고형 표현
- 정식 상품명 전체 사용 (내부 코드, 괄호, 로마숫자, 무배당, (주) 등)
- 인삿말("안녕하세요"), 본문 첫 문장 스타일
- 마침표(.) 사용
- 같은 문장 뼈대 반복 ("~건강보험, ~할까요" 패턴만 반복하지 말 것)

입력 정보:
- 상품 핵심명: ${cleanProductCore}
- 상품 고민(내부): ${topicConcern || '없음'}
- 상품 고민(고객형): ${topicConcernSearch || '없음'}
- 타깃: ${personaBucket || '일반'}
- 핵심키워드: ${searchKeywords.join(', ')}
- 주요 걱정: ${worrySummary}
- 주요 장점: ${sellingSummary}
${premiumInfo ? `- 보험료: ${premiumInfo}` : ''}

출력 형식 (반드시 JSON만 출력, 다른 텍스트 없이):
{"titles":[${families.map((_, i) => `"제목${i + 1}"`).join(',')}]}`
}
```

---

## 4. `lib/topic-utils.ts` (133줄)

```typescript
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
```

---

> **다음 파트**: [Part 1-B: 프롬프트 시스템](./qa-system-part1-prompts.md) (`lib/prompts/qa-prompt.ts` 전체 1,737줄)
> **Part 2**: [API 라우트](./qa-system-part2-api.md) (`analyze-design-sheet/route.ts` + `generate-qa/route.ts`)
