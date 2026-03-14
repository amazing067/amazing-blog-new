/**
 * 필드별 로컬 품질 게이트
 * 모델에게 맡기지 않고 로컬 룰로 각 필드를 검증
 * 실패 시 해당 필드만 재생성하도록 호출측에 알림
 */

function tokenize(text: string): Set<string> {
  return new Set(text.replace(/[^가-힣a-zA-Z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 1))
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a)
  const setB = tokenize(b)
  if (setA.size === 0 && setB.size === 0) return 0
  let intersection = 0
  for (const token of setA) { if (setB.has(token)) intersection++ }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

function getFirstSentence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^.+?[.?!？！\n]/)
  return match ? match[0].trim() : trimmed.substring(0, 80)
}

export interface FirstSentences {
  questionFirst: string
  answerFirst: string
  customerCommentFirst: string
  agentCommentFirst: string
}

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

  // 길이: 200~600자
  if (body.length < 200) {
    failures.push(`본문 너무 짧음: ${body.length}자 (최소 200자)`)
    score -= 25
  }
  if (body.length > 700) {
    failures.push(`본문 너무 김: ${body.length}자 (최대 700자)`)
    score -= 10
  }

  // 첫 문장 생활형 여부: 설계서/약관/AI 문서 문체가 아닌지
  const firstSentence = body.split(/[?？!!\n]/)[0] || ''
  const formalPatterns = [
    /합리적인 선택/,
    /검토 중입니다/,
    /장기 납입/,
    /예기치 않은/,
    /예기치 못한/,
    /경제적 상황/,
    /포함되어 있습니다/,
    /보장이 구성되어/,
    /상품을 분석/,
    /경제적 부담을/,
    /효율적인 보장/,
    /상품 구성을/,
    /종합적으로 판단/,
    /가입을 검토/,
    /보장 내용을 살펴/,
    /최근 보험 시장/,
    /보험료 부담이 크/,
    /보험 가입을 고려/,
    /적절한 보장을 선택/,
  ]
  for (const pat of formalPatterns) {
    if (pat.test(firstSentence)) {
      failures.push(`첫 문장이 설계서 문체: "${firstSentence.substring(0, 40)}..."`)
      score -= 15
      break
    }
  }

  // 내부 표기 금지
  if (options?.forbiddenPatterns) {
    for (const p of options.forbiddenPatterns) {
      if (p && p.length > 1 && body.includes(p)) {
        failures.push(`본문에 금지 패턴 포함: "${p}"`)
        score -= 10
      }
    }
  }

  // 마침표 검사
  const periodCount = (body.match(/\.\s/g) || []).length + (body.match(/\.$/g) || []).length
  if (periodCount > 2) {
    failures.push(`마침표 과다 사용: ${periodCount}개`)
    score -= 10
  }

  // 문단 구분 확인 (최소 1개 빈 줄)
  const hasParagraphs = /\n\s*\n/.test(body)
  if (!hasParagraphs && body.length > 200) {
    failures.push('문단 구분 없음 (200자 이상인데 빈 줄이 없음)')
    score -= 10
  }

  // 느낌표 과다 사용 감점
  const exclamationCount = (body.match(/!/g) || []).length
  if (exclamationCount > 5) {
    failures.push(`느낌표 남발 (${exclamationCount}개)`)
    score -= 10
  } else if (exclamationCount > 3) {
    score -= 5
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

  // 길이: 300~500자
  if (answer.length < 280) {
    failures.push(`답변 너무 짧음: ${answer.length}자 (최소 300자)`)
    score -= 30
  }
  if (answer.length > 550) {
    failures.push(`답변 너무 김: ${answer.length}자 (최대 500자)`)
    score -= 10
  }

  // 판단문 존재 여부: conflictAxis 키워드 또는 판단형 표현이 있는지
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

  // conflict axis 반영 여부
  if (options?.conflictAxis?.keywordNatural) {
    const kw = options.conflictAxis.keywordNatural
    if (!answer.includes(kw) && !answer.includes(kw.replace(/\s+/g, ''))) {
      // 키워드 자체가 없더라도 관련 표현이 있는지 확인
      const kwParts = kw.split(/\s+/).filter(w => w.length > 1)
      const hasRelated = kwParts.some(part => answer.includes(part))
      if (!hasRelated) {
        failures.push(`답변에 갈등 축 키워드("${kw}") 관련 내용 없음`)
        score -= 15
      }
    }
  }

  // 금지 패턴
  if (options?.forbiddenPatterns) {
    for (const p of options.forbiddenPatterns) {
      if (p && p.length > 1 && answer.includes(p)) {
        failures.push(`답변에 금지 패턴 포함: "${p}"`)
        score -= 10
      }
    }
  }

  // 정리문체 금지
  const formalWords = ['정리해드리면', '핵심은', '따라서', '검토해보세요', '고려하시면']
  for (const word of formalWords) {
    if (answer.includes(word)) {
      failures.push(`정리문체 표현 사용: "${word}"`)
      score -= 5
    }
  }

  // 약관/설명서체 표현 감지
  const docStylePatterns = [
    /포함되어 있습니다/,
    /대비할 수 있습니다/,
    /구성되어 있습니다/,
    /마련되어 있습니다/,
    /제공되고 있습니다/,
    /보장이 됩니다/,
    /경제적 부담을 대비/,
    /예기치 못한 경제적/,
    /보장받으실 수 있습니다/,
  ]
  for (const pat of docStylePatterns) {
    if (pat.test(answer)) {
      failures.push(`약관/설명서체 표현: "${answer.match(pat)?.[0]}"`)
      score -= 5
      break
    }
  }

  // 역할 누수 감점
  const roleLeakagePatterns = [
    { pat: /\d{1,2}년\s*(이상\s*)?경력/, penalty: 20, desc: '경력 자기소개' },
    { pat: /전문가님/, penalty: 15, desc: '전문가님 호칭' },
    { pat: /설계사입니다/, penalty: 15, desc: '설계사 자기소개' },
    { pat: /비교\s*설계\s*(받아|한번|해보)/, penalty: 10, desc: '비교설계 유도' },
    { pat: /상담\s*(요청|문의|받아)/, penalty: 10, desc: '상담 유도' },
    { pat: /연락\s*주세요/, penalty: 10, desc: '연락 유도' },
    { pat: /문의\s*주세요/, penalty: 10, desc: '문의 유도' },
  ]
  const first120 = answer.substring(0, 120)
  for (const { pat, penalty, desc } of roleLeakagePatterns) {
    if (pat.test(first120)) {
      failures.push(`답변 서두 역할 누수: ${desc}`)
      score -= penalty
    } else if (pat.test(answer)) {
      failures.push(`답변 역할 누수: ${desc}`)
      score -= Math.max(5, penalty - 10)
    }
  }

  // 마침표 검사
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

  // role 흐름: customer → agent 교대
  for (let i = 0; i < messages.length; i++) {
    const expectedRole = i % 2 === 0 ? 'customer' : 'agent'
    if (messages[i].role !== expectedRole) {
      failures.push(`댓글 ${i + 1}: role 흐름 이상 (예상: ${expectedRole}, 실제: ${messages[i].role})`)
      score -= 20
    }
  }

  // 각 댓글 길이
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

  // concern 반영: 최소 1개 댓글에서 걱정/고민 관련 내용이 있어야
  const allText = messages.map(m => m.content).join(' ')
  const hasConcern = /걱정|고민|궁금|불안|환급금|보험료|보장|해지|유지/.test(allText)
  if (!hasConcern) {
    failures.push('스레드에서 concern 관련 내용 없음')
    score -= 15
  }

  // 금지 패턴
  if (options?.forbiddenPatterns) {
    for (const p of options.forbiddenPatterns) {
      if (p && p.length > 1 && allText.includes(p)) {
        failures.push(`스레드에 금지 패턴 포함: "${p}"`)
        score -= 10
      }
    }
  }

  // 마지막 agent 댓글 영업성 감점
  const lastAgent = messages.filter(m => m.role === 'agent').pop()
  if (lastAgent) {
    const salesPatterns = [/비교\s*설계/, /상담\s*받아/, /문의\s*주/, /연락\s*주/, /설계사\s*(만나|찾아)/, /설계\s*(다시|받아)/]
    for (const pat of salesPatterns) {
      if (pat.test(lastAgent.content)) {
        failures.push(`마지막 agent 댓글 영업성: "${lastAgent.content.match(pat)?.[0]}"`)
        score -= 10
        break
      }
    }
  }

  return { passed: failures.length === 0, field: 'thread', failures, score: Math.max(0, score) }
}

