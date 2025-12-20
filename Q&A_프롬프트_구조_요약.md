# Q&A 프롬프트 시스템 구조 요약

## 📋 개요
보험카페 스타일의 Q&A를 자동 생성하는 AI 프롬프트 시스템입니다. 고객 질문부터 전문가 답변, 그리고 자연스러운 대화형 댓글 스레드까지 전체 대화 흐름을 생성합니다.

---

## 🔄 생성 단계 (3단계)

### **Step 1: 고객 질문 생성**
**목적**: 일반인이 보험카페에 올리는 질문글 생성

**입력 정보**:
- 상품명, 타겟 고객층, 고민 포인트, 강조 포인트
- 고객 스타일 (친근함/차갑함/간결함/궁금함)
- 감정 상태 (급함/고민/궁금/불안 등)
- 설계서 이미지 및 분석 결과 (선택)
- 최신 검색 결과 (보험료, 경쟁사 비교 등)

**출력 형식**:
- **제목**: 최대 50자, 1줄 (예: "75세 남성 DB손보 건강고지보험 월 47,710원 구성 충분할까요?")
- **본문**: 3-5개 문단으로 구성된 상세 질문

**주요 특징**:
- 나이/성별에 맞는 자연스러운 말투
- 주변 사람 경험, 가족/친구 사례 포함
- 설계서/제안서 언급 자연스럽게
- 보험 지식이 부족한 일반인 관점

---

### **Step 2: 전문가 첫 답변 생성**
**목적**: 설계사가 질문에 대한 전문적이고 상세한 첫 답변 생성

**입력 정보**:
- Step 1에서 생성된 질문 (제목 + 본문)
- 상품명, 강조 포인트, 답변 톤
- 설계서 분석 결과 (보험료, 담보, 특약)
- 최신 검색 결과

**답변 길이 옵션**:
- **짧은 답변**: 100-150자 (핵심 정보만)
- **기본 답변**: 200-300자 (상세 설명, 길이 제한 없음)

**주요 특징**:
- 구체적 금액, 조건, 특약명 명시 필수
- 경쟁사 비교 분석 포함
- 리스크/제한사항 설명 + 해결책 제시
- 무책임한 답변 절대 금지 (예: "제안서를 다시 보시면...")
- 친절하고 전문가다운 톤

---

### **Step 3: 대화형 댓글 스레드 생성**
**목적**: 첫 답변 이후 자연스러운 대화를 이어가는 댓글들 생성

**구성**:
- **고객 댓글** (홀수 번째): 추가 질문, 궁금증 표현
- **설계사 댓글** (짝수 번째): 전문적 답변, 상담 유도

**대화 횟수**: 6개, 8개, 10개, 12개 (짝수만, 항상 설계사가 마무리)

**답변 길이 옵션**:
- **짧은 답변**: 모든 댓글 120-150자
- **기본 답변**: 단계별 길이
  - 초반 (1-2번째): 200-300자 (상세 설명)
  - 중반 (3-4번째): 150-250자 (구체적 답변)
  - 후반 (5번째 이후): 100-200자 (간결하게)

**주요 특징**:
- **고객 역할 다양화**: 여러 사람이 댓글을 다는 것처럼 (customer1, customer2, customer3, customer4)
- **질문 어미 다양화**: "궁금해요" 5% 이하, 다양한 어미 사용
- **반복 방지**: 이전 댓글과 동일한 패턴/표현 절대 금지
- **자연스러운 전환**: "그런데", "혹시" 같은 전환 문구 최소화 (10% 이하)
- **끝맺음 필수**: 문장 완성, 해결책 제시 필수
- **요약 지시**: 길이 초과 시 단순 자르기 대신 핵심 정보만 남기고 요약

---

## 🎯 핵심 원칙

### 1. **자연스러움**
- 실제 보험카페에서 볼 수 있는 자연스러운 대화
- 짜고 치는 느낌 절대 금지
- 각 고객은 다른 사람처럼 다른 말투 사용

### 2. **전문성**
- 구체적 금액, 조건, 특약명 명시
- 경쟁사 비교 분석
- 리스크 설명 + 해결책 제시

### 3. **다양성**
- 매번 다른 패턴, 다른 구조, 다른 표현
- 질문 어미 다양화
- 전환 문구 다양화

### 4. **품질 보장**
- 무책임한 답변 절대 금지
- 끝맺음 필수 (중간에 끊기지 않음)
- 해결책 제시 필수

---

## 📊 입력 파라미터

