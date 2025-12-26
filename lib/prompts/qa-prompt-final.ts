/**
 * 보험카페 Q&A 자동 생성 프롬프트 (Ultimate Final Version)
 * Version: 4.0
 * Last Updated: 2025-01-XX
 * 
 * [핵심 철학]
 * 1. NO EXAMPLES: 예시 문장 제거 → AI 짜깁기 방지
 * 2. SHADOW SEEDS: 부정→긍정 서사로 리얼함 확보
 * 3. TEXTURAL SEEDS: 오타, 초성, 이모티콘으로 질감 부여
 * 4. AGE-BASED STYLE: 연령대별 말투 차이 반영
 * 5. CONTEXT CONTINUITY: 질문-답변-댓글 문맥 유지
 */

// =================================================================
// 1. 타입 정의
// =================================================================

export interface QAPromptData {
  productName: string
  targetPersona: string
  worryPoint: string
  sellingPoint: string
  answerTone: string  // 'friendly' | 'expert' | 'comparative' | 'persuasive'
  answerLength?: 'default'
  designSheetImage?: string
  designSheetAnalysis?: {
    premium?: string
    coverages?: string[]
    specialClauses?: string[]
  }
  searchResultsText?: string
}

export interface ConversationMessage {
  role: 'customer' | 'agent'
  content: string
  step: number
}

export interface ConversationContext {
  initialQuestion: { title: string; content: string }
  firstAnswer: string
  conversationHistory: ConversationMessage[]
  totalSteps: number
  currentStep: number
}

interface Seed {
  situation: typeof SITUATION_SEEDS[number]
  writingStyle: typeof WRITING_STYLE_SEEDS[number]
  textPattern: typeof TEXT_PATTERN_SEEDS[number]
  realtime: {
    timeOfDay: typeof REALTIME_SEEDS.timeOfDay[number]
    device: typeof REALTIME_SEEDS.device[number]
    activityLevel: typeof REALTIME_SEEDS.activityLevel[number]
  }
}

// =================================================================
// 2. 시드 데이터 (The Brain)
// =================================================================

/**
 * 상황 시드: 부정→긍정 서사 (Shadow Seeds)
 * 모든 상황이 "긍정 일변도"가 아닌 리얼한 감정선
 */
const SITUATION_SEEDS = [
  // 의심/불안 계열
  { id: 'doubt_resolved', type: '의심→해소', desc: '처음엔 사기 아닌가 의심했는데 설명 듣고 마음이 바뀐 상태' },
  { id: 'rejection_relief', type: '거절→안도', desc: '다른 곳에서 가입 거절당하고 여기서 겨우 승인나서 안도한 상태' },
  { id: 'expensive_worry', type: '가격걱정→안심', desc: '보험료가 비쌀까 봐 겁먹었는데 생각보다 저렴해서 다행인 상태' },
  { id: 'complex_worry', type: '복잡→명쾌', desc: '보험이 너무 복잡해서 머리 아팠는데 쉽게 설명해줘서 이해된 상태' },
  
  // 귀찮음/급함 계열
  { id: 'lazy_done', type: '귀차니즘→해결', desc: '보험 알아보는 게 너무 귀찮고 싫었는데 빨리 해결해줘서 시원한 상태' },
  { id: 'urgent_relief', type: '급함→해결', desc: '다음 주에 수술 예정이라 급하게 가입해야 하는 초조한 상태' },
  { id: 'procrastinate_done', type: '미루다→처리', desc: '계속 미루다가 이제서야 겨우 시작하는 상태' },
  
  // 비교/확인 계열
  { id: 'friend_compare', type: '지인비교', desc: '친구가 가입한 것보다 내 조건이 더 좋아서 은근히 기분 좋은 상태' },
  { id: 'agent_distrust', type: '설계사불신', desc: '전에 다른 설계사한테 안 좋은 경험 있어서 조심스러운 상태' },
  { id: 'second_opinion', type: '재확인', desc: '이미 견적 받았는데 여기서 한번 더 확인받고 싶은 상태' },
  
  // 특수 상황 계열
  { id: 'life_event', type: '인생이벤트', desc: '결혼/출산/이직 등 인생 전환점에서 보험 정리하려는 상태' },
  { id: 'family_pressure', type: '가족압박', desc: '배우자나 부모님이 보험 들라고 해서 알아보는 상태' },
  { id: 'renewal_shock', type: '갱신충격', desc: '갱신보험료가 너무 올라서 갈아타려고 알아보는 상태' }
] as const

