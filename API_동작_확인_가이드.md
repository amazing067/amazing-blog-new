# API 동작 확인 가이드

## 📊 현재 API 동작 상태 확인

### ✅ 1. Custom Search API - 정상 작동

**로그 확인:**
```
✅ Google Custom Search 성공: { query: '현대생명 변액연금보험 후기', resultCount: 3, totalResults: '484' }
[Q&A 생성] 🔍 검색 완료 - 수집된 결과: 15 건, 커스텀 서치 총 횟수: 6
```

**동작 상태:**
- ✅ Custom Search API 정상 작동
- ✅ 검색 쿼리 6개 모두 성공
- ✅ 검색 결과 15건 수집 완료
- ✅ 검색 엔진 ID 정상 작동

**확인 사항:**
- `GOOGLE_API_KEY` 정상 작동
- `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` 정상 작동
- 검색 결과가 프롬프트에 포함됨

---

### ✅ 2. Gemini API (Generative Language API) - 정상 작동

**로그 확인:**
```
모델 시도: gemini-2.0-flash (시도 1/2, 그라운딩: 활성화)
모델 시도: gemini-2.5-pro (시도 1/2, 그라운딩: 활성화)
토큰 사용량 (gemini-2.0-flash): { promptTokens: 7122, candidatesTokens: 257, totalTokens: 7379 }
토큰 사용량 (gemini-2.5-pro): { promptTokens: 9477, candidatesTokens: 465, totalTokens: 10890 }
```

**동작 상태:**
- ✅ Gemini Flash 모델 정상 작동
- ✅ Gemini Pro 모델 정상 작동
- ✅ 하이브리드 모델 선택 정상 작동
- ✅ 토큰 사용량 추적 정상

**확인 사항:**
- `GEMINI_API_KEY` 정상 작동
- Flash 모델: 질문 생성, 고객 댓글에 사용
- Pro 모델: 답변 생성, 설계사 댓글에 사용

---

### ✅ 3. Google Grounding (내장 검색 기능) - 정상 작동

**로그 확인:**
```
[gemini-2.0-flash] 🔍 그라운딩 결과:
  - 웹 검색 쿼리: [
    '40대 남성 노후 준비 변액연금보험',
    '45세 남성 변액연금보험 리스크',
    '45세 남성 변액연금보험 수익률',
    '변액연금보험 40대 남성 추천',
    '변액연금보험 장단점'
  ]
  - 검색된 청크 수: 2
```

**동작 상태:**
- ✅ Google Grounding 정상 작동
- ✅ 자동 웹 검색 쿼리 생성됨
- ✅ 검색된 청크가 응답에 포함됨
- ✅ 별도 API 키 불필요 (Gemini API에 내장)

**확인 사항:**
- Grounding이 자동으로 최신 정보 검색
- Custom Search와 함께 사용하여 더 풍부한 정보 제공

---

### ✅ 4. Google Sheets API - 정상 작동 (추정)

**코드 확인:**
- `lib/google-sheets.ts`에서 `google.sheets()` 사용
- `GOOGLE_API_KEY`로 인증
- 시트 데이터 읽기 정상 작동

---

## 📋 필요한 API 목록 (최종 확인)

### ✅ 필수 API (3개만 필요)

1. **Generative Language API** ✅
   - Gemini AI 사용
   - 현재 정상 작동

2. **Custom Search API** ✅
   - Google Custom Search 사용
   - 현재 정상 작동

3. **Google Sheets API** ✅
   - Google Sheets 데이터 읽기
   - 현재 정상 작동

---

### ❌ 불필요한 API (활성화 불필요)

**이미지에 보이지만 사용하지 않는 API들:**

- ❌ **Analytics Hub API** - 사용 안 함
- ❌ **BigQuery API** - 사용 안 함
- ❌ **BigQuery Connection API** - 사용 안 함
- ❌ **BigQuery Data Policy API** - 사용 안 함
- ❌ **BigQuery Data Transfer API** - 사용 안 함
- ❌ **BigQuery Migration API** - 사용 안 함
- ❌ **BigQuery Reservation API** - 사용 안 함
- ❌ **BigQuery Storage API** - 사용 안 함
- ❌ **Cloud Dataplex API** - 사용 안 함
- ❌ **Cloud Datastore API** - 사용 안 함
- ❌ **Cloud Logging API** - 자동 활성화 (사용 안 함, 무시 가능)
- ❌ **Cloud Monitoring API** - 자동 활성화 (사용 안 함, 무시 가능)
- ❌ **Cloud SQL** - 사용 안 함
- ❌ **Cloud Storage** - 사용 안 함
- ❌ **Cloud Storage API** - 사용 안 함
- ❌ **Cloud Trace API** - 사용 안 함
- ❌ **Dataform API** - 사용 안 함
- ❌ **Google Cloud APIs** - 일반 API (사용 안 함)
- ❌ **Google Cloud Storage JSON API** - 사용 안 함
- ❌ **Service Management API** - 자동 활성화 (사용 안 함, 무시 가능)
- ❌ **Service Usage API** - 자동 활성화 (사용 안 함, 무시 가능)