| 파라미터 | 설명 | 예시 |
|---------|------|------|
| `productName` | 보험 상품명 | "DB손보 건강고지보험" |
| `targetPersona` | 타겟 고객층 | "75세 남성", "30대 여성" |
| `worryPoint` | 고민 포인트 | "암 진단비 걱정", "보험료 부담" |
| `sellingPoint` | 강조 포인트 | "가성비 좋음", "보장 범위 넓음" |
| `feelingTone` | 감정 상태 | "고민", "급함", "불안" |
| `answerTone` | 답변 톤 | "friendly", "expert" |
| `customerStyle` | 고객 스타일 | "curious", "cold", "brief", "friendly" |
| `answerLength` | 답변 길이 | "short" (100-150자), "default" (단계별) |
| `conversationLength` | 대화 횟수 | 6, 8, 10, 12 (짝수만) |

---

## 🔧 기술적 특징

### **모델 사용 전략 (하이브리드)**
- **Flash 모델** (비용 절감): 질문 생성, 고객 댓글
- **Pro 모델** (품질 유지): 전문가 답변, 설계사 댓글

### **폴백 순서**
- **Pro 우선**: Pro → 2.5 Flash → 2.0 Flash
- **Flash 우선**: 2.5 Flash → 2.0 Flash

### **길이 제어**
- **프롬프트 우선**: AI가 지정된 길이 내로 요약하여 생성
- **API 보호**: 극단적으로 긴 경우(150% 초과)에만 제한 적용
- **문장 완성**: 한국어 문장 끝 패턴 인식으로 자연스러운 끝맺음

---

## 📝 출력 예시

### 질문 (Step 1)
**제목**: "75세 남성 DB손보 건강고지보험 월 47,710원 구성 충분할까요?"

**본문**: 
"안녕하세요 75살 남자입니다...
[3-5개 문단으로 구성된 상세 질문]"

### 첫 답변 (Step 2)
"질문자님~ 좋은 질문이시네요^^
[구체적 금액, 조건, 특약명 포함]
[경쟁사 비교]
[해결책 제시]
[상담 유도]"

### 대화형 댓글 (Step 3)
**고객**: "그렇다면 10대골절진단비 200만원보다 더 추가해서 가입이 가능한지 궁금해요"

**설계사**: "미라클님~ 네^^ 가능합니다 실제로는..."

---

## ✅ 품질 보장 메커니즘

1. **프롬프트 강화**: 길이 제한, 요약 지시, 끝맺음 필수
2. **패턴 감지**: 본문 시작 패턴 감지로 제목/본문 경계 명확히 분리
3. **중복 제거**: 제목과 본문 중복 자동 제거
4. **에러 처리**: 프롬프트 실패 시 폴백 로직

---

## 🔧 기술적 구현 상세

### **1. 프롬프트 생성 구조**

#### **프롬프트 템플릿 형식**
각 단계별로 TypeScript 함수로 프롬프트를 동적으로 생성합니다:

```typescript
// Step 1: 질문 생성
generateQuestionPrompt(data: QAPromptData): string

// Step 2: 답변 생성  
generateAnswerPrompt(data: QAPromptData, questionTitle: string, questionContent: string): string

// Step 3: 대화형 스레드
generateConversationThreadPrompt(data: QAPromptData, context: ConversationContext): string
```

#### **프롬프트 구성 요소**
1. **상황 설정**: 역할, 목표, 맥락 설명
2. **입력 정보**: 상품명, 타겟 고객, 설계서 분석, 검색 결과
3. **핵심 지침**: 답변 길이, 톤, 스타일, 금지 사항
4. **출력 형식**: 마크다운 금지, 마침표 금지, 순수 텍스트만
5. **최종 확인**: 길이, 끝맺음, 해결책, 요약 확인