/**
 * 글쓰기 스타일 시드 (Textural Seeds)
 * 실제 카페 유저들의 다양한 말투
 */
const WRITING_STYLE_SEEDS = [
  { 
    id: 'mobile_rush', 
    desc: '이동 중 모바일 작성',
    features: '문장 짧음, 오타 가끔, 음슴체 섞임',
    markers: ['근데', '암튼', '걍', '됨', '임']
  },
  { 
    id: 'emotional', 
    desc: '감정 풍부형',
    features: 'ㅠㅠ ㅋㅋ ㅎㅎ 많이 사용, 물음표 여러개(??)',
    markers: ['ㅠㅠ', 'ㅋㅋ', '진짜', '너무', '완전']
  },
  { 
    id: 'dry_fact', 
    desc: '쿨한 팩트형',
    features: '감정 표현 최소화, 이모티콘 거의 없음, 단답',
    markers: ['~인가요', '~되나요', '~한가요']
  },
  { 
    id: 'polite_careful', 
    desc: '조심스러운 예의형',
    features: '혹시, 실례지만, ~일까요 자주 사용',
    markers: ['혹시', '실례지만', '죄송한데', '괜찮으시면']
  },
  { 
    id: 'community_native', 
    desc: '카페 고인물형',
    features: '초성체, 줄바꿈 자주, 직설적',
    markers: ['ㅇㅇ', 'ㄴㄴ', 'ㄹㅇ', '~함', '~임']
  },
  { 
    id: 'talkative', 
    desc: '수다형',
    features: '말이 많고 상황 설명 길게, 사족 많음',
    markers: ['~거든요', '~는데요', '사실은', '그게']
  },
  {
    id: 'minimal',
    desc: '최소형',
    features: '핵심만 짧게, 1-2문장으로 끝냄',
    markers: ['이거', '이게', '됨?', '가능?']
  }
] as const

/**
 * 텍스트 패턴 시드 (실제 카페 말투 특징)
 */
const TEXT_PATTERN_SEEDS = [
  { 
    id: 'starter_casual',
    feature: '캐주얼 시작어',
    pattern: '아/오/어/음/앗 으로 문장 시작하는 경향',
    probability: 0.4
  },
  { 
    id: 'double_punctuation',
    feature: '물음표/느낌표 중복',
    pattern: '?? 또는 !! 사용',
    probability: 0.35
  },
  { 
    id: 'ending_drop',
    feature: '어미 탈락',
    pattern: '~인가, ~한가 (요 생략)',
    probability: 0.25
  },
  { 
    id: 'filler_words',
    feature: '군더더기',
    pattern: '근데, 그래서, 암튼, 아무튼 자주 사용',
    probability: 0.4
  },
  { 
    id: 'typo_natural',
    feature: '자연스러운 오타',
    pattern: '가끔 오타 (ㅇㅓ→어, 받침 누락 등)',
    probability: 0.2
  },
  {
    id: 'line_break_habit',
    feature: '잦은 줄바꿈',
    pattern: '한 문장씩 줄바꿈하는 습관 (단, 문장 중간X)',
    probability: 0.3
  }
] as const

/**
 * 실시간 변수 시드
 */
