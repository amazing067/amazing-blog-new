# Q&A 시스템 전체 레퍼런스 — Part 1-B: 프롬프트 시스템

> **이 문서는 Q&A 시스템에 사용되는 모든 코드·로직·프롬프트를 빠짐없이 수록합니다.**
> 총 3파트로 구성: [Part 1-A (유틸 라이브러리)](./qa-system-part1-lib-utils.md) / Part 1-B (프롬프트) / [Part 2 (API 라우트)](./qa-system-part2-api.md)

---

## 파일

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `lib/prompts/qa-prompt.ts` | 1,737 | 모든 프롬프트 템플릿 + 코드 레벨 무작위성 데이터 + 헬퍼 |

---

## 구조 개요

```
qa-prompt.ts
├── COMMON_GUIDELINES (공통 지침 5종)
├── 코드 레벨 무작위성 데이터
│   ├── QUESTION_CONCEPTS (5개 — 질문자 태도)
│   ├── TITLE_PATTERNS (6개 — 제목 패턴, 확률 기반)
│   ├── ANSWER_STRUCTURES (5개 — 답변 논리 구조)
│   ├── COMMENT_INTENTS (5개 — 댓글 작성 의도)
│   ├── COMMENTER_PERSONAS (5개 — 댓글 작성자, 확률 기반)
│   └── CONTEXT_NOISE (7개 — 문체 다양성)
├── 헬퍼 함수
│   ├── getRandomItem / getWeightedPersona / getWeightedTitlePattern
│   ├── getRandomContext
│   └── getDialogueState (대화 상태 머신)
├── 타입 정의
│   └── QAPromptData / ConversationMessage / ConversationContext / QuestionPromptResult
├── 프롬프트 생성 함수
│   ├── generateQuestionPrompt (Step 1: 질문)
│   ├── generateAnswerPrompt (Step 2: 답변)
│   ├── generateConversationThreadPrompt (Step 3: 개별 댓글)
│   ├── generateCommentPairPrompt (Step 3: 2쌍 구조 댓글)
│   ├── generateUnifiedQAPrompt (통합 생성 — 현재 비활성)
│   ├── generateThreadBatchPrompt (댓글 배치 — 통합 경로용)
│   ├── generateReviewMessagePrompt (후기 — 고객)
│   └── generateReviewResponsePrompt (후기 — 설계사 응답)
```

---

## 전체 소스 코드