#### **실제 프롬프트 예시 (Step 1)**
```
당신은 보험 지식이 부족한 일반인이며, 현재 보험 가입을 두고 고민 중인 커뮤니티 유저입니다.

[역할 설정]
- 나이: 75세 (매우 중요! 반드시 이 나이로 질문을 작성하세요!)
- 성별: 남성 (매우 중요! 반드시 이 성별로 질문을 작성하세요!)
- 타겟 고객: 75세 남성
- 보험에 대한 지식이 거의 없는 일반인
- 설계서를 받았지만 내용을 제대로 이해하지 못함
- 다른 사람들의 조언을 구하고 싶어함

[최근 검색 요약]
- 아래 검색 요약을 근거로 최신/구체 정보를 자연스럽게 반영하세요
- 링크나 출처를 본문에 남기지 말고 내용만 녹여서 전달하세요

- (1) DB손보 건강고지보험 보험료 가격 비교 — 월 보험료는 4만원대부터 시작하며...
- (2) DB손보 건강고지보험 특약 구성 — 통합전이암진단비, 간병인 사용...
- (3) DB손보 건강고지보험 경쟁사 비교 — 삼성생명, 한화생명 대비...
- (4) DB손보 건강고지보험 75세 남성 보험료 — 75세 남성 기준 월 4.5~5만원대...
- (5) DB손보 건강고지보험 후기 — 보장 범위가 넓고 보험료 대비 만족도가 높다는 평가가 많습니다

[핵심 지침]

1. 고객 스타일 (매우 중요!): 정말 궁금해서 물어보는 톤으로 작성하세요
   - 스타일 설명: 짜고 치는 느낌이 아니라 정말 모르는 게 있어서 궁금해서 물어봅니다
   - 예시:
     * "설계서 받았는데 이 보험료가 적정한 건지 모르겠어서요"
     * "다른 보험사는 어떤지 궁금해서요"
     * "이 특약이 정말 필요한 건지 잘 모르겠어요"
   - 피해야 할 것:
     * 과도한 친근함이나 정중함
     * 짜고 치는 느낌의 표현
     * 불필요한 감정 과장
   - 핵심: 진짜 모르는 게 있어서 궁금해서 물어보는 자연스러운 톤

2. 말투 및 형식: 정돈된 형식으로 작성하되, 일반인이 쓴 것처럼 자연스럽게
   - 50대 이상 말투: "이게 괜찮은 건지 모르겠어서요", "설계서를 받았는데 잘 모르겠어서 문의드립니다"
   - 더 정중한 표현, "요" 체 적극 사용, 문의드립니다 형식 선호
   - 정돈된 형식 유지: 전문가 답변처럼 문단 구분을 명확히 하고 정돈된 형식으로 작성
   - 문단 구분 필수: 질문 본문을 3-4개의 문단으로 나누어 작성 (각 문단 사이 빈 줄 추가)

3. 전문 용어 사용 가이드:
   - 전문 용어를 자연스럽게 사용하되, 완전히 이해하지 못한 느낌을 주세요
   - 예시: "10대골절진단비 200만원을 받을 수 있는 건가요?" (전문 용어 사용하되 확신 없음)
   - 허용되는 전문 용어: "10대골절진단비", "암주요치료비", "체증형", "면책기간" 등

4. 설계서/제안서 언급 (매우 중요):
   - "제안서를 하나 받아봤는데 월보험료가 47,710원으로 부담없게 구성되어있더라고요"
   - "설계서 받았는데 보험료가 월 47,710원이에요 이게 적정한가요?"
   - "설계서 보니까 통합전이암진단비, 간병인 사용 상해/질병 입원일당이 포함되어 있는데 이게 필요한 건가요?"
   - "이 설계안 봐주시고 의견 주시면 감사하겠습니다"

5. 감정 상태: 고민 상태를 반영하세요
   - 고민: "고민이 많아서", "어떤 게 나을지 모르겠어요", "이게 맞는 건지 확신이 안 서서"

6. 제목 규칙:
   - 상품명을 자연스럽게 포함
   - 질문 형식으로 작성
   - 30자 이내
   - 나이(75세)와 성별(남성)에 맞는 말투 사용

제목:
[생성된 제목]

본문:
[생성된 본문]
```

---

### **2. API 호출 흐름**

#### **전체 프로세스**
```
1. 클라이언트 요청 (POST /api/generate-qa)
   ↓
2. 입력 검증 및 전처리
   ↓
3. Google 검색 (최신 정보 수집)
   ↓
4. Step 1: 질문 생성
   ├─ 프롬프트 생성 (generateQuestionPrompt)
   ├─ Gemini API 호출 (Flash 모델)
   └─ 파싱 (제목/본문 분리)
   ↓
5. Step 2: 답변 생성
   ├─ 프롬프트 생성 (generateAnswerPrompt)
   ├─ Gemini API 호출 (Pro 모델)
   └─ 후처리 (제어 문자 제거)
   ↓
6. Step 3: 대화형 스레드 생성 (선택)
   ├─ 반복 (6/8/10/12회)
   │  ├─ 고객 댓글 (홀수, Flash)
   │  └─ 설계사 댓글 (짝수, Pro)
   └─ 길이 제어 및 후처리
   ↓
7. 응답 반환 (JSON)
```

