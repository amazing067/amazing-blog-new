import { pickOpeningFamily as _pickOpeningFamily } from '@/lib/title-family'
import { pickConcernVariant } from '@/lib/insurance-terminology'
import type { DesignSheetAnalysis } from '@/types/qa'

/**
 * 보험카페 Q&A 자동 생성 프롬프트 템플릿
 * Version: 3.0
 * Last Updated: 2025-12-20
 * 
 * 개선 사항:
 * - 코드 레벨 무작위성 강제 (Code-Level Randomization)
 * - 구조적 답변 길이 제어
 * - 단계별 대화 흐름 제어
 * - 토큰 절감 최적화 (패턴 리스트 삭제)
 */

// ============================================
// 공통 지침 (중복 제거를 위해 한 곳에 통합)
// ============================================

const COMMON_GUIDELINES = {
  NO_PERIOD: `⚠️ 마침표(.) 사용 절대 금지:
- 모든 문장 끝에 마침표를 사용하지 마세요
- 물음표(?)나 느낌표(!)는 사용 가능하지만, 마침표는 절대 사용하지 마세요
- 예: "설계서 받았는데요" (O), "설계서 받았는데요." (X)
- 예: "이게 적정한가요?" (O), "이게 적정한가요." (X)`,
  
  SENTENCE_INTEGRITY: `⚠️ 문장 중간 줄바꿈 절대 금지 (매우 중요):
- 문장이 완전히 끝나지 않았는데 중간에 줄을 바꾸지 마세요
- 쉼표(,) 뒤에서 줄을 바꾸지 마세요. 한 문장은 반드시 한 줄에 이어 쓰세요
- 문장이 끝난 뒤(물음표, 느낌표 뒤)에만 줄바꿈을 하세요
- 예시 (X): "나중에 부담이 커질 수\\n있다는 글도" (절대 금지 - 문장 중간에 줄바꿈)
- 예시 (X): "설계서 받았는데, 보험료가\\n3만원이에요" (절대 금지 - 쉼표 뒤 줄바꿈)
- 예시 (O): "나중에 부담이 커질 수 있다는 글도 봤어요\\n" (올바름 - 문장 끝에서 줄바꿈)
- 예시 (O): "설계서 받았는데 보험료가 3만원이에요\\n같은 보장에 더 저렴한 게 있을까요?" (올바름 - 문장 끝에서 줄바꿈)`,
  
  OUTPUT_FORMAT: `[출력 형식]
- 본문만 출력하세요. 마크다운이나 HTML 태그 없이 순수 텍스트만 출력하세요.
- 제어 문자(<ctrl*> 등)나 특수 문자를 포함하지 마세요.
- 마침표(.) 사용 절대 금지 (위 지침 참조)
- 문장 중간에 의미 없는 줄바꿈 금지 (위 SENTENCE_INTEGRITY 참조)`,
  
  DIVERSITY: `⚠️ 다양성 확보 필수:
- 매번 생성할 때마다 반드시 다른 패턴, 다른 구조, 다른 표현을 사용하세요
- 이전에 생성한 내용과 동일한 패턴이나 구조를 절대 사용하지 마세요
- 매번 다른 시작 패턴, 다른 구조, 다른 종결어미를 사용하세요`,
  
  PARAGRAPH_FORMAT: `⚠️ 문단 구분 필수:
- 2-3개의 문단으로 구성하세요
- 각 문단 사이에는 반드시 빈 줄(줄바꿈 2개, \\n\\n)을 넣어주세요
- 한 문단에 여러 문장을 자연스럽게 연결하세요 (문장 중간에 줄바꿈 금지)`
}

// ============================================
// 스타일 데이터 상수화 (코드 레벨 무작위성)
// ============================================

/**
 * 질문자의 태도 스타일
 */
const QUESTION_CONCEPTS = [
  {
    id: '의심형',
    description: '설계사의 답변에 의심을 품고 추가 확인을 요구하는 태도',
    tone: '의심스러워하며 확인하려는',
    examples: ['이게 정말 맞는 건가요?', '다른 보험사는 어떻게 되나요?', '혹시 숨겨진 조건은 없나요?'],
    focus: '의심을 품고 여러 각도에서 확인하려는 톤'
  },
  {
    id: '초보형',
    description: '보험에 대해 거의 모르는 초보자처럼 기초적인 질문을 하는 태도',
    tone: '기초적인 것도 모르는 초보자',
    examples: ['이게 뭔지 잘 모르겠어요', '보험료가 뭔가요?', '특약이 뭔지 궁금해요'],
    focus: '기초적인 것도 모르는 초보자처럼 질문하는 톤'
  },
  {
    id: '꼼꼼형',
    description: '모든 조건과 제한사항을 꼼꼼히 확인하려는 태도',
    tone: '꼼꼼하게 모든 것을 확인하려는',
    examples: ['면책기간은 언제부터인가요?', '보장 범위를 자세히 알고 싶어요', '제한사항이 있나요?'],
    focus: '모든 조건을 꼼꼼히 확인하려는 톤'
  },
  {
    id: '감정호소형',
    description: '개인적 상황이나 감정을 드러내며 공감을 구하는 태도',
    tone: '개인적 감정을 드러내며 공감을 구하는',
    examples: ['보험료가 부담스러워서요', '걱정이 많아서요', '불안해서 질문드려요'],
    focus: '개인적 감정을 드러내며 공감을 구하는 톤'
  },
  {
    id: '답정너형',
    description: '이미 어느 정도 결정을 내렸지만 확인 차원에서 질문하는 태도',
    tone: '이미 결정했지만 확인하려는',
    examples: ['이 상품으로 가입하려고 하는데 괜찮나요?', '이 구성으로 가입해도 될까요?', '이 보험료면 적정한가요?'],
    focus: '이미 결정했지만 최종 확인하려는 톤'
  }
] as const

/**
 * 제목 다양성 강화를 위한 패턴 정의 (코드 레벨 강제)
 */
const TITLE_PATTERNS = [
  {
    id: 'AFTER_REVIEW',
    type: '후기/경험 공유형',
    guide: '"가입한 분 후기 들려주세요", "OO 들고 계신 분 의견 부탁", "OO 가입하고 N개월 됐는데" 식으로 후기/경험을 묻거나 공유하는 톤. 카페 클릭률 최상위.',
    example: '50대 여성분들 무해지환급 건강보험 후기 들려주세요',
    probability: 0.18
  },
  {
    id: 'VS_COMPARE',
    type: 'vs/비교형',
    guide: '"OO vs OO 어느 게 나아요", "OO와 OO 비교 부탁드려요", "갱신형 vs 비갱신형" 식으로 두 옵션 비교를 요청하는 톤. 검색 클릭률 매우 높음.',
    example: '50대 남성 일반 vs 간편건강보험 비교 좀 부탁드립니다',
    probability: 0.15
  },
  {
    id: 'CONS_LIST',
    type: '단점/주의/N가지형',
    guide: '"단점 있나요", "함정/주의할 점 알려주세요", "체크할 N가지" 식으로 단점·주의사항·체크리스트를 묻는 톤. SEO 클릭 트리거 강함.',
    example: '갱신형 간편보험 단점 3가지만 알려주세요',
    probability: 0.12
  },
  {
    id: 'SIMPLE_AGGRO',
    type: '초간단/어그로형',
    guide: '상품명이나 나이를 모두 빼고, "이거 맞나요?", "호구 당한 건가요?", "해지해야 할까요?" 처럼 매우 짧고 자극적으로 작성하세요. (15자 이내)',
    example: '이거 설계사님이 추천했는데 맞나요?',
    probability: 0.12
  },
  {
    id: 'PRICE_FOCUS',
    type: '가격/금액 강조형',
    guide: '상품명보다는 "월 3만원", "5만원대" 처럼 가격을 제목의 핵심으로 내세우세요. 나이/성별은 생략 가능합니다.',
    example: '월 4만원대 암보험 견적 받았는데 봐주세요',
    probability: 0.12
  },
  {
    id: 'PRODUCT_SKEPTIC',
    type: '상품명+의심형',
    guide: '상품명을 언급하되, 구체적인 의심이나 단점을 질문하세요. 나이/성별은 생략하거나 간단히만 언급하세요.',
    example: '교보생명 암보험 갱신형이라는데 괜찮나요?',
    probability: 0.12
  },
  {
    id: 'SITUATION_FOCUS',
    type: '상황/고민 강조형',
    guide: '상품명 대신 본인의 상황(결혼, 임신, 해지 고민, 갈아타기 등)을 제목에 쓰세요. 나이/성별은 자연스럽게 포함하되 상품명은 생략 가능합니다.',
    example: '30대 직장인 암보험 갈아타기 조언 좀 부탁드려요',
    probability: 0.10
  },
  {
    id: 'SPECIFIC_ASK',
    type: '구체적 특약 질문형',
    guide: '전체 상품보다는 특정 특약(암진단비, 표적항암 등)을 콕 집어서 질문하세요. 상품명, 나이, 성별 모두 생략 가능합니다.',
    example: '표적항암치료비 특약 꼭 넣어야 하나요?',
    probability: 0.05
  },
  {
    id: 'STANDARD',
    type: '정석 질문형',
    guide: '나이/성별/상품명을 포함하여 정중하게 질문하세요. (기존 스타일)',
    example: '35세 여성 교보생명 암보험 견적 문의드립니다',
    probability: 0.04
  }
] as const

/**
 * 답변의 논리 구조
 */
const ANSWER_STRUCTURES = [
  {
    id: '결론→이유→영업',
    description: '먼저 결론을 제시하고 이유를 설명한 후 상담 유도',
    order: ['결론', '이유', '영업'],
    guide: '먼저 핵심 답변을 명확히 제시하고, 그 이유를 설명한 후 자연스럽게 상담을 유도하세요'
  },
  {
    id: '공감→분석→제안',
    description: '고객의 감정에 공감하고 분석한 후 제안',
    order: ['공감', '분석', '제안'],
    guide: '고객의 감정 상태에 먼저 공감하고, 상품을 분석한 후 구체적인 제안을 하세요'
  },
  {
    id: '질문반박→팩트→유도',
    description: '고객의 질문을 인정하고 팩트로 답변한 후 유도',
    order: ['질문반박', '팩트', '유도'],
    guide: '고객의 질문을 인정하고 구체적인 팩트로 답변한 후 상담을 유도하세요'
  },
  {
    id: '비교→장점→유도',
    description: '경쟁사와 비교하고 장점을 강조한 후 유도',
    order: ['비교', '장점', '유도'],
    guide: '경쟁사와 비교하여 우리 상품의 장점을 강조한 후 상담을 유도하세요'
  },
  {
    id: '설명→예시→유도',
    description: '상세히 설명하고 구체적 예시를 제시한 후 유도',
    order: ['설명', '예시', '유도'],
    guide: '상세히 설명하고 구체적인 예시를 제시한 후 상담을 유도하세요'
  }
] as const

/**
 * 댓글 작성 의도
 */
const COMMENT_INTENTS = [
  {
    id: '딴지걸기',
    description: '설계사의 답변에 반박하거나 의문을 제기하는 의도',
    tone: '반박하고 의문을 제기하는',
    examples: ['그런데 다른 보험사는 다르게 말하는데요?', '혹시 숨겨진 조건은 없나요?', '이게 정말 맞는 건가요?'],
    focus: '설계사의 답변에 반박하거나 의문을 제기하는 톤'
  },
  {
    id: '재촉하기',
    description: '빠른 답변이나 결정을 재촉하는 의도',
    tone: '빠른 답변을 재촉하는',
    examples: ['빨리 답변해주세요', '이번 주 안에 결정해야 해서요', '급하게 알아봐야 해서요'],
    focus: '빠른 답변이나 결정을 재촉하는 톤'
  },
  {
    id: '단순호응',
    description: '설계사의 답변에 긍정적으로 호응하는 의도',
    tone: '긍정적으로 호응하는',
    examples: ['아 그렇군요', '이해했습니다', '좋은 정보 감사합니다'],
    focus: '설계사의 답변에 긍정적으로 호응하는 톤'
  },
  {
    id: '엉뚱한질문',
    description: '원래 질문과는 다른 엉뚱한 질문을 하는 의도',
    tone: '엉뚱한 질문을 하는',
    examples: ['그런데 보험료는 언제 내나요?', '해지하면 어떻게 되나요?', '다른 상품도 추천해주세요'],
    focus: '원래 질문과는 다른 엉뚱한 질문을 하는 톤'
  },
  {
    id: '경험담공유',
    description: '자신의 경험이나 주변 사람의 경험을 공유하는 의도',
    tone: '경험을 공유하는',
    examples: ['저도 비슷한 경험이 있어서요', '친구가 이 보험 가입했는데요', '주변에서 이런 이야기를 들었어요'],
    focus: '자신의 경험이나 주변 사람의 경험을 공유하는 톤'
  }
] as const