```typescript
import { pickOpeningFamily as _pickOpeningFamily } from '@/lib/title-family'

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
    probability: 0.1
  }
] as const

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

const COMMENT_INTENTS = [
  { id: '딴지걸기', tone: '반박하고 의문을 제기하는' },
  { id: '재촉하기', tone: '빠른 답변을 재촉하는' },
  { id: '단순호응', tone: '긍정적으로 호응하는' },
  { id: '엉뚱한질문', tone: '엉뚱한 질문을 하는' },
  { id: '경험담공유', tone: '경험을 공유하는' }
] as const

const COMMENTER_PERSONAS = [
  { id: 'ORIGINAL', type: '원글 작성자', probability: 0.4, greeting: '' },
  { id: 'NEW_INTERESTED', type: '관심 생긴 제3자', probability: 0.25, greeting: '안녕하세요~' },
  { id: 'NEW_COMPARE', type: '비교 중인 제3자', probability: 0.15, greeting: '안녕하세요~' },
  { id: 'NEW_URGENT', type: '급한 가입희망자', probability: 0.1, greeting: '안녕하세요~' },
  { id: 'NEW_SKEPTIC', type: '조건 따지는 제3자', probability: 0.1, greeting: '안녕하세요~' }
] as const

const CONTEXT_NOISE = [
  '핸드폰으로 급하게 써서 문장이 짧고 간결한 스타일 (존댓말 유지)',
  '매우 꼼꼼하고 예의 바른 성격이라 "혹시 실례가 안 된다면~" 같은 표현 사용',
  '걱정이 많아서 "ㅠㅠ" 같은 이모티콘을 섞으며 불안해하는 말투',
  '회사 업무 중에 몰래 쓰는 상황이라 핵심만 딱딱 묻는 사무적인 말투',
  '보험 용어를 어느 정도 알아서 "그럼 납입면제는요?" 같이 훅 들어오는 스타일',
  '옆집 이웃에게 물어보듯 친근하고 부드러운 "해요"체 사용',
  '아무런 감정 없이 건조하게 팩트만 확인하는 시크한 존댓말'
] as const

// ============================================
// 헬퍼 함수
// ============================================

function getRandomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function getWeightedPersona() {
  const rand = Math.random()
  let sum = 0
  for (const persona of COMMENTER_PERSONAS) {
    sum += persona.probability
    if (rand <= sum) return persona
  }
  return COMMENTER_PERSONAS[0]
}

function getWeightedTitlePattern() {
  const rand = Math.random()
  let sum = 0
  for (const pattern of TITLE_PATTERNS) {
    sum += pattern.probability
    if (rand <= sum) return pattern
  }
  return TITLE_PATTERNS[0]
}

function getRandomContext() {
  return getRandomItem(CONTEXT_NOISE)
}

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

// ============================================
// 타입 정의
// ============================================

export interface QAPromptData {
  productName: string
  topicName?: string
  displayProductName?: string
  targetPersona: string
  worryPoint: string
  sellingPoint: string
  answerTone: string
  answerLength?: 'default'
  designSheetImage?: string
  designSheetAnalysis?: {
    premium?: string
    coverages?: string[]
    specialClauses?: string[]
  }
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

export interface QuestionPromptResult {
  prompt: string
  openingFamilyId: string
  openingFamilyName: string
  titlePatternId: string
  questionConceptId: string
}

// ============================================
// generateQuestionPrompt (Step 1: 질문 생성)
// ============================================
// 449~634행 — Flash 모델 호출용
// 주요 프롬프트 블록:
//   [화자 프로필] — 나이·성별 + randomSituation
//   [최근 검색 요약] — searchResultsText (일반론으로만)
//   [작성 미션] — 제목(selectedTitlePattern) + 본문(displayName 1회, 이후 customerFacingName)
//   [사실성 필수] — 입력에 없는 수치 임의 생성 금지
//   [📋 Evidence Map] — questionFacts 주입
//   [⛔ 절대 사용 금지] — forbiddenPatterns 주입
//   [⚖️ Conflict Axis] — 핵심 갈등 구조 주입
//   [출력 형식] — JSON { "title": "...", "body": "..." }
//
// 코드 레벨 무작위성:
//   - QUESTION_CONCEPTS에서 태도 랜덤 선택
//   - TITLE_PATTERNS에서 확률 기반 패턴 선택
//   - OPENING_FAMILIES에서 도입 톤 랜덤 선택
//   - CONTEXT_NOISE에서 문체 노이즈 랜덤 선택
//   - 나이대별 말투 가이드 자동 적용

// ============================================
// generateAnswerPrompt (Step 2: 답변 생성)
// ============================================
// 639~928행 — Pro 모델 호출용
// 주요 프롬프트 블록:
//   [상품명 사용 규칙] — displayName 1회 → customerFacingName 이후
//   [⛔ 절대 사용 금지] — forbiddenPatterns
//   [📋 답변 근거 사실 (Evidence Map)] — answerFacts 주입
//   [⚖️ 판단 축 (Conflict Axis)] — 판단 한 줄 강제
//   [핵심 지침 0~10]
//     0. 세일즈 모드 (CTA, 구체 숫자)
//     1. 고객 호명 + 공감 (empathyText 랜덤)
//     2. 구체적 금액/조건 필수
//     3. 전문적 디테일
//     4. 비교 제시 (현실적 금액)
//     5. 가입 유도
//     6. 답변 톤 (selectedTone)
//     7. 답변 구조 (selectedStructure)
//     8. 길이 300~450자, 4블록 고정
//     9. 다양성
//    10. 카페 형식
//
// 코드 레벨 무작위성:
//   - ANSWER_STRUCTURES에서 논리 구조 랜덤 선택
//   - empathyMap에서 공감 표현 랜덤 선택

// ============================================
// generateConversationThreadPrompt (Step 3: 개별 댓글)
// ============================================
// 935~1131행 — 고객 턴(Flash) / 설계사 턴(Pro) 교대
// 고객 턴:
//   - COMMENTER_PERSONAS 확률 기반 선택
//   - COMMENT_FAMILIES (7종) 가중치 기반 선택
//   - CONTEXT_NOISE 문체 다양성
//   - 이전 주제 회피 로직
//   - 마지막 스텝 → 가입희망 강제
// 설계사 턴:
//   - ADVISOR_TONES (4종) 랜덤 선택
//   - 범위 제한 (해약환급금·간편심사·특약·보험료·가입조건·보장 범위)
//   - 생활형 표현 강제

// ============================================
// generateCommentPairPrompt (Step 3: 2쌍 구조)
// ============================================
// 1138~1210행 — Pro 모델 호출용
// 쌍 0: 고객=걱정→기준 요청 / 설계사=기준 제시+체크포인트
// 쌍 1: 고객=조건 확인→정리 / 설계사=정리+행동 유도
// 출력: JSON { "customer": "...", "agent": "..." }

// ============================================
// generateUnifiedQAPrompt (통합 생성 — 통합 경로에서 사용)
// ============================================
// UnifiedQAPromptData에 selectedConcern, selectedConcernSearch, coverageSummaryForPrompt, coverageFocusLabels 수용.
// 값이 있으면 공통 규칙에 설계서 고민 축 블록 추가: 고민 축 중심 전개, 보장 요약 1~2개 반영, coverageFocusLabels 참고.

// ============================================
// generateThreadBatchPrompt (댓글 배치 — 통합 경로용)
// ============================================
// ThreadBatchPromptData에 selectedConcern, selectedConcernSearch, coverageSummaryForPrompt, coverageFocusLabels 수용.
// 값이 있으면 공통 규칙에 대화 고민 축·보장 요약 1개 이상 반영 블록 추가.

// ============================================
// generateReviewMessagePrompt (후기 — 고객)
// ============================================
// 1506~1643행 — Flash 모델 호출
// 8개 후기 패턴: 가입완료+장점+감사 / 만족도+장점+감사 / 추천의도 등
// 150-250자, 안심형/현실형 위주, 극찬형 지양

// ============================================
// generateReviewResponsePrompt (후기 — 설계사 응답)
// ============================================
// 1649~1737행 — Flash 모델 호출
// 15개 응답 패턴, 150-250자, 친절한 톤
// 추천 의도 응답, 추가 질문 환영 표현 포함
```