#### **API 엔드포인트 구조**
```typescript
POST /api/generate-qa
{
  productName: string,
  targetPersona: string,
  worryPoint: string,
  sellingPoint: string,
  feelingTone: string,
  answerTone: string,
  customerStyle: 'friendly' | 'cold' | 'brief' | 'curious',
  answerLength: 'short' | 'default',
  conversationMode: boolean,
  conversationLength: 6 | 8 | 10 | 12,
  designSheetImage?: string (base64),
  designSheetAnalysis?: {
    premium?: string,
    coverages?: string[],
    specialClauses?: string[]
  }
}
```

---

### **3. 모델 선택 및 폴백 로직**

#### **하이브리드 전략**
```typescript
// Flash 모델 사용 (비용 절감)
- Step 1: 질문 생성 → gemini-2.5-flash
- Step 3: 고객 댓글 → gemini-2.5-flash

// Pro 모델 사용 (품질 유지)
- Step 2: 전문가 답변 → gemini-2.5-pro
- Step 3: 설계사 댓글 → gemini-2.5-pro
```

#### **폴백 순서**
```typescript
// Pro 우선 (useFlash = false)
1차: gemini-2.5-pro
2차: gemini-2.5-flash (Pro 실패 시)
3차: gemini-2.0-flash (2.5 Flash 실패 시)

// Flash 우선 (useFlash = true)
1차: gemini-2.5-flash
2차: gemini-2.0-flash (2.5 Flash 실패 시)
```

#### **에러 처리**
- **모델 없음 (404)**: 즉시 다음 모델로 폴백
- **할당량 초과 (429)**: 다음 모델로 폴백
- **기타 에러**: 로깅 후 다음 모델 시도
- **모든 모델 실패**: 상세 에러 메시지 반환

---

### **4. 데이터 파싱 및 후처리**

#### **질문 파싱 (Step 1)**
```typescript
// 1. 원본 텍스트에서 "제목:" / "본문:" 형식 파싱
const titleSectionMatch = questionText.match(/제목[:\s]*\n?([\s\S]*?)(?:\n\s*본문[:\s]*\n?|$)/i)
const contentSectionMatch = questionText.match(/본문[:\s]*\n?([\s\S]*?)$/i)

// 2. 본문 시작 패턴 감지
const bodyStartPatterns = [
  /안녕하세요/i,
  /저는\s*\d+세/i,
  /현재는/i,
  /이번에/i,
  // ... 등
]

// 3. 제목 추출 (최대 50자, 본문 시작 패턴 이전까지만)
finalQuestionTitle = titleText
  .replace(/본문[:\s]*/i, '')
  .substring(0, findBodyStartPattern(titleText))
  .trim()
  .substring(0, 50)

// 4. 본문 추출 (제목 제거, "본문:" 접두사 제거)
rawQuestionContent = contentSectionMatch[1]
  .replace(/제목[:\s]*/i, '')
  .replace(titleTrimmed, '') // 제목과 중복 제거
  .trim()
```

#### **답변 후처리 (Step 2, 3)**
```typescript
// 1. 제어 문자 제거
answerContent = answerContent
  .replace(/<ctrl\d+>/gi, '')
  .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')

// 2. 마크다운 제거
answerContent = answerContent
  .replace(/```[\s\S]*?```/g, '')
  .replace(/\[생성된 댓글\]/g, '')

// 3. 길이 제어 (프롬프트 우선, 150% 초과 시에만 제한)
if (content.length > expectedMaxLength * 1.5) {
  content = enforceAnswerLength(content, expectedMaxLength)
}
```

#### **길이 제어 함수 (enforceAnswerLength)**
```typescript
// 1. 문단 단위로 분리
const paragraphs = content.split(/\n\s*\n/)

// 2. 문단 단위로 자르기 시도
for (const paragraph of paragraphs) {
  if (result + paragraph <= maxLength) {
    result += paragraph
  } else {
    // 3. 문장 단위로 자르기
    // 4. 한국어 문장 끝 패턴 찾기 (findKoreanSentenceEnd)
    // 5. 단어 단위로 자르기 (최후의 수단)
  }
}
```

---

### **5. Google 검색 및 Grounding 통합**