const REALTIME_SEEDS = {
  timeOfDay: [
    { time: '새벽', mood: '졸리고 두서없음', typoRate: 'high', length: 'short' },
    { time: '출근길', mood: '급하고 간결함', typoRate: 'medium', length: 'short' },
    { time: '점심', mood: '여유있음', typoRate: 'low', length: 'medium' },
    { time: '오후', mood: '집중력 있음', typoRate: 'low', length: 'medium' },
    { time: '퇴근후', mood: '피곤하지만 꼼꼼', typoRate: 'medium', length: 'long' },
    { time: '밤', mood: '차분하고 감성적', typoRate: 'low', length: 'long' }
  ],
  device: [
    { type: 'mobile', features: '오타 있음, 짧은 문장, ㅋㅋ ㅠㅠ 이모티콘' },
    { type: 'pc', features: '오타 적음, 상세한 설명, 정돈된 문장' },
    { type: 'tablet', features: '중간 정도, 적당히 상세' }
  ],
  activityLevel: [
    { level: '신규', style: '조심스럽고 예의바름, 질문 전에 양해 구함' },
    { level: '중급', style: '편하게 질문, 적당히 친근' },
    { level: '고인물', style: '초성체 사용, 직설적, 은어 섞음' }
  ]
} as const

/**
 * 연령대별 말투 특성
 */
const AGE_STYLE_MAP = {
  '20대': {
    features: ['ㅋㅋ', 'ㅎㅎ', 'ㄹㅇ', '개~', '존~', '미쳤다', 'ㅇㅈ', '레전드'],
    sentenceStyle: '짧고 빠름, 신조어 자연스럽게 사용',
    honorific: '존댓말 필수 (해요체/하십시오체)',
    emoji: '자주 사용'
  },
  '30대': {
    features: ['ㅎㅎ', '혹시', '근데', '좀', '그냥', '진짜'],
    sentenceStyle: '적당히 정중, 존댓말 사용',
    honorific: '존댓말 필수 (해요체)',
    emoji: '적당히 사용'
  },
  '40대': {
    features: ['~네요', '~군요', '감사합니다', '부탁드립니다'],
    sentenceStyle: '정중하고 격식있음',
    honorific: '존댓말 필수 (하십시오체)',
    emoji: '거의 안 씀'
  },
  '50대이상': {
    features: ['~습니다', '~입니다', '고맙습니다', '여쭤봅니다'],
    sentenceStyle: '매우 정중, 완전한 문장',
    honorific: '존댓말 필수 (격식체)',
    emoji: '안 씀'
  }
} as const

/**
 * 제목 패턴 (다양성 확보)
 */
const TITLE_PATTERNS = [
  { id: 'aggro', weight: 0.2, guide: '자극적으로 짧게 (15자 이내). 상품명/나이 생략' },
  { id: 'price_focus', weight: 0.2, guide: '가격을 핵심으로 ("월 3만원대", "5만원 견적")' },
  { id: 'product_skeptic', weight: 0.2, guide: '상품명 + 의심 ("~인데 괜찮나요?", "~이거 별로인가요?")' },
  { id: 'situation', weight: 0.2, guide: '본인 상황 중심 ("30대 직장인", "결혼 앞두고", "갈아타기")' },
  { id: 'specific_feature', weight: 0.1, guide: '특정 특약/기능 질문 ("암진단비", "갱신형이면")' },
  { id: 'standard', weight: 0.1, guide: '정석형 (나이+성별+상품명+질문)' }
] as const

/**
 * 댓글러 페르소나 (확장된 버전)
 */
