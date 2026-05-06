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

export type FailureTag =
  | 'title_too_short' | 'title_too_long' | 'title_blog_style' | 'title_internal_code'
  | 'body_no_paragraph' | 'body_formal_tone' | 'body_too_short' | 'body_too_long' | 'body_exclamation'
  | 'answer_role_leakage' | 'answer_no_judgment' | 'answer_doc_style' | 'answer_too_short' | 'answer_too_long'
  | 'thread_sales_ending' | 'thread_role_break' | 'thread_too_short' | 'thread_too_long'
  | 'human_self_intro' | 'human_excessive_cta' | 'human_first_sentence_repeat' | 'human_formal_tone' | 'human_role_leakage'
  | 'evidence_outside_facts' | 'evidence_forbidden_pattern'
  | 'keyword_missing' | 'keyword_overweight' | 'keyword_zero_volume' | 'keyword_no_title'
  | 'internal_keyword_leak' | 'internal_concern_lock' | 'market_head_missing' | 'market_head_not_big_keyword' | 'customer_concern_missing'
  | 'operational_regen_no_improvement' | 'operational_family_repeat' | 'operational_first_sentence_repeat' | 'operational_no_analysis'
  | 'operational_final_agent_ending_missing' | 'thread_empty'
  | 'uncategorized_warning'

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
    /참고하시기 바랍니다/,
    /안내드립니다/,
    /확인하시면 됩니다/,
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

  // 문단 중복: 같은/거의 같은 문단 반복
  const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 20)
  for (let i = 0; i < paragraphs.length; i++) {
    for (let j = i + 1; j < paragraphs.length; j++) {
      if (jaccardSimilarity(paragraphs[i], paragraphs[j]) >= 0.75) {
        failures.push(`문단 중복 (${i + 1}번째와 ${j + 1}번째 유사도 높음)`)
        score -= 10
        break
      }
    }
    if (failures.some(f => f.includes('문단 중복'))) break
  }
  // 같은 문장 2회 이상 반복
  const sentences = body.split(/(?<=[.?!？！\n])\s+/).map(s => s.trim()).filter(s => s.length > 15)
  const seen = new Map<string, number>()
  for (const s of sentences) {
    const key = s.replace(/\s+/g, ' ')
    const count = (seen.get(key) || 0) + 1
    seen.set(key, count)
    if (count >= 2) {
      failures.push('같은 문장 반복 2회 이상')
      score -= 10
      break
    }
  }

  // 느낌표/ㅠㅠ 과다
  const exclamationCount = (body.match(/!/g) || []).length
  const cryCount = (body.match(/ㅠ|ㅜ|ㅡ/g) || []).length
  if (exclamationCount > 5) {
    failures.push(`느낌표 남발 (${exclamationCount}개)`)
    score -= 10
  } else if (exclamationCount > 3) {
    failures.push(`느낌표 남발 (${exclamationCount}개)`)
    score -= 5
  }
  if (cryCount > 3) {
    failures.push(`ㅠㅠ/ㅜㅜ 과다 (${cryCount}개)`)
    score -= 5
  }

  // 접미 반복: 요요, 습니다요, 네요요
  if (/요\s*요\b|습니다\s*요\b|네요\s*요\b/.test(body)) {
    failures.push('접미 반복 (요요/습니다요/네요요)')
    score -= 10
  }

  // 감탄 과밀 + 정보 밀도 부족: 느낌표+감탄사 비율이 높고 문장 수 대비 길이 부족
  const sentenceCount = (body.match(/[.?!？！]\s+/g) || []).length + (body.match(/[.?!？！]$/) ? 1 : 0) || 1
  const exclamationRatio = exclamationCount / Math.max(1, sentenceCount)
  if (exclamationRatio > 0.5 && body.length < 400) {
    failures.push('감탄 과밀·정보 밀도 부족')
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

  // 길이: 280~550자 (실제 임계값과 메시지 일치)
  if (answer.length < 280) {
    failures.push(`답변 너무 짧음: ${answer.length}자 (최소 280자)`)
    score -= 30
  }
  if (answer.length > 550) {
    failures.push(`답변 너무 김: ${answer.length}자 (최대 550자)`)
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
  const formalWords = ['정리해드리면', '핵심은', '따라서', '검토해보세요', '고려하시면', '참고하시기 바랍니다', '안내드립니다']
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
    /참고하시기 바랍니다/,
    /확인하시면 됩니다/,
  ]
  for (const pat of docStylePatterns) {
    if (pat.test(answer)) {
      failures.push(`약관/설명서체 표현: "${answer.match(pat)?.[0]}"`)
      score -= 5
      break
    }
  }

  // 역할 누수 감점
  // 역할 누수: 자작글 톤을 깨는 자기소개/호칭만 감점. 연락·문의·비교설계 등 CTA는 영업 목적상 감점하지 않음.
  const roleLeakagePatterns = [
    { pat: /\d{1,2}년\s*(이상\s*)?경력/, penalty: 20, desc: '경력 자기소개' },
    { pat: /전문가님/, penalty: 15, desc: '전문가님 호칭' },
    { pat: /설계사입니다/, penalty: 15, desc: '설계사 자기소개' },
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

  // ── 4블록 흐름 검사: 판단 한 줄이 답변 앞부분(처음 75%)에 등장하는지 ──
  // 임계값과 감점을 약화 (이전 60%/-5 → 75%/-2): 너무 엄격하면 답변 재생성 빈도 ↑
  const judgmentEarlyPatterns = [
    /자신.*있으면|자신.*없으면/,
    /유리.*불리|불리.*유리/,
    /유지.*가능|유지.*자신/,
    /이건.*괜찮|이건.*부담|이건.*조심/,
    /이 상품.*맞|이 상품.*안 맞/,
    /본인.*상황|상황.*맞/,
    /핵심|관건/,
  ]
  const answerLen = answer.length
  if (answerLen >= 200) {
    const firstPortion = answer.substring(0, Math.floor(answerLen * 0.75))
    const judgmentInFirst = judgmentEarlyPatterns.some(p => p.test(firstPortion))
    if (hasJudgment && !judgmentInFirst) {
      failures.push('판단 한 줄이 답변 후반부에 위치 (앞 75% 안에 등장 권장)')
      score -= 2 // 매우 가벼운 감점 (재생성 트리거 방지)
    }
  }

  // ── AI 티 검출: "결론적으로", "종합적으로" 같은 AI 특유 표현 ──
  const aiPhrasePatterns = [
    /결론적으로/,
    /종합적으로/,
    /전반적으로/,
    /다양한 관점에서/,
    /여러 측면에서/,
    /신중히 고려/,
    /꼼꼼히 검토/,
    /다음과 같이/,
    /아래와 같이/,
    /이러한 측면/,
    /이런 부분에서/,
    // 추가: 답변 본문에서 AI가 자주 만드는 분석체 표현 (12회 테스트에서 발견)
    /[가-힣]+가 핵심 고민이신 것 같아요/,  // "이대로 가입해도 될까요가 핵심 고민이신 것 같아요"
    /본인 상황에 맞으면 유리하지만 아니면 부담/,  // 정형 패턴 (12회 중 거의 모두)
    /유리한데 아니면 부담/,
    /맞으면 유리하고 안 맞으면 부담/,
  ]
  for (const p of aiPhrasePatterns) {
    if (p.test(answer)) {
      failures.push(`AI 티 표현 사용: "${answer.match(p)?.[0]}"`)
      score -= 5
      break
    }
  }

  // ── 광고심의·과장 표현 검출 (카페 Q&A는 심의 의무 없지만 과장 표현은 신뢰도 저하) ──
  const exaggerationPatterns = [
    /\b1위\b/,
    /제일\s*저렴/,
    /최저가/,
    /단연.*최고/,
    /무조건\s*좋/,
    /100%\s*보장/,
    /절대\s*손해.*없/,
  ]
  for (const p of exaggerationPatterns) {
    if (p.test(answer)) {
      failures.push(`과장 표현 사용: "${answer.match(p)?.[0]}"`)
      score -= 8
      break
    }
  }

  return { passed: failures.length === 0, field: 'answer', failures, score: Math.max(0, score) }
}

// ── 댓글 스레드 게이트 ──
export function gateThread(
  messages: Array<{ role: string; content: string; step?: number }>,
  options?: { forbiddenPatterns?: string[] }
): GateResult {
  const failures: string[] = []
  let score = 100

  if (messages.length === 0) {
    return { passed: false, field: 'thread', failures: ['스레드 없음 (빈 배열)'], score: 0 }
  }

  // role 흐름: customer → agent 교대
  // 후기성 댓글(step >= 1999)은 마지막 agent 직후에 customer로 끼어들도록 설계됐기 때문에
  // 교대 검증에서 제외한다. 안 그러면 customer-customer 연속이 발생해 thread_role_break (30일 43건) 오탐.
  const conversationOnly = messages.filter(m => m.step == null || m.step < 1999)
  for (let i = 0; i < conversationOnly.length; i++) {
    const expectedRole = i % 2 === 0 ? 'customer' : 'agent'
    if (conversationOnly[i].role !== expectedRole) {
      failures.push(`댓글 ${i + 1}: role 흐름 이상 (예상: ${expectedRole}, 실제: ${conversationOnly[i].role})`)
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

  // 마지막 agent 댓글: 연락·문의·비교설계 등 CTA는 카페 Q&A 유입·전환 목적이므로 영업성으로 감점하지 않음.

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

  // 2. CTA: 유입·전환이 목적이므로 과도한 경우(6회 이상)만 감점. 2~5회는 허용.
  const allText = `${answer} ${thread.map(m => m.content).join(' ')}`
  const ctaCount = (allText.match(/연락|문의|상담|쪽지|비교\s*설계|오픈카톡/g) || []).length
  if (ctaCount >= 6) {
    failures.push(`CTA 과다 (${ctaCount}회)`)
    score -= 10
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

  // 4-1. 세션 내 자가 유사도 (질문 첫 줄 ↔ 답변 첫 줄 ↔ 첫 댓글 첫 줄)
  // 같은 글 안에서 첫 문장이 너무 비슷하면 단조로움
  {
    const qFirst = getFirstSentence(questionBody)
    const aFirst = getFirstSentence(answer)
    const cFirst = getFirstSentence(thread.find(m => m.role === 'customer')?.content || '')
    const pairs: Array<[string, string, string]> = []
    if (qFirst.length > 5 && aFirst.length > 5) pairs.push(['질문↔답변', qFirst, aFirst])
    if (qFirst.length > 5 && cFirst.length > 5) pairs.push(['질문↔첫댓글', qFirst, cFirst])
    if (aFirst.length > 5 && cFirst.length > 5) pairs.push(['답변↔첫댓글', aFirst, cFirst])

    let intraMaxSim = 0
    let intraMaxLabel = ''
    for (const [label, a, b] of pairs) {
      const sim = jaccardSimilarity(a, b)
      if (sim > intraMaxSim) {
        intraMaxSim = sim
        intraMaxLabel = label
      }
    }
    if (intraMaxSim >= 0.55) {
      failures.push(`세션 내 ${intraMaxLabel} 첫 문장 유사도 ${Math.round(intraMaxSim * 100)}% (단조로움)`)
      score -= 10
    }
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

  // evidence에 없는 단정적 표현 감지.
  // "비갱신형"은 일반 상품 구조 표기라 단독 등장만으로는 단정 아님 (false positive 30일 33건).
  // → "비갱신형이라 보험료 안 오른다" 같은 약속/보장 단정 결합형만 잡는다.
  const assertivePatterns = [
    /반드시\s*\d+만원/,
    /\d+%\s*할인/,
    /비흡연자?\s*할인/,
    /\d+세까지\s*보장/,
    /비갱신형(?:이라|이고|이니|이며|이어서)?\s*[^.]{0,40}?(?:보험료|가격|금액)\s*[^.]{0,15}?(?:안\s*오|변하지\s*않|동결|평생|영구)/,
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

// ── 키워드 건강 게이트 ──
export type DisplayKeywordSlot = {
  keyword: string
  volume: number | null
  role: 'market_head' | 'product_core' | 'concern_search' | 'customer_concern' | 'persona_longtail' | 'intent_head'
}

export function gateKeywordHealth(
  searchKeywords: string[] | undefined,
  title: string,
  body: string,
  searchKeywordsWithVolume?: Array<{ keyword: string; volume: number | null }>,
  topicConcern?: string,
  options?: {
    displayKeywords?: DisplayKeywordSlot[]
    marketHeadKeyword?: { keyword: string; volume: number | null; source?: string } | null
    /** 설계서 모드: 검색량 미확인만 있을 때 감점 완화(경고만, 통과 처리) */
    designSheetMode?: boolean
    /** concern 일치 판정용 후보(전체 topicConcernSearch + 짧은 표시문 등). 있으면 하나라도 키워드와 맞으면 통과 */
    concernMatchCandidates?: string[]
  }
): GateResult {
  const failures: string[] = []
  let score = 100

  if (!searchKeywords || searchKeywords.length === 0) {
    failures.push('검색 키워드 없음')
    score -= 30
    return { passed: false, field: 'keywordHealth', failures, score: Math.max(0, score) }
  }

  const kwInTitle = searchKeywords.filter(kw => title.includes(kw)).length
  if (kwInTitle === 0) {
    failures.push('제목에 키워드 미포함')
    score -= 15
  }
  if (kwInTitle >= 3) {
    failures.push(`제목 키워드 과밀 (${kwInTitle}개)`)
    score -= 20
  }

  if (searchKeywordsWithVolume && searchKeywordsWithVolume.length > 0) {
    const allZero = searchKeywordsWithVolume.every(kw => kw.volume === 0 || kw.volume === null)
    if (allZero) {
      failures.push('모든 키워드 검색량 0 또는 미확인')
      score -= 10
    }
  }

  const concernCandidates: string[] = []
  if (options?.concernMatchCandidates?.length) {
    for (const c of options.concernMatchCandidates) {
      const t = (c || '').trim()
      if (t) concernCandidates.push(t)
    }
  }
  if (concernCandidates.length === 0 && topicConcern?.trim()) {
    concernCandidates.push(topicConcern.trim())
  }

  if (concernCandidates.length > 0) {
    const concernInKeywords = concernCandidates.some((c) =>
      searchKeywords.some((kw) => kw.includes(c) || c.includes(kw))
    )
    if (!concernInKeywords) {
      failures.push(`concern 키워드("${concernCandidates[0]}") 미포함`)
      score -= 10
    } else {
      const primaryConcern = concernCandidates.reduce((a, b) => (b.length > a.length ? b : a), concernCandidates[0])
      const combined = `${title} ${body}`
      const normConcern = primaryConcern.replace(/\s+/g, '')
      if (normConcern.length > 0) {
        const occur = (combined.match(new RegExp(normConcern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        if (occur >= 3) {
          failures.push(`concern 표현 과다 반복 (${occur}회 이상)`)
          score -= 5
        }
      }
    }
  }

  // displayKeywords 5칸 구조 + marketHeadKeyword 표시용 건전성 (options 있을 때만)
  if (options?.displayKeywords) {
    const displayKeywords = options.displayKeywords
    const hasMarketHead = displayKeywords.some(d => d.role === 'market_head' && d.keyword?.trim())
    const hasProductCore = displayKeywords.some(d => d.role === 'product_core' && d.keyword?.trim())
    const hasCustomerConcern =
      displayKeywords.some(d => d.role === 'customer_concern' && d.keyword?.trim()) ||
      displayKeywords.some(d => d.role === 'concern_search' && d.keyword?.trim())
    const hasPersonaLongtail = displayKeywords.some(d => d.role === 'persona_longtail' && d.keyword?.trim())
    const hasIntentHead = displayKeywords.some(d => d.role === 'intent_head' && d.keyword?.trim())

    const hasFiveSlots = displayKeywords.length === 5 && hasMarketHead && hasProductCore && hasCustomerConcern && hasPersonaLongtail && hasIntentHead

    if (!hasFiveSlots) {
      failures.push('displayKeywords 5칸 역할 구조 미완성')
      score -= 15
    }

    // 고객형 키워드 계층에서 내부 구조어 유출 감지
    const internalPatterns = [
      /해약환급금미지급형/,
      /세만기형/,
      /\d+년납/,
      /\d+종/,
      /\b\d+N\d+\b/,
      /I{1,3}\b/,
      /[ⅠⅡⅢ]/,
      /\(\d{3,4}\)/,
    ]
    const customerFacingSlots = displayKeywords.filter(d =>
      (d.role === 'market_head' || d.role === 'product_core' || d.role === 'customer_concern' || d.role === 'concern_search') &&
      d.keyword?.trim()
    )
    const hasInternalInDisplay = customerFacingSlots.some(slot =>
      internalPatterns.some(p => p.test(slot.keyword))
    )
    if (hasInternalInDisplay) {
      failures.push('displayKeywords에 내부 구조어 포함')
      score -= 20
    }

    // customer_concern 역할 비거나 내부어인 경우
    const concernSlots = displayKeywords.filter(d => d.role === 'customer_concern')
    const concernEmptyOrInternal = concernSlots.length === 0 ||
      concernSlots.every(s => {
        const kw = (s.keyword || '').trim()
        if (!kw) return true
        return internalPatterns.some(p => p.test(kw))
      })
    if (concernEmptyOrInternal) {
      failures.push('customer_concern 슬롯 비어있거나 내부어 포함')
      score -= 10
    }
  }

  if (options && 'marketHeadKeyword' in options) {
    const m = options.marketHeadKeyword
    if (!m || !m.keyword?.trim()) {
      failures.push('marketHeadKeyword 없음')
      score -= 15
    } else {
      const bigHeads = ['건강보험', '암보험', '실손보험', '간편보험', '운전자보험', '종신보험', '보험']
      if (!bigHeads.includes(m.keyword.trim())) {
        failures.push(`marketHeadKeyword가 big market 키워드 아님: "${m.keyword}"`)
        score -= 15
      }
      if (m.volume == null || m.volume === 0) {
        if (m.source === 'unavailable') {
          failures.push('marketHeadKeyword 검색량 미확인 (unavailable)')
          score -= 5
        } else {
          failures.push('marketHeadKeyword 검색량 0 또는 fallback')
          score -= 8
        }
      }
    }
  }

  // 설계서 모드: 검색량 미확인만 있을 때는 경고만 하고 통과 처리 (keyword_zero_volume 감점 완화)
  const volumeOnlyFailures = [
    '모든 키워드 검색량 0 또는 미확인',
    'marketHeadKeyword 검색량 미확인 (unavailable)',
    'marketHeadKeyword 검색량 0 또는 fallback',
  ]
  if (options?.designSheetMode && failures.length > 0) {
    const onlyVolume = failures.every(f => volumeOnlyFailures.some(v => f.includes(v) || v.includes(f)))
    if (onlyVolume) {
      score = 95
      failures.length = 0
      return { passed: true, field: 'keywordHealth', failures, score }
    }
  }

  return { passed: failures.length === 0, field: 'keywordHealth', failures, score: Math.max(0, score) }
}

// ── 운영 리스크 게이트 ──
export function gateOperationalRisk(options: {
  wasRegenerated?: boolean
  regenImproved?: boolean
  firstSentenceSimilarityMax?: number
  familyRepeatCount?: number
  canonicalOverrideApplied?: boolean
  hasDesignSheetAnalysis?: boolean
  finalAgentEndingMissing?: boolean
}): GateResult {
  const failures: string[] = []
  let score = 100

  if (options.finalAgentEndingMissing) {
    failures.push('finalAgentEnding 미저장 (관제 불가)')
    score -= 10
  }

  if (options.wasRegenerated && !options.regenImproved) {
    failures.push('재생성 시도했으나 개선 안됨')
    score -= 15
  }

  const simMax = options.firstSentenceSimilarityMax ?? 0
  if (simMax >= 0.6) {
    failures.push(`첫 문장 유사도 ${Math.round(simMax * 100)}% (강한 반복)`)
    score -= 20
  } else if (simMax >= 0.4) {
    failures.push(`첫 문장 유사도 ${Math.round(simMax * 100)}% (약한 반복)`)
    score -= 10
  }

  if ((options.familyRepeatCount ?? 0) >= 3) {
    failures.push(`동일 family ${options.familyRepeatCount}회 반복`)
    score -= 10
  }

  if (options.canonicalOverrideApplied && !options.hasDesignSheetAnalysis) {
    failures.push('canonical override 적용됐으나 분석 결과 없음')
    score -= 15
  }

  return { passed: failures.length === 0, field: 'operationalRisk', failures, score: Math.max(0, score) }
}

// ── 실패 태그 자동 분류 (경고 문자열 기준 정확 매핑) ──
function warningToTag(failure: string): FailureTag | null {
  if (failure.includes('문단 구분 없음')) return 'body_no_paragraph'
  if (failure.includes('본문 너무 짧음')) return 'body_too_short'
  if (failure.includes('본문 너무 김')) return 'body_too_long'
  if (failure.includes('첫 문장이 설계서 문체')) return 'body_formal_tone'
  if (failure.includes('정리문체 표현 사용') || failure.includes('약관/설명서체')) return 'answer_doc_style'
  if (failure.includes('역할 누수')) return 'answer_role_leakage'
  if (failure.includes('제목 너무 짧')) return 'title_too_short'
  if (failure.includes('제목 너무 김')) return 'title_too_long'
  if (failure.includes('블로그형') || failure.includes('질문형이 아님') || failure.includes('마침표로 끝남')) return 'title_blog_style'
  if (failure.includes('모든 키워드 검색량 0 또는 미확인')) return 'keyword_zero_volume'
  if (failure.includes('제목에 키워드 미포함')) return 'keyword_missing'
  if (failure.includes('답변 첫 문장') && failure.includes('유사도')) return 'human_first_sentence_repeat'
  if (failure.includes('질문 첫 문장') && failure.includes('유사도')) return 'human_first_sentence_repeat'
  if (failure.includes('유사도') && failure.includes('반복')) return 'human_first_sentence_repeat'
  if (failure.includes('영업성') || failure.includes('상담 유도')) return 'thread_sales_ending'
  if (failure.includes('마지막 agent 댓글 영업')) return 'thread_sales_ending'
  if (failure.includes('Evidence 밖 단정')) return 'evidence_outside_facts'
  if (failure.includes('금지 패턴')) return 'evidence_forbidden_pattern'
  if (failure.includes('느낌표 남발')) return 'body_exclamation'
  if (failure.includes('문단 중복') || failure.includes('같은 문장 반복')) return 'body_no_paragraph'
  if (failure.includes('접미 반복')) return 'body_no_paragraph'
  if (failure.includes('ㅠㅠ') || failure.includes('감탄 과밀')) return 'body_exclamation'
  if (failure.includes('스레드 없음')) return 'thread_empty'
  if (failure.includes('finalAgentEnding 미저장')) return 'operational_final_agent_ending_missing'
  if (failure.includes('검색 키워드 없음')) return 'keyword_missing'
  if (failure.includes('제목 키워드 과밀')) return 'keyword_overweight'
  if (failure.includes('displayKeywords 5칸 구조 아님') || failure.includes('marketHeadKeyword 없음')) return 'keyword_zero_volume'
  if (failure.includes('marketHeadKeyword 검색량')) return 'keyword_zero_volume'
  if (failure.includes('displayKeywords에 내부 구조어 포함')) return 'internal_keyword_leak'
  if (failure.includes('displayKeywords 5칸 역할 구조 미완성')) return 'customer_concern_missing'
  if (failure.includes('marketHeadKeyword 없음')) return 'market_head_missing'
  if (failure.includes('marketHeadKeyword가 big market 키워드 아님')) return 'market_head_not_big_keyword'
  if (failure.includes('concern 표현 과다 반복')) return 'internal_concern_lock'
  if (failure.includes('제목에 내부 표기') || failure.includes('제목에 금지 패턴')) return 'title_internal_code'
  if (failure.includes('답변 너무 짧')) return 'answer_too_short'
  if (failure.includes('답변 너무 김')) return 'answer_too_long'
  if (failure.includes('판단문')) return 'answer_no_judgment'
  if (failure.includes('role 흐름 이상')) return 'thread_role_break'
  if (failure.includes('댓글') && failure.includes('너무 짧')) return 'thread_too_short'
  if (failure.includes('댓글') && failure.includes('너무 김')) return 'thread_too_long'
  if (failure.includes('자기소개') || failure.includes('경력')) return 'human_self_intro'
  if (failure.includes('CTA')) return 'human_excessive_cta'
  if (failure.includes('정리/약관 문체') || failure.includes('문체 과다')) return 'human_formal_tone'
  if (failure.includes('전문가님')) return 'human_role_leakage'
  if (failure.includes('재생성') && failure.includes('개선 안됨')) return 'operational_regen_no_improvement'
  if (failure.includes('family') && failure.includes('반복')) return 'operational_family_repeat'
  if (failure.includes('첫 문장 유사도')) return 'operational_first_sentence_repeat'
  if (failure.includes('canonical override')) return 'operational_no_analysis'
  if (failure.includes('concern 키워드')) return 'keyword_missing'
  return null
}

export function classifyFailureTags(gates: GateResult[], qualityWarningsCount?: number): FailureTag[] {
  const tags: FailureTag[] = []
  for (const gate of gates) {
    for (const failure of gate.failures) {
      const tag = warningToTag(failure)
      if (tag && !tags.includes(tag)) tags.push(tag)
    }
  }
  // safety fallback: qualityWarnings가 1개 이상인데 결과가 빈 배열이면 uncategorized_warning
  if ((qualityWarningsCount !== undefined && qualityWarningsCount >= 1) && tags.length === 0) {
    tags.push('uncategorized_warning')
  }
  return tags
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
    title: 12,
    questionBody: 10,
    answer: 16,
    thread: 8,
    humanLikeness: 15,
    evidenceConsistency: 17,
    keywordHealth: 12,
    operationalRisk: 10,
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

  // thread 점수가 없으면(스레드 없을 때) 기본 100으로 넣어 CSV 등에서 빈칸 방지
  if (!('thread' in breakdown) || breakdown.thread == null) {
    breakdown.thread = 100
  }

  return {
    totalScore,
    breakdown,
    allPassed: criticalFailures.length === 0,
    criticalFailures,
  }
}