#### **검색 쿼리 생성 (커스텀 검색)**
```typescript
// Step 1 전에 실행되는 Google Custom Search
// 검색 쿼리 자동 생성 (중복 제거)
const searchQueries = Array.from(new Set([
  `${productName} 보험료 가격`,           // 예: "DB손보 건강고지보험 보험료 가격"
  `${productName} 보험료 비교`,           // 예: "DB손보 건강고지보험 보험료 비교"
  `${productName} 장점 특징`,             // 예: "DB손보 건강고지보험 장점 특징"
  `${productName} 특약 구성`,             // 예: "DB손보 건강고지보험 특약 구성"
  `${productName} 보장 내용`,             // 예: "DB손보 건강고지보험 보장 내용"
  `${productName} 후기`,                  // 예: "DB손보 건강고지보험 후기"
  `${productName} ${targetPersona} 보험료`, // 예: "DB손보 건강고지보험 75세 남성 보험료"
  `${productName} ${targetPersona} 추천`,   // 예: "DB손보 건강고지보험 75세 남성 추천"
  `${productName} ${worryPoint}`,         // 예: "DB손보 건강고지보험 암 진단비 걱정"
  `${productName} ${sellingPoint}`        // 예: "DB손보 건강고지보험 가성비 좋음"
]))

// 검색 실행 (각 쿼리별로 최대 3개 결과 수집)
const collected: SearchResult[] = []
const seen = new Set<string>() // 중복 URL 제거

for (const query of searchQueries) {
  const res = await searchGoogle(query, 3) // 각 쿼리당 최대 3개
  for (const r of res.results) {
    if (r.link && !seen.has(r.link)) {
      seen.add(r.link)
      collected.push(r)
    }
  }
  await new Promise(resolve => setTimeout(resolve, 120)) // 쿼터 보호 (120ms 지연)
}
```

#### **Google Custom Search API 호출 형식**
```typescript
// lib/google-search.ts의 searchGoogle 함수
const url = new URL('https://www.googleapis.com/customsearch/v1')
url.searchParams.set('key', apiKey)                    // API 키
url.searchParams.set('cx', searchEngineId)            // 검색 엔진 ID
url.searchParams.set('q', query)                      // 검색 쿼리
url.searchParams.set('num', Math.min(maxResults, 10)) // 최대 10개 결과
url.searchParams.set('lr', 'lang_ko')                 // 한국어 결과만
url.searchParams.set('dateRestrict', 'm60')           // 최근 60개월(5년) 이내

// 응답 형식
{
  items: [
    {
      title: "검색 결과 제목",
      link: "https://...",
      snippet: "검색 결과 스니펫 (요약)",
      displayLink: "도메인명"
    }
  ]
}
```

#### **검색 결과 포맷팅 함수**
```typescript
// app/api/generate-qa/route.ts
const formatSearchResultsForPrompt = (results: SearchResult[]): string => {
  if (!results || results.length === 0) return ''
  
  return results
    .slice(0, 5) // 최대 5개만 프롬프트에 포함
    .map((r, idx) => {
      const title = (r.title || '')
        .replace(/\s+/g, ' ')      // 연속 공백 제거
        .trim()
        .slice(0, 80)              // 제목 최대 80자
      
      const snippet = (r.snippet || '')
        .replace(/\s+/g, ' ')      // 연속 공백 제거
        .trim()
        .slice(0, 200)             // 스니펫 최대 200자
      
      return `- (${idx + 1}) ${title} — ${snippet}`
    })
    .join('\n')
}
```

#### **프롬프트에 포함되는 검색 결과 실제 형식**
```
[최근 검색 요약]
- 아래 검색 요약을 근거로 최신/구체 정보를 자연스럽게 반영하세요
- 링크나 출처를 본문에 남기지 말고 내용만 녹여서 전달하세요

- (1) DB손보 건강고지보험 보험료 가격 비교 — 월 보험료는 4만원대부터 시작하며 75세 남성 기준 약 4.7만원 수준입니다 보험료는 나이와 건강 상태에 따라 달라질 수 있습니다
- (2) DB손보 건강고지보험 특약 구성 — 통합전이암진단비, 간병인 사용 상해/질병 입원일당 특약이 포함되어 있습니다 각 특약별 보장 범위와 금액을 확인하는 것이 중요합니다
- (3) DB손보 건강고지보험 경쟁사 비교 — 삼성생명, 한화생명 대비 가성비가 우수한 편입니다 보험료 대비 보장 범위가 넓어 많은 고객들이 선택하고 있습니다
- (4) DB손보 건강고지보험 75세 남성 보험료 — 75세 남성 기준 월 4.5~5만원대 보험료가 일반적입니다 건강 상태에 따라 보험료가 달라질 수 있으므로 정확한 설계가 필요합니다
- (5) DB손보 건강고지보험 후기 — 보장 범위가 넓고 보험료 대비 만족도가 높다는 평가가 많습니다 실제 가입자들의 후기를 보면 보장 내용에 대한 만족도가 높은 편입니다
```