/**
 * 댓글 작성자 페르소나 (Q&A 전용 / 후기 제외)
 * 가입 전 궁금해하는 예비 고객들의 자연스러운 질문 대화
 * 후기성 댓글은 별도 기능이므로 여기서는 완전히 제외
 */
const COMMENTER_PERSONAS = [
  {
    id: 'ORIGINAL',
    type: '원글 작성자',
    desc: '처음 질문을 올린 본인입니다. 설계사의 답변을 보고 추가 질문을 합니다.',
    probability: 0.4, // 40%
    tone: '자연스럽게 계속 질문하는',
    action_guide: '답변을 듣고 생긴 구체적인 궁금증(보장범위, 금액변동, 예외사항 등)을 물어보세요.',
    examples: ['설계사님께서 말씀하신 내용이 궁금해서요', '추가로 확인하고 싶은 게 있어요', '그 부분에 대해 더 자세히 알고 싶어요'],
    greeting: '' // 원글 작성자는 인사 불필요
  },
  {
    id: 'NEW_INTERESTED',
    type: '관심 생긴 제3자',
    desc: '지나가다 글을 봤는데 조건이 좋아 보여서 끼어듭니다.',
    probability: 0.25, // 25%
    tone: '호기심 많고 관심 있는',
    action_guide: '상품의 장점(가격, 보장)을 놀라워하며 "저도 쪽지 가능한가요?", "이거 좋아보이는데 저도 설계 좀"이라며 상담을 요청하세요.',
    examples: ['저도 궁금한데요', '와 월 3만원에 암진단비 5천만원이라니 가성비 대박이네요', '이 가격에 이 보장이 가능한가요? 저도 설계 받아보고 싶어서 쪽지 주세요'],
    greeting: '안녕하세요~' // 새로운 사람이므로 인사 포함
  },
  {
    id: 'NEW_COMPARE',
    type: '비교 중인 제3자',
    desc: '다른 보험과 고민 중인 사람입니다.',
    probability: 0.15, // 15%
    tone: '비교하고 전환하려는',
    action_guide: '"A사보다 이게 낫나요?", "저 00보험 있는데 갈아탈만 할까요?"라고 비교 질문을 던지세요.',
    examples: ['지금 A사 보험 있는데 이게 더 좋아 보이네요', 'A사는 감액기간 있는데 여긴 없나요? 그럼 갈아타고 싶은데요', '다른 보험사는 이렇던데 여긴 다른가요?'],
    greeting: '안녕하세요~' // 새로운 사람이므로 인사 포함
  },
  {
    id: 'NEW_URGENT',
    type: '급한 가입희망자',
    desc: '당장 가입이 급한 사람입니다.',
    probability: 0.1, // 10%
    tone: '급하고 서두르는',
    action_guide: '"오늘 가입 되나요?", "실비 청구 이력 있어도 되나요?" 등 가입 가능 여부를 급하게 물어보세요.',
    examples: ['이번 주 안에 가입해야 해서요', '급하게 쪽지 주세요', '오늘 가입 가능한가요?', '실비 청구 이력 있어도 가입 되나요?'],
    greeting: '안녕하세요~' // 새로운 사람이므로 인사 포함
  },
  {
    id: 'NEW_SKEPTIC',
    type: '조건 따지는 제3자',
    desc: '다른 곳이랑 비교하며 조건을 따져보는 사람입니다.',
    probability: 0.1, // 10%
    tone: '비교하고 의심하는',
    action_guide: '다른 보험사와 비교하며 의심을 표현하되, 설계사 답변을 듣고 "아 그렇구나"하며 긍정적으로 전환될 수 있는 질문을 하세요.',
    examples: ['다른 보험사는 이렇던데 여긴 다른가요?', '혹시 숨겨진 조건은 없나요?', '설계사님 답변 보니까 좋긴 한데 진짜인가요?'],
    greeting: '안녕하세요~' // 새로운 사람이므로 인사 포함
  }
] as const

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 배열에서 랜덤으로 하나 선택
 */
function getRandomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/**
 * 확률에 따라 페르소나 선택하는 헬퍼 함수
 * 원글 작성자 30%, 다른 사람들 70%로 자연스러운 다중 화자 구현
 */
function getWeightedPersona() {
  const rand = Math.random()
  let sum = 0
  for (const persona of COMMENTER_PERSONAS) {
    sum += persona.probability
    if (rand <= sum) return persona
  }
  return COMMENTER_PERSONAS[0] // 폴백
}

/**
 * 확률 기반 제목 패턴 선택 함수
 */
function getWeightedTitlePattern() {
  const rand = Math.random()
  let sum = 0
  for (const pattern of TITLE_PATTERNS) {
    sum += pattern.probability
    if (rand <= sum) return pattern
  }
  return TITLE_PATTERNS[0] // 폴백
}

/**
 * [신규 추가] 문체에 생동감을 주되, '존댓말'을 유지하는 상황 변수들
 * 논리적인 페르소나와 별개로, 글 쓰는 환경이나 기분을 부여합니다.
 * 모든 상황에서 존댓말(해요체/하십시오체)을 기본으로 사용합니다.
 */
const CONTEXT_NOISE = [
  '핸드폰으로 급하게 써서 문장이 짧고 간결한 스타일 (존댓말 유지)',
  '매우 꼼꼼하고 예의 바른 성격이라 "혹시 실례가 안 된다면~" 같은 표현 사용',
  '걱정이 많아서 "ㅠㅠ" 같은 이모티콘을 섞으며 불안해하는 말투',
  '회사 업무 중에 몰래 쓰는 상황이라 핵심만 딱딱 묻는 사무적인 말투',
  '보험 용어를 어느 정도 알아서 "그럼 납입면제는요?" 같이 훅 들어오는 스타일',
  '옆집 이웃에게 물어보듯 친근하고 부드러운 "해요"체 사용',
  '아무런 감정 없이 건조하게 팩트만 확인하는 시크한 존댓말'
] as const

/**
 * 랜덤 상황 노이즈 선택 함수
 */
function getRandomContext() {
  return getRandomItem(CONTEXT_NOISE)
}

/**
 * targetPersona 문자열에서 나이/성별/표기 라벨 추출 (질문·답변·스레드·후기 공통)
 * - "50대" → age=55, ageDecadeLabel="50대"
 * - "40세" → age=40
 * - "신혼부부" → age=32, "자녀 있는 가족" → age=38
 * - 여/여성/주부 → gender='여', 그 외 → '남' 기본
 */
function extractPersonaProfile(targetPersona: string): {
  age: number
  gender: '남' | '여'
  ageDecadeLabel: string | null
} {
  let age = 30
  const ageDecadeMatch = targetPersona.match(/(\d+)대/)
  const ageYearMatch = targetPersona.match(/(\d+)세/)

  if (ageDecadeMatch) {
    age = parseInt(ageDecadeMatch[1]) + 5
  } else if (ageYearMatch) {
    age = parseInt(ageYearMatch[1])
  } else if (targetPersona.includes('신혼부부')) {
    age = 32
  } else if (targetPersona.includes('자녀 있는 가족')) {
    age = 38
  }

  let gender: '남' | '여' = '남'
  if (targetPersona.includes('여') || targetPersona.includes('여성') || targetPersona.includes('주부')) {
    gender = '여'
  }

  return { age, gender, ageDecadeLabel: ageDecadeMatch ? ageDecadeMatch[0] : null }
}

export interface QAPromptData {
  productName: string
  topicName?: string
  displayProductName?: string
  /** 답변/설계사 댓글 전용 노출명 (예: "이 건강보험"). 회사명·브랜드 모두 제거. */
  agentSafeName?: string
  /** 답변/agent 출력 sanitize용 차단 키워드 목록 (회사명+원본 상품명 변형) */
  agentBlockedTerms?: string[]
  targetPersona: string
  worryPoint: string
  sellingPoint: string
  answerTone: string
  answerLength?: 'default'
  designSheetImage?: string
  designSheetAnalysis?: DesignSheetAnalysis | null
  searchResultsText?: string
  searchKeywords?: string[]
  evidenceMap?: {
    questionFacts: string[]
    answerFacts: string[]
    forbiddenPatterns: string[]
  }
  conflictAxis?: {
    keyword: string
    keywordNatural: string
    proCondition: string
    conCondition: string
    summary: string
  } | null
  /** 설계서 모드: 상류(analyze)에서 넘어온 concern/보장 축. 있으면 질문·답변·댓글에 강하게 반영 */
  selectedConcern?: string
  selectedConcernSearch?: string
  coverageSummaryForPrompt?: string[]
  coverageFocusLabels?: string[]
}

export interface ConversationMessage {
  role: 'customer' | 'agent'
  content: string
  step: number
}

export interface ConversationContext {
  initialQuestion: {
    title: string
    content: string
  }
  firstAnswer: string
  conversationHistory: ConversationMessage[]
  totalSteps: number
  currentStep: number
  // customerRole 제거: 페르소나 시스템으로 대체 (코드 레벨에서 자동 선택)
}

export interface QuestionPromptResult {
  prompt: string
  openingFamilyId: string
  openingFamilyName: string
  titlePatternId: string
  questionConceptId: string
  concernVariant?: string
}

/**
 * Step 1: 일반인 질문 생성 프롬프트
 */