const COMMENTER_PERSONAS = [
  // 원글 작성자
  { 
    id: 'original_poster', 
    type: '원글 작성자',
    probability: 0.35,
    desc: '처음 질문 올린 본인. 답변 보고 추가 질문',
    behavior: '구체적 궁금증 추가 질문, 감사 표현, 확인 요청',
    greeting: false
  },
  
  // 관심 있는 제3자
  { 
    id: 'interested_lurker', 
    type: '관심생긴 구경꾼',
    probability: 0.15,
    desc: '지나가다 조건 좋아보여서 끼어듦',
    behavior: '"저도 쪽지 주세요", "이 가격이면 괜찮네요" 식으로 상담 요청',
    greeting: true
  },
  { 
    id: 'comparison_shopper', 
    type: '비교 중인 사람',
    probability: 0.1,
    desc: '다른 보험과 비교 중',
    behavior: '"A사보다 이게 낫나요?", "갈아탈만 할까요?" 비교 질문',
    greeting: true
  },
  { 
    id: 'urgent_buyer', 
    type: '급한 가입희망자',
    probability: 0.05,
    desc: '당장 가입 급한 사람',
    behavior: '"이번 주 안에 가입해야 하는데요", "빨리 연락 주세요" 급한 톤',
    greeting: true
  },
  
  // 정보/의견 제공자
  { 
    id: 'info_sharer', 
    type: '정보공유러',
    probability: 0.08,
    desc: '본인이 아는 정보 공유',
    behavior: '"저 다른데서 들었는데", "이건 이렇더라고요" 지식 자랑',
    greeting: false
  },
  { 
    id: 'silent_supporter', 
    type: '조용한 지지자',
    probability: 0.07,
    desc: '짧게 공감만',
    behavior: '"오 괜찮네요", "좋은 정보 감사", "참고할게요" 단답',
    greeting: false
  },
  { 
    id: 'worry_maker', 
    type: '걱정충',
    probability: 0.05,
    desc: '괜히 불안 조장',
    behavior: '"근데 갱신되면 올라요", "나중에 거절당할수도" 부정적 언급',
    greeting: false
  },
  { 
    id: 'reality_checker', 
    type: '현실조언러',
    probability: 0.05,
    desc: '냉정하게 현실 체크',
    behavior: '"그 나이면 이 정도가 적정", "비교해보셨어요?" 객관적 시각',
    greeting: false
  },
  
  // 특수 유형
  { 
    id: 'nitpicker', 
    type: '딴지충',
    probability: 0.05,
    desc: '설계사 답변에 반박/의문 제기',
    behavior: '"다른 보험사는 다르던데요?", "이거 확실한가요?" 따지는 톤',
    greeting: false
  },
  { 
    id: 'lazy_requester', 
    type: '핑거프린세스',
    probability: 0.05,
    desc: '글 안 읽고 무작정 요청',
    behavior: '"저도요", "쪽지 주세요", "저한테도요" 한마디만',
    greeting: false
  }
] as const

/**
 * 답변 논리 구조
 */
const ANSWER_STRUCTURES = [
  { id: 'conclusion_first', order: ['결론', '이유', '상담유도'], weight: 0.25 },
  { id: 'empathy_first', order: ['공감', '분석', '제안'], weight: 0.25 },
  { id: 'fact_check', order: ['질문인정', '팩트', '유도'], weight: 0.2 },
  { id: 'comparison', order: ['비교', '장점', '유도'], weight: 0.15 },
  { id: 'education', order: ['설명', '예시', '유도'], weight: 0.15 }
] as const


// =================================================================
// 3. 유틸리티 함수
// =================================================================

/**
 * 가중치 기반 랜덤 선택
 */
function weightedRandom<T extends { weight?: number; probability?: number }>(items: readonly T[]): T {
  const weights = items.map(item => item.weight ?? item.probability ?? 1)
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let random = Math.random() * totalWeight
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i]
    if (random <= 0) return items[i]
  }
  return items[items.length - 1]
}

/**
 * 배열에서 랜덤 선택
 */
function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * 나이 추출
 */
function extractAge(persona: string): { age: number; decade: string } {
  const decadeMatch = persona.match(/(\d+)대/)
  const yearMatch = persona.match(/(\d+)세/)
  
  let age = 35
  if (decadeMatch) {
    age = parseInt(decadeMatch[1]) + Math.floor(Math.random() * 10)
  } else if (yearMatch) {
    age = parseInt(yearMatch[1])
  }
  
  let decade = '30대'
  if (age < 30) decade = '20대'
  else if (age < 40) decade = '30대'
  else if (age < 50) decade = '40대'
  else decade = '50대이상'
  
  return { age, decade }
}

/**
 * 성별 추출
 */
function extractGender(persona: string): string {
  if (persona.includes('여') || persona.includes('주부') || persona.includes('엄마')) {
    return '여성'
  }
  if (persona.includes('남') || persona.includes('아빠')) {
    return '남성'
  }
  return Math.random() > 0.5 ? '남성' : '여성'
}

/**
 * 전체 시드 생성
 */