#### **프롬프트에서 검색 결과 활용 지시**
```
[최근 검색 요약]
- 아래 검색 요약을 근거로 최신/구체 정보를 자연스럽게 반영하세요
- 링크나 출처를 본문에 남기지 말고 내용만 녹여서 전달하세요
[검색 결과 불릿 포인트]

[핵심 지침]
- 설계서 정보와 최신 검색 정보(뉴스·블로그·커뮤니티·카페 포함)를 근거로 장점/혜택을 구체적 숫자와 예시로 제시하세요
- 출처나 링크를 본문에 남기지 않습니다 (근거는 내용에만 녹여서 전달)
- 검색 결과의 구체적 금액, 보험료, 보장 내용, 경쟁사 비교 정보를 자연스럽게 활용하세요
```

#### **Google Grounding 활성화 (Gemini API)**
```typescript
// Gemini API 호출 시 Grounding 자동 활성화
const model = genAI.getGenerativeModel({ 
  model: modelName,
  tools: [{ googleSearch: {} }] // Google Grounding 활성화
})

// 모델이 필요 시 자동으로 웹 검색 수행
// Grounding 결과 확인
const groundingMetadata = response.candidates?.[0]?.groundingMetadata
if (groundingMetadata) {
  console.log('웹 검색 쿼리:', groundingMetadata.webSearchQueries)
  console.log('검색된 청크 수:', groundingMetadata.groundingChunks?.length)
}
```

#### **이중 검색 전략**
1. **커스텀 검색 (사전 검색)**: 
   - Step 1 전에 실행
   - Google Custom Search API 사용
   - 최대 10개 쿼리 × 3개 결과 = 최대 30개 수집
   - 중복 URL 제거 후 최대 5개만 프롬프트에 포함
   - 최신 보험료, 경쟁사 비교 정보 수집
   - 프롬프트에 불릿 포인트로 명시적 포함

2. **Google Grounding (실시간 검색)**:
   - Gemini API 호출 시 자동 활성화
   - 모델이 필요 시 자동으로 웹 검색 수행
   - 검색 결과를 자동으로 답변에 반영
   - Grounding 메타데이터로 검색 쿼리 및 청크 수 확인 가능

3. **출처 처리**:
   - 프롬프트에서 명시적으로 "출처 표기 금지" 지시
   - "링크나 출처를 본문에 남기지 말고 내용만 녹여서 전달하세요"
   - 내용만 활용하여 자연스럽게 답변에 녹임
   - 링크나 URL은 절대 포함하지 않음

---

### **6. 대화형 스레드 생성 로직**

#### **고객 역할 다양화**
```typescript
const customerRoles = ['customer1', 'customer2', 'customer3', 'customer4']

// 각 역할별 다른 스타일
customer1: '질문자' (원래 질문 올린 사람)
customer2: '관심자' (비슷한 상황의 다른 고객)
customer3: '비교자' (다른 상품과 비교하려는 고객)
customer4: '확인자' (확인하고 싶은 다른 고객)
```

#### **대화 히스토리 관리**
```typescript
// 이전 대화를 프롬프트에 포함
const previousMessages = conversationHistory
  .map(msg => `${msg.role === 'customer' ? '고객' : '설계사'}: ${msg.content}`)
  .join('\n\n')

// 최근 N개만 포함 (토큰 절감)
const recentHistory = conversationHistory.slice(-4)
```

#### **단계별 길이 제어**
```typescript
const stepNumber = Math.ceil(step / 2) // 몇 번째 댓글인지

if (answerLength === 'default') {
  if (stepNumber <= 2) {
    maxLength = 300 // 초반: 200-300자
  } else if (stepNumber <= 4) {
    maxLength = 250 // 중반: 150-250자
  } else {
    maxLength = 200 // 후반: 100-200자
  }
}
```

---

### **7. 에러 처리 및 재시도**

#### **에러 타입별 처리**
```typescript
// 1. 모델 없음 (404)
if (error.message.includes('404') || error.message.includes('not found')) {
  // 즉시 다음 모델로 폴백
  continue
}

// 2. 할당량 초과 (429)
if (error.message.includes('429') || error.message.includes('quota')) {
  // 다음 모델로 폴백
  continue
}

// 3. 기타 에러
// 로깅 후 다음 모델 시도
```

#### **상세 로깅**
```typescript
console.error('========== Q&A 생성 오류 발생 ==========')
console.error('에러 타입:', typeof error)
console.error('에러 객체:', error)
console.error('에러 메시지:', error?.message)
console.error('에러 스택:', error?.stack)
console.error('에러 JSON:', JSON.stringify(error))
```