// ── 인간미 점수 게이트 ──
export function gateHumanLikeness(
  title: string,
  questionBody: string,
  answer: string,
  thread: Array<{ role: string; content: string }>,
  recentFirstSentences?: FirstSentences[]
): GateResult {
  const failures: string[] = []
  let score = 100

  // 1. 답변 첫 문장이 자기소개형이면 강한 감점
  const answerFirst = answer.split(/[?？!!\n]/)[0] || ''
  if (/\d{1,2}년.*경력|전문가입니다|설계사입니다/.test(answerFirst)) {
    failures.push('답변 서두에 자기소개/경력 자랑')
    score -= 25
  }

  // 2. 전체적으로 CTA가 과도한지
  const allText = `${answer} ${thread.map(m => m.content).join(' ')}`
  const ctaCount = (allText.match(/연락|문의|상담|쪽지|비교\s*설계|오픈카톡/g) || []).length
  if (ctaCount >= 4) {
    failures.push(`CTA 과다 (${ctaCount}회)`)
    score -= 15
  } else if (ctaCount >= 2) {
    failures.push(`CTA 다소 많음 (${ctaCount}회)`)
    score -= 5
  }

  // 3. 정리문체 밀도
  const formalCount = (allText.match(/정리해드리면|핵심은|따라서|검토해보세요|고려하시면|포함되어 있습니다|대비할 수 있습니다|구성되어 있습니다/g) || []).length
  if (formalCount >= 3) {
    failures.push(`정리/약관 문체 과다 (${formalCount}회)`)
    score -= 15
  } else if (formalCount >= 1) {
    score -= 5
  }

  // 4. 역할 누수 (전문가님, 나- 등)
  if (/전문가님|나[-~]\s*전문가님/.test(allText)) {
    failures.push('역할 누수: 전문가님 호칭')
    score -= 20
  }

  // 5. 첫 문장 유사도 검사 (최근 결과물 대비)
  if (recentFirstSentences && recentFirstSentences.length > 0) {
    const currentFirstSentences: FirstSentences = {
      questionFirst: getFirstSentence(questionBody),
      answerFirst: getFirstSentence(answer),
      customerCommentFirst: getFirstSentence(thread.find(m => m.role === 'customer')?.content || ''),
      agentCommentFirst: getFirstSentence(thread.find(m => m.role === 'agent')?.content || ''),
    }

    const fields: (keyof FirstSentences)[] = ['questionFirst', 'answerFirst', 'customerCommentFirst', 'agentCommentFirst']
    const fieldLabels: Record<keyof FirstSentences, string> = {
      questionFirst: '질문 첫 문장',
      answerFirst: '답변 첫 문장',
      customerCommentFirst: '첫 고객 댓글',
      agentCommentFirst: '첫 설계사 댓글',
    }

    let maxSim = 0
    let maxSimField = ''

    for (const recent of recentFirstSentences) {
      for (const field of fields) {
        const current = currentFirstSentences[field]
        const prev = recent[field]
        if (current && prev && current.length > 5 && prev.length > 5) {
          const sim = jaccardSimilarity(current, prev)
          if (sim > maxSim) {
            maxSim = sim
            maxSimField = fieldLabels[field]
          }
        }
      }
    }

    if (maxSim >= 0.6) {
      failures.push(`${maxSimField} 유사도 ${Math.round(maxSim * 100)}% (강한 반복)`)
      score -= 20
      console.log(`[품질게이트] firstSentenceSimilarity: ${maxSimField} = ${Math.round(maxSim * 100)}% (강한 감점 -20)`)
    } else if (maxSim >= 0.4) {
      failures.push(`${maxSimField} 유사도 ${Math.round(maxSim * 100)}% (약한 반복)`)
      score -= 10
      console.log(`[품질게이트] firstSentenceSimilarity: ${maxSimField} = ${Math.round(maxSim * 100)}% (약한 감점 -10)`)
    } else {
      console.log(`[품질게이트] firstSentenceSimilarity: 최대 ${Math.round(maxSim * 100)}% — 통과`)
    }
  }

  return { passed: failures.length === 0, field: 'humanLikeness', failures, score: Math.max(0, score) }
}