---

## 주요 프롬프트 구조 상세

### generateQuestionPrompt 프롬프트 골격

```
당신은 보험 가입을 고민 중인 일반인입니다. 커뮤니티에 질문글을 작성합니다.

[화자 프로필]
- {profileAgeLabel} ({targetPersona})
- 현재 상황/기분: **{randomSituation}**

[최근 검색 요약] (있는 경우)
- 검색 요약은 일반론으로만 반영

[작성 미션]
1. 제목: [{selectedTitlePattern.type}] 스타일로 작성
   - 핵심키워드 1개 이상 포함
   - 정식 상품명 전체 제목에 쓰지 말 것
   - 괄호, 버전 코드, 로마숫자, (주), 무배당 금지
2. 본문:
   - 설계서 내용 언급하며 궁금한 점
   - 본문 첫 언급 "{displayName}" 1회 → 이후 "{customerFacingName}"
   - 태도: **{selectedConcept.tone}**
   - 도입 톤: **"{openingGuide}"**
   - 300~500자, 2~3개 문단

[사실성 - 필수]
- 입력에 없는 수치 임의 생성 금지

[📋 Evidence Map] — questionFacts
[⛔ 절대 사용 금지] — forbiddenPatterns
[⚖️ Conflict Axis] — 갈등 구조
[📌 설계서 고민 축] — (설계서 모드) data에 selectedConcern/selectedConcernSearch/coverageSummaryForPrompt/coverageFocusLabels가 있으면: 질문 중심을 해당 고민 축으로, 보장 요약 1~2개 자연스럽게 반영, 구조어 대신 "보장 구성/쏠림/균형" 표현

[출력 형식] — JSON { "title": "...", "body": "..." }
```