---

### **8. 실제 프롬프트 형식 예시**

#### **Step 2 프롬프트 구조 (실제 예시)**
```
당신은 DB손보 건강고지보험을 판매하는 15년 이상의 경력을 가진 베테랑 보험 전문가입니다. 이 상품에 대해 깊이 있게 알고 있으며, 고객의 궁금증을 해결하여 보험 가입까지 자연스럽게 이어지도록 상담하는 것이 목표입니다.

[상황 설정]
- 당신은 DB손보 건강고지보험을 판매하는 전문가입니다 - 이 상품에 대한 모든 것을 알고 있고, 고객이 이 상품을 가입하도록 도와야 합니다
- 보험카페에서 DB손보 건강고지보험에 대한 질문이 올라왔고, 많은 사람들이 관심을 보이고 있습니다
- 고객들은 "아 이 상품에 리뷰가 이렇게 달렸구나", "사람들이 관심이 있구나"라고 느끼고 있습니다
- 당신의 목표: 고객의 궁금증을 해결하고 "나도 연락해볼까?" 하고 싶게 만들어서 보험 가입까지 이어지게 하는 것

[최근 검색 요약]
- 아래 검색 요약을 근거로 최신/구체 정보를 자연스럽게 반영하세요
- 링크나 출처를 본문에 남기지 말고 내용만 녹여서 전달하세요

- (1) DB손보 건강고지보험 보험료 가격 비교 — 월 보험료는 4만원대부터 시작하며 75세 남성 기준 약 4.7만원 수준입니다
- (2) DB손보 건강고지보험 특약 구성 — 통합전이암진단비, 간병인 사용 상해/질병 입원일당 특약이 포함되어 있습니다
- (3) DB손보 건강고지보험 경쟁사 비교 — 삼성생명, 한화생명 대비 가성비가 우수한 편입니다
- (4) DB손보 건강고지보험 75세 남성 보험료 — 75세 남성 기준 월 4.5~5만원대 보험료가 일반적입니다
- (5) DB손보 건강고지보험 후기 — 보장 범위가 넓고 보험료 대비 만족도가 높다는 평가가 많습니다

[역할 설정]
- 15년 이상의 경력을 가진 보험 전문가 (약관 해석, 상품 분석, 시장 동향에 정통)
- DB손보 건강고지보험에 대한 전문가 - 이 상품의 모든 장점, 특징, 보장 내용을 정확히 알고 있음
- 보험 시장의 최신 트렌드와 신상품에 대한 깊은 지식을 가진 전문가
- 고객의 상황을 깊이 이해하고 공감하는 상담사
- 객관적이면서도 DB손보 건강고지보험에 유리한 방향으로 해석하는 전문가
- 자연스럽게 상담을 유도하여 보험 가입까지 연결하는 영업 전문가
- 보험카페에서 활발하게 댓글 활동을 하는 전문가 (실제 보험카페 전문가들의 댓글 스타일 참고)

[핵심 지침]

0. 세일즈 모드 (가장 중요!):
   - 존댓말을 유지하되 직설적이고 강한 CTA로 설득하세요
   - 반박·중립 없이 우리 상품 가입을 자연스럽게 유도하세요
   - 설계서 정보와 최신 검색 정보(뉴스·블로그·커뮤니티·카페 포함)를 근거로 장점/혜택을 구체적 숫자와 예시로 제시하세요
   - 출처나 링크를 본문에 남기지 않습니다 (근거는 내용에만 녹여서 전달)
   - 금액·담보·특약 등 수치를 숨기지 말고 모두 공개해도 됩니다

1. 고객 호명 및 공감하기:
   - 고객 호명 필수: "질문자님~", "고객님~"
   - 호명 후 "~" 또는 "^^" 사용으로 친근함 표현
   - 질문자의 감정 상태(고민)에 맞춘 구체적 공감
   - 기본 공감: "고민이 많으시겠어요 보험 선택은 정말 중요한 결정이니까요"

2. 구체적이고 명확한 답변:
   - 구체적 금액/조건 명시 필수: 모호한 표현 대신 구체적 숫자 사용
     * ❌ "적정합니다" → ✅ "월 47,710원으로 200만원 보장받을 수 있어 합리적입니다"
     * ❌ "보장됩니다" → ✅ "일반 골절시 50만원, 10대 골절에 해당되는 경우 250만원 보장됩니다"
   - 조건/제한사항 명확히 설명: "10년간 보장", "연간 1회씩 10년간", "90일간 보장이 되지 않습니다"

3. DB손보 건강고지보험에 대한 전문적이고 디테일한 답변:
   - 최신 검색 정보 활용 (매우 중요!):
     * 아래 최신 검색 결과를 참고하여 정확하고 확실한 정보를 제공하세요
     * 검색 결과의 구체적 금액, 보험료, 보장 내용, 경쟁사 비교 정보를 자연스럽게 활용하세요
     * 출처는 언급하지 말고 내용만 활용하여 답변에 녹여내세요
   - DB손보 건강고지보험의 구체적 보장 내용 상세 설명
   - 경쟁사 비교 분석 (구체적 금액과 예시 필수!)
   - 리스크 및 제한사항 명확히 설명 + 해결책 제시

4. 비교 제시 (구체적 금액과 예시 필수!):
   - 2-3개 상품을 구체적 금액과 함께 비교
   - 예: "비슷한 보장 기준으로 비교해보면 삼성생명은 월 3만원대로 보험료가 저렴한 편이고 한화생명은 특약 구성이 더 풍부해서 월 3.5만원대입니다 현재 상품인 DB손보 건강고지보험은 월 47,710원으로 중간 위치에 있어 가성비가 좋은 편이에요"

5. DB손보 건강고지보험 가입 유도:
   - 목표: 고객이 "나도 연락해볼까?" 하고 싶게 만들어서 보험 가입까지 이어지게
   - 자연스러운 상담 유도: "오픈카톡에 정보 남겨주시면 DB손보 건강고지보험에 대해 더 자세히 상담드리겠습니다^^"

6. 답변 톤: 친절하고 다정한 톤으로, 고객의 마음을 이해하는 따뜻한 상담사처럼 작성하세요

7. 답변 길이:
   - 매우 중요! 첫 답변은 정확히 200-300자 사이로 작성하세요
   - 핵심 정보는 반드시 포함 (구체적 금액, 조건, 특약명 필수)
   - 기본 정보는 가능한 한 포함 (비교, 추가 설명)
   - 문단은 3-4개로 구성 (각 문단은 1-2문장)

[출력 형식]
- 본문만 출력하세요. 마크다운이나 HTML 태그 없이 순수 텍스트만 출력하세요.
- 제어 문자(<ctrl*> 등)나 특수 문자를 포함하지 마세요.
- 마침표(.) 사용 절대 금지 (위 지침 참조)
```