function generateFullSeed(): Seed {
  return {
    situation: pickRandom(SITUATION_SEEDS),
    writingStyle: pickRandom(WRITING_STYLE_SEEDS),
    textPattern: pickRandom(TEXT_PATTERN_SEEDS),
    realtime: {
      timeOfDay: pickRandom(REALTIME_SEEDS.timeOfDay),
      device: pickRandom(REALTIME_SEEDS.device),
      activityLevel: pickRandom(REALTIME_SEEDS.activityLevel)
    }
  }
}

/**
 * 연령대별 스타일 가져오기
 */
function getAgeStyle(decade: string) {
  return AGE_STYLE_MAP[decade as keyof typeof AGE_STYLE_MAP] || AGE_STYLE_MAP['30대']
}


// =================================================================
// 4. 핵심 원칙 (간소화 & 강력화)
// =================================================================

const CORE_PRINCIPLES = `
[절대 원칙 - 위반 시 실패]
1. 문장 보존: 문장이 완전히 끝나기 전에 절대 줄바꿈하지 마세요
   - (X) "보험료가 비싸서\\n고민입니다"
   - (O) "보험료가 비싸서 고민입니다"
2. 마침표 금지: 문장 끝에 마침표(.) 대신 줄바꿈 또는 ?!~요 사용
3. 자연스러움: 부여된 페르소나에 100% 빙의. AI 티 나면 실패
4. 예시 베끼기 금지: 프롬프트에 있는 문장을 그대로 쓰지 마세요
`

const OUTPUT_RULES = `
[출력 규칙]
- 순수 텍스트만 출력 (마크다운/HTML 태그 금지)
- 제어 문자나 특수 기호 금지
- 2-3개 문단으로 구성, 문단 사이 빈 줄
`


// =================================================================
// 5. 프롬프트 생성 함수들
// =================================================================

/**
 * Step 1: 초기 질문 생성
 * (기존 호환: generateQuestionPrompt)
 */
export function generateQuestionPrompt(data: QAPromptData): string {
  const { productName, targetPersona, worryPoint, designSheetAnalysis } = data
  
  const seed = generateFullSeed()
  const { age, decade } = extractAge(targetPersona)
  const gender = extractGender(targetPersona)
  const ageStyle = getAgeStyle(decade)
  const titlePattern = weightedRandom(TITLE_PATTERNS)
  
  return `당신은 보험 가입을 고민하는 일반인입니다. 보험카페에 질문글을 작성하세요.

[화자 프로필]
- 나이: ${age}세 (${decade})
- 성별: ${gender}
- 상품: ${productName}
- 고민: ${worryPoint}

[심리 상태 시드]
- 현재 상황: ${seed.situation.desc}
- 작성 환경: ${seed.realtime.device.type}로 ${seed.realtime.timeOfDay.time}에 작성
- 카페 활동: ${seed.realtime.activityLevel.style}

[말투 시드]
- 스타일: ${seed.writingStyle.desc}
- 특징: ${seed.writingStyle.features}
- 연령대 특성: ${ageStyle.sentenceStyle}
- 자주 쓰는 표현: ${ageStyle.features.join(', ')}

[텍스트 패턴]
- ${seed.textPattern.feature}: ${seed.textPattern.pattern}

[제목 작성 가이드]
- 패턴: ${titlePattern.guide}
- 15-40자 내외

[본문 작성 가이드]
1. 위 [심리 상태 시드]를 자연스럽게 녹여서 왜 이 글을 썼는지 표현
2. 설계서 정보 언급: ${designSheetAnalysis?.premium || '보험료'}, ${designSheetAnalysis?.coverages?.slice(0, 2).join(', ') || '보장내용'}
3. [말투 시드]와 [텍스트 패턴]을 반영한 자연스러운 문체
4. **무조건 존댓말(해요체/하십시오체) 사용** (반말 금지)
5. 2-3문단, 300-500자 내외

${CORE_PRINCIPLES}
${OUTPUT_RULES}

---
[제목]:

[본문]:`
}


/**
 * Step 2: 설계사 답변 생성
 */
