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
  weight: number // 기본 선택 가중치 (높을수록 자주 뽑힘)
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

/**
 * 가중치 기반으로 N개 family를 중복 없이 샘플링
 * recentFamilyIds: 최근 사용된 family → 가중치 절반으로 감점
 */
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

/**
 * n-gram 유사도 (단어 기반 Jaccard)
 */
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

  // ── A. 질문형 평가 (카페 질문의 본질) ──

  if (/까요|없나요|맞나요|어떤가요|인가요|될까요|할까요|일까요|좋을까요|괜찮을까요|아닌가요|건가요|던가요|드시나요|계실까요|싶어요|모르겠어요/.test(title)) {
    score += 25; reasons.push('+25 의문형 종결')
  } else if (/[?]/.test(title)) {
    score += 15; reasons.push('+15 물음표')
  }

  // ── B. 고민 포인트 평가 ──

  if (/환급금|해지|해약|보험료|보장|납입면제|가입|적당|괜찮|부담|손해|유지|갱신|심사|고지/.test(title)) {
    score += 18; reasons.push('+18 고민어 포함')
  }

  // ── C. 핵심키워드 적절성 평가 ──

  const kwMatches = searchKeywords.filter(kw => kw && titleNorm.includes(normalizeForCompare(kw)))
  if (kwMatches.length === 1 || kwMatches.length === 2) {
    score += 18; reasons.push(`+18 키워드 ${kwMatches.length}개 적절`)
  } else if (kwMatches.length >= 3) {
    score -= 15; reasons.push(`-15 키워드 ${kwMatches.length}개 과다`)
  }

  // ── D. 상품 개별성 평가 (상품형 제목 미세 가산) ──

  if (cleanProductCore && cleanProductCore.length > 3 && titleNorm.includes(normalizeForCompare(cleanProductCore))) {
    score += 12; reasons.push('+12 상품명 포함')
  }

  // ── E. 타깃 페르소나 평가 ──

  if (/\d+대\s*(남성|여성|남자|여자|남|여)/.test(title)) {
    score += 8; reasons.push('+8 페르소나 포함')
  }

  // ── F. 길이 평가 ──

  if (title.length >= 18 && title.length <= 38) {
    score += 8; reasons.push('+8 적절 길이')
  } else if (title.length < 12 || title.length > 45) {
    score -= 10; reasons.push('-10 길이 부적절')
  }

  // ── G. 자연스러움 (괄호/코드 없음) ──

  if (!/[()]/.test(title) && !/(I{2,3}|Ⅱ|Ⅲ)/.test(title) && !/\d+\.\d+/.test(title)) {
    score += 5; reasons.push('+5 깔끔')
  }

  // ── H. 카페 생활형 표현 가산 ──

  if (/이대로|이거|괜찮|어떤가요|될까요|진짜|좀|그냥|들어도|해도|맞는 건지|이 정도면/.test(title)) {
    score += 8; reasons.push('+8 카페 생활형')
  }

  // ── 감점 ──

  // SEO/블로그형 표현 (카페 질문이 아닌 블로그/광고 냄새)
  if (/진짜\s*이유|완전\s*정리|총정리|꼭\s*알아야|반드시|놓치면|비교하세요|알아보니|꿀팁|필수|주목|추천해요|추천합니다|가입\s*전\s*꼭|핵심\s*정리|한눈에|장단점\s*분석|보험료\s*절약|이것만\s*알면|확인하세요|체크하세요|정리했습니다|알려드립니다/.test(title)) {
    score -= 30; reasons.push('-30 SEO/블로그형')
  }

  // 설명문형 (의문형이 아닌 서술/명령형)
  if (!/[?]/.test(title) && !/까요|나요|죠|가요|던데|어요|해요|싶어요|네요/.test(title)) {
    score -= 15; reasons.push('-15 설명문형')
  }

  // 정식 상품명 그대로
  if (rawProductName.length > 15 && title.includes(rawProductName)) {
    score -= 30; reasons.push('-30 raw상품명 노출')
  }

  // 인삿말/본문형
  if (/안녕하세요|글\s*남겨|언니들|가입했습니다/.test(title)) {
    score -= 40; reasons.push('-40 인삿말형')
  }

  // ── I. 최근 제목 중복 감점 ──

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

  // ── J. 너무 비어있는 제목 감점 ──
  const contentWords = title.replace(/[?？!！,，\s]/g, '')
  if (contentWords.length < 10) {
    score -= 15; reasons.push('-15 내용 부족 (너무 짧은 제목)')
  }

  // ── K. 자극형 제목 감점 ──
  if (/단점이\s*없|이게\s*진짜|사기\s*아닌|속는\s*건|충격|경악|대박/.test(title)) {
    score -= 15; reasons.push('-15 자극형 (과도한 자극/도발)')
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
  { id: 'news_scared', name: '뉴스/주변 사례 불안형', template: '뉴스에서 암 치료비 기사 보고 갑자기 보험이 신경 쓰이기 시작했어요' },
  { id: 'switch_old', name: '기존 보험 갈아타기형', template: '지금 보험이 너무 비싸서 갈아탈까 고민 중인데요' },
  { id: 'price_ok_structure_not', name: '가격은 OK 구조 불안형', template: '가격은 마음에 드는데 구조가 좀 불안해서 여쭤봐요' },
  { id: 'multi_agent_compare', name: '설계사 여러 명 비교형', template: '설계사 두 분한테 설계서를 받았는데 어떤 게 나은지 모르겠어요' },
  { id: 'retirement_worry', name: '노후 대비 걱정형', template: '나이 들면서 건강보험 하나는 있어야 할 것 같아서요' },
  { id: 'cancer_focus', name: '암 보장 집중형', template: '암 보장이 되는 게 있다길래 보고 있는데 이게 괜찮은 건지 궁금해요' },
  { id: 'work_break', name: '회사 중 잠깐형', template: '회사 일하다가 잠깐 올려봐요' },
  { id: 'spouse_push', name: '배우자 권유형', template: '남편이 보험 하나 들어두라고 해서 알아보는 중이에요' },
]

/**
 * 본문 도입 family 1개를 랜덤 선택 (recentOpenings 회피)
 */
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

  // concern 교차 사용 규칙: raw(내부)와 search(생활형)를 번갈아 사용
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