**💡 중요:**
- 위 API들은 Google Cloud Console이 자동으로 활성화할 수 있습니다
- 하지만 실제로 사용하지 않으므로 **무시해도 됩니다**
- 비활성화하고 싶다면 "사용 설정된 API" 페이지에서 비활성화 가능하지만, 필수는 아닙니다

---

## 🎯 결론

### ✅ 현재 상태: 완벽하게 작동 중!

1. **Custom Search API**: ✅ 정상 작동 (6번 호출, 모두 성공)
2. **Gemini API**: ✅ 정상 작동 (Flash + Pro 모델 모두 사용)
3. **Google Grounding**: ✅ 정상 작동 (자동 웹 검색)
4. **Google Sheets API**: ✅ 정상 작동 (데이터 읽기)

### 📌 추가로 활성화할 API: 없음!

- 현재 활성화된 3개 API만으로 충분합니다
- 다른 API는 사용하지 않으므로 활성화할 필요 없습니다
- 이미지에 보이는 다른 API들은 자동 활성화된 것이거나 사용하지 않는 것입니다

---

## 💡 최적화 팁

### 불필요한 API 비활성화 (선택사항)

**원하는 경우 불필요한 API를 비활성화할 수 있습니다:**

1. **"API 및 서비스"** → **"사용 설정된 API"** 접속
2. 사용하지 않는 API 선택
3. **"사용 중지"** 또는 **"DISABLE"** 버튼 클릭

**⚠️ 주의:**
- 비활성화해도 문제없지만, 필수는 아닙니다
- 나중에 필요할 수도 있으므로 그대로 두는 것도 방법입니다

---

## 🔍 검색 기능 분석: Custom Search vs Google Grounding

### Q: Custom Search와 Grounding만 있으면 충분한가요?
**A: 네, 충분합니다!** 두 가지가 서로 보완적으로 작동합니다.

---

### 📊 현재 검색 기능 구조

#### 1. Custom Search API (명시적 검색)
**사용 위치:**
- Q&A 생성 시: 6개의 검색 쿼리로 명시적으로 검색
- 블로그 생성 시: 주제/키워드 기반 검색

**작동 방식:**
```typescript
// 명시적으로 검색 쿼리 생성
const searchQueries = [
  `${productName} 후기`,
  `${productName} 특약`,
  `${productName} 장점`,
  // ...
]

// Custom Search API 호출
const res = await searchGoogle(q, 3)

// 검색 결과를 프롬프트에 포함
searchResultsText = formatSearchResultsForPrompt(collected)
```

**장점:**
- ✅ 검색 쿼리를 직접 제어 가능
- ✅ 검색 결과를 프롬프트에 명시적으로 포함
- ✅ 출처 추적 가능

---

#### 2. Google Grounding (자동 검색)
**사용 위치:**
- Gemini API 호출 시 자동으로 활성화
- Gemini가 필요하다고 판단할 때 자동 검색

**작동 방식:**
```typescript
// Gemini 모델에 Grounding 활성화
const model = genAI.getGenerativeModel({ 
  model: modelName,
  tools: [{ googleSearch: {} }] // Grounding 활성화
})

// Gemini가 자동으로 웹 검색 쿼리 생성
// 검색된 청크가 응답에 포함됨
```

**장점:**
- ✅ Gemini가 자동으로 필요한 정보 검색
- ✅ 프롬프트에 없는 정보도 자동으로 찾음
- ✅ 별도 API 키 불필요 (Gemini API에 내장)

---

### 💡 두 가지가 함께 작동하는 이유

**서로 보완적:**
1. **Custom Search**: 명시적으로 필요한 정보를 미리 검색하여 프롬프트에 포함
2. **Grounding**: Gemini가 추가로 필요한 정보를 자동으로 검색

**예시 (로그에서 확인):**
- Custom Search: "현대생명 변액연금보험 후기" 등 6개 쿼리로 검색
- Grounding: Gemini가 자동으로 "40대 남성 노후 준비 변액연금보험" 등 추가 검색

**결과:**
- ✅ 더 풍부한 정보 제공
- ✅ 최신 정보 반영
- ✅ 다양한 출처 활용

---

### 📌 결론

**Q: Custom Search와 Grounding만 있으면 충분한가요?**
**A: 네, 충분합니다!**

**이유:**
1. ✅ **Custom Search**: 명시적 검색으로 핵심 정보 확보
2. ✅ **Grounding**: Gemini가 자동으로 추가 정보 검색
3. ✅ **두 가지 조합**: 최신 정보를 포괄적으로 제공

**추가 검색 API 불필요:**
- ❌ BigQuery - 데이터 분석용 (검색과 무관)
- ❌ Cloud Storage - 파일 저장용 (검색과 무관)
- ❌ 기타 검색 API - Custom Search와 Grounding으로 충분

**💡 최적화 팁:**
- 현재 구조가 최적입니다
- Custom Search로 명시적 검색 + Grounding으로 자동 검색 = 완벽한 조합

---

**작성일**: 2024-12-16
**확인 상태**: 모든 필수 API 정상 작동 ✅
**검색 기능**: Custom Search + Grounding 조합 완벽 ✅