export function generateAnswerPrompt(
  data: QAPromptData,
  questionTitle: string,
  questionContent: string
): string {
  const { productName, sellingPoint, answerTone, designSheetAnalysis } = data
  
  const structure = weightedRandom(ANSWER_STRUCTURES)
  
  const toneGuide = {
    'friendly': '친근하고 따뜻하게, 고객 눈높이에서',
    'expert': '전문적이지만 이해하기 쉽게',
    'comparative': '객관적 비교로 신뢰감 있게',
    'persuasive': '확신 있게, 하지만 과하지 않게'
  }[answerTone] || '친근하고 따뜻하게'

  return `당신은 15년차 베테랑 보험설계사입니다. 고객의 질문에 답변하세요.

[고객 질문]
제목: "${questionTitle}"
내용: "${questionContent}"

[답변 구조]
${structure.order.join(' → ')} 순서로 구성

[답변 톤]
${toneGuide}

[핵심 정보]
- 상품: ${productName}
- 장점: ${sellingPoint}
- 보험료: ${designSheetAnalysis?.premium || '합리적인 수준'}
- 주요 보장: ${designSheetAnalysis?.coverages?.slice(0, 3).join(', ') || '암진단비, 수술비 등'}

[작성 지침]
1. 고객의 말투와 감정 상태를 파악해서 그에 맞는 톤으로 시작
2. 고객이 짧게 물으면 짧게, 길게 걱정하면 상세하게
3. "질문자님" 반복 금지 → "회원님" 또는 자연스럽게 생략
4. 장점 언급 시 광고처럼 보이지 않게 객관적으로
5. 마지막에 자연스럽게 쪽지/상담 유도 (강요 아닌 제안)
6. **친절하고 정중한 존댓말 사용** ("~님", "~요" 사용)
7. 2-3문단, 300-500자 내외

${CORE_PRINCIPLES}
${OUTPUT_RULES}

---
[생성된 답변]:`
}


/**
 * Step 3: 대화형 스레드 생성 (댓글 티키타카)
 * (기존 호환: generateConversationThreadPrompt)
 * currentStep 홀수 = 고객 턴, 짝수 = 설계사 턴
 */