- **QAPromptData** 확장 필드(설계서 모드): `selectedConcern`, `selectedConcernSearch`, `coverageSummaryForPrompt`, `coverageFocusLabels`. 질문/답변/댓글/통합/스레드배치 프롬프트에서 destructure 후 값이 있을 때만 설계서 전용 블록 삽입.

### generateAnswerPrompt 프롬프트 골격

```
당신은 {customerFacingName}을 판매하는 15년 이상의 경력을 가진 베테랑 보험 전문가입니다.

[상품명 사용 규칙]
- 첫 언급 "{displayName}" 1회 → 이후 "{customerFacingName}"
- 내부 표기 절대 금지
- **해지·환급 구조 설명 절대 금지**: "중간에 해지하면 돌려받는 돈이 거의 없는", "해지하면 돌려받는 돈이 없는 구조", "해약환급금이 없는 대신" 등은 전문가 답변에 절대 쓰지 마세요

[⛔ 절대 사용 금지] — forbiddenPatterns
[📋 답변 근거 사실 (Evidence Map)] — answerFacts
[⚖️ 판단 축 (Conflict Axis)] — 판단 한 줄 강제
[📌 설계서 판단 축] — selectedConcern으로 판단 시작, coverageSummaryForPrompt 중 2개 안팎 근거 사용, 고정 문장 반복 금지

[핵심 지침]
0. 세일즈 모드 (CTA, 구체 숫자)
1. 고객 호명 + 공감 (empathyText)
2. 구체적 금액/조건 필수
3. 전문적 디테일
4. 비교 제시
5. 가입 유도
6. 답변 톤: {selectedTone}
7. 답변 구조: {selectedStructure.id}
8. 길이 300~450자, 4블록:
   ① 공감/전제 1문장
   ② 핵심 판단 1~2문장 (판단 한 줄 필수)
   ③ 체크포인트 2~3개
   ④ 행동 유도 1문장
9. 다양성
10. 카페 형식

[출력] — 본문만 (순수 텍스트)
```

### generateCommentPairPrompt 프롬프트 골격

```
당신은 보험카페 댓글 스레드를 쓰는 작가입니다.
고객 댓글 1개 + 설계사 답글 1개를 JSON으로 생성하세요.

[스레드 흐름]
- 쌍0: 걱정 → 기준 요청 / 기준 제시 + 체크포인트
- 쌍1: 조건 확인 → 정리 / 정리 + 행동 유도

[핵심 원칙]
1. 앞 대화를 실제로 소화한 느낌
2. 정확히 대응 + 새 정보 1개
3. 카페 댓글 말투
4. 생활형 표현
5. conflictAxis 반영
6. (설계서 모드) [📌 설계서 댓글 축] — 고객: selectedConcern/보장 요약으로 추가 질문, 설계사: 보장 기준 정리·보장 요약 1개 이상 근거, 영업성/동일 마무리 반복 금지

[글자 수]
쌍0: 고객 150~250 / 설계사 180~280
쌍1: 고객 120~200 / 설계사 150~230

[출력] { "customer": "...", "agent": "..." }
```

---

> **이전 파트**: [Part 1-A: 라이브러리 유틸리티](./qa-system-part1-lib-utils.md)
> **다음 파트**: [Part 2: API 라우트](./qa-system-part2-api.md) (`analyze-design-sheet/route.ts` + `generate-qa/route.ts` + `product-name-correction.ts`)
