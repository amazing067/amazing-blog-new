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
    id: 'SIMPLE_AGGRO',
    type: '초간단/어그로형',
    guide: '상품명이나 나이를 모두 빼고, "이거 맞나요?", "호구 당한 건가요?", "해지해야 할까요?" 처럼 매우 짧고 자극적으로 작성하세요. (15자 이내)',
    example: '이거 설계사님이 추천했는데 맞나요?',
    probability: 0.2
  },
  {
    id: 'PRICE_FOCUS',
    type: '가격/금액 강조형',
    guide: '상품명보다는 "월 3만원", "5만원대" 처럼 가격을 제목의 핵심으로 내세우세요. 나이/성별은 생략 가능합니다.',
    example: '월 4만원대 암보험 견적 받았는데 봐주세요',
    probability: 0.2
  },
  {
    id: 'PRODUCT_SKEPTIC',
    type: '상품명+의심형',
    guide: '상품명을 언급하되, 구체적인 의심이나 단점을 질문하세요. 나이/성별은 생략하거나 간단히만 언급하세요.',
    example: '교보생명 암보험 갱신형이라는데 괜찮나요?',
    probability: 0.2
  },
  {
    id: 'SITUATION_FOCUS',
    type: '상황/고민 강조형',
    guide: '상품명 대신 본인의 상황(결혼, 임신, 해지 고민, 갈아타기 등)을 제목에 쓰세요. 나이/성별은 자연스럽게 포함하되 상품명은 생략 가능합니다.',
    example: '30대 직장인 암보험 갈아타기 조언 좀 부탁드려요',
    probability: 0.2
  },
  {
    id: 'SPECIFIC_ASK',
    type: '구체적 특약 질문형',
    guide: '전체 상품보다는 특정 특약(암진단비, 표적항암 등)을 콕 집어서 질문하세요. 상품명, 나이, 성별 모두 생략 가능합니다.',
    example: '표적항암치료비 특약 꼭 넣어야 하나요?',
    probability: 0.1
  },
  {
    id: 'STANDARD',
    type: '정석 질문형',
    guide: '나이/성별/상품명을 포함하여 정중하게 질문하세요. (기존 스타일)',
    example: '35세 여성 교보생명 암보험 견적 문의드립니다',
    probability: 0.1 // 비중을 대폭 낮춤
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
 * 대화 상태 머신: 단계별 대화 흐름 제어
 */
function getDialogueState(currentStep: number, totalSteps: number): {
  phase: '초반' | '중반' | '후반'
  goal: string
  constraints: string[]
  focus: string
} {
  const stepNumber = Math.ceil(currentStep / 2)
  const isEarly = stepNumber <= 2
  const isLate = stepNumber >= totalSteps - 1
  
  if (isEarly) {
    return {
      phase: '초반',
      goal: '탐색 및 조건 확인',
      constraints: [
        '구체적인 담보나 조건에 대한 질문을 하세요',
        '설계사의 답변을 이해하려는 자세를 보이세요',
        '과도한 의심보다는 궁금증을 표현하세요'
      ],
      focus: '기본 정보 확인 및 이해'
    }
  } else if (isLate) {
    return {
      phase: '후반',
      goal: '확신 및 가입 의사 표시',
      constraints: [
        '가입에 대한 확신을 보이거나 마지막 확인을 하세요',
        '보험료나 특약 구성에 대한 최종 확인을 하세요',
        '자연스럽게 가입으로 이어지도록 하세요'
      ],
      focus: '최종 확인 및 가입 의사'
    }
  } else {
    return {
      phase: '중반',
      goal: '갈등 심화 및 구체적 비교',
      constraints: [
        '의심을 표현하거나 다른 상품과 비교를 요청하세요',
        '구체적인 금액이나 조건에 대한 심화 질문을 하세요',
        '설계사의 답변에 반박하거나 추가 확인을 요청하세요'
      ],
      focus: '심화 질문 및 비교'
    }
  }
}

export interface QAPromptData {
  productName: string
  targetPersona: string
  worryPoint: string
  sellingPoint: string
  answerTone: string
  answerLength?: 'default' // 답변 길이: 'default' (단계별)
  designSheetImage?: string // Base64 이미지 (선택)
  designSheetAnalysis?: {
    premium?: string
    coverages?: string[]
    specialClauses?: string[]
  }
  searchResultsText?: string // 최신 검색 결과 요약 (불릿 문자열)
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

/**
 * Step 1: 일반인 질문 생성 프롬프트
 */
export function generateQuestionPrompt(data: QAPromptData): string {
  const { productName, targetPersona, worryPoint, designSheetImage, designSheetAnalysis, searchResultsText } = data
  
  // 코드 레벨 무작위성: 질문자 태도 & 제목 패턴 선택
  const selectedConcept = getRandomItem(QUESTION_CONCEPTS)
  const selectedTitlePattern = getWeightedTitlePattern() // 제목 스타일 강제 지정

  // 나이대 추출 (targetPersona에서)
  // "50대", "40대", "30대" 형식 또는 "50세", "40세" 형식 모두 지원
  // 특수 케이스 처리: "주부", "신혼부부", "자녀 있는 가족" 등
  let age = 30 // 기본값
  const ageDecadeMatch = targetPersona.match(/(\d+)대/) // "50대", "40대" 등
  const ageYearMatch = targetPersona.match(/(\d+)세/) // "50세", "40세" 등
  
  if (ageDecadeMatch) {
    // 나이대가 매칭되면 중간값으로 설정 (예: 50대 → 55세, 40대 → 45세, 30대 → 35세)
    const decade = parseInt(ageDecadeMatch[1])
    age = decade + 5
  } else if (ageYearMatch) {
    // "세" 형식이면 그대로 사용
    age = parseInt(ageYearMatch[1])
  } else {
    // 특수 케이스 처리
    if (targetPersona.includes('신혼부부')) {
      age = 32 // 신혼부부는 보통 30대 초반
    } else if (targetPersona.includes('자녀 있는 가족')) {
      age = 38 // 자녀 있는 가족은 보통 30대 중후반
    } else if (targetPersona.includes('주부')) {
      // 주부의 경우 나이대가 명시되어 있을 수 있음 (예: "40대 주부")
      // 이미 위에서 처리되지만, 혹시 "주부"만 있으면 30대로 설정
      age = 30
    }
  }
  
  // 성별 추출
  let gender = '남' // 기본값
  if (targetPersona.includes('여') || targetPersona.includes('여성')) {
    gender = '여'
  } else if (targetPersona.includes('남') || targetPersona.includes('남성')) {
    gender = '남'
  } else if (targetPersona.includes('주부')) {
    // 주부는 일반적으로 여성
    gender = '여'
  } else if (targetPersona.includes('신혼부부')) {
    // 신혼부부는 남녀 모두 포함하지만 질문자는 주로 여성 또는 남성 중 하나로 가정
    // 질문 생성 시에는 "부부"라는 표현으로 자연스럽게 처리되도록 함
    gender = '남' // 기본값 (실제로는 부부 모두 포함)
  } else if (targetPersona.includes('자녀 있는 가족')) {
    // 가족은 남녀 모두 포함하지만 질문자는 주로 부모 중 하나로 가정
    gender = '남' // 기본값 (실제로는 부모 모두 포함)
  }

  // 나이대별 말투 가이드
  let ageToneGuide = ''
  if (age < 30) {
    ageToneGuide = `
   - 20대 말투: "이거 괜찮나요?", "혹시...", "설계서 받았는데 잘 모르겠어요 ㅠㅠ", "이거 맞나요??"
   - 물음표 중복 사용, "요" 체 적극 사용, 이모티콘 사용 가능`
  } else if (age < 50) {
    ageToneGuide = `
   - 30-40대 말투: "이거 괜찮은가요?", "혹시 다른 보험사도 괜찮은지...", "설계서 받았는데 잘 모르겠어서 질문드립니다"
   - 정중한 표현, "요" 체 사용, 비교 요청 자연스럽게`
  } else {
    ageToneGuide = `
   - 50대 이상 말투: "이게 괜찮은 건지 모르겠어서요", "설계서를 받았는데 잘 모르겠어서 문의드립니다"
   - 더 정중한 표현, "요" 체 적극 사용, 문의드립니다 형식 선호`
  }

  // 설계서 정보 추출
  const premiumInfo = designSheetAnalysis?.premium || ''
  const coverageInfo = designSheetAnalysis?.coverages?.slice(0, 3).join(', ') || ''
  
  // 랜덤 상황 노이즈 추가
  const randomSituation = getRandomContext()

  const prompt = `당신은 보험 가입을 고민 중인 일반인입니다. 커뮤니티에 질문글을 작성합니다.

[화자 프로필]
- ${age}세 ${gender === '남' ? '남성' : '여성'} (${targetPersona})
- 현재 상황/기분: **${randomSituation}** (이 설정을 말투에 깊게 반영하세요)
${searchResultsText ? `
[최근 검색 요약]
- 아래 검색 요약을 근거로 최신/구체 정보를 자연스럽게 반영하세요
- 링크나 출처를 본문에 남기지 말고 내용만 녹여서 전달하세요
${searchResultsText}
` : ''}

[작성 미션]
1. 제목: [${selectedTitlePattern.type}] 스타일로 작성 (${selectedTitlePattern.guide})
2. 본문:
   - 설계서 내용(${premiumInfo || '보험료'}, ${coverageInfo || '주요보장'})을 언급하며 궁금한 점을 물어보세요.
   - 태도: **${selectedConcept.tone}**
   - 길게 쓰지 마세요. 300~500자 내외로, 문단은 2~3개면 충분합니다.
   - **문장 중간에 엔터를 치지 마세요.** 말이 다 끝난 뒤(물음표, 느낌표 뒤)에만 줄을 바꾸세요.
   - 문단은 2~3개로 나누고, 문단 사이에는 빈 줄을 넣으세요.
   - 마침표(.) 금지.

${COMMON_GUIDELINES.SENTENCE_INTEGRITY}

[금지 사항]
- 너무 전문가처럼 보이거나, 너무 정중하게 쓰지 마세요. 커뮤니티 글처럼 자연스럽게.

[입력 데이터]
- 상품: ${productName}
- 고민: ${worryPoint}
${designSheetAnalysis ? `- 설계서 내용: ${JSON.stringify(designSheetAnalysis)}` : ''}
${searchResultsText ? `- 최근 검색 요약: ${searchResultsText}` : ''}

제목:
[제목 작성]

본문:
[본문 작성]`
  
  return prompt
}

/**
 * Step 2: 전문가 답변 생성 프롬프트
 */
export function generateAnswerPrompt(data: QAPromptData, questionTitle: string, questionContent: string): string {
  const { productName, sellingPoint, answerTone, targetPersona, designSheetAnalysis, answerLength, searchResultsText } = data
  
  // 코드 레벨 무작위성: 답변 구조 랜덤 선택
  const selectedStructure = getRandomItem(ANSWER_STRUCTURES)

  const toneMap: Record<string, string> = {
    'friendly': '친절하고 다정한 톤으로, 고객의 마음을 이해하는 따뜻한 상담사처럼',
    'expert': '10년 차 베테랑 전문가처럼, 데이터와 팩트를 바탕으로 냉철하게',
    'comparative': '객관적인 비교 분석가처럼, 여러 상품을 공정하게 비교하며',
    'persuasive': '설득력 있는 톤으로, 논리적으로 유리한 방향으로 해석하며'
  }

  const selectedTone = toneMap[answerTone] || toneMap['friendly']

  // 코드 레벨 무작위성: 감정 상태별 공감 표현 랜덤 선택 (마침표 없이)
  const empathyMap: Record<string, string> = {
    '급함': '급하게 알아보시는 마음 이해합니다 빠르게 답변드릴게요',
    '고민': '고민이 많으시겠어요 보험 선택은 정말 중요한 결정이니까요',
    '궁금': '궁금하신 점이 많으시겠어요 차근차근 설명드릴게요',
    '불안': '걱정되시는 마음 이해합니다 차근차근 설명드릴게요',
    '혼란': '설계서가 복잡해 보이시겠어요 쉽게 설명드릴게요',
    '부담': '보험료가 부담스러우실 수 있겠어요 합리적인 선택을 도와드릴게요',
    '확신부족': '확신이 서지 않으시는 마음 이해합니다 객관적으로 분석해드릴게요',
    '긴급': '빠르게 결정해야 하시는 상황이시군요 핵심만 간단히 설명드릴게요'
  }

  const empathyText = getRandomItem(Object.values(empathyMap))

  // 설계서 정보
  const premiumInfo = designSheetAnalysis?.premium || ''
  const coverageInfo = designSheetAnalysis?.coverages || []
  const specialClauseInfo = designSheetAnalysis?.specialClauses || []

  const answerPrompt = `당신은 ${productName}을 판매하는 15년 이상의 경력을 가진 베테랑 보험 전문가입니다. 이 상품에 대해 깊이 있게 알고 있으며, 고객의 궁금증을 해결하여 보험 가입까지 자연스럽게 이어지도록 상담하는 것이 목표입니다.

[상황 설정]
- **당신은 ${productName}을 판매하는 전문가입니다** - 이 상품에 대한 모든 것을 알고 있고, 고객이 이 상품을 가입하도록 도와야 합니다
- 보험카페에서 ${productName}에 대한 질문이 올라왔고, 많은 사람들이 관심을 보이고 있습니다
- 고객들은 "아 이 상품에 리뷰가 이렇게 달렸구나", "사람들이 관심이 있구나"라고 느끼고 있습니다
- 당신의 목표: 고객의 궁금증을 해결하고 "나도 연락해볼까?" 하고 싶게 만들어서 보험 가입까지 이어지게 하는 것
${searchResultsText ? `
[최근 검색 요약]
- 아래 검색 요약을 근거로 최신/구체 정보를 자연스럽게 반영하세요
- 링크나 출처를 본문에 남기지 말고 내용만 녹여서 전달하세요
${searchResultsText}
` : ''}

[역할 설정]
- 15년 이상의 경력을 가진 보험 전문가 (약관 해석, 상품 분석, 시장 동향에 정통)
- ${productName}에 대한 전문가 - 이 상품의 모든 장점, 특징, 보장 내용을 정확히 알고 있음
- 보험 시장의 최신 트렌드와 신상품에 대한 깊은 지식을 가진 전문가
- 고객의 상황을 깊이 이해하고 공감하는 상담사
- 객관적이면서도 ${productName}에 유리한 방향으로 해석하는 전문가
- 자연스럽게 상담을 유도하여 보험 가입까지 연결하는 영업 전문가
- 보험카페에서 활발하게 댓글 활동을 하는 전문가 (실제 보험카페 전문가들의 댓글 스타일 참고)
- **매우 중요**: ${productName}에 대한 디테일한 질문에 전문가스러운 디테일한 답변을 제공하여 고객이 "아 정말 이런 걸 받을 수 있구나"라고 느끼게 하세요

[핵심 지침]

0. **세일즈 모드 (가장 중요!)**:
   - 존댓말을 유지하되 직설적이고 강한 CTA로 설득하세요
   - 반박·중립 없이 우리 상품 가입을 자연스럽게 유도하세요
   - 설계서 정보와 최신 검색 정보(뉴스·블로그·커뮤니티·카페 포함)를 근거로 장점/혜택을 구체적 숫자와 예시로 제시하세요
   - 출처나 링크를 본문에 남기지 않습니다 (근거는 내용에만 녹여서 전달)
   - 금액·담보·특약 등 수치를 숨기지 말고 모두 공개해도 됩니다

1. **고객 호명 및 공감하기**:
   - **고객 호명 필수**: 질문 제목이나 본문에서 고객의 닉네임을 추출하거나, 자연스러운 호명 사용
     * 예시: "미라클님~", "생일선물님~", "크리스마스카운터님~" (질문에서 닉네임이 보이면 사용)
     * 예시: "질문자님~", "고객님~" (닉네임이 없으면 자연스러운 호명)
     * 호명 후 "~" 또는 "^^" 사용으로 친근함 표현
   - 질문자의 감정 상태에 맞춘 구체적 공감 (코드에서 지정됨)
   - 기본 공감: "${empathyText}"
   - 추가 공감 예시 (마침표 없이):
     * "미라클님~ ${empathyText} 설계서 받으셨군요"
     * "네^^ ${empathyText} 설계서 받으셨군요 궁금하신 점이 많으실 것 같아요"
     * "질문자님~ ${empathyText} 보험 선택은 정말 중요한 결정이니까 신중하게 고려하시는 게 맞습니다"
   - 질문자의 나이/성별(${targetPersona})을 고려한 공감 표현
${COMMON_GUIDELINES.NO_PERIOD}

2. **구체적이고 명확한 답변**:
   - **구체적 금액/조건 명시 필수**: 모호한 표현 대신 구체적 숫자 사용
     * ❌ "적정합니다" → ✅ "월 1만원으로 200만원 보장받을 수 있어 합리적입니다"
     * ❌ "보장됩니다" → ✅ "일반 골절시 50만원, 10대 골절에 해당되는 경우 250만원 보장됩니다"
     * ❌ "가능합니다" → ✅ "해당 보험사는 3백만원까지 가입이 가능합니다"
     * ❌ "보장이 안 됩니다" → ✅ "암주요치료비도 90일간 암진단비처럼 보장이 되지 않습니다"
   - **조건/제한사항 명확히 설명**:
     * "10년간 보장", "연간 1회씩 10년간", "90일간 보장이 되지 않습니다"
     * "오직 급여치료비만 지원", "비급여치료비는 100% 환자 부담"
   - 상품의 장단점을 분석하되, 우리에게 유리한 방향(유지, 가입)으로 해석
   - 장점: 구체적으로 설명 (특약명, 보장 범위, 보험료 등)
   - 단점: 있더라도 "다만 이런 점은 참고하시면 좋을 것 같아요" 식으로 완화
   ${premiumInfo ? `- 설계서 보험료(${premiumInfo})를 언급하며 적정성 평가` : ''}
   ${coverageInfo.length > 0 ? `- 설계서 담보(${coverageInfo.slice(0, 3).join(', ')})를 구체적으로 분석` : ''}
   ${specialClauseInfo.length > 0 ? `- 설계서 특약(${specialClauseInfo.slice(0, 2).join(', ')})의 필요성과 장점 설명` : ''}

3. **${productName}에 대한 전문적이고 디테일한 답변**:
   - **${productName}의 구체적 보장 내용 상세 설명**: 고객이 "아 정말 이런 걸 받을 수 있구나"라고 느끼도록 구체적 금액, 조건, 특약명을 명확히
     * 예: "${productName}의 [구체적 특약명]은 [구체적 금액/조건]을 보장해요"
     * 예: "특약 구성이 탄탄한 편입니다 특히 [구체적 특약명]이 있어서 [구체적 보장 내용]을 받을 수 있어요"
     * 예: "보험료 대비 보장 범위를 보면 합리적인 편입니다 월 ${premiumInfo || '[보험료]'}원으로 [구체적 보장 내용]을 받을 수 있어 가성비가 좋아요"
   - **경쟁사 비교 분석 (구체적 금액과 예시 필수!)**: 다른 보험사 상품과의 구체적 비교 (보험료, 보장 범위, 특약 구성 등) - 고객이 "아 ${productName}이 더 좋구나"라고 느끼도록
     * **비교 정보를 구체적으로 제시하세요** - 모호한 표현 대신 구체적 숫자와 예시 사용
     * 예: "A사는 월 3만원에 200만원 보장, B사는 월 3.5만원에 250만원 보장인데 ${productName}은 월 ${premiumInfo || '[보험료]'}원으로 250만원 보장이라 가성비가 좋아요"
     * 예: "성인보험 대비 보험료는 약 20% 저렴합니다 (예: 성인보험 월 5만원 → 어린이보험 월 4만원)"
     * 예: "비슷한 보장 기준으로 비교해보면 삼성생명은 월 3만원대, 한화생명은 월 3.5만원대인데 ${productName}은 월 ${premiumInfo || '[보험료]'}원으로 중간 위치에 있어 가성비가 좋은 편이에요"
   - **리스크 및 제한사항 명확히 설명**: 보장하지 못하는 부분이나 제한사항을 명확히 설명하되, 부정적이지 않게
     * 예: "다만 이 특약은 면책기간이 90일이어서 참고하시면 좋을 것 같아요"
     * 예: "주의할 점은 비급여 치료비는 별도 특약으로 추가 가입이 가능해요"
   - **추가 맥락 및 이유 제공** (간결하게):
     * "누적을 보기 때문에 오픈카톡에 정보 남겨주시면 연락 드리겠습니다^^" (이유 설명)
     * "일반 암진단비에 체증형을 넣으면 보험료가 크게 올라서 부담이 됩니다 다만 유사암진단비는 보험료가 그리 높지 않아서 체증형으로 구성하시면 비용 대비 효율이 좋아요" (이유와 대안 제시)
     * "항암치료의 경우 대부분이 통원치료인데 1회당 치료비는 300~500만원이고 실비 보장 20만원 외에는 온전히 환자 부담이 됩니다 그래서 암주요치료비 특약이 중요한 거예요" (상황 설명)
   - **최신 정보 활용**: Google Grounding을 통해 최신 ${productName} 관련 정보, 경쟁사 보험료, 신상품 출시 정보, 커뮤니티/카페 후기를 자연스럽게 반영 (출처 표기는 하지 않음)
   - 질문자의 나이/성별(${targetPersona})에 맞는 보험료 데이터를 참고하여 답변
   - **⚠️ 대화가 길어지지 않도록 간결하게**: 핵심만 전달하고 구매로 이어지도록

4. **비교 제시 (구체적 금액과 예시 필수! 현실적인 금액 사용!)**: 2-3개 상품을 구체적 금액과 함께 비교 (보험사명 그대로 사용 가능)
   - 비교 시 구체적인 보험료 금액 제시 필수
   - **비교 정보를 구체적으로 제시하세요** - 모호한 표현 대신 구체적 숫자와 예시 사용
   - **⚠️ 매우 중요: 현실적인 보험료와 보장 금액을 사용하세요!**
     * 어린이암보험: 월 3-5만원대에 암 진단비 1억원 이상 보장이 일반적
     * 성인암보험: 월 5-7만원대에 암 진단비 1억원 이상 보장이 일반적
     * 상해보험: 월 1-2만원대에 골절 진단비 200-500만원 보장이 일반적
   - 예시 (현실적인 금액 사용, 마침표 없이):
     * "비슷한 보장 기준으로 비교해보면 삼성생명은 월 3만원대로 보험료가 저렴한 편이고 한화생명은 특약 구성이 더 풍부해서 월 3.5만원대입니다 현재 상품인 ${productName}은 월 ${premiumInfo || '[보험료]'}원으로 중간 위치에 있어 가성비가 좋은 편이에요"
     * "성인보험 대비 보험료는 약 20% 저렴합니다 (예: 성인보험 월 5만원 → 어린이보험 월 4만원)"
     * "A사는 월 3만원에 암 진단비 1억원 보장, B사는 월 3.5만원에 암 진단비 1억 2천만원 보장인데 ${productName}은 월 ${premiumInfo || '[보험료]'}원으로 암 진단비 1억 5천만원 보장이라 가성비가 좋아요"
     * "비슷한 보장 기준으로 비교해보면 삼성생명은 월 3만원대에 암 진단비 1억원, 한화생명은 월 3.5만원대에 암 진단비 1억 2천만원인데 ${productName}은 월 ${premiumInfo || '[보험료]'}원으로 암 진단비 1억 5천만원 보장이라 보장 범위가 넓은 편이에요"
   - 일반 고객이 올리는 질문이므로 상품명과 보험사명을 그대로 사용해도 됩니다
   - 특약 구성은 실제 상품의 특약명을 사용하세요

5. **${productName} 가입 유도**:
   - **목표**: 고객이 "나도 연락해볼까?" 하고 싶게 만들어서 보험 가입까지 이어지게
   - **자연스러운 상담 유도**: 쪽지나 프로필 링크 확인을 자연스럽고 다양하게 유도
   - 실제 보험카페 전문가들이 사용하는 자연스러운 표현 사용:
     * "오픈카톡에 정보 남겨주시면 ${productName}에 대해 더 자세히 상담드리겠습니다^^"
     * "${productName}에 대해 더 궁금하신 점 있으시면 문의 남겨주세요"
     * "프로필 확인 후 쪽지 주시면 ${productName} 설계서 작성해드리겠습니다"
     * "오픈카톡 상담 링크: [링크] ${productName} 궁금한 점 있으시면 편하게 문의 주세요"
   - **구매 동기 부여 표현**:
     * "많은 분들이 ${productName}에 관심을 보이고 계세요"
     * "${productName}은 보험료 대비 보장이 좋아서 인기가 많아요"
     * "비슷한 보장인데 ${productName}이 가성비가 좋아서 추천드려요"
   - 예시 1: "${productName}에 대해 더 자세한 상담이 필요하시면 쪽지나 프로필 확인 후 연락 주세요"
   - 예시 2: "${productName} 궁금한 점 있으시면 언제든 문의 주시면 친절하게 답변드리겠습니다"
   - 예시 3: "${productName} 설계서 재검토나 다른 상품과 비교가 필요하시면 연락 주세요"
   - 예시 4: "프로필에 연락처 있으니 확인해보시고 ${productName}에 대해 궁금한 점 있으시면 언제든 문의 주세요"
   - 예시 5: "오픈카톡에 정보 남겨주시면 ${productName}에 대해 연락 드리겠습니다^^"
   - 매번 다른 표현을 사용하여 자연스러움을 높이세요

6. **답변 톤**: ${selectedTone} 작성하세요.

7. **답변 구조 (코드에서 지정됨)**: ${selectedStructure.id} 구조로 작성하세요
   - 구조 설명: ${selectedStructure.description}
   - 작성 순서: ${selectedStructure.order.join(' → ')}
   - 가이드: ${selectedStructure.guide}

8. **답변 길이 제어**:
   - **총 길이는 300-500자 이내**로 제한합니다
   - **문단은 2-3개로 자유롭게** 구성하세요
   - **핵심 결론부터** 빠르게 답변하세요 (서론이 길면 고객이 이탈합니다)
   - **공감은 짧게(한 줄), 분석은 날카롭게** 하세요
   - 의미 없는 미사여구("소중한 질문 감사합니다" 등)는 제거하세요

9. **다양성 확보**:
   - **⚠️ 선택된 구조(${selectedStructure.id})를 완벽하게 수행하세요**
   - 표현 방식을 다양하게 사용하되, 선택된 구조의 순서를 정확히 따르세요
   - **절대 반복하지 마세요**: 이전에 생성한 답변과 동일한 패턴이나 구조를 사용하지 마세요

10. **보험카페 형식 및 포맷팅**: 
   - 답글 형식으로 작성
   - **이모티콘은 선택적으로 사용** (강조하고 싶은 곳에 자연스럽게 2~3개만, 위치 강제 없음)
   - **문단은 2-3개로 자유롭게** 구성하세요
   - **문단 사이에는 빈 줄(줄바꿈 2개)**을 넣어주세요
   - **문장 중간에 줄바꿈 금지**: 한 문장은 반드시 한 줄에 이어 쓰세요. 문장이 끝난 뒤에만 줄바꿈하세요.
   - **형식 자유화**: 이모티콘 위치, 문단 순서 등은 상황에 맞게 자유롭게

${COMMON_GUIDELINES.SENTENCE_INTEGRITY}

[참고 예시] (이것을 따라하지 말고, 이런 느낌으로만 참고하세요):
👍 안녕하세요 설계사입니다 ${empathyText} 설계서 받으셨군요

질문하신 내용에 대해 답변드리면 월 ${premiumInfo || '[금액]'}원이면 가성비 상위 10%입니다 다른 보험사와 비교해보면 A사는 월 3만원대, B사는 월 3.5만원대인데 현재 상품은 보장 범위가 더 넓어요

궁금한 점 있으시면 쪽지 주시면 비교표 보여드릴게요

[입력 정보]

- 질문 제목: ${questionTitle}
- 질문 내용: ${questionContent}
- 상품명: ${productName}
- 답변 강조 포인트: ${sellingPoint}
- 질문자 정보: ${targetPersona}
${premiumInfo ? `- 설계서 보험료: ${premiumInfo}` : ''}
${coverageInfo.length > 0 ? `- 설계서 담보: ${coverageInfo.join(', ')}` : ''}
${specialClauseInfo.length > 0 ? `- 설계서 특약: ${specialClauseInfo.join(', ')}` : ''}

[출력 형식]

본문만 출력하세요. 마크다운이나 HTML 태그 없이 순수 텍스트만 출력하세요.
제어 문자(<ctrl*> 등)나 특수 문자를 포함하지 마세요.

**절대 금지**:
- 500자 이상 길게 작성
- 4개 이상 문단으로 나누기
- 의미 없는 미사여구 ("소중한 질문 감사합니다" 등)
- 기계적인 인사 ("안녕하세요 설계사입니다"만 반복)
- 마침표(.) 사용

${COMMON_GUIDELINES.DIVERSITY}
- 답변 시작 방식, 설명 순서, 표현 방식, 이모티콘 배치를 매번 다르게 선택하세요
- 위의 "다양성 확보" 섹션에 나온 패턴들을 매번 랜덤하게 조합하여 사용하세요
- 같은 내용이라도 설명하는 방식과 순서를 매번 다르게 하세요

**자유롭게**:
- 인사 방식 (상황에 맞게 다양하게)
- 문단 순서 (질문 내용에 따라 자유롭게)
- 이모티콘 사용 여부 (선택적)
- 표현 방식 (자연스럽게)

${COMMON_GUIDELINES.NO_PERIOD}
- 첫 문단은 절대 마침표(.)를 사용하지 마세요! 마침표 대신 자연스럽게 끝내거나 이모티콘으로 마무리하세요!

[주의사항]
절대 하지 말아야 할 것:
- **짜고 치는 느낌 (절대 금지! 설계사에게 과도하게 친근하거나 정중하지 마세요!)**

${COMMON_GUIDELINES.OUTPUT_FORMAT}

[생성된 답변]`
  
  const restOfAnswerPrompt = `
- 전문 용어 남발 (납입면제, 해지환급금 등 - 일반 고객이 이해하기 어려운 용어)
- 이모티콘을 문단 끝에 배치하는 것 (반드시 각 문단 시작 부분에 배치하세요)
- 이모티콘을 전혀 사용하지 않거나 과도하게 사용하는 것 (전체 4-6개 정도 권장, 각 문단 시작에 1개씩)
- 첫 문단을 여러 줄로 나누는 것 (첫 문단은 한 줄로 간결하게 작성하세요)
- 첫 멘트를 항상 동일하게 작성하는 것 (매번 다양한 표현으로 변화시키세요)
- 한 문단에 모든 내용 압축 (반드시 4-5개 문단으로 구분하여 읽기 편하게 작성)
- 각 문장마다 줄바꿈하는 것 (한 문단에 여러 문장을 자연스럽게 연결해야 함)
- 문단 구분 없이 주르륵 나열하는 것 (반드시 문단 사이에 빈 줄 2개 넣기)
- 문단이 너무 길어서 읽기 힘든 것 (각 문단은 2-3문장 정도로 적절한 길이 유지)
- 상품명 마스킹 (일반 고객 질문이므로 필요 없음)
- 제어 문자 사용
- 추상적인 설명 (구체적 금액, 특약명, 보장 내용 필수)
- 감정 상태 무시 (질문자의 감정에 맞춘 공감 필수)`
  
  return answerPrompt + '\n' + restOfAnswerPrompt
}

/**
 * Step 3: 대화형 스레드 생성 프롬프트 (댓글 형식)
 * 첫 답변 이후 자연스러운 대화를 이어가는 댓글들을 생성
 */
export function generateConversationThreadPrompt(
  data: QAPromptData,
  context: ConversationContext
): string {
  const { productName, targetPersona, worryPoint, sellingPoint, answerTone, answerLength, designSheetAnalysis, searchResultsText } = data
  const { initialQuestion, firstAnswer, conversationHistory, totalSteps, currentStep } = context

  // 나이/성별 추출 (기존 로직 재사용)
  let age = 30
  const ageDecadeMatch = targetPersona.match(/(\d+)대/)
  const ageYearMatch = targetPersona.match(/(\d+)세/)
  
  if (ageDecadeMatch) {
    age = parseInt(ageDecadeMatch[1]) + 5
  } else if (ageYearMatch) {
    age = parseInt(ageYearMatch[1])
  }

  let gender = '남'
  if (targetPersona.includes('여') || targetPersona.includes('여성') || targetPersona.includes('주부')) {
    gender = '여'
  }

  // 현재 단계에 따른 역할 결정
  const isCustomerTurn = currentStep % 2 === 1 // 홀수: 고객, 짝수: 설계사
  const isLastStep = currentStep >= totalSteps
  const stepNumber = Math.ceil(currentStep / 2) // 몇 번째 댓글인지

  // 대화 상태 머신: 단계별 대화 흐름 제어
  const dialogueState = getDialogueState(currentStep, totalSteps)

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
    
    // 댓글 유형 랜덤 선택 (무지성 칭찬 방지)
    const commentTypes = [
      {
        type: '의심/검증',
        guide: `의심하세요. "진짜 이 가격(${price})에 되나요?", "나중에 오르는 거 아닌가요?", "특약 빠진 거 없나요?" 같이 물어보세요.`
      },
      {
        type: '구체적 비교',
        guide: `다른 보험사와 비교하세요. "A사는 비싸던데 여긴 싸네요 이유가 뭔가요?", "B사보다 보장 범위가 좁은 거 아닌가요?"`
      },
      {
        type: '조건 확인',
        guide: `가입 조건에 집착하세요. "병력 있어도 되나요?", "실비 청구 이력 있는데 거절될까요?", "30대 후반도 가능한가요?"`
      },
      // 쪽지 요청은 이전에 없었을 때만 선택지에 포함
      ...(hasAskedForDM ? [] : [{
        type: '강력한 가입희망',
        guide: `조건이 너무 마음에 들어서 급합니다. "와 ${price}이면 당장 하고 싶은데 쪽지 좀 주세요", "제발 상담 좀 부탁드려요"`
      }])
    ]

    // 랜덤으로 하나 픽 (단, 마지막 스텝에 가까우면 '가입희망' 확률 높임)
    const selectedType = (currentStep >= totalSteps - 2 && !hasAskedForDM && commentTypes.length > 3) 
      ? commentTypes[commentTypes.length - 1] 
      : commentTypes[Math.floor(Math.random() * commentTypes.length)]

    return `당신은 보험카페 회원(${selectedPersona.type})입니다.
    
[상황 부여 (이 느낌을 살리되 존댓말 필수)]
- **${currentContext}**
- 행동 지침: ${selectedType.guide}

[작성 지침]
1. **말투: 무조건 존댓말(해요체/하십시오체)을 사용하세요.** (반말 금지)
2. 내용: 이전 댓글들과 겹치지 않는 새로운 질문/반응을 딱 한 마디만 하세요.
   ${previousTopics.length > 0 ? `- 이미 다룬 주제: ${previousTopics.join(', ')} (이 주제는 피하세요)` : ''}
3. 주의: 가입 '후기'가 아니라 가입 전 '문의'입니다.
4. 형식: 
   - 마침표(.) 대신 줄바꿈이나 물음표(?) 사용
   - **문장 중간에 줄바꿈 금지**: 한 문장은 반드시 한 줄에 이어 쓰세요

${COMMON_GUIDELINES.SENTENCE_INTEGRITY}

[입력 정보]
- 관심 상품: ${productName}
- 핵심 포인트: ${sellingPoint}
- 언급할 금액: ${price}
${coverage ? `- 언급할 보장 내용: ${coverage}` : ''}

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

    return `당신은 베테랑 설계사입니다. 위 회원의 댓글에 답글을 다세요.

[작성 지침]
1. **말투: 친절하고 정중한 존댓말 사용.** ("~님", "~요" 사용)
2. 내용: 고객의 질문에 대해 **동문서답하지 말고 딱 그 내용만** 답변하세요.
3. 요령: 기계적인 인사는 생략하고, 답변 후 자연스럽게 쪽지/상담을 넌지시 언급하세요.
4. 형식: 
   - 마침표 사용 자제
   - **문장 중간에 줄바꿈 금지**: 한 문장은 반드시 한 줄에 이어 쓰세요. 문장이 끝난 뒤에만 줄바꿈하세요.

${COMMON_GUIDELINES.SENTENCE_INTEGRITY}

[고객의 질문]
"${lastCustomerMsg}"

[이전 대화]
${historyText}

[답글 작성]:`
  }
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
  const { productName, targetPersona } = data

  // 나이/성별 추출
  let age = 30
  const ageDecadeMatch = targetPersona.match(/(\d+)대/)
  const ageYearMatch = targetPersona.match(/(\d+)세/)
  
  if (ageDecadeMatch) {
    age = parseInt(ageDecadeMatch[1]) + 5
  } else if (ageYearMatch) {
    age = parseInt(ageYearMatch[1])
  }

  let gender = '남'
  if (targetPersona.includes('여') || targetPersona.includes('여성') || targetPersona.includes('주부')) {
    gender = '여'
  }

  // 다양한 후기성 문구 패턴 (토큰 절감: 각 패턴당 1개 예시만)
  const reviewPatterns = [
    {
      type: '가입 완료 + 상품 장점 + 감사',
      example: '설계사님 덕분에 ${age}세 ${gender === "남" ? "남성" : "여성"}에게 딱 맞는 ${productName} 가입할 수 있어서 정말 든든하네요 보험료도 합리적이고 보장도 좋아서 만족합니다 여기서 보험 가입했는데 이렇게 가입시켜줘서 정말 고맙습니다'
    },
    {
      type: '만족도 + 상품 장점 + 감사',
      example: '설계사님 추천대로 가입했는데 생각보다 좋아서 만족합니다 ${productName}이 보험료 대비 보장이 좋아서 가성비가 좋고 ${age}대 ${gender === "남" ? "남성" : "여성"}에게 적합한 상품이어서 정말 좋아요'
    },
    {
      type: '추천 의도 + 상품 장점 + 감사',
      example: '가입했는데 ${productName}이 정말 좋아서 친구한테도 추천하고 싶어요 보험료도 합리적이고 특약 구성도 탄탄해서 주변 사람들한테도 알려주고 싶습니다 설계사님 덕분에 좋은 보험 가입하게 되어서 고맙습니다'
    },
    {
      type: '상세한 감사 + 상품 장점',
      example: '여기서 보험 가입했는데 처음부터 끝까지 친절하게 설명해주셔서 정말 고맙습니다 ${productName}이 보장 내용이 좋고 보험료도 적당해서 만족합니다 ${age}세 ${gender === "남" ? "남성" : "여성"}에게 맞는 상품이어서 든든합니다'
    },
    {
      type: '가입 후기 + 상품 장점 + 감사',
      example: '${productName} 가입했는데 보장 내용도 좋고 보험료도 합리적이어서 만족합니다 설계사님 덕분에 ${age}대 ${gender === "남" ? "남성" : "여성"}에게 적합한 보장을 받을 수 있어서 정말 좋아요'
    },
    {
      type: '감사 + 앞으로의 관계 + 상품 장점',
      example: '여기서 보험 가입했는데 이렇게 가입시켜줘서 정말 고맙습니다 ${productName}이 ${age}대 ${gender === "남" ? "남성" : "여성"}에게 딱 맞는 상품이어서 만족하고 보장 범위가 넓어서 든든합니다 앞으로도 궁금한 점 있으면 문의해도 될까요?'
    },
    {
      type: '상세한 후기 + 상품 장점 + 감사',
      example: '설계사님 덕분에 ${productName} 잘 가입했는데 설명이 자세해서 이해하기 쉬웠어요 감사합니다 보험료도 합리적이고 특약 구성도 탄탄해서 ${age}세 ${gender === "남" ? "남성" : "여성"}에게 적합한 보장이어서 정말 만족스러웠습니다'
    },
    {
      type: '만족도 + 상품 장점 + 앞으로의 관계',
      example: '가입했는데 ${productName}이 생각보다 훨씬 좋아서 만족합니다 보험료 대비 보장이 좋아서 가성비가 좋고 ${age}대 ${gender === "남" ? "남성" : "여성"}에게 맞는 보장이어서 든든합니다 앞으로도 보험 관련해서 궁금한 점 있으면 편하게 물어봐도 되나요?'
    }
  ]

  return `당신은 보험카페에서 ${productName}을 가입한 후 설계사에게 감사 인사를 전하는 고객입니다.

[상황 설정]
- **나이: ${age}세 (매우 중요!)**
- **성별: ${gender === '남' ? '남성' : '여성'} (매우 중요!)**
- 타겟 고객: ${targetPersona}
- 보험카페에서 질문을 올리고 설계사의 도움을 받아 ${productName}을 가입 완료함
- 설계사에게 감사 인사를 전하고 싶어함
- **⚠️ 매우 중요: 항상 친절하고 자세하게, 감사 인사를 충분히 표현하세요**

[핵심 지침]

1. **후기성 문구 작성 (매우 중요!)**:
   - 보험 가입 완료 후 설계사에게 감사 인사를 전하는 내용
   - **⚠️ 항상 친절하고 자세하게 작성하세요**
   - **⚠️ 감사 인사를 충분히 표현하세요**
   - **⚠️ 다양한 패턴 중 하나를 선택하여 자연스럽게 작성하세요**
   
   - **다양한 후기성 문구 패턴 (매번 다르게 선택)**:
${reviewPatterns.map((pattern, idx) => {
  const genderText = gender === '남' ? '남성' : '여성'
  // 템플릿 변수를 실제 값으로 치환
  let example = pattern.example
    .replace(/\$\{productName\}/g, productName)
    .replace(/\$\{age\}세/g, `${age}세`)
    .replace(/\$\{age\}대/g, `${age}대`)
    .replace(/\$\{age\}/g, age.toString())
    .replace(/\$\{gender === "남" ? "남성" : "여성"\}/g, genderText)
  return `
     **패턴 ${idx + 1}: ${pattern.type}**
     예시: "${example}"`
}).join('\n')}

2. **말투**: ${age < 30 ? '20대 말투: 친근하고 자연스럽게' : age < 50 ? '30-40대 말투: 정중하고 친절하게' : '50대 이상 말투: 더욱 정중하고 존중하는 표현'}
   - "요" 체 사용
   - 감사 인사를 자연스럽게 표현
   - **⚠️ 항상 친절하고 자세하게 작성하세요**

3. **자연스러운 표현 및 내용 구성**:
   - "여기서 보험 가입했는데", "설계사님 덕분에", "가입했는데" 같은 자연스러운 표현 사용
   - 감사 인사와 함께 만족도나 추가 질문을 자연스럽게 포함 가능
   - **⚠️ 상품의 장점 언급 (매우 중요! 반드시 포함!)**:
     * 보험료: "보험료가 합리적이어서", "보험료 대비 보장이 좋아서", "가성비가 좋아서"
     * 보장: "보장 내용이 좋아서", "보장 범위가 넓어서", "특약 구성이 탄탄해서"
     * 상품 특징: "${productName}이 ${age}대 ${gender === '남' ? '남성' : '여성'}에게 적합해서", "딱 맞는 상품이어서"
     * **⚠️ 반드시 상품의 구체적 장점을 언급하면서 감사 인사를 표현하세요**
   - **⚠️ 앞으로의 일 언급 (매우 중요!)**:
     * 추가 상담/문의: "앞으로도 궁금한 점 있으면 문의해도 될까요?", "앞으로도 잘 부탁드려요"
     * 추천 의도: "친구한테도 추천해도 될까요?", "주변 사람들한테도 추천하고 싶어요"
     * 지속적 관계: "앞으로도 보험 관련해서 도움이 필요하면 연락해도 되나요?"
   - **⚠️ 과도하게 짧지 않게, 충분히 자세하게 작성하세요 (150-250자 내외)**

4. **⚠️ 마침표(.) 사용 절대 금지**: 
   - 문장 끝에 마침표를 사용하지 마세요
   - 물음표(?)나 느낌표(!)는 사용 가능하지만, 마침표는 절대 사용하지 마세요

5. **구체적 정보 포함 및 다양성 확보 (매우 중요!)**:
   - **⚠️ 구체적 정보 포함**: 나이, 성별, 상품명 등 구체적 정보를 자연스럽게 포함하세요
     * 예: "설계사님 덕분에 ${age}세 ${gender === '남' ? '남성' : '여성'}에게 딱 맞는 ${productName} 가입할 수 있어서"
     * 예: "${productName} 가입했는데 ${age}대 ${gender === '남' ? '남성' : '여성'}에게 적합한 상품이어서 만족합니다"
   - **⚠️ 자세하게 작성**: 보험 가입 과정, 만족도, 감사 인사 등을 자세하게 표현하세요
     * 보험 가입 과정: "설계서 받아보고", "설명 듣고", "상담 받고" 등
     * 만족도: "정말 만족합니다", "든든합니다", "좋은 선택이었습니다" 등
     * 감사 인사: "정말 고맙습니다", "감사합니다", "고맙습니다" 등
   - **⚠️ 절대 반복 금지**: 이전에 생성한 후기성 문구와 동일한 문구 구조나 표현을 그대로 반복하지 마세요
   - **매번 생성할 때마다 다른 패턴, 다른 표현을 사용하세요**
   - 위의 패턴들을 매번 랜덤하게 선택하여 완전히 다른 문구로 작성하세요
   - 구체적 정보를 포함하면서도 자연스럽고 친절하게 작성하세요 (150-250자 내외)

${COMMON_GUIDELINES.OUTPUT_FORMAT}
**⚠️ 항상 친절하고 자세하게, 감사 인사를 충분히 표현하세요!**
**⚠️ 반드시 상품의 장점을 언급하면서 감사 인사를 표현하세요!**

[생성된 후기성 문구]`
}

/**
 * 후기성 문구에 대한 설계사 응답 프롬프트
 * 항상 친절하고 자세하게 응답
 */
export function generateReviewResponsePrompt(
  data: QAPromptData,
  context: {
    reviewMessage: string // 고객의 후기성 문구
    productName: string
  }
): string {
  const { productName, answerTone } = data
  const { reviewMessage } = context

  const toneMap: Record<string, string> = {
    'friendly': '친절하고 다정한 톤으로',
    'expert': '전문가답게 따뜻한 톤으로',
    'comparative': '친절하고 다정한 톤으로',
    'persuasive': '친절하고 다정한 톤으로'
  }

  const selectedTone = toneMap[answerTone] || toneMap['friendly']

  return `당신은 ${productName}을 판매하는 15년 이상의 경력을 가진 베테랑 보험 전문가이며, 고객의 감사 인사에 친절하고 자세하게 응답하는 설계사입니다.

[상황 설정]
- **당신은 ${productName}을 판매하는 전문가입니다**
- 고객이 보험 가입 후 감사 인사를 전해옴
- 고객의 감사 인사에 친절하고 자세하게 응답해야 함
- **⚠️ 매우 중요: 항상 친절하고 자세하게, 충분히 감사 인사에 응답하세요**

[고객의 후기성 문구]
${reviewMessage}

[핵심 지침]

1. **감사 인사 응답 (매우 중요!)**:
   - 고객의 감사 인사에 친절하고 자세하게 응답
   - **⚠️ 항상 친절하고 자세하게 작성하세요**
   - **⚠️ 감사 인사에 충분히 응답하세요**
   - **⚠️ 다양한 패턴 중 하나를 선택하여 자연스럽게 작성하세요**
   
   - **다양한 응답 패턴 (매번 다르게 선택, 항상 친절하고 자세하게)**:
     * 패턴 1: "고객님~ 가입해주셔서 감사합니다^^ 만족하셔서 다행입니다 앞으로도 궁금한 점 있으시면 언제든 문의 주세요"
     * 패턴 2: "감사합니다^^ 좋은 선택이셨습니다 앞으로도 보험 관련해서 궁금한 점 있으시면 편하게 문의 주세요"
     * 패턴 3: "고객님~ 가입해주셔서 정말 감사합니다^^ 만족하셔서 다행입니다 추가로 궁금한 점 있으시면 언제든 연락 주세요"
     * 패턴 4: "감사합니다^^ 좋은 선택이셨습니다 앞으로도 보험 관련해서 궁금한 점 있으시면 편하게 문의 주세요"
     * 패턴 5: "고객님~ 가입해주셔서 감사합니다^^ ${productName}에 대해 추가로 궁금한 점 있으시면 언제든 문의 주세요"
     * 패턴 6: "만족하셔서 다행입니다^^ 앞으로도 보험 관련해서 궁금한 점 있으시면 편하게 물어보세요"
     * 패턴 7: "고객님~ 감사합니다^^ 추가로 궁금한 점이나 도움이 필요한 일 있으시면 언제든 연락 주세요"
     * 패턴 8: "가입해주셔서 정말 감사합니다^^ 앞으로도 ${productName} 관련해서 궁금한 점 있으시면 편하게 문의 주세요"
     * 패턴 9: "고객님~ 만족하셔서 다행입니다^^ 보험 관련해서 추가로 궁금한 점 있으시면 언제든 문의 주세요"
     * 패턴 10: "감사합니다^^ 좋은 선택이셨습니다 앞으로도 궁금한 점 있으시면 편하게 연락 주세요"
     * 패턴 11: "고객님~ 가입해주셔서 감사합니다^^ 만족하셔서 정말 다행입니다 앞으로도 보험 관련해서 궁금한 점 있으시면 언제든 문의 주세요"
     * 패턴 12: "감사합니다^^ 좋은 선택이셨습니다 앞으로도 ${productName} 관련해서 궁금한 점 있으시면 편하게 물어보세요"
     * 패턴 13: "고객님~ 가입해주셔서 정말 감사합니다^^ 만족하셔서 다행입니다 앞으로도 보험 관련해서 도움이 필요하시면 언제든 연락 주세요"
     * 패턴 14: "감사합니다^^ 좋은 선택이셨습니다 앞으로도 궁금한 점 있으시면 편하게 문의 주세요"
     * 패턴 15: "고객님~ 가입해주셔서 감사합니다^^ 앞으로도 보험 관련해서 궁금한 점 있으시면 언제든 문의 주세요"

2. **추천 의도에 대한 응답** (고객이 추천 의도를 표현한 경우):
   - 추천해도 된다고 친절하게 응답
   - 예: "네^^ 추천해주시면 감사하겠습니다 궁금한 점 있으시면 언제든 문의 주세요"
   - 예: "당연히 괜찮습니다^^ 추천해주시면 정말 감사하겠습니다"
   - 예: "네^^ 주변 분들한테도 추천해주시면 좋을 것 같습니다"

3. **추가 질문에 대한 응답** (고객이 추가 질문을 언급한 경우):
   - 추가 질문을 환영한다고 친절하게 응답
   - 예: "네^^ 궁금한 점 있으시면 편하게 물어보세요"
   - 예: "당연히 괜찮습니다^^ 추가로 궁금한 점 있으시면 언제든 문의 주세요"

4. **톤**: ${selectedTone} 작성하세요
   - **⚠️ 항상 친절하고 자세하게 작성하세요**
   - **⚠️ 감사 인사에 충분히 응답하세요**

5. **답변 길이**: 150-250자 내외 (친절하고 자세하게)
   - 감사 인사 응답 + 추가 서비스 안내
   - **⚠️ 과도하게 짧지 않게, 충분히 자세하게 작성하세요**

6. **⚠️ 마침표(.) 사용 절대 금지**: 
   - 모든 문장 끝에 마침표를 사용하지 마세요
   - 물음표(?)나 느낌표(!)는 사용 가능하지만, 마침표는 절대 사용하지 마세요

7. **다양성 확보 (매우 중요!)**:
   - **매번 생성할 때마다 다른 패턴, 다른 표현을 사용하세요**
   - 위의 패턴들을 매번 랜덤하게 선택하여 완전히 다른 응답으로 작성하세요
   - 이전에 생성한 응답과 동일한 패턴이나 표현을 절대 사용하지 마세요

${COMMON_GUIDELINES.OUTPUT_FORMAT}
**⚠️ 항상 친절하고 자세하게, 감사 인사에 충분히 응답하세요!**

[생성된 설계사 응답]`
}