export function generateConversationThreadPrompt(
  data: QAPromptData,
  context: ConversationContext
): string {
  const { productName, targetPersona, sellingPoint, designSheetAnalysis } = data
  const { conversationHistory, initialQuestion, currentStep, totalSteps } = context
  
  const seed = generateFullSeed()
  const { age, decade } = extractAge(targetPersona)
  const gender = extractGender(targetPersona)
  const ageStyle = getAgeStyle(decade)
  
  // 이전 대화 텍스트화
  const historyText = conversationHistory
    .map(m => `[${m.role === 'customer' ? '회원' : '설계사'}]: ${m.content}`)
    .join('\n')
  
  // 쪽지/상담 요청이 이미 있었는지 확인
  const allHistoryText = [
    initialQuestion.title,
    initialQuestion.content,
    ...conversationHistory.map(m => m.content)
  ].join(' ')
  const hasAskedForDM = allHistoryText.includes('쪽지') || 
                        allHistoryText.includes('상담') || 
                        allHistoryText.includes('문의') ||
                        allHistoryText.includes('연락')
  
  // 현재 단계에 따른 역할 결정
  const isCustomerTurn = currentStep % 2 === 1
  const isLastStep = currentStep >= totalSteps
  const stepNumber = Math.ceil(currentStep / 2)
  
  // 대화 단계 판단
  const phase = stepNumber <= 2 ? '초반' : (stepNumber >= totalSteps - 1 ? '후반' : '중반')
  
  // [Case A] 고객/댓글러 턴
  if (isCustomerTurn) {
    // 쪽지 요청 페르소나 필터링
    let availablePersonas: typeof COMMENTER_PERSONAS[number][] = [...COMMENTER_PERSONAS]
    if (hasAskedForDM) {
      // 쪽지 요청이 이미 있으면 쪽지 요청 페르소나 제외
      availablePersonas = COMMENTER_PERSONAS.filter(p => 
        p.id !== 'interested_lurker' && 
        p.id !== 'urgent_buyer' && 
        p.id !== 'lazy_requester'
      ) as typeof COMMENTER_PERSONAS[number][]
    }
    
    const commenter = weightedRandom(availablePersonas)
    const isOP = commenter.id === 'original_poster'
    
    return `당신은 보험카페 회원입니다. 댓글을 작성하세요.

[당신의 역할]
- 페르소나: ${commenter.type}
- 설명: ${commenter.desc}
- 행동 패턴: ${commenter.behavior}
${isOP ? `- 원글 작성자 (${age}세 ${gender})이므로 이전 맥락을 알고 있음` : '- 제3자이므로 새로운 시각에서 접근'}
${commenter.greeting ? '- 새로운 사람이므로 짧은 인사로 시작 가능' : '- 인사 생략하고 바로 본론'}

[말투 시드]
- 스타일: ${seed.writingStyle.desc}
- 특징: ${seed.writingStyle.features}
- 연령대: ${ageStyle.sentenceStyle}
- 작성 환경: ${seed.realtime.device.features}

[대화 단계: ${phase}]
${phase === '초반' ? '- 탐색 및 조건 확인 단계. 기본적인 궁금증 표현' : ''}
${phase === '중반' ? '- 심화 질문 단계. 의심이나 비교 요청 가능' : ''}
${phase === '후반' ? '- 마무리 단계. 확신 표현이나 최종 확인' : ''}

[원글 정보]
제목: "${initialQuestion.title}"
상품: ${productName}

[이전 대화]
${historyText || '(첫 댓글)'}

[작성 지침]
1. **무조건 존댓말(해요체/하십시오체) 사용** (반말 금지)
2. 위 [페르소나]와 [행동 패턴]에 완전히 빙의
3. 이전 대화에서 이미 나온 내용은 묻지 않기 (중복 금지)
4. 1-3문장으로 짧게 (댓글은 길면 안 됨)
5. [말투 시드] 반영한 자연스러운 카페 말투
6. 마침표(.) 금지, 문장 중간 줄바꿈 금지
${hasAskedForDM ? '\n7. **주의**: 이미 다른 회원이 쪽지/상담을 요청했으므로, 쪽지 요청은 하지 마세요.' : ''}

${CORE_PRINCIPLES}

---
[생성된 댓글]:`
  }
  
  // [Case B] 설계사 턴
  else {
    const lastCustomerMsg = conversationHistory.length > 0
      ? conversationHistory[conversationHistory.length - 1].content
      : ''
    
    const premiumInfo = designSheetAnalysis?.premium || ''
    const coverageInfo = designSheetAnalysis?.coverages?.slice(0, 2).join(', ') || ''

    return `당신은 베테랑 설계사입니다. 회원의 댓글에 답글을 다세요.

[회원의 마지막 댓글]
"${lastCustomerMsg}"

[이전 대화]
${historyText}

[상품 정보]
- 상품: ${productName}
- 장점: ${sellingPoint}
${premiumInfo ? `- 보험료: ${premiumInfo}` : ''}
${coverageInfo ? `- 주요 보장: ${coverageInfo}` : ''}

[작성 지침]
1. 동문서답 금지 - 회원이 물은 것에만 정확히 답변
2. 회원의 톤에 맞추기 - 단답이면 짧게, 진지하면 상세하게
3. 기계적 인사 생략, 바로 본론
4. 자연스럽게 쪽지/상담 넌지시 언급 (강요 X)
5. 1-3문장
6. 마침표(.) 금지

${CORE_PRINCIPLES}

---
[생성된 답글]:`
  }
}


/**
 * Step 4: 후기 메시지 생성
 */
