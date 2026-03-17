# Q&A 생성 시스템 — 전체 코드 & 로직 완전판

> **아키텍처**: Ground Truth Lock + Field-by-Field Generation + Quality Gate
>
> **핵심 원칙**: "사실은 잠그고, 표현만 단계별로 다듬는다"
>
> **관련 소스 파일 목록**:
> - `app/api/analyze-design-sheet/route.ts` — 설계서 분석 API (keyCoverages, concern 후보, mainAxis 스코어링, scrubNoRefundStructureTerm)
> - `app/api/generate-qa/route.ts` — Q&A 생성 API (canonicalConcernContext, 설계서 모드 displayKeywords/promptKeywords 5칸, 4필드 프롬프트 전달)
> - `lib/prompts/qa-prompt.ts` — 모든 프롬프트 템플릿 (설계서 모드 selectedConcern/coverageSummaryForPrompt 블록, unified/threadBatch 4필드 수용)
> - `lib/product-name-correction.ts` (356줄) — 상품명 OCR 교정 (alias + fuzzy + 검색 빈도)
> - `lib/quality-gate.ts` (332줄) — 필드별 품질 게이트
> - `lib/insurance-terminology.ts` (223줄) — 보험 용어 번역 사전 + 갈등 축
> - `lib/title-family.ts` (371줄) — 제목 패밀리 + 채점 + 본문 도입 패밀리
> - `lib/topic-utils.ts` (133줄) — 상품명 구조화 + 페르소나 추출
>
> **문서 파일**:
> - [Part 1-A: 유틸 라이브러리](./qa-system-part1-lib-utils.md) — insurance-terminology + quality-gate + title-family + topic-utils
> - [Part 1-B: 프롬프트](./qa-system-part1-prompts.md) — qa-prompt.ts 전체
> - [Part 2: API 라우트](./qa-system-part2-api.md) — analyze-design-sheet + generate-qa + product-name-correction

---

## 목차

