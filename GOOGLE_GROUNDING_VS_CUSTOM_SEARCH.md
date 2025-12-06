# Google Grounding vs Google Custom Search

## 두 기능의 차이점

### 🔍 Google Grounding (Gemini API 내장 기능)

**특징:**
- **자동 검색**: Gemini 모델이 자동으로 웹 검색을 수행
- **모델 레벨 처리**: AI가 필요하다고 판단할 때 자동으로 검색
- **출처 자동 제공**: 검색 결과의 출처 링크를 자동으로 포함
- **검색 쿼리 제어 불가**: 모델이 자동으로 검색어를 결정
- **실시간 정보**: 최신 웹 정보에 자동 접근

**장점:**
- 별도 API 키 불필요 (Gemini API 키만 있으면 됨)
- 모델이 자동으로 필요한 정보를 찾아서 사용
- 출처가 자동으로 포함됨

**단점:**
- 검색 쿼리를 직접 제어할 수 없음
- 검색 결과를 미리 확인할 수 없음
- 검색 범위를 제한할 수 없음

---

### 🔎 Google Custom Search (별도 API)

**특징:**
- **수동 검색**: 우리가 직접 검색 쿼리를 보내고 결과를 받음
- **검색 제어**: 검색어, 검색 범위, 결과 개수 등을 완전히 제어 가능
- **프롬프트 포함**: 검색 결과를 프롬프트에 직접 포함시켜 AI에게 제공
- **맞춤 검색 엔진**: 특정 도메인이나 주제에 특화된 검색 엔진 생성 가능
- **결과 사전 확인**: 검색 결과를 받아서 확인하고 필터링 가능

**장점:**
- 검색 쿼리를 완전히 제어 가능
- 검색 결과를 미리 확인하고 필터링 가능
- 특정 도메인(예: 보험 관련 사이트만)으로 검색 범위 제한 가능
- 검색 결과를 프롬프트에 포함시켜 더 정확한 정보 제공

**단점:**
- 별도 API 키와 검색 엔진 ID 필요
- 검색 쿼리를 직접 작성해야 함
- API 호출 비용 발생 (무료 티어: 일일 100회)

---

## 🎯 함께 사용하는 전략

### 1단계: Google Custom Search (우리가 제어)
- 주제와 키워드로 **명확한 검색 쿼리** 생성
- 검색 결과를 프롬프트에 포함
- AI가 이 정보를 기반으로 글 작성

### 2단계: Google Grounding (AI가 자동)
- Gemini 모델이 **추가로 필요한 정보**를 자동으로 검색
- 우리가 놓친 최신 정보나 관련 정보를 자동으로 찾아서 사용
- 출처를 자동으로 포함

### 결과
- **이중 검색**: 우리가 제어하는 검색 + AI가 자동으로 하는 검색
- **더 풍부한 정보**: 두 가지 검색 결과를 모두 활용
- **더 정확한 출처**: Custom Search 출처 + Grounding 출처

---

## 구현 방법

### Google Grounding 활성화

```typescript
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.5-pro',
  // Grounding 설정
})

const result = await model.generateContent({
  contents: prompt,
  config: {
    groundingConfig: {
      enableGrounding: true,
      groundingSources: [{
        type: 'GOOGLE_SEARCH_RETRIEVAL'
      }]
    }
  }
})
```

### Google Custom Search 사용

```typescript
// 1. 검색 수행
const searchResults = await searchInsuranceTopics(topic, keywords)

// 2. 프롬프트에 포함
const searchResultsText = formatSearchResultsForPrompt(searchResults)
const prompt = generateInsuranceBlogPrompt({
  ...,
  searchResults: searchResultsText
})
```

---

## 권장 사용 시나리오

### 시나리오 1: 일반 블로그 생성
- ✅ Google Custom Search: 주제 관련 명확한 검색
- ✅ Google Grounding: AI가 추가 정보 자동 검색

### 시나리오 2: 특정 도메인 검색이 필요한 경우
- ✅ Google Custom Search: 특정 사이트(예: 보험사 공식 사이트)만 검색
- ✅ Google Grounding: 일반 웹 검색으로 보완

### 시나리오 3: 최신 정보가 중요한 경우
- ✅ Google Custom Search: 최신 통계, 뉴스 검색
- ✅ Google Grounding: 실시간 정보 자동 수집