// ── Evidence 일관성 게이트 ──
export function gateEvidenceConsistency(
  answer: string,
  thread: Array<{ role: string; content: string }>,
  options?: { answerFacts?: string[]; forbiddenPatterns?: string[] }
): GateResult {
  const failures: string[] = []
  let score = 100

  const agentTexts = thread.filter(m => m.role === 'agent').map(m => m.content).join(' ')
  const allAnswerText = `${answer} ${agentTexts}`

  // evidence에 없는 단정적 표현 감지
  const assertivePatterns = [
    /반드시\s*\d+만원/,
    /\d+%\s*할인/,
    /비흡연자?\s*할인/,
    /\d+세까지\s*보장/,
    /비갱신형/,
  ]

  if (options?.answerFacts) {
    const factsJoined = options.answerFacts.join(' ')
    for (const pat of assertivePatterns) {
      const match = allAnswerText.match(pat)
      if (match && !factsJoined.includes(match[0].replace(/\s+/g, ''))) {
        failures.push(`Evidence 밖 단정: "${match[0]}"`)
        score -= 10
      }
    }
  }

  // 금지 패턴 재확인
  if (options?.forbiddenPatterns) {
    for (const p of options.forbiddenPatterns) {
      if (p && p.length > 1 && allAnswerText.includes(p)) {
        failures.push(`금지 패턴 잔존: "${p}"`)
        score -= 10
      }
    }
  }

  return { passed: failures.length === 0, field: 'evidenceConsistency', failures, score: Math.max(0, score) }
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
    title: 15,
    questionBody: 12,
    answer: 18,
    thread: 10,
    humanLikeness: 15,
    evidenceConsistency: 20,
  }

  let weightedSum = 0
  let totalWeight = 0

  for (const gate of gates) {
    const weight = weights[gate.field] || 5
    breakdown[gate.field] = gate.score
    weightedSum += gate.score * weight
    totalWeight += weight

    // 70점 미만이면 critical
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