---

### **9. 성능 최적화**

#### **RPM 제한 대응**
```typescript
// 각 API 호출 사이에 1초 지연
await new Promise(resolve => setTimeout(resolve, 1000))
```

#### **토큰 사용량 추적**
```typescript
type TokenUsage = {
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

// 각 단계별 토큰 사용량 로깅 및 집계
const tokenUsage: TokenUsage[] = []
```

#### **비용 추정**
```typescript
const costRates = {
  'gemini-2.5-pro': { prompt: 1.25, completion: 10.00 },
  'gemini-2.5-flash': { prompt: 0.075, completion: 0.30 },
  'gemini-2.0-flash': { prompt: 0.10, completion: 0.40 }
}

// 토큰 사용량 기반 비용 계산
const cost = (promptTokens / 1_000_000) * rate.prompt + 
             (completionTokens / 1_000_000) * rate.completion
```

---

### **10. 데이터 흐름 다이어그램**

```
[클라이언트]
    ↓ POST /api/generate-qa
[API 라우트]
    ↓ 입력 검증
[Google 검색]
    ↓ 최신 정보 수집
[프롬프트 생성]
    ├─ generateQuestionPrompt()
    ├─ generateAnswerPrompt()
    └─ generateConversationThreadPrompt()
    ↓
[Gemini API 호출]
    ├─ Flash 모델 (질문, 고객 댓글)
    └─ Pro 모델 (답변, 설계사 댓글)
    ↓
[응답 파싱]
    ├─ 제목/본문 분리
    ├─ 제어 문자 제거
    └─ 길이 제어
    ↓
[후처리]
    ├─ 중복 제거
    ├─ 문장 완성 확인
    └─ 포맷팅
    ↓
[응답 반환]
    └─ JSON 형식
```

---

## 📈 개선 이력

- **Version 2.3** (2024-12-16)
  - 개인적 경험 사례 추가
  - 나이/성별 언급 자연스럽게
  - 댓글 스레드 전환 문구 개선
  - 제목/본문 경계 분리 강화
  - 대화형 스레드 길이 제어 개선 (요약 지시 추가)
  - 본문 시작 패턴 감지 로직 추가
  - 프롬프트 우선 길이 제어 (API 보호 완화)