1. [전체 아키텍처 흐름](#1-전체-아키텍처-흐름)
2. [analyze-design-sheet — 설계서 분석 API](#2-analyze-design-sheet)
3. [generate-qa — Q&A 생성 API 핵심 로직](#3-generate-qa)
4. [lib/prompts/qa-prompt.ts — 프롬프트 전체](#4-프롬프트-전체)
5. [lib/quality-gate.ts — 품질 게이트 전체](#5-품질-게이트-전체)
6. [lib/insurance-terminology.ts — 용어 사전 + 갈등 축 전체](#6-용어-사전-전체)
7. [lib/title-family.ts — 제목 패밀리 + 채점 전체](#7-제목-패밀리-전체)
8. [lib/topic-utils.ts — 상품명 구조화 전체](#8-상품명-구조화-전체)

---

## 1. 전체 아키텍처 흐름

```
[사용자 → BlogGenerator.tsx]
  │ 설계서 이미지 업로드
  ▼
[analyze-design-sheet API]
  ├─ 1단계: Flash 모델로 기본 정보 추출 (상품명, 보험료, 담보)
  ├─ 3단계: Pro 모델로 최종 분석 (1단계 결과만 주입, 검색 없음)
  ├─ 상품명 정규화·keyCoverages·concern 선택 등 후처리
  ├─ 축 기반 검색: topicConcern/topicConcernSearch 확정 후 브랜드+축으로 1~2회만 검색, 결과 없으면 포기 → searchSummary
  ├─ 상품명 정규화: normalizeExtractedProductName → correctAndLog → convertToCustomerTopicName
  ├─ Evidence Map 구축: questionFacts / answerFacts / forbiddenPatterns
  ├─ Conflict Axis 구축: buildConflictAxis(topicConcern, topicConcernSearch)
  └─ 응답: canonical payload 전체 + evidenceMap + conflictAxis
       │
       ▼  (BlogGenerator가 그대로 전달, 재해석 금지)
[generate-qa API]
  ├─ Canonical Payload 확정 (설계서 모드: 분석 결과가 폼값보다 우선)
  ├─ 검색 재사용 (hasUpstreamSearch → Google CSE 스킵)
  ├─ 키워드 추출 (Naver SearchAd + Google CSE 보강 + 상품군별 스코어링)
  │
  ├─ Step 1: 질문 본문 생성 (Flash 모델)
  │   └─ generateQuestionPrompt (evidenceMap + conflictAxis + openingFamily + questionConcept)
  │   └─ JSON 파싱 → 텍스트 파싱 fallback → formatQuestionContent (문단 재배치)
  │
  ├─ Step 1.5: 제목 후보 생성 (Pro 모델)
  │   └─ sampleFamilies(6) → buildTitlePrompt → generateContentWithFallback
  │   └─ scoreTitleCandidate (로컬 채점) → 최고점 제목 선택
  │   └─ 실패 시 규칙형 폴백
  │
  ├─ Step 2: 답변 생성 (Pro 모델)
  │   └─ generateAnswerPrompt (evidenceMap + conflictAxis + 4블록 강제)
  │   └─ 포맷팅 → enforceAnswerLength(450) → 300자 미만 시 재생성
  │
  ├─ Step 3: 댓글 2쌍 구조 (Pro 모델)
  │   └─ 쌍 1: generateCommentPairPrompt(pairIndex=0) → JSON 파싱
  │   └─ 쌍 2: generateCommentPairPrompt(pairIndex=1) → JSON 파싱
  │   └─ 파싱 실패 시 개별 generateConversationThreadPrompt fallback
  │   └─ 후기성 문구 삽입 (reviewCount > 0 && conversationLength >= 6)
  │
  ├─ 필드별 정제: 제목 → cleanForTitle(강), 본문/답변/댓글 → cleanForBody(약)
  │
  ├─ Quality Gate: 필드별 로컬 검증
  │   └─ gateTitle → gateQuestionBody → gateAnswer → gateThread
  │   └─ 답변 70점 미만 → 재생성 1회 시도
  │   └─ calculateOverallScore (가중 평균)
  │
  └─ 최종 응답: question + answer + conversation + qualityGate + usage + metadata
```

---

## 2. analyze-design-sheet

### 파일: `app/api/analyze-design-sheet/route.ts` (723줄)

### 핵심 로직 요약

**Gemini 모델 폴백 순서**:
- 1단계(basic): `gemini-2.5-flash` → `gemini-2.5-pro`
- 3단계(final): `gemini-2.5-pro` → `gemini-2.5-flash` → `gemini-2.0-flash`

**1단계 프롬프트** (Flash):

```
이 이미지는 보험 설계서/제안서입니다. 이미지에서 다음 정보만 추출해주세요:

**[추출할 정보]**
- 보험사명: 로고나 상단에 표시된 보험사 이름
- 보험 상품명: 제목이나 상품명란에 적힌 정확한 상품명
- 가입자 정보: 나이, 성별, 직업 (있는 경우)

**[출력 형식 - 반드시 JSON만 출력]**
{
  "productName": "보험사명 + 보험상품명",
  "targetPersona": "나이대 + 성별 + 직업",
  "premium": "월보험료 또는 연보험료",
  "coverages": ["담보명1", "담보명2"],
  "specialClauses": ["특약명1", "특약명2"]
}

⚠️ 이미지에 명시된 정확한 정보만 추출하세요. 추정하지 마세요.
```

**3단계** — 검색 없이 1단계 결과만으로 최종 분석 (설계서 이미지 기반으로 worryPoint/sellingPoint/축 확정).  
- **worryPoint/sellingPoint**: 프롬프트에 "해약환급금, 중간에 해지하면 돌려받는 돈, 해약환급금이 없는 대신 등 해지·환급 구조에 대한 문장은 절대 포함하지 마세요"라고 명시하여, **처음부터 해당 문구가 나오지 않도록** 지시함. (후처리로 제거하지 않음)

**축 기반 검색** (3단계·후처리 완료 후):
- `topicConcern` / `topicConcernSearch`와 `companyShort`가 확정된 경우에만 실행.
- 쿼리 1: `{companyShort} {topicConcernSearch 또는 topicConcern}` (최대 5건).
- 결과 없으면 쿼리 2: `{companyShort} {첫 keyCoverage 이름}` (1회만 추가 시도).
- 결과 없으면 바로 포기. 수집된 결과를 `searchSummary`로 응답에 포함 (generate-qa에서 재사용).

**3단계 프롬프트** (Pro) — 1단계 결과만 주입 (검색 블록 없음):

```
이 이미지는 보험 설계서/제안서입니다. 이미지를 자세히 읽고,
표시된 모든 텍스트와 데이터를 정확히 추출해주세요.

**[1단계에서 이미 추출한 정보 - 반드시 사용하세요!]**
- 상품명: {basicData.productName}
- 대상: {basicData.targetPersona}
- 보험료: {basicData.premium}
- 담보: {basicData.coverages}
- 특약: {basicData.specialClauses}

**[최근 검색 요약]**
{searchResultsText}

**[이미지 분석 단계]**
1단계: 이미지의 모든 텍스트를 OCR로 읽기
2단계: 핵심 정보 추출
3단계: 보험 종류 판단 (이미지에 명시된 정확한 상품명만 사용)
4단계: 검색 결과 활용 (worryPoint, sellingPoint에 반영)

**[출력 형식 - 반드시 JSON만 출력]**
{
  "productName": "보험사명 + 보험상품명",
  "targetPersona": "나이대 + 성별 + 직업",
  "worryPoint": "실제 고객 고민 (검색 결과 참고)",
  "sellingPoint": "주요 장점 2-3개 (검색 결과 참고)",
  "premium": "월보험료",
  "coverages": ["담보명1", ...],
  "specialClauses": ["특약명1", ...]
}
```

**상품명 정규화 체인**:

```typescript
// 1. normalizeExtractedProductName: 중복단어·무배당·내부코드·로마숫자 제거
// 2. correctAndLog: alias 사전 + 검색 결과 기반 상품명 교정
// 3. convertToCustomerTopicName: 회사명 축약, display/topic/concern 분리
```

**Evidence Map 구축**:

```typescript
// questionFacts: 질문 본문에서 쓸 수 있는 사실
if (premium) questionFacts.push(`월 보험료 ${premium}`)
if (worryPoint) questionFacts.push(worryPoint)
if (coverageEvidence.length > 0) questionFacts.push(`주요 보장: ${coverageEvidence.slice(0, 3).join(', ')}`)
if (topicConcern) questionFacts.push(`핵심 고민: ${translateToNatural(topicConcern)}`)

// answerFacts: 답변에서 써야 하는 근거
if (premium) answerFacts.push(`월 보험료 ${premium}`)
if (sellingPoint) answerFacts.push(sellingPoint)
coverageEvidence.forEach(ev => answerFacts.push(ev))
if (specialClauses.length > 0)
  answerFacts.push(`특약: ${specialClauses.slice(0, 5).map(c => translateToNatural(c)).join(', ')}`)

// forbiddenPatterns: 절대 사용 금지 내부 표기
forbiddenPatterns.push('무배당', '(주)', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'II', 'III')
// + 내부 코드 패턴, 설계사 표현 금지
// + 설계서 공통: 해지·환급 구조 문구 (질문/답변에 노출 금지)
forbiddenPatterns.push('중간에 해지하면 돌려받는 돈이 거의 없는')
forbiddenPatterns.push('해지하면 돌려받는 돈이 없는 구조')
forbiddenPatterns.push('중도에 해지하면 돌려받는 돈')

// answerFacts에 topicConcern이 있으면 "concern 구조: {naturalConcern}" 추가
if (topicConcern) answerFacts.push(`concern 구조: ${translateToNatural(topicConcern)}`)
```

**keyCoverages·designFocusLabel**:  
- `keyCoverages` = `buildKeyCoverages(merged)` (merged = cleanCoverages + cleanSpecialClauses 일부). category별 우선순위 정렬 후 최대 5개.  
- `designFocusLabel` = axisCounts·axisWeight로 mainAxis 산출 후 designFocusLabelMap 매핑 (예: cancer → '암 보장 중심', brain → '치매 보장 중심').  
- 응답에 `keyCoverages`, `designFocusLabel` 포함. **프론트(BlogGenerator)는 이 두 값을 designSheetAnalysis에 넣어 generate-qa로 전달해야** coverage_focus 슬롯에 암/치매 등 담보 키워드가 반영됨.

**축 후처리**: topicConcern/topicConcernSearch에만 `scrubNoRefundStructureTerm` 적용 (해약환급금미지급형 등 제거). worryPoint/sellingPoint는 3단계에서 뽑지 않도록 지시했으므로 후처리 없음.

**최종 응답 구조**: evidenceMap + conflictAxis + keyCoverages + designFocusLabel 포함

---

## 3. generate-qa

### 파일: `app/api/generate-qa/route.ts` (3166줄)

### 3-1. Canonical Payload 확정

```typescript
const isDesignSheetMode = !!(designSheetImage && designSheetAnalysis)
const canonical = {
  productName: isDesignSheetMode
    ? (designSheetAnalysis.rawProductName || productName)
    : productName,
  targetPersona: isDesignSheetMode
    ? (designSheetAnalysis.personaBucket || targetPersona)
    : targetPersona,
}
// 설계서 모드에서 폼값과 분석값이 다르면 분석값 우선
if (isDesignSheetMode) {
  targetPersona = canonical.targetPersona
  productName = canonical.productName
}
```

### 3-2. canonicalConcernContext (설계서 모드 전용)

설계서 모드(`isDesignSheetMode && designSheetAnalysis`)일 때 상류 분석 결과를 한 번에 정리한 객체:

```typescript
canonicalConcernContext = {
  selectedConcern: designSheetAnalysis.topicConcern,
  selectedConcernSearch: designSheetAnalysis.topicConcernSearch,
  selectedConcernSource: designSheetAnalysis.selectedConcernSource,
  selectedConcernReason: designSheetAnalysis.selectedConcernReason,
  keyCoverages: rawKeyCoverages,  // { name, amount?, isRenewal? }[]
  coverageSummaryForPrompt: buildCoverageSummaryForPrompt(rawKeyCoverages),  // 고객형 요약 3~5개
  coverageFocusLabels: buildCoverageFocusLabels(rawKeyCoverages),            // 강조 보장 축 2~4개
}
```

- **Canonical Payload**: designSheetAnalysis에 worryPoint·sellingPoint가 있으면 canonical에서 우선 사용(분석 결과가 폼값보다 우선). 프론트는 분석 응답 시 이 두 필드도 designSheetAnalysis에 넣어 전달해야 함.
- **데이터 소스**: `rawKeyCoverages` = designSheetAnalysis.keyCoverages (각 항목 name = normalizedName || customerLabel || rawName). **프론트가 analyze 응답의 keyCoverages·designFocusLabel을 designSheetAnalysis에 포함해 전달해야** coverageSummaryForPrompt/coverageFocusLabels가 채워짐. 비어 있으면 coverage_focus는 designSheetAnalysis.designFocusLabel로 fallback 후, 없으면 "보장 균형".
- **프롬프트 전달**: `generateQuestionPrompt`, `generateAnswerPrompt`(메인/재생성/품질게이트), `generateConversationThreadPrompt`, `generateCommentPairPrompt`, `generateUnifiedQAPrompt`, `generateThreadBatchPrompt` 호출 시 `selectedConcern`, `selectedConcernSearch`, `coverageSummaryForPrompt`, `coverageFocusLabels` 4개 필드를 data 객체에 포함.
- **키워드**: 설계서 모드 displayKeywords 5칸 역할 — `market_head`, `product_core`, `concern_search`, `persona_longtail`, `coverage_focus`. promptKeywords 우선순위: concern_search → product_core → persona_longtail → coverage_focus → market_head. 내부 구조어(해약환급금미지급형, 20년납, 2종 등)는 최종 키워드에서 제외.
- **usageLogMeta / 응답 metadata**: 설계서 모드일 때 `selectedConcernSource`, `selectedConcernReason`, `selectedConcernSearch`, `coverageSummaryForPrompt`, `coverageFocusLabels` 저장 및 반환.

### 3-3. 상품명 구조화 (재정규화 금지)

```typescript
if (preStructured) {
  cleanProductCore = designSheetAnalysis.topicCore
  topicConcern = designSheetAnalysis.topicConcern || ''
  topicConcernSearch = designSheetAnalysis.topicConcernSearch || ''
  // ...
} else {
  const converted = convertToCustomerTopicName(productName)
  // ...
}
```

### 3-4. 검색 재사용

```typescript
const hasUpstreamSearch = isDesignSheetMode
  && designSheetAnalysis?.searchSummary
  && designSheetAnalysis.searchSummary.length > 50

if (hasUpstreamSearch) {
  searchResultsText = designSheetAnalysis.searchSummary
  // Google CSE 호출 완전 스킵
} else {
  // 수동 모드: 8개 쿼리로 Google CSE 검색 실행
}
```

### 3-5. 키워드 추출 (Naver SearchAd + 스코어링)

```typescript
// 상품군 판별: cancer/silsan/simple/jongsin/driver/health/other
// Naver SearchAd에 hintKeywords 전달 → 최대 15개 후보 반환
// 스코어링: product(+40) + intent(+25) + persona(+15) + core(+30) + longtail(+25)
// 감점: generic(-80), competitor(-60), claim(-30), comparison_site(-35)
// 상품군 불일치 탈락 (OTHER_GROUP_PATTERNS)
// 반반 구조: 우리 키워드 3개 + 관련 대형 키워드 2개
// concern 키워드 최우선 삽입 (설계서 모드)
```

### 3-6. Gemini 모델 사용 분배

```
Flash 사용 (비용 절감): 질문 생성 (Step 1), 고객 댓글, 후기
Pro 사용 (품질 유지): 답변 생성 (Step 2), 설계사 댓글, 제목 후보 (Step 1.5), 댓글 쌍 생성

폴백 순서 (Flash): gemini-2.5-flash → gemini-2.0-flash
폴백 순서 (Pro): gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash
```

### 3-7. Step 1: 질문 생성 (Flash)

```typescript
const questionPromptResult = generateQuestionPrompt({
  productName, topicName: customerTopicName, displayProductName, targetPersona,
  worryPoint, sellingPoint, answerTone, designSheetImage, designSheetAnalysis,
  searchResultsText, searchKeywords,
  evidenceMap: designSheetAnalysis?.evidenceMap || undefined,
  conflictAxis: designSheetAnalysis?.conflictAxis || undefined,
  selectedConcern: selectedConcernForPrompt,
  selectedConcernSearch: selectedConcernSearchForPrompt,
  coverageSummaryForPrompt: coverageSummaryForPromptForPrompt,
  coverageFocusLabels: coverageFocusLabelsForPrompt,
})
// Flash 모델로 호출 → JSON 파싱 → 텍스트 파싱 fallback
// vocative-only 첫 줄 제거 ("선배님들!", "옆집 언니들!")
// formatQuestionContent: 문단 3개 보장, 문장 중간 줄바꿈 수정
```

### 3-8. Step 1.5: 제목 후보 (Pro)

```typescript
const sampledFamilies = sampleFamilies(6) // 12개 중 6개 가중치 기반 샘플
const titlePrompt = buildTitlePrompt({ families, cleanProductCore, topicConcern, ... })
// Pro 모델로 호출 → JSON 파싱 → scoreTitleCandidate로 채점 → 최고점 선택
// 실패 시 규칙형 폴백 5개 후보 중 선택
```

### 3-9. Step 2: 답변 생성 (Pro)

```typescript
const answerPrompt = generateAnswerPrompt({
  ..., evidenceMap, conflictAxis
}, finalQuestionTitle, finalQuestionContent)
// Pro 모델로 호출
// 포맷팅: 4-5문단 자동 분리, 이모티콘 위치 조정
// enforceAnswerLength(450): 500자 초과 시 soft cap
// 300자 미만 시 자동 1회 재생성
```

### 3-10. Step 3: 댓글 2쌍 구조

```typescript
const totalPairs = Math.ceil(threadStepsNeeded / 2) // 보통 2쌍

for (let pairIdx = 0; pairIdx < totalPairs; pairIdx++) {
  const pairPrompt = generateCommentPairPrompt(data, {
    initialQuestion, firstAnswer, conversationHistory: history.slice(-4),
    pairIndex: pairIdx, totalPairs, isLastPair
  })
  // Pro 모델로 호출 → JSON 파싱 {customer, agent}
  // 실패 시 fallback: 고객(Flash) + 설계사(Pro) 개별 호출
  // 길이 보장: 고객 최소 80자, 최대 250-375자 / 설계사 최대 230-420자
}

// 후기성 문구 삽입: reviewCount > 0 && conversationLength >= 6
// 마지막 설계사 댓글 직후에 삽입
```

### 3-11. 필드별 정제

```typescript
// 제목: cleanForTitle (괄호·버전·로마숫자·무배당 모두 제거)
// 본문/답변/댓글: cleanForBody (버전코드·무배당만 제거, 해약환급금미지급형 등 보존)
```

### 3-12. Quality Gate 통합

```typescript
const gateResults: GateResult[] = []
gateResults.push(gateTitle(finalQuestionTitle, undefined, { forbiddenPatterns }))
gateResults.push(gateQuestionBody(finalQuestionContent, { forbiddenPatterns }))
gateResults.push(gateAnswer(answerContent, { conflictAxis, forbiddenPatterns }))
gateResults.push(gateThread(conversationThread, { forbiddenPatterns }))

// 답변 70점 미만 → 재생성 1회 (실패 사유를 프롬프트에 포함)
if (answerGate.score < 70) {
  const retryPrompt = generateAnswerPrompt(...,
    finalQuestionContent + `\n\n⚠️ 이전 답변이 ${answerGate.score}점. 문제: ${answerGate.failures.join(', ')}`
  )
  // 재생성 후 점수 비교 → 개선된 경우만 교체
}

const overallQuality = calculateOverallScore(gateResults)
```

### 3-13. 최종 응답 구조

```json
{
  "success": true,
  "question": { "title": "...", "content": "...", "generatedAt": "..." },
  "answer": { "content": "...", "generatedAt": "..." },
  "conversation": [{ "role": "customer/agent", "content": "...", "step": 3 }, ...],
  "qualityGate": {
    "totalScore": 85,
    "breakdown": { "title": 95, "questionBody": 85, "answer": 80, "thread": 90 },
    "allPassed": true,
    "criticalFailures": [],
    "qualityWarning": false,
    "qualitySuggestRegenerate": false
  },
  "usage": { "promptTokens": ..., "completionTokens": ..., "costEstimate": {...} },
  "metadata": { "productName": ..., "topicName": ..., "searchKeywords": [...], ... }
}
```

**품질 게이트 저장 정책**: 저장은 항상 허용(`allow_with_warning`). `qualityWarning`(Critical 실패 존재), `qualitySuggestRegenerate`(총점 70 미만 또는 Critical 실패)가 true이면 클라이언트에서 경고·재생성 유도 문구 표시.

---

## 4. 프롬프트 전체

### 파일: `lib/prompts/qa-prompt.ts` (1737줄)

### 4-1. 공통 지침 (COMMON_GUIDELINES)

```typescript
const COMMON_GUIDELINES = {
  NO_PERIOD: `⚠️ 마침표(.) 사용 절대 금지:
- 모든 문장 끝에 마침표를 사용하지 마세요
- 물음표(?)나 느낌표(!)는 사용 가능하지만, 마침표는 절대 사용하지 마세요`,

  SENTENCE_INTEGRITY: `⚠️ 문장 중간 줄바꿈 절대 금지:
- 문장이 완전히 끝나지 않았는데 중간에 줄을 바꾸지 마세요
- 쉼표(,) 뒤에서 줄을 바꾸지 마세요. 한 문장은 반드시 한 줄에 이어 쓰세요`,

  OUTPUT_FORMAT: `[출력 형식]
- 본문만 출력하세요. 마크다운이나 HTML 태그 없이 순수 텍스트만 출력하세요.`,

  DIVERSITY: `⚠️ 다양성 확보 필수:
- 매번 생성할 때마다 반드시 다른 패턴, 다른 구조, 다른 표현을 사용하세요`,

  PARAGRAPH_FORMAT: `⚠️ 문단 구분 필수:
- 2-3개의 문단으로 구성하세요
- 각 문단 사이에는 반드시 빈 줄(줄바꿈 2개)을 넣어주세요`
}
```

### 4-2. 코드 레벨 무작위성 데이터 (전체)

#### QUESTION_CONCEPTS (5개 — 질문자 태도)

| ID | 설명 | 톤 |
|---|---|---|
| 의심형 | 설계사 답변에 의심을 품고 추가 확인 | 의심스러워하며 확인하려는 |
| 초보형 | 보험에 대해 거의 모르는 초보자 | 기초적인 것도 모르는 초보자 |
| 꼼꼼형 | 모든 조건과 제한사항을 꼼꼼히 확인 | 꼼꼼하게 모든 것을 확인하려는 |
| 감정호소형 | 개인적 상황이나 감정을 드러내며 공감 요구 | 개인적 감정을 드러내며 공감을 구하는 |
| 답정너형 | 이미 결정했지만 확인 차원에서 질문 | 이미 결정했지만 확인하려는 |

#### TITLE_PATTERNS (6개 — 확률 기반 선택)

| ID | 타입 | 확률 | 가이드 |
|---|---|---|---|
| SIMPLE_AGGRO | 초간단/어그로형 | 20% | 상품명/나이 빼고 매우 짧고 자극적 (15자 이내) |
| PRICE_FOCUS | 가격/금액 강조형 | 20% | 가격을 제목의 핵심으로 |
| PRODUCT_SKEPTIC | 상품명+의심형 | 20% | 상품명 + 구체적 의심/단점 질문 |
| SITUATION_FOCUS | 상황/고민 강조형 | 20% | 본인 상황(결혼, 해지 고민 등) 중심 |
| SPECIFIC_ASK | 구체적 특약 질문형 | 10% | 특정 특약을 콕 집어 질문 |
| STANDARD | 정석 질문형 | 10% | 나이/성별/상품명 포함 정중한 질문 |

#### ANSWER_STRUCTURES (5개 — 답변 논리 구조)

| ID | 순서 |
|---|---|
| 결론→이유→영업 | 결론 먼저 → 이유 → 상담 유도 |
| 공감→분석→제안 | 감정 공감 → 상품 분석 → 제안 |
| 질문반박→팩트→유도 | 질문 인정 → 팩트 답변 → 유도 |
| 비교→장점→유도 | 경쟁사 비교 → 장점 강조 → 유도 |
| 설명→예시→유도 | 상세 설명 → 구체 예시 → 유도 |

#### COMMENT_INTENTS (5개 — 댓글 작성 의도)

| ID | 톤 |
|---|---|
| 딴지걸기 | 반박하고 의문을 제기하는 |
| 재촉하기 | 빠른 답변을 재촉하는 |
| 단순호응 | 긍정적으로 호응하는 |
| 엉뚱한질문 | 원래 질문과는 다른 엉뚱한 질문 |
| 경험담공유 | 자신의 경험이나 주변 사람의 경험 공유 |

#### COMMENTER_PERSONAS (5개 — 확률 기반)

| ID | 타입 | 확률 | 특징 |
|---|---|---|---|
| ORIGINAL | 원글 작성자 | 40% | 추가 질문, 인사 불필요 |
| NEW_INTERESTED | 관심 생긴 제3자 | 25% | 조건이 좋아보여 끼어듦, 쪽지 요청 |
| NEW_COMPARE | 비교 중인 제3자 | 15% | 다른 보험과 비교 질문 |
| NEW_URGENT | 급한 가입희망자 | 10% | 당장 가입 급함 |
| NEW_SKEPTIC | 조건 따지는 제3자 | 10% | 의심하며 조건 비교 |

#### CONTEXT_NOISE (7개 — 문체 다양성)

```
1. 핸드폰으로 급하게 써서 문장이 짧고 간결한 스타일 (존댓말 유지)
2. 매우 꼼꼼하고 예의 바른 성격이라 "혹시 실례가 안 된다면~" 표현
3. 걱정이 많아서 "ㅠㅠ" 같은 이모티콘을 섞으며 불안해하는 말투
4. 회사 업무 중에 몰래 쓰는 상황이라 핵심만 딱딱 묻는 사무적 말투
5. 보험 용어를 어느 정도 알아서 "그럼 납입면제는요?" 같이 훅 들어오는 스타일
6. 옆집 이웃에게 물어보듯 친근하고 부드러운 "해요"체
7. 아무런 감정 없이 건조하게 팩트만 확인하는 시크한 존댓말
```

#### 대화 상태 머신 (getDialogueState)

```typescript
function getDialogueState(currentStep, totalSteps) {
  if (isEarly) return { phase: '초반', goal: '탐색 및 조건 확인' }
  if (isLate)  return { phase: '후반', goal: '확신 및 가입 의사 표시' }
  return { phase: '중반', goal: '갈등 심화 및 구체적 비교' }
}
```

### 4-3. 질문 생성 프롬프트 (`generateQuestionPrompt`)

프롬프트 전문은 qa-prompt.ts의 449~633행입니다. 핵심 구조:

```
[화자 프로필] — 나이·성별 + randomSituation
[최근 검색 요약] — searchResultsText (일반론으로만)
[작성 미션] — 제목(selectedTitlePattern) + 본문(displayName 1회, 이후 customerFacingName)
  - 태도: selectedConcept.tone
  - 도입 톤: openingGuide
  - 300~500자, 2~3개 문단
[사실성 필수] — 입력에 없는 수치 임의 생성 금지
[📋 Evidence Map] — questionFacts 주입
[⛔ 절대 사용 금지] — forbiddenPatterns 주입
[⚖️ Conflict Axis] — 핵심 갈등 구조 주입
[📌 설계서 고민 축] — (설계서 모드) selectedConcern/selectedConcernSearch + coverageSummaryForPrompt/coverageFocusLabels 있으면: 질문 중심을 해당 고민 축으로, 보장 요약 1~2개 자연스럽게 반영, 구조어 대신 "보장 구성/쏠림/균형" 표현
[출력 형식] — JSON { "title": "...", "body": "..." }
```

### 4-4. 답변 생성 프롬프트 (`generateAnswerPrompt`)

프롬프트 전문은 qa-prompt.ts의 639~928행입니다. 핵심 구조:

```
[상품명 사용 규칙] — displayName 1회 → customerFacingName 이후
[⛔ 절대 사용 금지] — forbiddenPatterns
[📋 답변 근거 사실 (Evidence Map)] — answerFacts 주입
  - 근거에 없는 내용 단정 금지, 추정 시 "~로 보입니다" 표시
[⚖️ 판단 축 (Conflict Axis)] — 판단 한 줄 강제
[📌 설계서 판단 축] — (설계서 모드) selectedConcern으로 판단 시작, coverageSummaryForPrompt 중 2개 안팎을 근거로 사용, 고정 문장 반복 금지
[핵심 지침 0~10]
  0. 세일즈 모드 (CTA, 구체 숫자)
  1. 고객 호명 + 공감 (empathyText 랜덤)
  2. 구체적 금액/조건 필수
  3. 전문적 디테일
  4. 비교 제시 (현실적 금액)
  5. 가입 유도
  6. 답변 톤 (selectedTone)
  7. 답변 구조 (selectedStructure)
  8. 길이 300~450자, 4블록 고정:
     ① 공감/전제 1문장
     ② 핵심 판단 1~2문장 (판단 한 줄 필수!)
     ③ 체크포인트 2~3개
     ④ 행동 유도 1문장
  9. 다양성
 10. 카페 형식
```

### 4-5. 댓글 2쌍 구조 프롬프트 (`generateCommentPairPrompt`)

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

[글자 수] 쌍0: 고객 150~250 / 설계사 180~280
          쌍1: 고객 120~200 / 설계사 150~230

[출력] { "customer": "...", "agent": "..." }
```

### 4-6. 개별 댓글 프롬프트 (`generateConversationThreadPrompt`)

**고객 턴**: COMMENTER_PERSONAS + COMMENT_FAMILIES (7종: 의심검증/구체비교/조건확인/공감불안/실사용경험/추가디테일/강력가입희망) + CONTEXT_NOISE

**설계사 턴**: ADVISOR_TONES (4종: 정리형/판단기준형/공감+해결형/주의사항형), 범위 제한 (해약환급금·간편심사·특약·보험료·가입조건·보장 범위 안에서만)

### 4-7. 통합 생성 프롬프트 (`generateUnifiedQAPrompt`)

현재 비활성화 (품질 우선 원칙). 제목 N개 + 질문 본문 + 답변을 1회 Pro 호출로 생성. 구조는 PART A(제목) + PART B(질문) + PART C(답변) JSON 출력.

### 4-8. 댓글 배치 프롬프트 (`generateThreadBatchPrompt`)

통합 경로용. N개 댓글을 1회 Pro 호출로 생성. 각 step별 role/persona/family/길이 지정.

### 4-9. 후기 프롬프트 (`generateReviewMessagePrompt` + `generateReviewResponsePrompt`)

- 고객 후기: 8개 패턴 (가입완료+장점+감사, 만족도+장점+감사 등), 150-250자, 안심형/현실형 위주
- 설계사 응답: 15개 패턴, 150-250자, 친절한 톤

---

## 5. 품질 게이트 전체

### 파일: `lib/quality-gate.ts` (332줄)

### gateTitle (제목 검증)

| 규칙 | 조건 | 감점 |
|---|---|---|
| 길이 | 22~40자 | 짧음 -20, 김 -15 |
| 질문형 | `?` 또는 `까요/나요/인가요/맞나요/건가요/할까/좋을까` 등 | -25 |
| 내부 표기 | `무배당`, `\(\d{3,5}\)`, `I{2,3}`, `[ⅠⅡⅢ]`, `\d+종`, `\(주\)` | 각 -15 |
| forbiddenPatterns | 커스텀 금지 패턴 | 각 -15 |
| 마침표 | `.$` | -10 |
| 최근 유사도 | Jaccard > 0.6 | -20 |

### gateQuestionBody (본문 검증)

| 규칙 | 조건 | 감점 |
|---|---|---|
| 길이 | 200~700자 | 짧음 -25, 김 -10 |
| 첫 문장 | `합리적인 선택/검토 중입니다/장기 납입` 등 설계서 문체 | -15 |
| forbiddenPatterns | 커스텀 금지 패턴 | 각 -10 |
| 마침표 | 2개 초과 | -10 |
| 문단 구분 | `\n\s*\n` 없음 (200자 이상) | -10 |

### gateAnswer (답변 검증)

| 규칙 | 조건 | 감점 |
|---|---|---|
| 길이 | 280~550자 | 짧음 -30, 김 -10 |
| **판단문** | **`자신이 있으면/경우라면/유리/불리/장점/단점/괜찮/아쉬/조심` 등** | **-25** |
| conflictAxis | keywordNatural 관련 내용 없음 | -15 |
| forbiddenPatterns | | 각 -10 |
| 정리문체 | `정리해드리면/핵심은/따라서/검토해보세요/고려하시면` | 각 -5 |
| 마침표 | 3개 초과 | -10 |

### gateThread (스레드 검증)

| 규칙 | 조건 | 감점 |
|---|---|---|
| role 흐름 | customer → agent 교대 | 각 -20 |
| 댓글 길이 | 50~400자 | 짧음 -15, 김 -10 |
| concern | `걱정/고민/궁금/불안/환급금/보험료/보장/해지/유지` | -15 |
| forbiddenPatterns | | 각 -10 |

### 기타 품질 게이트 (quality-gate.ts)

- **firstSentenceSimilarity**: 질문 본문 첫 문장이 저장된 첫문장과 유사하면 감점 (강한 감점 -20 / 약한 -10).
- **humanLikeness**: 설계서 문체·기계적 표현 감지 시 감점.
- **evidenceConsistency**: 답변이 Evidence Map과 충돌하는지 검사.
- **keywordHealth**: displayKeywords 5칸·marketHead·customer_concern·검색량 등 키워드 건강도. 70점 미만 시 Critical 실패로 기록.

### calculateOverallScore

```typescript
// weights 예시 (실제 코드는 quality-gate.ts 참조)
const weights = { title: 20, questionBody: 15, answer: 20, thread: 10, humanLikeness: 15, evidenceConsistency: 17, keywordHealth: 12, ... }
// 가중 평균 → totalScore
// 70점 미만 → criticalFailures에 추가
```

---

## 6. 용어 사전 전체

### 파일: `lib/insurance-terminology.ts` (223줄)

### INSURANCE_TERM_DICTIONARY

| 내부 표기 | 자연어 | 비고 |
|---|---|---|
| 해약환급금미지급형 | 환급금 없는 구조 | 중도해지 시 환급금 없음 |
| 해약환급금미지급형 II | 환급금 없는 구조 | 2세대 |
| 저해지환급금형 | 해지하면 돌려받는 돈이 적은 구조 | |
| 표준형 | 일반 환급 구조 | |
| 세만기형 | 세만기형 (보험 기간이 세 번으로 나뉘는 구조) | |
| 보험료납입면제 | 특정 조건에서 보험료 면제 | |
| 보험료납입면제대상 | 보험료 면제 대상 조건 | |
| 보험료납입면제대상Ⅱ | 특정 질병 시 보험료 면제 | |
| 납입기간 | 보험료 내는 기간 | |
| 일반상해사망 | 사고로 사망 시 보장 | |
| 암사망 | 암으로 사망 시 보장 | |
| 종합병원하이클래스암주요치료비 | 종합병원 암 주요 치료비 보장 | |
| 항암방사선치료비 | 항암 방사선 치료비 보장 | |
| 항암약물치료비 | 항암 약물 치료비 보장 | |
| 암진단비 | 암 진단 시 일시금 보장 | |
| 유사암진단비 | 유사암(경계성종양 등) 진단 시 보장 | |
| 일반암진단비 | 일반 암 진단 시 보장 | |
| 특정암진단비 | 특정 암(고액암 등) 진단 시 보장 | |
| 뇌혈관질환진단비 | 뇌혈관 질환 진단 시 보장 | |
| 허혈성심장질환진단비 | 심장 질환 진단 시 보장 | |
| 골절진단비 | 골절 시 보장 | |
| 상해입원일당 | 사고로 입원 시 일당 보장 | |
| 질병입원일당 | 질병으로 입원 시 일당 보장 | |
| 수술비 | 수술 시 보장 | |
| 통원치료비 | 통원 치료 시 보장 | |
| 실손의료비 | 실비 보장 (실제 치료비 보상) | |
| 무배당 | *(삭제)* | |
| 갱신형 | 갱신되는 (일정 기간마다 보험료가 바뀌는) | |
| 비갱신형 | 비갱신 (보험료가 변하지 않는) | |
| 간편심사 | 간편 심사 (건강 조건이 까다롭지 않은) | |
| 간편가입 | 간편 가입 (가입 조건이 쉬운) | |
| 체증형 | 보장이 해마다 늘어나는 | |
| 정액형 | 보장 금액이 고정된 | |
| 면책기간 | 보장이 시작되기 전 대기 기간 | |
| 감액기간 | 보장 금액이 줄어드는 초기 기간 | |
| (주), I, II, III, Ⅰ, Ⅱ, Ⅲ | *(삭제)* | |

### 주요 함수

- **`translateToNatural(internalTerm)`** — 부분 일치도 처리하는 번역
- **`cleanInternalTerms(text)`** — 삭제 대상 표기 제거
- **`buildConflictAxis(concern, concernSearch)`** — 갈등 축 생성

### Conflict Axis 매핑

| concern | proCondition | conCondition | summary |
|---|---|---|---|
| 해약환급금미지급형 | 끝까지 유지할 자신이 있으면 보험료 저렴 | 중도해지 가능성이 있으면 낸 돈 못 돌려받음 | 유지 가능성 |
| 갱신형 | 초기 보험료 저렴, 필요시 갱신 가능 | 갱신 시 보험료 상승 부담 | 장기 유지 비용 |
| 간편심사 | 건강 조건 까다롭지 않아 가입 쉬움 | 보험료 비싸거나 보장 제한적 | 가입 편의 vs 보장 범위 |
| 납입면제 | 질병 시 보험료 면제 유지 | 면제 조건 까다로우면 적용 어려움 | 면제 조건 범위 |
| 세만기형 | 단계별 관리 가능 | 구조 복잡, 보장 내용 변경 가능 | 복잡도 vs 보장 연속성 |
| *(기타)* | 본인 상황에 맞으면 유리 | 본인 상황에 안 맞으면 부담 | 적합성 |

### `buildCoverageEvidence(coverages)`

보장 항목을 카테고리별로 분류 (암치료/사망/입원/수술/납입면제/기타) → 자연어 요약

---

## 7. 제목 패밀리 전체

### 파일: `lib/title-family.ts` (371줄)

### Title Family 12개

| ID | 이름 | 가이드 | 예시 | 가중치 |
|---|---|---|---|---|
| worry_direct | 고민 직접형 | 핵심 고민을 직접 질문형으로 | 환급금 없는 건강보험, 이대로 들어도 될까요 | 12 |
| experience_ask | 경험 문의형 | 경험자에게 물어보는 형태 | 이 상품 가입해보신 분들 계실까요 | 10 |
| compare_hesitate | 비교 망설임형 | A vs B 갈팡질팡 | 일반 건강보험이랑 뭐가 더 나은 걸까요 | 8 |
| design_review | 설계서 검토형 | "설계서 받았는데" 검토 요청 | 설계서 받았는데 이 정도면 무난한 편인가요 | 10 |
| cost_feel | 비용 체감형 | 월 보험료 금액 중심 | 월 1만원대면 괜찮은 편인지 궁금해요 | 9 |
| cancel_risk | 해지 리스크형 | 해지/환급금 불안 | 중간에 해지하면 손해가 너무 큰 구조일까요 | 9 |
| coverage_interpret | 보장 해석형 | 특정 보장 실제 의미 | 이 보장 문구는 실제로 어디까지 되는 걸까요 | 7 |
| target_empathy | 타깃 공감형 | 연령대/성별 공감 | 50대 여성 기준으로 이런 건강보험 많이 드시나요 | 10 |
| fit_check | 가입 적합성형 | 자신 상황에 맞는지 | 저 같은 조건이면 이 상품이 맞는 걸까요 | 9 |
| condition_verify | 조건 확인형 | 할인/면제/심사 적용 여부 | 건강할인 조건이 실제로 까다로운 편인가요 | 8 |
| life_vent | 생활형 하소연형 | 보험 어렵다는 넋두리 | 보험은 어렵고 이건 더 헷갈리네요 | 7 |
| final_check | 결정 직전형 | 가입 직전 마지막 확인 | 거의 가입하려는데 마지막으로 체크할 게 있을까요 | 8 |

### sampleFamilies(count, recentFamilyIds)

가중치 기반 중복 없이 N개 샘플링. 최근 사용 family는 가중치 30%로 감점.

### scoreTitleCandidate — 채점 기준 전체

| 항목 | 점수 | 매칭 조건 |
|---|---|---|
| 의문형 종결 | +25 | `까요/없나요/맞나요/어떤가요/인가요/될까요/할까요/일까요/좋을까요/괜찮을까요/아닌가요/건가요/던가요/드시나요/계실까요/싶어요/모르겠어요` |
| 물음표 | +15 | `?` |
| 고민어 | +18 | `환급금/해지/해약/보험료/보장/납입면제/가입/적당/괜찮/부담/손해/유지/갱신/심사/고지` |
| 키워드 1~2개 | +18 | searchKeywords 적절 |
| 키워드 3개+ | -15 | 과다 |
| 상품명 | +12 | cleanProductCore 포함 |
| 페르소나 | +8 | `\d+대\s*(남성\|여성)` |
| 적절 길이 | +8 | 18~38자 |
| 카페 생활형 | +8 | `이대로/이거/괜찮/어떤가요/진짜/좀/그냥` 등 |
| 깔끔 | +5 | 괄호/코드 없음 |
| SEO/블로그 | -30 | `진짜 이유/완전 정리/꿀팁/비교하세요/추천합니다` 등 |
| 설명문형 | -15 | 의문형 아님 |
| raw 상품명 | -30 | 15자+ 정식 상품명 노출 |
| 인삿말형 | -40 | `안녕하세요/가입했습니다` |
| 유사도 60%+ | -25 | Jaccard(최근 제목) |
| 유사도 40%+ | -12 | |

### Opening Family 10개

| ID | 이름 | 템플릿 |
|---|---|---|
| design_sheet | 설계서 기반 | 설계서 받고 보험료 보니까 고민이 되더라고요 |
| someone_said | 주변 소문형 | 지인이 이 상품 가입했다길래 저도 알아보는 중인데요 |
| online_search | 검색 중 발견형 | 인터넷으로 찾아보다가 이 상품이 눈에 들어왔어요 |
| worry_start | 걱정 시작형 | 요즘 건강 문제로 보험 알아보기 시작했는데요 |
| agent_recommend | 설계사 추천형 | 설계사분이 이걸 추천해주셨는데 제가 잘 몰라서요 |
| comparison_stuck | 비교 중 막힘형 | 여러 상품 비교하다가 머리가 복잡해져서요 |
| renewal_concern | 갱신 불안형 | 기존 보험 갱신 시기가 다가오는데 갈아타야 하나 |
| family_trigger | 가족 계기형 | 가족이 아파서 보험 필요성을 느꼈는데요 |
| budget_tight | 예산 고민형 | 보험료가 부담이 되는데 이 정도면 적당한 건지 |
| almost_decided | 거의 결정형 | 거의 가입하려고 하는데 마지막으로 확인하고 싶어요 |

### buildTitlePrompt

Title Family별 1개씩 제목 생성 + concern 교차 사용 (내부 고민어 / 생활형 고민어 절반씩) + 절대 금지 규칙 + JSON 출력

---

## 8. 상품명 구조화 전체

### 파일: `lib/topic-utils.ts` (133줄)

### COMPANY_MAP (20개 보험사)

| 패턴 | 축약 |
|---|---|
| 라이나생명보험(주) | 라이나생명 |
| 삼성생명보험(주) | 삼성생명 |
| 삼성화재해상보험(주) | 삼성화재 |
| 한화생명보험(주) | 한화생명 |
| 한화손해보험(주) | 한화손보 |
| 교보생명보험(주) | 교보생명 |
| 현대해상화재보험(주) | 현대해상 |
| DB손해보험(주) | DB손보 |
| DB생명보험(주) | DB생명 |
| 메리츠화재해상보험(주) | 메리츠 |
| 흥국화재해상보험(주) | 흥국화재 |
| KB손해보험(주) | KB손보 |
| KB라이프보험(주) | KB라이프 |
| 하나손해보험(주) | 하나손보 |
| 하나생명보험(주) | 하나생명 |
| 동양생명보험(주) | 동양생명 |
| 신한라이프생명보험(주) | 신한라이프 |
| NH농협생명보험(주) | NH농협 |
| AIG손해보험(주) | AIG손보 |
| 푸본현대생명보험(주) | 푸본현대 |
| 처브라이프생명보험(주) | 처브라이프 |

### convertToCustomerTopicName 처리 단계

```
1. 회사명 추출 + 축약 (COMPANY_MAP)
2. (주), 주식회사, 무배당 제거
3. display 단계: 버전코드 괄호 제거, 핵심 구조어(해약환급금미지급형 등) 괄호만 벗기고 보존
4. topic 단계: 모든 괄호·로마숫자·종수·코드 제거 → cleanProductCore
5. concern 추출: CONCERN_PATTERNS 15개 매칭
```

### CONCERN_PATTERNS (15개)

| 패턴 | concern | concernSearch |
|---|---|---|
| 해약환급금미지급형\|해약환급금 | 해약환급금미지급형 | 환급금 없는 보험 |
| 무해약 | 무해약환급금 | 해지해도 돈 못 받는 보험 |
| 간편심사 | 간편심사 | 병력 있어도 가입 가능한 보험 |
| 유병자 | 유병자 | 아파도 들 수 있는 보험 |
| 고지의무 | 고지의무 | 병원 기록 있으면 보험 가입 |
| 납입면제 | 납입면제 | 보험료 납입면제 조건 |
| 특정N대질병제외 | *(extract)* | 일부 질병 빠지는 보험 |
| 질병제외 | 질병제외 | 질병제외형 보험 장단점 |
| 비갱신 | 비갱신형 | 보험료 안 오르는 보험 |
| 갱신형\|갱신 | 갱신형 | 갱신되면 보험료 얼마나 오르나 |
| 만기환급 | 만기환급형 | 만기에 돈 돌려받는 보험 |
| 순수보장 | 순수보장형 | 보험료 싼 대신 환급 없는 보험 |
| 감액 | 감액형 | 감액형 보험 보험료 |
| 고액암 | 고액암 | 고액암 진단비 얼마 |
| 3대질병\|3대진단 | 3대질병 | 암 뇌 심장 보험 보장 |

### extractPersonaBucket

```typescript
// "50세 여성" → "50대 여성", "30대 남성 직장인" → "30대 남성"
// 연령대 + 성별만 추출
```

---

## 9. 문제점·개선안·테스트 제안

### 9-1. 핵심 고민이 너무 짧게 나오는 문제

**원인**
- **topicConcern / worryPoint**: concern 후보 선택 시 `selectedConcernCandidate.concern`은 **고정된 한 문장** 템플릿(예: "상해 쪽 보장은 있는데 질병 대비가 부족한 건 아닌지 걱정")으로 설정됨.
- 3단계 AI가 생성한 **긴 worryPoint**는, 후보가 선택되면 `buildWorryPointFromConcern`에서 **완전히 덮어쓰기**되어 설계서 기준 자세한 고민이 사라짐.
- **topicConcernSearch**는 `buildConcernSearchLabel`에서 **20자로 잘림**되어 검색어만 짧게 유지됨.

**해결 방향**
1. **worryPoint 덮어쓰기 완화**: 설계서 모드에서 `topicConcern`/`topicConcernSearch`는 후보 기준으로 두되, **worryPoint**는 "후보 한 문장 + 3단계 worryPoint 요약 1~2문장" 형태로 합치거나, 후보가 선택되어도 3단계 worryPoint를 **concernDetail** 같은 별도 필드로 보존해 generate 쪽에서 본문/답변에 풍부한 고민 문맥으로 넣기.
2. **concern 확장 단계 추가**: keyCoverages·premium·담보 이름을 넣어 "이 설계서 기준 구체적 고민 2~3문장"을 한 번 더 생성(또는 3단계 프롬프트에서 worryPoint를 2~4문장으로 쓰라고 강조)하고, 그 결과를 worryPoint 또는 concernDetail로 사용.
3. **프롬프트에 길이/구체성 지시**: 질문·답변 프롬프트에 "설계서에 나온 담보·보험료를 1~2개 이상 구체적으로 언급하며, 고민을 한두 문장이 아닌 **설계서 기준으로 자세히** 풀어서 써 주세요" 같은 문구 추가.

### 9-2. 답변이 짧거나 일반론으로 흐르는 문제

**현재**
- 답변 목표 300~450자, soft cap 450자, 300자 미만 시 재생성.
- 설계서 모드에서 coverageSummaryForPrompt를 근거로 쓰라고 하지만, 실제로 요약이 비어 있으면 설계서 축이 약해짐.

**해결 방향**
1. **keyCoverages·designFocusLabel 전달**: analyze-design-sheet 응답에 keyCoverages·designFocusLabel이 포함되며, **BlogGenerator가 designSheetAnalysis에 이 두 필드를 넣어 generate-qa에 전달**해야 함. 미전달 시 canonicalConcernContext.coverageFocusLabels/coverageSummaryForPrompt가 비어 있어 coverage_focus가 "보장 균형"으로만 나옴. generate-qa에서는 coverage_focus fallback으로 designFocusLabel 사용.
2. analyze 단계에서 coverages+specialClauses 병합으로 keyCoverages 구축(이미 반영됨).
3. 답변 프롬프트에 "**350자 이상** 권장, 설계서 보장을 **2개 이상** 구체적으로 언급해 판단 근거를 제시하세요" 명시.
3. (선택) 답변 soft cap을 500자로 올리고, 품질 게이트에서 "판단 근거로 보장 2개 이상 언급" 여부를 체크해 미달 시 재생성 유도.

### 9-3. 테스트로 확인할 항목

| 항목 | 확인 방법 |
|------|-----------|
| 치매/뇌 위주 설계서 | keyCoverages에 brain 다수, topicConcern이 injury_only가 아님, coverageSummaryForPrompt에 치매·장기요양 등 포함 |
| 상해 위주 설계서 | injury 담보 2개 이상일 때만 injury_only 후보 생성, mainAxis와 맞는 concern 선택 |
| 해약환급금미지급형 | topicConcern/topicConcernSearch/worryPoint/제목/displayKeywords에 "해약환급금미지급형" 문구 없음 |
| 고민/답변 길이 | worryPoint 100자 이상, 질문 본문 300자대, 답변 350자 이상 비율 |
| 설계서 4필드 전달 | 로그에서 canonicalConcernContext 적용 후, 각 generate* 호출 시 selectedConcern 등 4필드 포함 여부 |

### 9-4. 배치 테스트 스크립트

- `scripts/run-design-sheet-batch-test.mjs`: 여러 설계서 이미지에 대해 analyze → generate-qa 파이프라인 실행 후, 결과 JSON/품질점수/키워드/고민 문구를 저장. 위 표 항목을 스크립트에서 자동 체크하거나, 생성된 worryPoint·questionContent·answerContent 길이와 "보장"/"치매" 등 키워드 포함 여부를 요약하면 유리함.

### 9-5. 추가 개선·확인 사항

| 항목 | 설명 |
|------|------|
| **문서–코드 동기화** | analyze-design-sheet 라인 수(723+) 등은 실제 파일 기준으로 주기적으로 맞출 것. |
| **품질 게이트 가중치** | quality-gate.ts의 calculateOverallScore 가중치(title, questionBody, answer, thread, humanLikeness, evidenceConsistency, keywordHealth)는 코드 기준으로 full-reference와 일치하는지 확인. |
| **designSheetAnalysis 타입** | 프론트/API 간 designSheetAnalysis 타입을 공유 타입으로 두면 keyCoverages·designFocusLabel 누락 방지에 유리함. |
| **3단계 검색 블록** | 검색 결과가 있을 때만 3단계 프롬프트에 "[최근 검색 요약]" 블록이 들어감. 축 기반 검색은 3단계·concern 선택 이후에 수행됨. |

---

*전체 소스 코드 기준 완전판 정리*
*최종 업데이트: 2026-03-17 (3단계 해지·환급 문구 출력 금지, keyCoverages/designFocusLabel 전달, 품질게이트 보조 항목 반영)*