export function generateReviewMessagePrompt(
  data: QAPromptData,
  context: { productName: string }
): string {
  const { productName, targetPersona } = data
  
  const seed = generateFullSeed()
  const { age, decade } = extractAge(targetPersona)
  const gender = extractGender(targetPersona)
  const ageStyle = getAgeStyle(decade)

  return `당신은 보험 가입을 완료한 고객입니다. 설계사에게 감사 후기를 남깁니다.

[화자 프로필]
- 나이: ${age}세 (${decade})
- 성별: ${gender}
- 가입 상품: ${productName}

[서사 시드]
- 가입 전 상황: ${seed.situation.desc}
- 이 상황이 해결되어 현재 만족한 상태

[말투 시드]
- 스타일: ${seed.writingStyle.desc}
- 특징: ${seed.writingStyle.features}
- 연령대 특성: ${ageStyle.sentenceStyle}
- 작성 환경: ${seed.realtime.device.features}

[후기 작성 가이드]
1. 서사 구조: "가입 전 걱정/의심 → 해결 과정 → 현재 만족"
2. 구체적 만족 포인트 1-2개 언급 (가격/보장/친절함/빠른처리 중 택)
3. 상품명(${productName}) 자연스럽게 포함
4. 150-250자, 2-3문장
5. 마지막에 추가 문의 가능 여부 또는 추천 의사 표현 가능

[피해야 할 것]
- "가입 시켜줘서 감사합니다" 같은 어색한 표현
- "최고의 상품", "강력 추천" 같은 광고 멘트
- 로봇 같은 형식적 감사

${CORE_PRINCIPLES}
${OUTPUT_RULES}

---
[생성된 후기]:`
}


/**
 * Step 6: 후기에 대한 설계사 응답
 */
export function generateReviewResponsePrompt(
  data: QAPromptData,
  context: { reviewMessage: string; productName: string }
): string {
  const { reviewMessage, productName } = context

  return `당신은 설계사입니다. 고객의 후기에 감사 답글을 남깁니다.

[고객의 후기]
"${reviewMessage}"

[작성 지침]
1. 고객이 언급한 구체적 내용을 받아서 공감
2. 형식적 답변 금지 - 1:1 대화하듯 자연스럽게
3. 추가 문의 환영한다는 내용으로 마무리
4. 100-180자, 2-3문장
5. 상품명(${productName})은 언급해도 되고 안 해도 됨

[피해야 할 것]
- "감사합니다" 반복
- 매크로 느낌의 답변
- 과도한 이모티콘

${CORE_PRINCIPLES}

---
[생성된 답글]:`
}


// =================================================================
// 6. 대화 시나리오 통합 생성 (선택적)
// =================================================================

/**
 * 전체 대화 시나리오 생성을 위한 메타 프롬프트
 * n8n 등에서 전체 흐름을 한번에 생성할 때 사용
 */
export function generateFullScenarioMeta(data: QAPromptData): {
  questionPrompt: string
  getAnswerPrompt: (title: string, content: string) => string
  getThreadPrompt: (context: ConversationContext) => string
  getReviewPrompt: () => string
  getReviewResponsePrompt: (review: string) => string
} {
  return {
    questionPrompt: generateQuestionPrompt(data),
    getAnswerPrompt: (title, content) => generateAnswerPrompt(data, title, content),
    getThreadPrompt: (context) => generateConversationThreadPrompt(data, context),
    getReviewPrompt: () => generateReviewMessagePrompt(data, { productName: data.productName }),
    getReviewResponsePrompt: (review) => generateReviewResponsePrompt(data, { 
      reviewMessage: review, 
      productName: data.productName 
    })
  }
}


// =================================================================
// 7. 디버그/테스트 유틸리티
// =================================================================

/**
 * 현재 생성되는 시드 조합 확인용
 */
export function debugCurrentSeeds(): void {
  const seed = generateFullSeed()
  console.log('=== Current Seed Combination ===')
  console.log('Situation:', seed.situation.desc)
  console.log('Writing Style:', seed.writingStyle.desc)
  console.log('Text Pattern:', seed.textPattern.feature)
  console.log('Time:', seed.realtime.timeOfDay.time, '-', seed.realtime.timeOfDay.mood)
  console.log('Device:', seed.realtime.device.type)
  console.log('Activity:', seed.realtime.activityLevel.level)
  console.log('================================')
}

/**
 * 가능한 조합 수 계산
 */
export function calculateCombinations(): number {
  const situations = SITUATION_SEEDS.length
  const styles = WRITING_STYLE_SEEDS.length
  const patterns = TEXT_PATTERN_SEEDS.length
  const times = REALTIME_SEEDS.timeOfDay.length
  const devices = REALTIME_SEEDS.device.length
  const activities = REALTIME_SEEDS.activityLevel.length
  
  const total = situations * styles * patterns * times * devices * activities
  console.log(`Total possible combinations: ${total}`)
  return total
}