export function generateQuestionPrompt(data: QAPromptData): QuestionPromptResult {
  const { productName, topicName, displayProductName, targetPersona, worryPoint, sellingPoint, designSheetImage, designSheetAnalysis, searchResultsText, searchKeywords, evidenceMap, conflictAxis, selectedConcern, selectedConcernSearch, coverageSummaryForPrompt, coverageFocusLabels } = data
  // 제목·키워드용 (강한 정제)
  const customerFacingName = topicName || productName
  // 본문 첫 언급용 (중간 정제 — 핵심 구조어 보존)
  const displayName = displayProductName || customerFacingName

  // 코드 레벨 무작위성: 질문자 태도 & 제목 패턴 선택
  const selectedConcept = getRandomItem(QUESTION_CONCEPTS)
  const selectedTitlePattern = getWeightedTitlePattern()

  // 본문 도입 family 선택 (18개 중 랜덤)
  const openingFamily = _pickOpeningFamily()
  const openingGuide = openingFamily ? openingFamily.template : '설계서 받고 고민이 생겨서요'

  // concern 생활형 변주: 본문/답변/댓글에서 사용할 표현
  const rawConcern = conflictAxis?.keyword || ''
  const concernVariant = rawConcern ? pickConcernVariant(rawConcern) : ''
  if (concernVariant && concernVariant !== rawConcern) {
    console.log(`[Q&A 프롬프트] concernVariant 선택: "${rawConcern}" → "${concernVariant}"`)
  }

  // 나이/성별 추출 (질문·답변·스레드·후기 공통 헬퍼)
  const { age, gender, ageDecadeLabel } = extractPersonaProfile(targetPersona)

  // 나이대별 말투 가이드 (제목/본문 마무리 톤 다양화 — 카페 클릭 트리거 패턴 골고루 사용)
  // ⚠️ "괜찮나요/되나요" 일변도 금지 — 후기, vs 비교, 단점, N가지, 함정 같은 표현을 적극 섞을 것
  const TITLE_TONE_VARIANTS_BY_AGE = {
    young: [
      '"이거 괜찮나요?", "이거 맞나요??", "이거 가입한 거 호구인가요"',
      '"OO보험 후기 좀 들려주세요", "가입한 분 계세요?"',
      '"OO 단점 알려주세요", "이거 함정 있나요?"',
      '"A vs B 뭐가 더 나아요?", "이거랑 OO 비교해주세요"',
      '"가입 전 체크할 거 N가지 알려주세요"',
    ],
    middle: [
      '"이거 괜찮은가요?", "혹시 다른 보험사도 괜찮은지..."',
      '"가입 후기 들려주세요", "실제로 가입해보신 분?"',
      '"OO 단점이 뭔가요", "주의할 점 있을까요"',
      '"OO vs OO 비교 부탁드려요", "OO랑 비교하면 어때요"',
      '"가입 전 N가지 점검해주세요", "체크포인트 좀..."',
    ],
    senior: [
      '"이게 괜찮은 건지 모르겠어서요", "문의드립니다"',
      '"가입하신 분 후기 좀 부탁드립니다", "실제로 들고 계신 분?"',
      '"단점이나 주의사항 알려주세요", "함정은 없는지요"',
      '"OO와 비교해 주실 분 계실까요", "다른 회사 OO와 비교"',
      '"가입 전에 점검할 부분 몇 가지 부탁드립니다"',
    ],
  } as const
  const ageBucket = age < 30 ? 'young' : age < 50 ? 'middle' : 'senior'
  const toneVariants = TITLE_TONE_VARIANTS_BY_AGE[ageBucket]
  // 매번 다른 톤 1개 무작위 선택해 강조 (이걸 그대로 쓰지 말고 톤만 따라하기)
  const pickedToneVariant = toneVariants[Math.floor(Math.random() * toneVariants.length)]
  let ageToneGuide = ''
  if (age < 30) {
    ageToneGuide = `
   - 20대 말투: "요" 체 적극 사용, 이모티콘/물음표 중복 가능
   - 이번 글의 제목 마무리 톤 (이걸 그대로 쓰지 말고 톤만 따라할 것): ${pickedToneVariant}
   - ❌ 절대 모든 제목을 "괜찮나요/되나요" 톤으로만 쓰지 말 것 (다양성 핵심)`
  } else if (age < 50) {
    ageToneGuide = `
   - 30-40대 말투: 정중한 "요" 체, 비교 요청 자연스럽게
   - 이번 글의 제목 마무리 톤 (이걸 그대로 쓰지 말고 톤만 따라할 것): ${pickedToneVariant}
   - ❌ 절대 모든 제목을 "괜찮나요/되나요" 톤으로만 쓰지 말 것 (다양성 핵심)`
  } else {
    ageToneGuide = `
   - 50대 이상 말투: 정중한 "요" 체, 문의/부탁 형식 자주 사용
   - 이번 글의 제목 마무리 톤 (이걸 그대로 쓰지 말고 톤만 따라할 것): ${pickedToneVariant}
   - ❌ 절대 모든 제목을 "괜찮나요/되나요" 톤으로만 쓰지 말 것 (다양성 핵심)`
  }

  // 설계서 정보 추출
  const premiumInfo = designSheetAnalysis?.premium || ''
  const coverageInfo = designSheetAnalysis?.coverages?.slice(0, 3).join(', ') || ''
  
  // 랜덤 상황 노이즈 추가
  const randomSituation = getRandomContext()

  // 연령 표기: 입력이 "50대"면 출력에도 "50대"만 사용. "55세" 등 구체 나이를 임의로 넣지 않도록 프롬프트에도 동일 표기
  const profileAgeLabel = ageDecadeLabel
    ? `${ageDecadeLabel} ${gender === '남' ? '남성' : '여성'}`
    : `${age}세 ${gender === '남' ? '남성' : '여성'}`

  const prompt = `당신은 보험 가입을 고민 중인 일반인입니다. 커뮤니티에 질문글을 작성합니다.

[화자 프로필]
- ${profileAgeLabel} (${targetPersona})
- 현재 상황/기분: **${randomSituation}** (이 설정을 말투에 깊게 반영하세요)
${searchResultsText ? `
[최근 검색 요약]
- 검색 요약은 **일반론**으로만 반영하세요. "일부 상품에서는", "보통", "찾아보니" 등 가능성 문장으로 쓸 것.
- 링크나 출처를 본문에 남기지 말고 내용만 녹여서 전달하세요.
${searchResultsText}
` : ''}

[작성 미션]
1. 제목: 🚨 **이번 글은 반드시 [${selectedTitlePattern.type}] 패턴 1가지로만 작성** — 다른 패턴 절대 금지
   - 패턴 가이드: ${selectedTitlePattern.guide}
   - 패턴 예시: "${selectedTitlePattern.example}" — 형식·톤만 참고, 그대로 복사 금지
   - ⛔ **이번 글은 절대 사용 금지된 표현** (선택된 패턴이 아래 목록에 있다면 그 항목은 무시):
     ${selectedTitlePattern.id === 'AFTER_REVIEW' ? '"괜찮을까요/괜찮은가요/괜찮나요/되나요/맞나요" 류 caution 톤 절대 금지. 반드시 "후기/가입하신/들고 계신/들어보신" 류로 끝맺기' : ''}${selectedTitlePattern.id === 'VS_COMPARE' ? '"괜찮을까요/되나요" caution 톤 금지. 반드시 "vs/비교/대비/A보다 B" 형태 사용' : ''}${selectedTitlePattern.id === 'CONS_LIST' ? '"괜찮을까요" 금지. 반드시 "단점/주의/체크/N가지/함정" 류 사용' : ''}${selectedTitlePattern.id === 'SIMPLE_AGGRO' ? '15자 초과 금지, 정중한 표현 금지' : ''}${selectedTitlePattern.id === 'PRICE_FOCUS' ? '제목에 가격(월 X만원, 보험료 숫자) 반드시 포함' : ''}${selectedTitlePattern.id === 'PRODUCT_SKEPTIC' ? '제목에 의심·갈등 단어(정말/진짜/이게 맞나/괜찮나) 포함, 단 모두 동일 표현 금지' : ''}${selectedTitlePattern.id === 'SITUATION_FOCUS' ? '본인 상황 단어(갈아타기/해지 고민/가입 직전/처음 가입) 포함, 상품명 자세히 안 써도 OK' : ''}${selectedTitlePattern.id === 'SPECIFIC_ASK' ? '특약·세부 보장명만 콕 집어 질문, 상품 전체 언급 금지' : ''}${selectedTitlePattern.id === 'STANDARD' ? '나이·성별·상품 카테고리·문의드립니다 정석 형식' : ''}
   - **제목에는 반드시 아래 핵심키워드(검색형 요약어) 중 1개 이상을 포함하세요.** 예: 간편건강보험, 건강보험, 암보험, 보험료, 실손보험 등.
   - **정식 상품명 전체(회사명·버전·코드·괄호까지 포함된 긴 이름)는 제목에 절대 쓰지 마세요.** 고객용 주제명(${customerFacingName})을 기준으로 짧은 검색형 키워드 + 고민 한 줄로 작성하세요.
   - **괄호, 버전 코드(3.105 등), 로마숫자(I, II, III), (주), 무배당 같은 내부 표기는 제목·본문 어디에도 넣지 마세요.**
   - "보험 이거 맞나요?"처럼 키워드 없이 너무 일반적인 제목만 쓰지 마세요.
2. 본문:
   - ${premiumInfo || coverageInfo ? `설계서 내용(${premiumInfo || '보험료'}, ${coverageInfo || '주요보장'})을 언급하며` : '고민과 강조점을 반영하여'} 궁금한 점을 물어보세요.
   - **본문 첫 언급은 "${displayName}"을 1회 사용하고, 이후에는 "${customerFacingName}"처럼 짧은 주제명으로만 쓰세요.** 정식 상품명 전체를 쓰지 마세요.
   - 태도: **${selectedConcept.tone}**
   - **본문 첫 2~3문장은 반드시 카페 일상 말투**로 시작하세요. 설계서 문서 말투를 쓰지 마세요.
     * 이번 글의 도입 톤: **"${openingGuide}"** — 이 느낌으로 첫 1~2문장을 시작하세요 (그대로 복사하지 말고, 이 상황의 말투를 살려서 자연스럽게)
     * ❌ 절대 금지 첫 문장 표현 (이런 식으로 시작하면 0점):
       - "합리적인 선택일지 검토 중입니다"
       - "장기 납입 중 예기치 못한 경제적 상황이 발생할 경우"
       - "보장이 포함되어 있습니다"
       - "보험 가입을 고려하고 있습니다"
       - "상품 구성을 살펴보니"
       - "종합적으로 판단해보면"
       - "효율적인 보장을 위해"
       - "최근 보험 시장에서"
       - "경제적 부담을 대비하기 위해"
       - "보장 내용을 살펴보았습니다"
       - "적절한 보장을 선택하기 위해"
     * ✅ 좋은 시작 예시 (이런 말투가 자연스럽다):
       - "회사 일하다가 잠깐 올려봐요"
       - "지인이 괜찮다고 해서 설계서 받아봤는데 잘 모르겠네요"
       - "갱신 시기 다가와서 이것저것 보다가 질문드려요"
       - "중간에 사정 생기면 어쩌나 싶어서 고민돼요"
       - "설계서 받고 보니까 이게 맞는 건지 헷갈려서요"
   - **본문 길이: 반드시 300~500자 이내로 작성하세요. 550자를 초과하면 시스템에서 잘립니다.**
   - 🚨 **반드시 3개 단락으로 출력** (한 덩어리로 쓰면 카페 가독성 0). 단락 사이는 **빈 줄 1개** (\\n\\n) 반드시.

     출력 형식 (이 구조로):

     [단락 1: 인사/도입 — 1~2문장, 50~100자]
     "안녕하세요" 같은 정형 인사 대신, 위 도입 톤을 살린 자연스러운 한 줄

     [단락 2: 상품 정보·고민 본문 — 2~3문장, 180~280자]
     설계서 내용·금액·보장 + 본인 고민/의문점 풀어쓰기

     [단락 3: 마무리 질문/조언 요청 — 1~2문장, 50~100자]
     "조언 부탁드려요", "후기 좀 들려주세요" 같은 자연스러운 마무리

   - **문장 중간에 엔터 절대 금지.** 한 문장 끝(물음표/느낌표/"요" 뒤)에서만 줄바꿈.
   - 마침표(.) 금지.

${COMMON_GUIDELINES.SENTENCE_INTEGRITY}

[사실성 - 필수 (위반 시 심각한 오류)]
- 질문 본문에 넣는 **구체적 수치·조건·상품 특성**은 반드시 아래 [입력 데이터]에 적힌 내용만 사용하세요.
- **연령**: 입력에 "50대", "40대"처럼 연령대만 있으면 본문에도 **반드시 그 연령대만** 사용하세요. 55세, 51세, 58세 등 구체 나이를 임의로 넣지 마세요.
- **입력에 없는** 보험료 금액(예: 10만원대, 3만원), 보장 기간(100세, 비갱신형/갱신형), 보장 금액(1억, 3000만), 할인명(비흡연자 할인 등), 특약명·상품명 세부사항을 **임의로 만들어 넣지 마세요.**
- 설계서 분석이 제공된 경우에만 그 내용을 참고하고, 없으면 고민(worryPoint)과 강조점(sellingPoint)만 일반적으로 반영하세요. 검색 요약은 "일반적으로", "일부 상품에서는" 등 가능성 문장으로만 쓸 것.
- **광고성 표현 자제**: "비교 어플", "실시간 보험료 견적", "실시간 견적" 같은 표현은 제목·첫 문단에서 쓰지 마세요. "알아보니 이런 얘기도 있다던데" 정도로만.

[금지 사항]
- 너무 전문가처럼 보이거나, 너무 정중하게 쓰지 마세요. 커뮤니티 글처럼 자연스럽게.

[입력 데이터]
- 제목·키워드용 주제명: ${customerFacingName}
- 본문 첫 언급용 상품명 (1회만): ${displayName}
- 정식 상품명 (내부 참고만, 글에 그대로 쓰지 말 것): ${productName}
- 고민: ${worryPoint}
- 강조점 (답변에서 참고할 포인트): ${sellingPoint}
- 질문 본문에서는 위 고민이 읽는 사람이 공감할 수 있도록 자연스럽게 드러나면 좋아요.
${designSheetAnalysis ? `- 설계서 내용: ${JSON.stringify(designSheetAnalysis)}` : '- 설계서: 없음 (위 고민·강조점만 사용)'}
${searchResultsText ? `- 최근 검색 요약: ${searchResultsText}` : ''}
${searchKeywords && searchKeywords.length > 0 ? `- 연관 키워드 (상위 1~2개 필수, 나머지 가능하면): ${searchKeywords.join(', ')}` : ''}
${evidenceMap?.questionFacts && evidenceMap.questionFacts.length > 0 ? `
[📋 질문에서 활용할 수 있는 사실 (Evidence Map)]
아래는 설계서에서 확인된 사실입니다. 질문 본문에 자연스럽게 녹여 쓰세요.
담보명을 나열하지 말고, 생활형 표현으로 바꿔서 사용하세요.
${evidenceMap.questionFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')}` : ''}
${evidenceMap?.forbiddenPatterns && evidenceMap.forbiddenPatterns.length > 0 ? `
[⛔ 절대 사용 금지 표기]
${evidenceMap.forbiddenPatterns.map(p => `- "${p}"`).join('\n')}` : ''}
${conflictAxis ? `
[⚖️ 핵심 고민 축 (Conflict Axis)]
이 질문의 핵심 갈등: ${conflictAxis.keywordNatural}
- ${conflictAxis.proCondition}
- ${conflictAxis.conCondition}
- 핵심: ${conflictAxis.summary}
${concernVariant ? `- 본문에서 이 갈등을 표현할 때 "${concernVariant}" 같은 생활형 표현을 쓰세요 (전문 용어 대신)` : ''}
이 갈등 구조가 질문 본문에 자연스럽게 드러나야 합니다.` : ''}
${(selectedConcern ?? selectedConcernSearch) && designSheetAnalysis ? `
[📌 설계서 고민 축]
- 질문 초점: "${selectedConcern || selectedConcernSearch}" 축을 중심으로 쓰면 됩니다. 문장을 그대로 복붙하지 말고 자기 말로 풀어서 쓰세요.
${(coverageSummaryForPrompt?.length ?? 0) > 0 ? `- 보장은 아래 요약 중 1~2개만 자연스럽게 언급하면 됩니다. 구조어보다 "보장 구성", "보장 균형" 쪽 표현을 쓰세요.
  보장 요약: ${(coverageSummaryForPrompt || []).slice(0, 5).join(' / ')}` : (designSheetAnalysis as { designFocusLabel?: string })?.designFocusLabel ? `- 담보 초점: ${(designSheetAnalysis as { designFocusLabel: string }).designFocusLabel}. 이 초점을 본문에 자연스럽게 녹이세요.` : ''}
${coverageFocusLabels && coverageFocusLabels.length > 0 ? `- 보장 축 참고: ${coverageFocusLabels.join(', ')}` : ''}` : ''}
${designSheetAnalysis ? `
[⛔ 설계서 질문 본문 금지]
- 질문 **본문**에 "해지하면 돌려받는 돈", "환급금 없는 구조", "중도에 해지하면", "돌려받는 돈이 거의 없는", "해약환급금" 등 해약/환급 구조 설명을 넣지 마세요. 설계서의 중요한 포인트가 아니에요.` : ''}
${searchKeywords && searchKeywords.length > 0 ? `
[연관 키워드 반영]
- 상위 1~2개를 제목 또는 본문에 문맥에 맞게 녹이세요
- 제목에는 최대 1개, 본문에는 최대 2개 수준으로 자연스럽게 사용하세요` : ''}

[출력 형식 - 반드시 JSON]
아래 JSON 형식으로만 출력하세요. 다른 텍스트 없이 JSON만 출력하세요.
\`\`\`json
{
  "title": "카페 질문형 제목 (25~40자, 의문형 종결)",
  "body": "카페 질문 본문 (반드시 300~500자, 최대 550자 초과 금지)"
}
\`\`\`

주의:
- title과 body를 반드시 분리해서 JSON으로 출력하세요
- title에는 본문 내용을 넣지 마세요
- **body는 300~500자 이내로만 작성하세요. 550자 초과 시 잘리므로 길게 쓰지 마세요.**
- **body는 2~3문단으로 나누고, 문단 사이에 빈 줄을 넣어주세요.** (한 덩어리로 쓰지 말 것)
- body 첫 문장에 호칭만 단독으로 넣지 마세요 (❌ "선배님들!", ❌ "옆집 언니들!")
- body 첫 문장은 반드시 상황 설명이나 고민 문장으로 시작하세요
- JSON 외의 텍스트를 출력하지 마세요`
  
  return {
    prompt,
    openingFamilyId: openingFamily?.id || 'unknown',
    openingFamilyName: openingFamily?.name || 'unknown',
    titlePatternId: selectedTitlePattern.id,
    questionConceptId: selectedConcept.id,
    concernVariant: concernVariant || undefined,
  }
}

export interface AnswerPromptResult {
  prompt: string
  /** ANSWER_STRUCTURES에서 선택된 구조 id (KPI 추적용) */
  answerStructureId: string
  /** ANSWER_OPENERS_BY_TONE에서 선택된 톤 카테고리 (KPI 추적용) */
  answerOpenerCategory: string
  /** ANSWER_PERSONAS에서 선택된 페르소나 id (KPI 추적용) */
  answerPersonaId: string
}

/**
 * Step 2: 전문가 답변 생성 프롬프트
 */
export function generateAnswerPrompt(data: QAPromptData, questionTitle: string, questionContent: string): AnswerPromptResult {
  const { productName, topicName, displayProductName, agentSafeName, sellingPoint, answerTone, targetPersona, designSheetAnalysis, answerLength, searchResultsText, searchKeywords, evidenceMap, conflictAxis, selectedConcern, selectedConcernSearch, coverageSummaryForPrompt, coverageFocusLabels } = data
  // 답변/설계사 측은 회사명·브랜드 노출 금지 — agentSafeName(예: "이 건강보험")만 사용
  const customerFacingName = agentSafeName || topicName || productName
  const displayName = agentSafeName || displayProductName || customerFacingName
  
  // 코드 레벨 무작위성: 답변 구조 랜덤 선택
  const selectedStructure = getRandomItem(ANSWER_STRUCTURES)

  const toneMap: Record<string, string> = {
    'friendly': '카페에서 보험 잘 아는 지인이 편하게 답해주는 느낌으로',
    'expert': '보험 잘 아는 사람이 핵심만 짚어주는 느낌으로',
    'comparative': '여러 상품 봤던 경험자가 객관적으로 비교하는 느낌으로',
    'persuasive': '이 상품 잘 아는 사람이 솔직하게 알려주는 느낌으로',
  }

  const selectedTone = toneMap[answerTone] || toneMap['friendly']

  // ── 답변 첫 문장 다양성: 5가지 톤 카테고리 × 4~5개 = 24개 ──
  // 같은 이미지를 여러 번 분석해도 첫 문장이 매번 달라지도록 폭넓게 분포
  const ANSWER_OPENERS_BY_TONE = {
    공감형: [
      '걱정되시는 부분이 딱 그 부분이죠',
      '그 부분 고민하시는 거 맞아요',
      '네 그 구조라서 고민되시는 거 이해해요',
      '그 고민 정말 자연스러운 거예요',
      '말씀하신 부분 보니까 어디서 막히시는지 보이네요',
    ],
    경험공유형: [
      '저도 처음에 그 부분이 제일 신경 쓰였어요',
      '저도 비슷한 거 알아본 적 있어서 말씀드리면',
      '저희 가족도 이런 구조 들어봐서 아는데요',
      '저도 같은 고민으로 한참 비교해봤거든요',
      '몇 번 비슷한 케이스 본 적 있어서 적어볼게요',
    ],
    핵심짚기형: [
      '말씀하신 부분이 핵심이에요',
      '그게 제일 중요한 포인트예요',
      '결국 봐야 할 건 거기가 맞아요',
      '진짜 봐야 할 데가 그 부분이에요',
      '딱 그 지점이 이 상품의 갈림길이에요',
    ],
    솔직진단형: [
      '솔직히 말하면 이게 두 갈래로 나뉘는 구조예요',
      '이 상품 그냥 단순한 게 아니라 호불호가 갈리는 구조라',
      '편하게 적어보면 장단점이 명확한 상품이에요',
      '있는 그대로 말하면 누구한텐 좋고 누구한텐 부담이에요',
      '포장하지 않고 보면 가격이랑 구조가 연결돼 있는 상품이에요',
    ],
    질문되돌리기형: [
      '결국 이게 본인한테 맞느냐가 핵심이에요',
      '판단은 한 가지 질문에서 시작돼요',
      '먼저 이거 하나만 정리되면 답이 보여요',
      '시작할 때 한 가지만 봐도 절반은 정해져요',
    ],
  } as const

  // 톤 카테고리 자체도 랜덤 → 첫 문장이 더 다양하게 분포
  const ANSWER_OPENER_CATEGORIES = Object.keys(ANSWER_OPENERS_BY_TONE) as Array<keyof typeof ANSWER_OPENERS_BY_TONE>
  const selectedOpenerCategory = getRandomItem(ANSWER_OPENER_CATEGORIES)
  const empathyText = getRandomItem(ANSWER_OPENERS_BY_TONE[selectedOpenerCategory])

  // ── 답변 마무리 다양성: 16개 ──
  const ANSWER_CLOSERS = [
    '이 부분만 보시면 판단이 한결 쉬워질 거예요',
    '유지 가능성 먼저 보시면 그 다음은 자연스럽게 정리돼요',
    '이 한 가지만 본인 기준에 맞춰서 보시면 답이 보일 거예요',
    '본인 상황에 맞춰서 그 부분만 점검해보시면 충분해요',
    '그 부분만 한 번 더 짚어보시면 큰 그림이 보여요',
    '결국 이건 가격이 아니라 구조를 어떻게 받아들이느냐 문제예요',
    '같은 가격대 일반형이랑 한 번 비교해보시면 감이 잡혀요',
    '이건 좋다 나쁘다보다 본인한테 맞느냐가 답이에요',
    '여기까지만 정리되면 나머지는 어렵지 않아요',
    '이 한 줄만 머리에 두고 보시면 판단이 빨라져요',
    '그 부분 확인이 첫 단추예요',
    '먼저 이 조건만 본인이랑 맞춰보시면 돼요',
    '이게 정해지면 나머지는 따라오는 결정이에요',
    '본인이 끝까지 갈 수 있느냐가 진짜 기준이에요',
    '결국 본인이 감당할 수 있는 구조인지가 핵심이에요',
    '이걸 먼저 보시면 어떤 게 본인한테 맞는지 보일 거예요',
  ] as const
  const closerText = getRandomItem(ANSWER_CLOSERS)

  // ── 답변자 페르소나 family: 5개 (중립/경험자/꼼꼼이/솔직형/비교 마니아) ──
  const ANSWER_PERSONAS = [
    { id: 'neutral', name: '중립 회원', guide: '편향 없이 장단점을 둘 다 짚어줌. "이건 ~이고 저건 ~이에요" 톤' },
    { id: 'experienced', name: '경험자', guide: '"저도 해봤는데/들어봤는데" 1인칭 경험을 살짝 섞음. 자랑은 안 함' },
    { id: 'detail', name: '꼼꼼이', guide: '조건과 예외를 짚어주는 톤. "이 부분만 조심하시면" 식으로 디테일 한 줄' },
    { id: 'frank', name: '솔직형', guide: '포장하지 않고 호불호를 명확히 말함. "이건 좋은데 저건 부담돼요" 톤' },
    { id: 'comparator', name: '비교 마니아', guide: '"비슷한 일반형이랑 비교하면" 식으로 다른 옵션과 비교 한 줄' },
  ] as const
  const selectedAnswerPersona = getRandomItem(ANSWER_PERSONAS)

  // 설계서 정보
  const premiumInfo = designSheetAnalysis?.premium || ''
  const coverageInfo = designSheetAnalysis?.coverages || []
  const specialClauseInfo = designSheetAnalysis?.specialClauses || []

  // concern 생활형 변주 (답변에서 사용)
  const rawConcern = conflictAxis?.keyword || ''
  const answerConcernVariant = rawConcern ? pickConcernVariant(rawConcern) : ''
  if (answerConcernVariant && answerConcernVariant !== rawConcern) {
    console.log(`[답변 프롬프트] concernVariant 선택: "${rawConcern}" → "${answerConcernVariant}"`)
  }

  const answerPrompt = `당신은 보험카페에서 ${customerFacingName}에 대해 잘 아는 사람입니다. 카페 답글을 달아주세요.

[절대 규칙]
- 전문가 자기소개 금지 ("10년 경력", "설계사입니다", "전문가님" 등)
- 상담 유도 금지 ("연락 주세요", "문의 주세요", "비교 설계 받아보세요" 등)
- 영업 냄새 금지 — 정보를 주되 판단은 읽는 사람이 하게 해야 함
- 정리문체 금지 ("정리해드리면", "따라서", "검토해보세요", "고려하시면")

[🚨 상품명 사용 규칙 — 답변/설계사 측은 회사명·브랜드 노출 절대 금지]
- 답변 본문에서는 "${customerFacingName}" 같은 일반 카테고리 표현만 사용하세요 (예: "이 건강보험", "이 간편보험", "이 상품")
- 회사명 절대 금지: 삼성/한화/교보/현대해상/DB/메리츠/흥국/KB/하나/동양/신한라이프/NH농협/AIG/푸본현대/처브라이프/미래에셋/AXA/AIA/라이나/MG/동부 등 보험사명을 답변에 쓰지 마세요
- 브랜드/원본 상품명 절대 금지: "M-케어", "마이핏1680", "흥Good 든든한", "하나더퍼스트", "통합건강보험 ONE" 같은 고유 브랜드 명칭을 답변에 쓰지 마세요 (질문 본문에는 OK, 답변에는 NO)
- 괄호, 버전 코드, 로마숫자(I, II, III), 점 시퀀스(3.10.5), 코드(5N5/3N5), (주), 무배당 같은 내부 표기 절대 금지
- 해지·환급 구조 설명 절대 금지: "중간에 해지하면 돌려받는 돈이 거의 없는", "해지하면 돌려받는 돈이 없는 구조", "해약환급금이 없는 대신" 등은 전문가 답변에 절대 쓰지 마세요. 간편심사 등 다른 보장 구조어는 자연스럽게 사용 가능
- 자연스러운 대체 표현: "이 건강보험은 ~", "이 상품은 ~", "말씀하신 보험은 ~", "지금 보고 계신 설계서는 ~"
${evidenceMap?.forbiddenPatterns && evidenceMap.forbiddenPatterns.length > 0 ? `
[⛔ 절대 사용 금지 표기]
${evidenceMap.forbiddenPatterns.map(p => `- "${p}"`).join('\n')}` : ''}

[역할]
- 보험카페에서 이 상품에 대해 잘 아는 회원
- "상담원"이 아니라 "잘 아는 지인"의 답글 느낌
- 읽는 사람에게 "아, 뭘 봐야 하는지 알겠다" 느낌을 줘야 함
${searchResultsText ? `
[최근 검색 요약]
- 아래 검색 요약을 근거로 최신/구체 정보를 자연스럽게 반영하세요
- 링크나 출처를 본문에 남기지 말고 내용만 녹여서 전달하세요
${searchResultsText}
` : ''}
${searchKeywords && searchKeywords.length > 0 ? `
[연관 키워드]
- 상위 1~2개만 답변에 자연스럽게 녹이세요 (나열 금지)
- 키워드: ${searchKeywords.join(', ')}` : ''}
${evidenceMap?.answerFacts && evidenceMap.answerFacts.length > 0 ? `
[📋 답변 근거 사실 (Evidence Map)]
아래는 설계서에서 확인된 사실입니다. 답변은 이 근거를 참고해 쓰면 됩니다.
근거에 없는 내용은 단정하지 말고, 추정할 경우 "~로 보여요", "~일 수 있어요" 등으로 표시하세요.
${evidenceMap.answerFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')}` : ''}
${conflictAxis ? `
[⚖️ 판단 축 (Conflict Axis) — 참고 정보]
이 상품의 핵심 판단 갈등 (배경 지식, 그대로 쓰지 말 것):
- 키워드: ${conflictAxis.keywordNatural}
- 유리한 경우: ${conflictAxis.proCondition}
- 불리한 경우: ${conflictAxis.conCondition}
${answerConcernVariant ? `- 답변에서는 "${answerConcernVariant}" 같은 생활형 표현을 쓸 수 있어요 (전문 용어 대신)` : ''}

⚠️ 판단 한 줄 작성 시 다음 정형 패턴을 **절대 그대로** 쓰지 마세요 (다양성 저하):
- "본인 상황에 맞으면 유리하지만 아니면 부담이 될 수 있는 구조"
- "맞으면 유리하고 안 맞으면 부담"
- "유리하지만 반대라면 ~ 부담"
대신 매번 다른 방식으로 판단을 표현하세요. 예시 (그대로 복사 금지, 변형 필수):
- "${conflictAxis.proCondition.split(' ').slice(0,3).join(' ')}이 가능한 분에겐 좋고, 그 외엔 무리가 따르는 구조예요"
- "이건 ${conflictAxis.keywordNatural} 쪽에서 갈려요 — 끝까지 갈 분에겐 합리적, 중간에 흔들릴 분에겐 손해"
- "결국 ${conflictAxis.keywordNatural}에 본인이 어떻게 답하느냐가 결정해요"
- "${conflictAxis.proCondition.split(' ').slice(0,2).join(' ')}이라면 가성비, 반대라면 비용만 남는 보험"
- "이 상품은 ${conflictAxis.keywordNatural}을 기준으로 호불호가 명확히 갈리는 편이에요"` : ''}
${(selectedConcern ?? selectedConcernSearch) && designSheetAnalysis ? `
[📌 설계서 판단 축]
- 판단 축 (내부 참고용, 답변에 그대로 인용 금지): "${selectedConcern || selectedConcernSearch}"
- ⛔ 위 검색어 표현을 답변 본문에 따옴표로 인용하거나 그대로 박지 말 것 (예: "이건 ~괜찮은지 스스로 질문해 보셨을 때" 식 금지)
- ✅ 이 축의 의미를 자기 말로 풀어서 답변 흐름에 자연스럽게 녹여야 함. 예: "본인이 ~을 어떻게 보느냐에 따라 갈려요"
${(coverageSummaryForPrompt?.length ?? 0) > 0 ? `- 근거는 아래 보장 요약 중 2개 안팎을 사용하면 됩니다. 설계서에 없는 특약·치료는 넣지 마세요.
  보장 요약: ${(coverageSummaryForPrompt || []).slice(0, 5).join(' / ')}` : (designSheetAnalysis as { designFocusLabel?: string })?.designFocusLabel ? `- 담보 초점: ${(designSheetAnalysis as { designFocusLabel: string }).designFocusLabel}. 이 초점을 근거로 1~2문장 언급하면 됩니다.` : ''}
${coverageFocusLabels?.length ? `- 보장 축 참고: ${coverageFocusLabels.join(', ')}` : ''}
- "끝까지 유지할 수 있으면 괜찮다" 같은 고정 문장만 반복하지 말고, 공감 → 판단 → 근거 → 마무리 흐름을 유지하세요.` : ''}

[핵심 지침]

1. **이번 답변의 답변자 페르소나**: ${selectedAnswerPersona.name}
   - ${selectedAnswerPersona.guide}
   - 이 페르소나의 톤이 답변 전체에 자연스럽게 묻어나야 합니다 (자기소개 금지, 톤만)

2. **답변 흐름 (이번 글은 "${selectedStructure.id}" 구조)**:
   - ${selectedStructure.description}
   - 순서: ${selectedStructure.order.join(' → ')}
   - 위 구조를 따르되, 다음 4가지 요소가 어딘가에 모두 들어가야 합니다 (순서는 구조에 따라 자유):
     * 공감 또는 진단 한 줄 (시작 문장 제안: "${empathyText}" — 그대로 복사하지 말고 ${selectedOpenerCategory} 톤으로 자기 말로 변형하세요)
     * 판단 한 줄: ${conflictAxis ? `"${conflictAxis.proCondition}" vs "${conflictAxis.conCondition}" 축으로 누구에게 유리/불리한지` : '이 상품이 누구에게 유리/불리한지 한 줄로'}
     * 구체적 이유 2~3개: ${evidenceMap?.answerFacts ? 'Evidence Map 근거를 참고해' : ''} 보험료·보장 범위·유지 가능성 중 2~3가지
     * 마무리 한 줄 (예: "${closerText}" — 그대로 복사하지 말고 변형하세요)

   ${premiumInfo ? `- 보험료(${premiumInfo}) 정보가 있으면 본문에 언급` : ''}
   ${coverageSummaryForPrompt && coverageSummaryForPrompt.length > 0 ? `- 아래 보장 요약 중 최소 2개 이상을 실제 이름을 살짝 풀어서 언급 (대괄호·코드·로마숫자 없이 자연어로)` : coverageInfo.length > 0 ? `- 설계서 담보 중 최소 2개 이상을 실제 이름을 살짝 풀어서 언급 (대괄호·코드·로마숫자 없이 자연어로)` : ''}

3. **말투 규칙**:
   - 톤: ${selectedTone}
   - 허용: "저라면", "보통은", "이건", "이 상품은"
   - 가급적 피하기: "정리해드리면", "따라서", "결론적으로", "종합적으로", "전반적으로", "다양한 관점에서", "검토해보세요", "고려하시면", "한번 정리해보면"
   - 금지: "전문적으로 말씀드리면", "상담 경험상", "설계사 관점에서", "연락 주시면", "비교 설계", "10년 경력", "전문가입니다"
   - 전문 용어를 그대로 나열하지 말고 자연어로 풀어서. 예: "납입면제 특약" → "아플 때 보험료 안 내도 되는 안전장치"
   - 예시 느낌 (그대로 복사 금지, 톤만 참고):
     * "이건 끝까지 유지 가능하면 괜찮고, 중간 해지 가능성이 있으면 부담이 큰 구조예요"
     * "보험료가 싼 이유가 환급금 구조 때문이라, 가격만 보고 들어가면 나중에 불편할 수 있어요"
     * "보장보다 먼저 본인이 20년 동안 끌고 갈 수 있는 구조인지가 더 중요해 보여요"
${designSheetAnalysis && answerTone === 'expert' ? `
   - **설계서 모드(expert 톤)**: 전문적인 사람이 존댓말·카페 문장 구조만 빌린 톤으로 작성하세요. 이모티콘/과한 카페체는 줄이고, 치매·장기요양 관련 설계라면 아래처럼 실제로 짚어주는 한 줄을 넣으면 좋습니다.
     * "치매 진단 기준(CDR)이나 장기요양 등급이 설계서에 어떻게 반영돼 있는지 먼저 보시면 좋아요"
     * "갱신 시 나이·건강에 따라 보장이 바뀌는지 한 번 확인해보시는 게 좋아요"` : ''}

4. **답변 길이·구조**: 320~420자 (권장), 280~520자 사이 (허용 한도)
   - 🚨 **반드시 3개 단락으로 출력** (한 덩어리로 쓰면 카페 가독성 0)
   - 단락 사이에는 **빈 줄 1개** (즉 \\n\\n) 반드시 넣기
   - 출력 형식 (이 구조 그대로 따르기):

     [단락 1: 공감/진단 — 1~2문장, 60~120자]
     첫 문장은 짧게, 고객 고민 공감 또는 핵심 진단

     [단락 2: 분석/근거 — 2~3문장, 150~280자]
     상품의 작동 방식, 보장 구조, 가격·조건 분석

     [단락 3: 마무리/판단 기준 — 1~2문장, 60~120자]
     핵심 한 줄 또는 비교/체크 권유로 자연스럽게 닫기

   - 각 단락은 2~3문장. 문장 중간 줄바꿈 절대 금지 (단락 끝에서만 줄바꿈)
   - 단락 4개 이상 금지, 1개(한 덩어리) 절대 금지

5. **이모티콘**: 선택적 사용 (전혀 안 써도 OK)
   - 사용한다면 전체 0~3개, 문단 시작 또는 끝 어디든 자연스러우면 OK

6. **사실성**: Evidence Map 밖의 사실을 단정하지 말 것
   - 설계서에 없는 특약을 만들어 말하지 말 것
   - 추정할 경우 "~로 보여요", "~일 수 있어요" 사용
   - 구체적 금액은 설계서 데이터 기반으로만

${COMMON_GUIDELINES.NO_PERIOD}

${COMMON_GUIDELINES.SENTENCE_INTEGRITY}

[톤 참고용 답변 예시 (이 느낌으로만, 그대로 복사 절대 금지)]:
이거 솔직히 말하면 두 갈래로 나뉘는 구조라 본인이 어느 쪽인지부터 봐야 해요

저라면 이 상품은 끝까지 가져갈 자신이 있느냐가 첫 번째 기준이에요 보험료가 낮은 편이라 가성비는 좋은데, 환급이 적은 구조라서 중간에 그만두면 손해가 커지거든요 거기에 암 관련 치료비를 집중해서 보는 점은 분명한 장점이에요

같은 보험료대 일반형이랑 보장 범위 한 번만 나란히 놓고 보시면 본인한테 어떤 게 맞는지 금방 보여요

[입력 정보]

- 질문 제목: ${questionTitle}
- 질문 내용: ${questionContent}
- 답변에서 사용할 상품 지칭어 (이것만 사용): ${customerFacingName}
- 답변 강조 포인트 (참고): ${sellingPoint}
- 질문자 정보: ${targetPersona}
- 답변 흐름(공감 → 판단 → 이유 → 마무리) 안에서 위 강조 포인트를 자연스럽게 녹이면 좋아요. 복붙하지 말고 문맥에 맞게 풀어 쓰세요.
${premiumInfo ? `- 설계서 보험료: ${premiumInfo}` : ''}
${coverageInfo.length > 0 ? `- 설계서 담보: ${coverageInfo.join(', ')}` : ''}
${specialClauseInfo.length > 0 ? `- 설계서 특약: ${specialClauseInfo.join(', ')}` : ''}
${(coverageSummaryForPrompt?.length ?? 0) > 0 ? `- 보장 요약(답변 근거로 사용): ${coverageSummaryForPrompt!.slice(0, 5).join(' / ')}` : ''}

${COMMON_GUIDELINES.DIVERSITY}
- 답변 시작 방식, 설명 순서, 표현 방식을 매번 다르게 선택하세요
- 같은 내용이라도 설명 방식과 순서를 매번 다르게 하세요

**절대 금지**:
- 520자 초과
- 280자 미만 (공감+판단+이유+마무리 4블록이 빠지지 않도록)
- 4개 이상 문단으로 나누기
- 한 문장마다 줄바꿈 (한 문단에 여러 문장 자연스럽게 연결)
- 의미 없는 미사여구 ("소중한 질문 감사합니다" 등)
- 기계적인 인사 ("안녕하세요 설계사입니다" 반복)
- 짜고 치는 느낌 (설계사에게 과도하게 친근하거나 정중하지 말 것)
- 추상적인 설명 (구체적 금액·특약명·보장 내용 필수)
- 제어 문자 사용

${COMMON_GUIDELINES.OUTPUT_FORMAT}

[생성된 답변]`

  return {
    prompt: answerPrompt,
    answerStructureId: selectedStructure.id,
    answerOpenerCategory: selectedOpenerCategory,
    answerPersonaId: selectedAnswerPersona.id,
  }
}

/**
 * Step 3: 대화형 스레드 생성 프롬프트 (댓글 형식)
 * 첫 답변 이후 자연스러운 대화를 이어가는 댓글들을 생성
 */
export function generateConversationThreadPrompt(
  data: QAPromptData,
  context: ConversationContext
): string {
  const { productName, topicName, displayProductName, targetPersona, worryPoint, sellingPoint, answerTone, answerLength, designSheetAnalysis, searchResultsText, conflictAxis, selectedConcern, selectedConcernSearch, coverageSummaryForPrompt, coverageFocusLabels } = data
  const customerFacingName = topicName || productName
  const displayName = displayProductName || customerFacingName
  const { initialQuestion, firstAnswer, conversationHistory, totalSteps, currentStep } = context

  // 현재 단계에 따른 역할 결정
  const isCustomerTurn = currentStep % 2 === 1 // 홀수: 고객, 짝수: 설계사
  const isLastStep = currentStep >= totalSteps
  const stepNumber = Math.ceil(currentStep / 2) // 몇 번째 댓글인지

  // 이전 대화 요약 (중복 방지용)
  const historyText = conversationHistory
    .map(msg => `[${msg.role === 'customer' ? '고객' : '설계사'}]: ${msg.content}`)
    .join('\n')
  
  // 쪽지/상담 요청이 이미 있었는지 확인
  const allHistoryText = [initialQuestion.title, firstAnswer, ...conversationHistory.map(m => m.content)].join(' ')
  const hasAskedForDM = allHistoryText.includes('쪽지') || allHistoryText.includes('상담') || allHistoryText.includes('문의')

  // 설계서 데이터 (구체적 언급용)
  const price = designSheetAnalysis?.premium || '이 보험료'
  const coverage = designSheetAnalysis?.coverages?.[0] || '보장 내용'

  // concern 생활형 변주 (개별 댓글에서 사용)
  const rawConcern = conflictAxis?.keyword || ''
  const threadConcernVariant = rawConcern ? pickConcernVariant(rawConcern) : ''
  if (threadConcernVariant && threadConcernVariant !== rawConcern) {
    console.log(`[스레드 프롬프트] concernVariant 선택: "${rawConcern}" → "${threadConcernVariant}"`)
  }

  // 이전 대화에서 나온 주제 추출 (중복 방지용)
  const previousTopics: string[] = []
  if (allHistoryText.includes('가격') || allHistoryText.includes('보험료')) previousTopics.push('가격')
  if (allHistoryText.includes('보장') || allHistoryText.includes('특약')) previousTopics.push('보장')
  if (allHistoryText.includes('가입') || allHistoryText.includes('절차')) previousTopics.push('가입절차')
  if (allHistoryText.includes('비교') || allHistoryText.includes('다른 보험')) previousTopics.push('비교')

  if (isCustomerTurn) {
    // 페르소나 선택
    const selectedPersona = getWeightedPersona()
    
    // 상황 노이즈 선택 (문체 다양성)
    const currentContext = getRandomContext()
    
    // 댓글 Family 시스템: 역할별 다양한 패턴으로 하루 20개를 올려도 비슷하지 않게
    const COMMENT_FAMILIES = [
      {
        type: '의심/검증',
        weight: 3,
        guide: `의심하세요. "진짜 이 가격(${price})에 되나요?", "나중에 오르는 거 아닌가요?", "특약 빠진 거 없나요?" 같이 물어보세요.`
      },
      {
        type: '구체적 비교',
        weight: 2,
        guide: `다른 보험사와 비교하세요. "A사는 비싸던데 여긴 싸네요 이유가 뭔가요?", "B사보다 보장 범위가 좁은 거 아닌가요?"`
      },
      {
        type: '조건 확인',
        weight: 2,
        guide: `가입 조건에 집착하세요. "병력 있어도 되나요?", "실비 청구 이력 있는데 거절될까요?", "30대 후반도 가능한가요?"`
      },
      {
        type: '공감/불안 공유',
        weight: 2,
        guide: `질문자의 고민에 공감하세요. "저도 같은 고민이에요", "저도 환급금 없는 게 좀 찝찝했는데", "나도 비슷한 나이라 걱정돼요" 같은 반응 후 추가 질문.`
      },
      {
        type: '실사용 경험 요청',
        weight: 1,
        guide: `실제 경험을 물어보세요. "혹시 이 보험 가입하신 분 계세요?", "실제로 청구해보신 분 있나요?", "건강할인 실제로 받으신 분?" 같이 경험 공유를 요청하세요.`
      },
      {
        type: '추가질문/디테일',
        weight: 2,
        guide: `세부 사항을 파고드세요. "납입면제 조건이 정확히 어떻게 되나요?", "갱신 시 보험료가 얼마나 오르나요?", "입원일당은 며칠부터인가요?" 같이 구체적으로 물어보세요.`
      },
      ...(hasAskedForDM ? [] : [{
        type: '판단정리형',
        weight: 1,
        guide: `대화를 통해 이해가 된 느낌. "말씀 들어보니 유지만 잘 하면 괜찮은 구조인 것 같아요", "결국 저한테 맞느냐가 핵심이네요" 같이 판단 의사를 보여주세요`
      }])
    ]

    // 가중치 기반 랜덤 선택 (이전 댓글에서 사용한 유형 회피)
    const usedTypes = new Set(previousTopics)
    const availableFamilies = COMMENT_FAMILIES.filter(f => !usedTypes.has(f.type))
    const pool = availableFamilies.length > 0 ? availableFamilies : COMMENT_FAMILIES
    const totalWeight = pool.reduce((sum, f) => sum + f.weight, 0)
    let rand = Math.random() * totalWeight
    let selectedFamily = pool[0]
    for (const f of pool) {
      rand -= f.weight
      if (rand <= 0) { selectedFamily = f; break }
    }

    const commentTypes = COMMENT_FAMILIES

    // 마지막 스텝이면 판단정리형으로 유도
    const finalFamily = (currentStep >= totalSteps - 2 && !hasAskedForDM)
      ? (COMMENT_FAMILIES.find(f => f.type === '판단정리형') || selectedFamily)
      : selectedFamily

    return `당신은 보험카페 회원(${selectedPersona.type})입니다.
    
[상황 부여 (이 느낌을 살리되 존댓말 필수)]
- **${currentContext}**
- 댓글 역할: ${finalFamily.type}
- 행동 지침: ${finalFamily.guide}

[작성 지침]
1. **말투: 무조건 존댓말(해요체/하십시오체)을 사용하세요.** (반말 금지)
2. 내용: 이전 댓글들과 겹치지 않는 새로운 질문/반응을 하세요. 고민이나 반응을 2~3문장으로 풀어서 쓰세요.
   ${previousTopics.length > 0 ? `- 이미 다룬 주제: ${previousTopics.join(', ')} (이 주제는 피하세요)` : ''}
3. 주의: 가입 '후기'가 아니라 가입 전 '문의'입니다.
4. 형식: 
   - 마침표(.) 대신 줄바꿈이나 물음표(?) 사용
   - **문장 중간에 줄바꿈 금지**: 한 문장은 반드시 한 줄에 이어 쓰세요
5. **⚠️ 글자 수 제한 (반드시 지키세요)**:
   - ${stepNumber <= 2 ? '이 댓글은 **180~250자** 사이로 작성하세요' : stepNumber <= 4 ? '이 댓글은 **150~220자** 사이로 작성하세요' : '이 댓글은 **100~180자** 사이로 작성하세요'}
   - 위 범위를 벗어나면 실패입니다. 쓰기 전에 머릿속으로 분량을 가늠하고, 초과하지 않게 핵심만 담으세요
   - 길어지면 설명을 줄이고 질문 하나에 집중하세요

${COMMON_GUIDELINES.SENTENCE_INTEGRITY}

[입력 정보]
- 관심 상품: ${customerFacingName}
- 핵심 포인트: ${sellingPoint}
- 언급할 금액: ${price}
${coverage ? `- 언급할 보장 내용: ${coverage}` : ''}
- ⚠️ 괄호, 버전 코드, 로마숫자(I, II, III), (주), 무배당 같은 내부 표기는 절대 넣지 마세요
${conflictAxis ? `
[⚖️ 핵심 갈등 축]
이 상품의 핵심 갈등: ${conflictAxis.keywordNatural}
- 유리한 경우: ${conflictAxis.proCondition}
- 불리한 경우: ${conflictAxis.conCondition}
${threadConcernVariant ? `- 이 갈등을 말할 때 "${threadConcernVariant}" 같은 생활형 표현을 쓰세요` : ''}
→ 이 갈등과 관련된 고민을 자연스럽게 드러내세요` : ''}
${(selectedConcern ?? selectedConcernSearch) && (coverageSummaryForPrompt?.length ?? 0) > 0 ? `
[📌 설계서 고민/보장 축]
- 고객 댓글은 **"${selectedConcern || selectedConcernSearch}"**를 자기 말로 다시 묻거나 확인하는 흐름으로 쓰세요. 또는 아래 보장 요약 중 1개를 집어서 추가 질문하세요.
- 보장 요약: ${(coverageSummaryForPrompt || []).slice(0, 4).join(' / ')}
- 매번 "그럼 결국 유지가 핵심이네요"처럼 같은 문장으로 수렴하지 말고, 고민 축에 맞춰 다른 반응을 하세요.` : ''}

[이전 대화]
Q: ${initialQuestion.title}
A: ${firstAnswer}
${historyText ? `이전 댓글들:\n${historyText}` : ''}

[댓글 작성]:`
  } else {
    // 설계사 댓글 생성
    // 고객의 마지막 질문 내용 파악
    const lastCustomerMsg = conversationHistory.length > 0 
      ? conversationHistory[conversationHistory.length - 1].content 
      : initialQuestion.content

    // 설계사 답변 톤 다양화
    const ADVISOR_TONES = [
      { type: '정리형', guide: '핵심만 정리해서 깔끔하게 답변하세요. 요점 2~3개로 나누어 설명하세요' },
      { type: '판단기준형', guide: '고객이 스스로 판단할 수 있는 기준을 제시하세요. "이런 경우라면~", "이 부분을 확인해보시면~"' },
      { type: '공감+해결형', guide: '고객 고민에 먼저 공감한 뒤 해결 방향을 제시하세요. "맞아요 그 부분 많이들 고민하시는데요~"' },
      { type: '주의사항형', guide: '놓치기 쉬운 주의사항을 짚어주세요. "한 가지 꼭 확인하셔야 할 게~", "이건 많이들 모르시는 부분인데~"' },
    ]
    const advisorTone = ADVISOR_TONES[Math.floor(Math.random() * ADVISOR_TONES.length)]

    // 마지막 설계사 턴이면 마무리 변주 가이드 추가
    const AGENT_ENDING_POOL = [
      '정리하면 유지 자신 있으면 괜찮고, 아니면 표준형 비교가 먼저예요',
      '결국 보험료가 아니라 내가 이 구조를 감당할 수 있느냐가 기준이에요',
      '이건 좋다 나쁘다보다 본인 상황에 맞느냐로 보시면 판단이 쉬워요',
      '보장 내용보다 유지 가능성을 먼저 따져보시면 답이 보일 거예요',
      '가격에 끌리셨다면, 그 가격의 조건을 받아들일 수 있는지가 핵심이에요',
      '20년이라는 시간을 버틸 수 있는지, 거기서부터 시작하시면 돼요',
      '싸다는 건 이유가 있고, 그 이유를 감수할 수 있으면 나쁘지 않아요',
      '이 구조가 내 성향에 맞는지, 그게 제일 먼저 볼 부분이에요',
    ]
    const lastStepEndingGuide = isLastStep
      ? `\n8. ⚠️ **마지막 답글 마무리 규칙**:
   - "비교 설계 받아보세요", "상담 받아보세요", "문의 주세요", "연락 주세요" 절대 금지
   - "핵심은 보험료보다" 로 시작하는 문장 금지 (반복 방지)
   - 마지막 문장은 아래 예시와 비슷한 톤으로, 단 자기 말로 바꿔서 쓰세요:
     "${AGENT_ENDING_POOL[Math.floor(Math.random() * AGENT_ENDING_POOL.length)]}"`
      : ''

    return `당신은 베테랑 설계사입니다. 위 회원의 댓글에 답글을 다세요.

[답변 톤: ${advisorTone.type}]
- ${advisorTone.guide}

[작성 지침]
1. **말투: 친절하고 정중한 존댓말 사용.** ("~님", "~요" 사용)
2. 내용: 고객의 질문에 대해 **동문서답하지 말고 딱 그 내용만** 답변하세요.
3. **범위 제한**: 답변은 이 상품의 보장 구조·간편심사·특약·보험료·가입조건·보장 범위 안에서만 하세요. 보험사 재무건전성·파산·예금자보호·역사 등 다른 주제로 확장하지 마세요.
4. 요령: 기계적인 인사는 생략하고, 판단 기준 정리로 자연스럽게 마무리하세요.
5. 형식: 
   - 마침표 사용 자제
   - **문장 중간에 줄바꿈 금지**: 한 문장은 반드시 한 줄에 이어 쓰세요. 문장이 끝난 뒤에만 줄바꿈하세요.
6. **⚠️ 글자 수 제한 (반드시 지키세요)**:
   - ${stepNumber <= 2 ? '이 답글은 **180~280자** 사이로 작성하세요' : stepNumber <= 4 ? '이 답글은 **150~230자** 사이로 작성하세요' : '이 답글은 **100~180자** 사이로 작성하세요'}
   - 초과하면 실패입니다. 핵심 답변 + 한 줄 행동 유도만으로 충분합니다
7. **톤**: "검토해보세요", "고려하시면" 대신 → "이건 꼭 보셔야 해요", "이 부분은 좀 조심하셔야 해요", "이 경우엔 괜찮은 편이에요" 같은 생활형 표현을 쓰세요${lastStepEndingGuide}

${COMMON_GUIDELINES.SENTENCE_INTEGRITY}

[고객의 질문]
"${lastCustomerMsg}"
${conflictAxis ? `
[⚖️ 핵심 갈등 축]
이 상품의 핵심 갈등: ${conflictAxis.keywordNatural}
- 유리한 경우: ${conflictAxis.proCondition}
- 불리한 경우: ${conflictAxis.conCondition}
- 핵심 판단: ${conflictAxis.summary}
${threadConcernVariant ? `- 이 갈등을 설명할 때 "${threadConcernVariant}" 같은 생활형 표현을 쓰세요` : ''}
→ 이 갈등 구조에 기반해 판단 기준을 제시하세요` : ''}
${(selectedConcern ?? selectedConcernSearch) && (coverageSummaryForPrompt?.length ?? 0) > 0 ? `
[📌 설계서 답글 규칙]
- 답글은 **보장 기준**으로 정리하세요. selectedConcern("${selectedConcern || selectedConcernSearch}")을 그대로 복붙하지 말고 자연스럽게 풀어 설명하세요.
- 아래 보장 요약 중 **1개 이상**을 실제 판단 근거로 사용하세요. 보장 요약: ${(coverageSummaryForPrompt || []).slice(0, 4).join(' / ')}
- 마지막 문장은 영업성("연락 주세요", "상담 받아보세요") 금지. "그럼 결국 유지만 잘 하면~" 같은 같은 마무리 문장을 매번 반복하지 말고, 톤을 바꿔서 마무리하세요.` : ''}

[이전 대화]
${historyText}

[답글 작성]:`
  }
}

/**
 * 2쌍 구조: 고객 댓글 + 설계사 답글을 한 번에 생성
 * 품질 우선: 1쌍씩 호출하여 앞 대화를 실제로 소화한 후속 대화 생성
 */
export function generateCommentPairPrompt(
  data: QAPromptData,
  context: {
    initialQuestion: { title: string; content: string }
    firstAnswer: string
    conversationHistory: ConversationMessage[]
    pairIndex: number // 0 = 첫째 쌍, 1 = 둘째 쌍
    totalPairs: number
    isLastPair: boolean
  }
): string {
  const { productName, topicName, displayProductName, agentSafeName, targetPersona, worryPoint, sellingPoint, designSheetAnalysis, conflictAxis, selectedConcern, selectedConcernSearch, coverageSummaryForPrompt, coverageFocusLabels } = data
  // 페어 댓글의 agent도 회사명·브랜드 노출 금지 — agentSafeName 사용 (질문/customer 측은 별도 입력에서 노출 OK)
  const customerFacingName = agentSafeName || topicName || productName
  const price = designSheetAnalysis?.premium || '이 보험료'
  const coverage = designSheetAnalysis?.coverages?.[0] || ''

  // concern 생활형 변주 (댓글에서 사용)
  const rawConcern = conflictAxis?.keyword || ''
  const commentConcernVariant = rawConcern ? pickConcernVariant(rawConcern) : ''
  if (commentConcernVariant && commentConcernVariant !== rawConcern) {
    console.log(`[댓글 프롬프트] concernVariant 선택: "${rawConcern}" → "${commentConcernVariant}"`)
  }

  const historyText = context.conversationHistory
    .map(msg => `[${msg.role === 'customer' ? '고객' : '설계사'}]: ${msg.content}`)
    .join('\n')

  const allText = [context.initialQuestion.title, context.firstAnswer, ...context.conversationHistory.map(m => m.content)].join(' ')
  const hasAskedForDM = allText.includes('쪽지') || allText.includes('상담') || allText.includes('문의')

  // 페어 흐름 family — 매번 다른 흐름 패턴으로 다양화 (이전엔 "걱정→기준→정리→유도" 정형 1개로 고정)
  const FIRST_PAIR_FLOWS = [
    { customerRole: '특정 보장 콕 집기', agentRole: '그 보장의 실제 작동 방식 설명', desc: '고객이 답변에서 본 특정 보장(예: 특약, 특정 진단비)을 콕 집어 추가 질문' },
    { customerRole: '비교 사례 요청', agentRole: '간략한 비교 + 본인에게 맞는 기준 한 줄', desc: '고객이 다른 회사/상품과 비교를 부탁, 설계사가 차이점만 짚음' },
    { customerRole: '본인 상황 추가 정보', agentRole: '그 상황에 맞는 한 줄 조언', desc: '고객이 본인 가족/병력/직업 같은 추가 정보를 주며 적합 여부 묻기' },
    { customerRole: '의심/반박', agentRole: '오해 풀어주기', desc: '고객이 "이거 진짜 그래요?" 식으로 의심, 설계사가 부드럽게 풀어줌' },
    { customerRole: '걱정 토로', agentRole: '공감 + 다른 시각 제시', desc: '고객이 불안을 토로, 설계사가 다른 관점에서 짚어줌' },
  ]
  const SECOND_PAIR_FLOWS = [
    { customerRole: '판단 결심 표현', agentRole: '결심 인정 + 마지막 점검 한 가지', desc: '고객이 가입 쪽으로 마음이 기울어 답글, 설계사가 마지막 한 가지만 짚음' },
    { customerRole: '여전한 망설임', agentRole: '망설임 정상화 + 시간 권유', desc: '고객이 아직 결정 못함을 인정, 설계사가 천천히 보라고 함' },
    { customerRole: '사이드 질문', agentRole: '간단 답 + 본 주제로 마무리', desc: '고객이 살짝 다른 질문 (예: 청약 절차, 갱신 시기), 설계사가 짧게 답하고 본 주제로 닫음' },
    { customerRole: '경험 공유', agentRole: '사례 짧게 받음 + 마무리', desc: '고객이 본인/지인 경험 짧게 공유, 설계사가 받아주며 마무리' },
    { customerRole: '핵심 재확인', agentRole: '핵심만 한 줄로 재정리', desc: '고객이 "그러니까 핵심은 이거 맞죠?" 식 재확인, 설계사가 한 줄 정리' },
  ]
  const flowPool = context.pairIndex === 0 ? FIRST_PAIR_FLOWS : SECOND_PAIR_FLOWS
  const pairFlow = flowPool[Math.floor(Math.random() * flowPool.length)]

  // 마지막 설계사 마무리 변주 풀 (매번 다른 톤으로 끝나게)
  const ENDING_VARIANTS = [
    '정리하면 유지 자신 있으면 괜찮고, 아니면 표준형 비교가 먼저예요',
    '결국 보험료가 아니라 내가 이 구조를 감당할 수 있느냐가 기준이에요',
    '이건 좋다 나쁘다보다 본인 상황에 맞느냐로 보시면 판단이 쉬워요',
    '보장 내용보다 유지 가능성을 먼저 따져보시면 답이 보일 거예요',
    '가격에 끌리셨다면, 그 가격의 조건을 받아들일 수 있는지가 핵심이에요',
    '20년이라는 시간을 버틸 수 있는지, 거기서부터 시작하시면 돼요',
    '싸다는 건 이유가 있고, 그 이유를 감수할 수 있으면 나쁘지 않아요',
    '이 구조가 내 성향에 맞는지, 그게 제일 먼저 볼 부분이에요',
  ]
  const pickedEnding = ENDING_VARIANTS[Math.floor(Math.random() * ENDING_VARIANTS.length)]

  const lastPairGuide = context.isLastPair
    ? `\n- 고객 댓글에 정리/확인 의사가 자연스럽게 드러나야 합니다 (가입 의향이 아닌 판단 의향)
- 설계사 답글은 **판단 기준 정리**로 마무리해야 합니다
- ⚠️ 마지막 설계사 답글에서 절대 금지: "비교 설계 받아보세요", "상담 받아보세요", "문의 주세요", "연락 주세요", "설계사 만나보세요", "핵심은 보험료보다"
- 마지막 문장은 반드시 아래 예시 중 하나와 비슷한 톤으로, 단 똑같이 쓰지 말고 자기 말로 바꿔서 쓰세요:
  "${pickedEnding}"`
    : ''

  return `당신은 보험카페 댓글 스레드를 쓰는 작가입니다.
아래 대화 맥락을 읽고, **고객 댓글 1개 + 설계사 답글 1개**를 JSON으로 생성하세요.

[스레드 흐름: ${pairFlow.desc}]
- 고객 역할: ${pairFlow.customerRole}
- 설계사 역할: ${pairFlow.agentRole}
${lastPairGuide}

[핵심 원칙]
1. 고객 댓글은 앞 대화를 **실제로 읽고 소화한** 느낌이어야 합니다. 앞 답변의 특정 내용을 가리키며 후속 질문을 하세요.
2. 설계사 답글은 고객 질문에 **정확히 대응**하되, 새로운 정보를 1개 이상 추가하세요.
3. **카페 댓글 말투** (존댓말, 문장 중간 줄바꿈 금지)
   - 설계사(agent): 마침표 최소(0~2개), "다"체 금지, "결론적으로/정리하면" 금지 → "~예요/~어요/~네요" 위주
   - 고객(customer): 마침표·"~요요" 같은 자연스러운 카페 표현 자유. 회사명/원본 상품명도 자유 사용 OK ("하나더퍼스트", "M-케어" 등 그대로 적어도 됨)
4. 설계사는 "검토해보세요", "고려하시면" 대신 → "이건 꼭 보셔야 해요", "이 부분은 좀 조심" 같은 생활형 표현을 쓰세요.
5. ⚠️ 다음 정형 패턴은 **절대 사용 금지** (이전 답변에서 매번 반복됐던 표현):
   - 설계사: "딱 두 가지만 체크해보세요" / "딱 두 가지만 기억하시면" / "딱 한 가지만"
   - 설계사: "첫째 ~ 둘째 ~" 번호 매김 (자연스럽게 풀어 쓰기)
   - 고객: "아 이제 그림이 그려지네요" / "아 이제 정리가 되네요" / "아하 ~군요"
   - 고객/설계사: "본인 상황에 맞으면 유리하지만 아니면 부담"
   - 양쪽 모두 매번 같은 마무리 톤 ("결국 ~가 핵심" "~게 답이에요")
   대신 매번 다른 도입 (예: "이 부분이 헷갈리실 수 있는데", "그 점이 의외로 중요해요", "한 가지 짚어드릴게요"), 다른 마무리 (열린 질문, 공감 한 줄, 추가 시각 한 줄 등)를 사용하세요.
${conflictAxis ? `5. [⚖️ 핵심 갈등 축 (Conflict Axis)]
   이 상품의 핵심 갈등: "${conflictAxis.keywordNatural}"
   - 유리한 경우: ${conflictAxis.proCondition}
   - 불리한 경우: ${conflictAxis.conCondition}
   - 핵심 판단: ${conflictAxis.summary}
   ${commentConcernVariant ? `- 댓글에서 이 갈등을 말할 때 "${commentConcernVariant}" 같은 생활형 표현을 쓰세요` : ''}
   → 고객은 이 갈등을 느끼고, 설계사는 판단 기준을 제시하세요.` : ''}
${(selectedConcern ?? selectedConcernSearch) && (coverageSummaryForPrompt?.length ?? 0) > 0 ? `
[📌 설계서 댓글 축]
- 고객 댓글: **"${selectedConcern || selectedConcernSearch}"**를 자기 말로 묻거나, 아래 보장 요약 중 1개를 집어서 추가 질문하세요. 보장 요약: ${(coverageSummaryForPrompt || []).slice(0, 4).join(' / ')}
- 설계사 답글: 보장 기준으로 정리하고, 위 보장 요약 중 1개 이상을 실제 판단 근거로 사용하세요. 마지막 문장은 영업성 금지. 같은 마무리 문장("결국 유지가 핵심이네요" 등) 반복 금지.` : ''}

[글자 수 제한]
- 고객 댓글: ${context.pairIndex === 0 ? '150~250자' : '120~200자'}
- 설계사 답글: ${context.pairIndex === 0 ? '180~280자' : '150~230자'}

[상품 정보]
- 보험료: ${price}
${coverage ? `- 주요 보장: ${coverage}` : ''}
- 🎯 고객(customer) 댓글에서 사용할 지칭어: 자유 (원본 상품명/회사명 그대로 OK, 예: "하나더퍼스트", "M-케어 건강보험", "그 보험" 등 자연스럽게)
- 🚨 설계사(agent) 답글에서만 사용 가능한 지칭어: ${customerFacingName} (회사명·브랜드 절대 노출 금지)

[🚨 설계사(agent) 댓글 절대 금지 — 회사명·브랜드 노출 금지]
- 회사명 절대 금지: 삼성/한화/교보/현대해상/DB/메리츠/흥국/KB/하나/동양/신한라이프/NH농협/AIG/푸본현대/처브라이프/미래에셋/AXA/AIA/라이나/MG/동부 등 보험사명을 설계사 답글에 쓰지 마세요
- 브랜드/원본 상품명 절대 금지: "M-케어", "마이핏1680", "흥Good 든든한", "하나더퍼스트", "통합건강보험 ONE" 같은 고유 브랜드 명칭을 설계사 답글에 쓰지 마세요
- 괄호, 버전 코드, 로마숫자(I, II, III), 점 시퀀스(3.10.5), 코드(5N5/3N5), (주), 무배당 같은 내부 표기 절대 금지
- 자연스러운 대체 표현: "이 건강보험은 ~", "이 상품은 ~", "말씀하신 보험은 ~"
- 단, 고객(customer) 댓글에서는 회사명/원본 상품명 노출 OK (실제 카페 사용자는 그렇게 적음). 설계사(agent) 답글에서만 절대 금지.

[🚨 설계사(agent) 답글 말투 규칙 — 정리문체/단정 마침표 금지]
- ❌ 절대 금지 단어/표현: "결론적으로", "결론은", "정리하면", "정리해드리면", "따라서", "종합적으로", "전반적으로", "검토해보세요", "고려하시면", "한번 정리해보면", "한 마디로"
- ❌ "~합니다", "~입니다" 같은 격식 "다"체 금지 — 카페 톤은 "~예요", "~어요", "~네요"
- ❌ 마침표(.) 사용 최소화 — 평문 종결은 마침표 없이 "~예요" 자체로 끝. 마침표 1~2개까지만 허용
- ✅ 자연스러운 카페 어미: "~예요", "~어요", "~거든요", "~네요", "~죠", "~잖아요"
- ✅ 단, 고객(customer) 댓글에서는 마침표/다체 일부 허용 (실제 카페 톤 다양함)

[원글 질문]
Q: ${context.initialQuestion.title}
${context.initialQuestion.content}

[첫 답변]
A: ${context.firstAnswer}
${historyText ? `\n[이전 댓글]\n${historyText}` : ''}

[출력 형식 - 반드시 JSON만]
\`\`\`json
{
  "customer": "고객 댓글 내용 (존댓말, 마침표 금지)",
  "agent": "설계사 답글 내용 (존댓말, 마침표 금지)"
}
\`\`\`
`
}

/**
 * 후기성 문구 생성 프롬프트 (고객이 보험 가입 후 감사 인사)
 * 토큰 절감: 이전 대화 맥락 제거, 패턴 예시 축소
 * 품질 유지: 핵심 정보(나이, 성별, 상품명) 유지, 상품 장점 강조
 */

export function generateReviewMessagePrompt(
  data: QAPromptData,
  context: {
    productName: string
  }
): string {
  const { productName, topicName, displayProductName, targetPersona } = data
  const customerFacingName = topicName || productName
  const displayName = displayProductName || customerFacingName

  // 나이/성별 추출 (공통 헬퍼)
  const { age, gender } = extractPersonaProfile(targetPersona)
  const genderLabel = gender === '남' ? '남성' : '여성'

  // ── 후기 톤 family: 8개 (서로 명확히 다른 톤) — 1개만 랜덤 선택 ──
  const REVIEW_TONES = [
    { id: 'reassured', name: '안심형', guide: '"가입하고 나니 마음이 놓인다"는 안도감 톤. 차분하고 현실적' },
    { id: 'practical', name: '실속형', guide: '"가성비가 좋아서 만족"이라는 실속 강조 톤. 보험료 대비 보장 만족' },
    { id: 'recommend', name: '추천형', guide: '"주변에도 추천하고 싶다"는 자연스러운 추천 의지 톤. 친구한테 알려주고 싶음' },
    { id: 'detail_appreciation', name: '꼼꼼 감사형', guide: '"설명을 자세히 해주셔서 이해가 쉬웠다"는 과정 감사 톤' },
    { id: 'family_relief', name: '가족 안도형', guide: '"가족도 든든해한다"는 가족 맥락 톤. 부모/배우자/자녀 언급' },
    { id: 'shy_thanks', name: '겸손 감사형', guide: '"덕분에 잘 가입했다"는 짧고 겸손한 감사 톤. 과한 칭찬 없음' },
    { id: 'future_relation', name: '관계 지속형', guide: '"앞으로도 잘 부탁드린다"는 관계 강조 톤. 추가 문의 의향' },
    { id: 'late_realization', name: '늦은 깨달음형', guide: '"진작 들었어야 했다"는 후회+감사 섞인 톤' },
  ] as const
  const selectedReviewTone = REVIEW_TONES[Math.floor(Math.random() * REVIEW_TONES.length)]

  return `당신은 보험카페에서 ${customerFacingName} 가입 후 설계사에게 감사 인사를 남기는 고객입니다.

[화자 프로필]
- ${age}세 ${genderLabel} (${targetPersona})
- 카페에서 질문 올렸다가 설계사 도움받아 ${customerFacingName} 가입 완료
- 이번 후기 톤: **${selectedReviewTone.name}** — ${selectedReviewTone.guide}

[상품명 표기 규칙]
- 본문 첫 언급에 "${displayName}" 1회 사용 가능, 이후엔 "${customerFacingName}" 짧은 주제명만
- 정식 상품명("${productName}")은 절대 그대로 쓰지 말 것
- 괄호, 버전 코드, 로마숫자, (주), 무배당 같은 내부 표기 금지

[작성 지침]
1. 길이: **150~250자** (한 덩어리 또는 2문단)
2. 위 "${selectedReviewTone.name}" 톤 한 가지로만 작성. 톤 가이드를 따르되 그대로 복사하지 말고 자기 말로 풀어 쓸 것
3. 카페 회원의 자연스러운 후기 톤 — 광고 같지 않게, 과한 숫자 나열 금지
4. 말투: ${age < 30 ? '20대 친근체 ("~네요", "~어요", 가벼운 ㅎ/ㅠ 1개 정도 OK)' : age < 50 ? '30-40대 정중체 ("~네요", "~합니다" 섞임, 무난한 톤)' : '50대 이상 정중체 ("~합니다", "~네요" 위주, 차분한 톤)'}

${COMMON_GUIDELINES.NO_PERIOD}

5. 다양성: 매번 다른 첫 문장, 다른 구조, 다른 어미로 작성. 이전 후기와 같은 패턴 반복 금지

[톤별 시작 문장 예시 (그대로 복사 금지, 느낌만 참고)]
- 안심형: "가입하고 나서야 마음이 좀 놓이네요"
- 실속형: "이 보험료에 이 보장이면 진짜 가성비 좋네요"
- 추천형: "친구한테도 알려주고 싶을 만큼 잘 들었어요"
- 꼼꼼 감사형: "한 단계씩 다 짚어주셔서 이해가 쉬웠어요"
- 가족 안도형: "저희 부모님도 든든해하시네요"
- 겸손 감사형: "덕분에 잘 가입했어요 감사합니다"
- 관계 지속형: "앞으로도 종종 여쭤봐도 될까요?"
- 늦은 깨달음형: "이걸 진작 알았으면 좋았을걸 싶어요"

${COMMON_GUIDELINES.OUTPUT_FORMAT}

[생성된 후기성 문구]`
}

/**
 * 후기성 문구에 대한 설계사 응답 프롬프트
 * 다양성 강화: 톤 family 6개 중 1개 랜덤
 */
export function generateReviewResponsePrompt(
  data: QAPromptData,
  context: {
    reviewMessage: string // 고객의 후기성 문구
    productName: string
  }
): string {
  const { productName, topicName, displayProductName, answerTone } = data
  const { reviewMessage } = context
  const customerFacingName = topicName || productName

  // ── 응답 톤 family: 6개 (서로 다른 마무리 톤) — 1개 랜덤 선택 ──
  const RESPONSE_TONES = [
    { id: 'warm_short', name: '따뜻한 단답형', example: '저야말로 감사합니다^^ 잘 선택하셨어요 앞으로도 편하게 물어보세요' },
    { id: 'reassuring', name: '안심형', example: '믿고 가입해주셔서 감사합니다 만족하셨다니 다행이에요^^' },
    { id: 'open_invite', name: '편한 초대형', example: '감사합니다^^ 추가로 궁금한 거 생기시면 부담 없이 쪽지 주세요' },
    { id: 'family_extension', name: '가족 확장형', example: '가족분들 보장도 비슷한 고민 있으시면 같이 봐드릴게요^^ 감사합니다' },
    { id: 'long_term', name: '장기 관계형', example: '앞으로도 갱신이나 보장 점검 필요하시면 언제든 연락 주세요^^ 감사합니다' },
    { id: 'humble_short', name: '겸손 짧은형', example: '도움 되셨다니 다행이에요 좋은 선택이셨습니다^^' },
  ] as const
  const selectedResponseTone = RESPONSE_TONES[Math.floor(Math.random() * RESPONSE_TONES.length)]

  const toneMap: Record<string, string> = {
    friendly: '친절하고 다정한 카페체',
    expert: '전문가다움이 살짝 묻은 따뜻한 카페체',
    comparative: '친절하고 다정한 카페체',
    persuasive: '친절하고 다정한 카페체',
  }
  const selectedTone = toneMap[answerTone] || toneMap.friendly

  return `당신은 ${customerFacingName} 관련해서 카페에서 답변하던 설계사입니다. 고객의 감사 인사에 짧게 답글을 달아주세요.

[고객의 후기]
${reviewMessage}

[이번 응답 톤]
- 스타일: **${selectedResponseTone.name}**
- 예시 (그대로 복사 금지, 톤만 참고): "${selectedResponseTone.example}"

[작성 지침]
1. 길이: **80~160자** (짧게 마무리 — 너무 길면 광고 냄새)
2. 답변 톤: ${selectedTone}
3. 다음 중 1~2가지를 자연스럽게 포함:
   - 가입에 대한 감사 한 줄
   - 만족하셨다는 점에 안도/긍정 한 줄
   - 추가 질문/관계 지속 의향 한 줄 (선택)
4. 고객이 추천 의향을 표현했다면 → "추천해주시면 감사하겠습니다" 식으로 한 줄 응답
5. 고객이 추가 질문 의향을 표현했다면 → "편하게 물어보세요" 식으로 응답
6. 상품명은 "${customerFacingName}" 짧은 형태만. 정식명 노출 금지

${COMMON_GUIDELINES.NO_PERIOD}

7. 매번 다른 표현·다른 구조로. 이전 응답과 동일한 첫 문장 반복 금지

${COMMON_GUIDELINES.OUTPUT_FORMAT}

[생성된 설계사 응답]`
}

