# Q&A 시스템 전체 레퍼런스 — Part 2: API 라우트

> **이 문서는 Q&A 시스템에 사용되는 모든 코드·로직·프롬프트를 빠짐없이 수록합니다.**
> 총 3파트로 구성: [Part 1-A (유틸 라이브러리)](./qa-system-part1-lib-utils.md) / [Part 1-B (프롬프트)](./qa-system-part1-prompts.md) / Part 2 (API 라우트)

---

## 파일 목차

| # | 파일 | 줄 수 | 역할 |
|---|------|-------|------|
| 1 | `lib/product-name-correction.ts` | 356 | 보험 상품명 OCR 교정 레이어 (alias 사전 + 검색 빈도 + fuzzy matching) |
| 2 | `app/api/analyze-design-sheet/route.ts` | 723 | 설계서 이미지 분석 API (Gemini Vision + Google CSE) |
| 3 | `app/api/generate-qa/route.ts` | 3,166 | Q&A 생성 API (질문→제목→답변→댓글→품질게이트) |

---

## 1. `lib/product-name-correction.ts` (356줄)

### 역할

OCR/모델이 추출한 상품명을 실존 상품명 사전과 대조하여 교정한다.

### 교정 파이프라인

```
1) 정답 사전 정확 매칭 → 교정 불필요
2) 검색 결과 빈도 기반 교정 (가장 강력한 시그널)
3) alias 사전 기반 직접 매핑
4) known product fuzzy matching (편집 거리)
5) 검색 결과 텍스트에서 정규식 패턴 탐색 (사전에 없는 상품)
```

### KNOWN_PRODUCTS 사전 (주요)

| 보험사 | 상품명 | aliases |
|--------|--------|---------|
| 하나손보 | 하나더퍼스트 | 하나퍼스트, 하나 퍼스트, 하나더 퍼스트, 하나더펏스트 |
| 삼성생명 | 뉴인생설계 | 뉴 인생설계, 뉴인생 설계 |
| 삼성화재 | 착한가격보험 | 착한 가격보험, 착한가격 보험 |
| 현대해상 | 굿앤굿 | 굿앤 굿, 굿엔굿, 굿앤꿋 |
| DB손보 | 프로미라이프 | 프로미 라이프, 프로미라이브, 프로미라이트 |
| 교보생명 | 플래닛라이프 | 플래닛 라이프, 플레닛라이프 |
| 라이나생명 | TheK건강보험 | 더케이건강보험, The K 건강보험 |
| 동양생명 | 수호천사 | 수호 천사 |

### 주요 함수

- **`correctProductName(extractedName, searchResults?)`** → `CorrectionResult`
  - method: `search_frequency` | `alias_map` | `fuzzy_match` | `none`
  - confidence: `high` | `medium` | `low`

- **`correctAndLog(extractedName, normalizedName, searchResults?)`** → raw/normalized 교정 결과 + 로그

### 교정 기준

| 단계 | 조건 | confidence |
|------|------|------------|
| 검색 빈도 | 3회+ 등장 & 유사도 ≥ 40% | high |
| 검색 빈도 | 2회+ 등장 & 유사도 ≥ 50% | medium |
| 검색 빈도 | 1회+ 등장 & 유사도 ≥ 70% | medium |
| alias 매핑 | 정확 일치 | high |
| fuzzy matching | 유사도 ≥ 85% | high |
| fuzzy matching | 유사도 ≥ 75% | medium |
| 검색 패턴 | 2회+ 등장 정규식 패턴 | medium/low |

---

## 2. `app/api/analyze-design-sheet/route.ts` (723줄)

### 전체 흐름

```
POST /api/analyze-design-sheet
  │ body: { imageBase64 }
  │
  ├─ 1단계: Flash 모델 기본 정보 추출
  │   └─ gemini-2.5-flash → gemini-2.5-pro (폴백)
  │   └─ JSON 파싱: productName, targetPersona, premium, coverages, specialClauses
  │
  ├─ 상품명 정규화: normalizeExtractedProductName (중복단어·무배당·코드 제거)
  │
  ├─ 3단계: Pro 모델 최종 분석 (검색 없이 1단계 결과만 주입)
  │   └─ gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash (폴백)
  │   └─ JSON 파싱: productName, targetPersona, worryPoint, sellingPoint, premium, coverages, specialClauses
  │   └─ GPT 거부 감지 시 1단계 데이터 기반 자동 생성
  │
  ├─ 상품명 교정: correctAndLog (alias + fuzzy)
  │
  ├─ 축 기반 검색 (축 확정 시에만, 1~2회)
  │   └─ 쿼리1: {companyShort} {topicConcernSearch 또는 topicConcern}, 결과 없으면 쿼리2: {companyShort} {첫 keyCoverage}
  │   └─ 결과 없으면 포기. 수집분 → searchSummary
  │
  ├─ 상품명 구조화: convertToCustomerTopicName
  │
  ├─ personaBucket 추출: extractPersonaBucket
  │
  ├─ coverages/specialClauses 정제 (로마숫자 제거, 중복 제거)
  │
  ├─ keyCoverages 구축: buildKeyCoverages(merged) — merged = [...cleanCoverages, ...cleanSpecialClauses.slice(0,15)]
  │   └─ normalizeCoverageNameForCustomer, inferCoverageCategory(치매/뇌 등 brain 강화), 우선순위 정렬 후 최대 5개
  │
  ├─ designFocusLabel: axisCounts·axisWeight로 mainAxis 산출 → designFocusLabelMap (예: cancer→'암 보장 중심', brain→'치매 보장 중심')
  │
  ├─ Concern 후보 생성·선택
  │   ├─ buildCoverageConcernCandidates (injury_only는 상해≥2 + 질병축 거의 없을 때만)
  │   ├─ buildBalanceConcernCandidates, buildStructureConcernFallbacks
  │   ├─ chooseBestConcernCandidate: keyCoverages로 mainAxis 추론, mainAxis와 어긋나는 후보 페널티
  │   └─ topicConcern/topicConcernSearch/worryPoint/sellingPoint 설정
  │
  ├─ scrubNoRefundStructureTerm: topicConcern, topicConcernSearch에만 적용. worryPoint/sellingPoint는 3단계 프롬프트에서 해지·환급 구조 문구 포함 금지로 처음부터 뽑지 않음 (후처리 없음)
  │
  ├─ Evidence Map / Conflict Axis / 고객형 고민 후보군 구축
  │   └─ forbiddenPatterns에 '중간에 해지하면 돌려받는 돈이 거의 없는', '해지하면 돌려받는 돈이 없는 구조', '중도에 해지하면 돌려받는 돈' 추가
  │
  └─ 응답 data에 keyCoverages, keyCoveragesCount, designFocusLabel, selectedConcernSource, selectedConcernReason, concernCandidatesCount 포함
```

### 핵심 로직 상세

#### normalizeExtractedProductName

```typescript
// 중복 단어 제거 (예: "하나퍼스트 무배당 하나퍼스트" → "하나퍼스트")
// "무배당" 제거
// 내부 코드 제거: (4165), 5N5
// "2종", "1종" 제거
// 로마 숫자 제거: II, III, Ⅱ, Ⅲ
```

#### Evidence Map 구축 규칙

```typescript
// questionFacts (질문에서 활용)
if (premium) questionFacts.push(`월 보험료 ${premium}`)
if (worryPoint) questionFacts.push(worryPoint)
if (coverageEvidence.length > 0) questionFacts.push(`주요 보장: ${coverageEvidence.slice(0, 3).join(', ')}`)
if (topicConcern) questionFacts.push(`핵심 고민: ${translateToNatural(topicConcern)}`)

// answerFacts (답변 근거)
if (premium) answerFacts.push(`월 보험료 ${premium}`)
if (sellingPoint) answerFacts.push(sellingPoint)
coverageEvidence.forEach(ev => answerFacts.push(ev))
if (specialClauses.length > 0) answerFacts.push(`특약: ${specialClauses.slice(0, 5).map(c => translateToNatural(c)).join(', ')}`)

// forbiddenPatterns (절대 금지)
'무배당', '(주)', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'II', 'III'
// + 내부 코드 패턴, '설계사 전문 상담', '약관을 참고하세요' 등
// + 설계서 공통: '중간에 해지하면 돌려받는 돈이 거의 없는', '해지하면 돌려받는 돈이 없는 구조', '중도에 해지하면 돌려받는 돈'
```

---

## 3. `app/api/generate-qa/route.ts` (3,166줄)

### 전체 흐름

```
POST /api/generate-qa
  │ body: { productName, targetPersona, worryPoint, sellingPoint, answerTone,
  │         designSheetImage, designSheetAnalysis, conversationMode, conversationLength,
  │         reviewCount, generateStep, questionTitle, questionContent }
  │
  ├─ 인증 검증 (Supabase auth)
  ├─ 필수 입력 검증
  ├─ 파이프라인 guard (설계서 이미지 있는데 분석 미완료 → 거부)
  │
  ├─ Canonical Payload 확정
  │   └─ 설계서 모드: 분석 결과가 폼값보다 우선
  │
  ├─ canonicalConcernContext 구성 (설계서 모드)
  │   └─ designSheetAnalysis.keyCoverages → rawKeyCoverages (name = normalizedName || customerLabel || rawName) → coverageSummaryForPrompt, coverageFocusLabels
  │   └─ **프론트가 designSheetAnalysis에 keyCoverages·designFocusLabel을 포함해 전달해야** 위 값이 채워짐. 비어 있으면 coverage_focus는 designFocusLabel → 없으면 "보장 균형"으로 fallback
  │   └─ selectedConcern, selectedConcernSearch, selectedConcernSource, selectedConcernReason, keyCoverages, coverageSummaryForPrompt, coverageFocusLabels
  │   └─ generateQuestionPrompt / generateAnswerPrompt(메인·재생성·품질게이트) / generateConversationThreadPrompt /
  │       generateCommentPairPrompt / generateUnifiedQAPrompt / generateThreadBatchPrompt 호출 시 위 4필드(selectedConcern, selectedConcernSearch, coverageSummaryForPrompt, coverageFocusLabels) 전달
  │
  ├─ 상품명 구조화 (재정규화 금지)
  │   └─ preStructured: 분석 topicCore 그대로 사용
  │   └─ 수동 모드: convertToCustomerTopicName
  │
  ├─ 검색 재사용 / Google CSE (8쿼리)
  │   └─ hasUpstreamSearch → 스킵
  │   └─ 수동 모드: 8개 쿼리 실행
  │
  ├─ 키워드 추출 (Naver SearchAd + 스코어링)
  │   ├─ 상품군 판별: cancer/silsan/simple/jongsin/driver/health/other
  │   ├─ hintKeywords 구성 → Naver SearchAd 최대 15개 반환
  │   ├─ 스코어링: product(+40) + intent(+25) + persona(+15) + core(+30) + longtail(+25)
  │   ├─ 감점: generic(-80), competitor(-60), claim(-30), comparison_site(-35)
  │   ├─ OTHER_GROUP_PATTERNS 상품군 불일치 탈락
  │   ├─ 반반 구조: 우리 키워드 3개 + 관련 대형 키워드 2개
  │   ├─ concern 키워드 최우선 삽입 (설계서 모드)
  │   └─ 키워드 후압축 + 길이 제한 (20자) + cleanForKeyword
  │
  ├─ Gemini 모델 분배
  │   ├─ Flash: 질문 생성, 고객 댓글, 후기
  │   └─ Pro: 답변 생성, 설계사 댓글, 제목 후보, 댓글 쌍
  │
  ├─ [통합 경로] 현재 비활성 (false && ...)
  │
  ├─ Step 1: 질문 생성 (Flash)
  │   ├─ generateQuestionPrompt → Flash 호출
  │   ├─ JSON 파싱 → 텍스트 파싱 fallback
  │   ├─ vocative-only 첫 줄 제거
  │   └─ formatQuestionContent (문단 3개 보장, 문장 중간 줄바꿈 수정)
  │
  ├─ Step 1.5: 제목 후보 (Pro)
  │   ├─ sampleFamilies(6) → buildTitlePrompt
  │   ├─ Pro 호출 → JSON 파싱
  │   ├─ scoreTitleCandidate 채점 → 최고점 선택
  │   └─ 실패 시 규칙형 폴백 5개 후보
  │
  ├─ Step 2: 답변 생성 (Pro)
  │   ├─ generateAnswerPrompt → Pro 호출
  │   ├─ 포맷팅: 4-5문단 자동 분리, 이모티콘 위치 조정
  │   ├─ enforceAnswerLength(450): 500자 초과 시 soft cap
  │   └─ 300자 미만 시 자동 1회 재생성
  │
  ├─ Step 3: 댓글 2쌍 구조 (Pro)
  │   ├─ totalPairs = Math.ceil(threadStepsNeeded / 2)
  │   ├─ 쌍별: generateCommentPairPrompt → Pro 호출 → JSON 파싱
  │   ├─ 실패 시 fallback: 고객(Flash) + 설계사(Pro) 개별 호출
  │   ├─ 길이 보장: 고객 80~375자 / 설계사 ~420자
  │   └─ 후기성 문구 삽입 (reviewCount > 0 && conversationLength >= 6)
  │
  ├─ 필드별 정제
  │   ├─ 제목: cleanForTitle (강)
  │   ├─ 본문/답변/댓글: cleanForBody (약)
  │   └─ 로그/내부: 정제 없음
  │
  ├─ Quality Gate
  │   ├─ gateTitle → gateQuestionBody → gateAnswer → gateThread
  │   ├─ 답변 70점 미만 → 재생성 1회 (실패 사유 프롬프트 포함)
  │   └─ calculateOverallScore (가중 평균)
  │
  ├─ 사용량 로그 (Supabase usage_logs)
  │
  └─ 응답:
      {
        success: true,
        question: { title, content, generatedAt },
        answer: { content, generatedAt },
        conversation: [{ role, content, step }, ...],
        qualityGate: { totalScore, breakdown, allPassed, criticalFailures },
        usage: { promptTokens, completionTokens, totalTokens, breakdown, costEstimate },
        metadata: { productName, topicName, displayProductName, searchKeywords, promptVersion, ... }
      }
```

### 핵심 로직 상세

#### Canonical Payload 확정

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
```

#### 상품명 구조화 (재정규화 금지)

```typescript
if (preStructured) {
  // 설계서 분석에서 이미 구조화 완료 → 그대로 사용
  cleanProductCore = designSheetAnalysis.topicCore
  topicConcern = designSheetAnalysis.topicConcern || ''
  topicConcernSearch = designSheetAnalysis.topicConcernSearch || ''
  companyShort = designSheetAnalysis.companyShort || ''
  displayProductName = designSheetAnalysis.displayProductName || productName
} else {
  // 수동 모드 → convertToCustomerTopicName으로 추출
  const converted = convertToCustomerTopicName(productName)
}
```

#### 키워드 스코어링

```typescript
const scoreKeyword = (kw, volume) => {
  let score = 0
  if (isRelevant(kw)) score += 40           // product
  if (INTENT_WORDS.some(w => kw.includes(w))) score += 25  // intent
  if (PERSONA_PATTERN.test(kw)) score += 15  // persona
  if (isCoreKeyword(kw)) score += 30         // core
  if (isCoreKeyword(kw) && PERSONA_PATTERN.test(kw)) score += 25  // longtail
  if (GENERIC_BAD_KEYWORDS.some(bad => kw === bad)) score -= 80  // generic
  if (COMPETITOR_KEYWORDS.some(c => kw.includes(c))) score -= 60  // competitor
  if (CLAIM_WORDS.some(w => kw.includes(w))) score -= 30  // claim
  if (/비교사이트|비교몰/.test(kw)) score -= 35  // comparison_site
  score += Math.log10(volume + 1) * 3  // 검색량 보조
  return score
}
```

#### 필드별 정제 함수

```typescript
// cleanForTitle (강): 모든 괄호·버전·로마숫자·(주)·무배당 제거
// cleanForBody (약): (주)·무배당·버전코드 괄호만 제거, 핵심 구조어 보존
//   해약환급금미지급형, 간편심사, 특정4대질병제외, 고액치료비, 표적항암 → 보존
// cleanForKeyword = cleanForTitle (같은 강도)
```

#### enforceAnswerLength

```typescript
// 문단 단위 → 문장 단위 → 단어 단위로 자르되
// findKoreanSentenceEnd로 자연스러운 문장 끝 탐색
// 한국어 문장 종결 패턴: 요, 니다, 습니다, 해요, 어요, 까요 등
// 50자 이상에서 문장 끝을 찾되, 5자 이내 차이 허용
```

#### Gemini 모델 폴백 구조

```typescript
// Flash 우선 (useFlash=true):
//   gemini-2.5-flash → gemini-2.0-flash
// Pro 우선 (useFlash=false):
//   gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash

// 할당량 초과(429) 감지 → 1초 대기 후 다음 모델
// 모델 미존재(404) 감지 → 즉시 다음 모델
// 성공 후 1초 대기 (RPM 150 제한 대응)
```

#### 비용 추적

```typescript
const getCostRates = () => ({
  'gemini-2.0-flash': { prompt: 0.10, completion: 0.40 },  // per 1M tokens
  'gemini-2.5-flash': { prompt: 0.075, completion: 0.30 },
  'gemini-2.5-pro':   { prompt: 1.25, completion: 10.00 },
})
// Google CSE: $0.0005 per search
```

#### Quality Gate 재생성 로직

```typescript
if (answerGate.score < 70) {
  const retryPrompt = generateAnswerPrompt(...,
    finalQuestionContent + `\n\n⚠️ 이전 답변이 ${answerGate.score}점. 
    문제: ${answerGate.failures.join(', ')}. 
    반드시 판단 한 줄을 포함하고, 4블록을 빠짐없이 작성하세요.`
  )
  const retryResult = await generateContentWithFallback(retryPrompt, ...)
  const retryGate = gateAnswer(retryAnswer, ...)
  if (retryGate.score > answerGate.score) {
    answerContent = retryAnswer  // 개선된 경우만 교체
  }
}
```

#### 최종 응답 구조

```json
{
  "success": true,
  "question": { "title": "...", "content": "...", "generatedAt": "..." },
  "answer": { "content": "...", "generatedAt": "..." },
  "conversation": [{ "role": "customer|agent", "content": "...", "step": 3 }, ...],
  "qualityGate": {
    "totalScore": 85,
    "breakdown": { "title": 95, "questionBody": 85, "answer": 80, "thread": 90 },
    "allPassed": true,
    "criticalFailures": []
  },
  "usage": {
    "promptTokens": 12000,
    "completionTokens": 3000,
    "totalTokens": 15000,
    "breakdown": [...],
    "costEstimate": {
      "currency": "USD",
      "totalCost": 0.045,
      "customSearchCost": 0.004,
      "customSearchCount": 8,
      "details": [...]
    }
  },
  "metadata": {
    "productName": "...",
    "topicName": "...",
    "displayProductName": "...",
    "searchKeywords": [...],
    "promptVersion": "1.2",
    "openingFamilyId": "design_sheet",
    "titlePatternId": "PRODUCT_SKEPTIC",
    "questionConceptId": "꼼꼼형"
  }
}
```

---

---

## 전체 소스 코드

### `lib/product-name-correction.ts`

```typescript
/**
 * 보험 상품명 정답 교정 레이어
 *
 * OCR/모델 추출값을 실존 상품명 사전과 대조하여 가장 가까운 정답으로 교정한다.
 * 검색 결과에서 반복 등장하는 상품명이 있으면 그것을 우선 신뢰한다.
 *
 * 파이프라인:
 *   1) 검색 결과 빈도 기반 교정 (가장 강력한 시그널)
 *   2) alias 사전 기반 직접 매핑
 *   3) known product fuzzy matching (편집 거리)
 */

import type { SearchResult } from '@/lib/google-search'

// ─── 보험사 실존 상품 사전 ──────────────────────────
// name: 정답 상품명, aliases: OCR이 잘못 읽을 수 있는 변형들

interface KnownProduct {
  name: string
  aliases: string[]
  company: string
  category: 'health' | 'cancer' | 'silsan' | 'simple' | 'jongsin' | 'driver' | 'dental' | 'other'
}

const KNOWN_PRODUCTS: KnownProduct[] = [
  // 하나손보
  { name: '하나더퍼스트', aliases: ['하나퍼스트', '하나 퍼스트', '하나더 퍼스트', '하나더펏스트', '하나더피스트'], company: '하나손보', category: 'health' },
  { name: '하나원큐다이렉트', aliases: ['하나원큐', '하나 원큐'], company: '하나손보', category: 'other' },

  // 삼성생명
  { name: '삼성 건강보험', aliases: ['삼성건강보험', '삼성 건강 보험'], company: '삼성생명', category: 'health' },
  { name: '뉴인생설계', aliases: ['뉴 인생설계', '뉴인생 설계'], company: '삼성생명', category: 'jongsin' },

  // 삼성화재
  { name: '착한가격보험', aliases: ['착한 가격보험', '착한가격 보험'], company: '삼성화재', category: 'health' },

  // 한화생명
  { name: '건강파트너', aliases: ['건강 파트너'], company: '한화생명', category: 'health' },
  { name: '한화생명 건강보험', aliases: ['한화 건강보험'], company: '한화생명', category: 'health' },

  // 교보생명
  { name: '교보 건강보험', aliases: ['교보건강보험'], company: '교보생명', category: 'health' },
  { name: '플래닛라이프', aliases: ['플래닛 라이프', '플레닛라이프'], company: '교보생명', category: 'health' },

  // 현대해상
  { name: '굿앤굿', aliases: ['굿앤 굿', '굿엔굿', '굿앤꿋'], company: '현대해상', category: 'health' },
  { name: '하이카', aliases: ['하이 카', '하이카자동차'], company: '현대해상', category: 'driver' },

  // DB손보
  { name: '프로미라이프', aliases: ['프로미 라이프', '프로미라이브', '프로미라이트'], company: 'DB손보', category: 'health' },
  { name: '참좋은건강보험', aliases: ['참좋은 건강보험', '참 좋은 건강보험'], company: 'DB손보', category: 'health' },

  // 메리츠
  { name: '메리츠 건강보험', aliases: ['메리츠건강보험'], company: '메리츠', category: 'health' },

  // KB손보
  { name: 'KB 건강보험', aliases: ['KB건강보험', '케이비건강보험'], company: 'KB손보', category: 'health' },
  { name: 'KB 다이렉트', aliases: ['KB다이렉트', '케이비다이렉트'], company: 'KB손보', category: 'other' },

  // 라이나생명
  { name: '라이나 건강보험', aliases: ['라이나건강보험'], company: '라이나생명', category: 'health' },
  { name: 'TheK건강보험', aliases: ['더케이건강보험', 'The K 건강보험', 'TheK 건강보험', '더K건강보험'], company: '라이나생명', category: 'health' },

  // 동양생명
  { name: '수호천사', aliases: ['수호 천사'], company: '동양생명', category: 'health' },

  // 신한라이프
  { name: '신한 건강보험', aliases: ['신한건강보험'], company: '신한라이프', category: 'health' },

  // AIG
  { name: 'AIG 건강보험', aliases: ['AIG건강보험'], company: 'AIG손보', category: 'health' },

  // 흥국화재
  { name: '흥국화재 건강보험', aliases: ['흥국건강보험'], company: '흥국화재', category: 'health' },

  // NH농협
  { name: 'NH 건강보험', aliases: ['NH건강보험', '농협건강보험'], company: 'NH농협', category: 'health' },
]

// ─── 편집 거리 (Levenshtein) ──────────────────────────

function levenshtein(a: string, b: string): number {
  const la = a.length
  const lb = b.length
  if (la === 0) return lb
  if (lb === 0) return la

  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0))
  for (let i = 0; i <= la; i++) dp[i][0] = i
  for (let j = 0; j <= lb; j++) dp[0][j] = j

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[la][lb]
}

// ─── 검색 결과에서 상품명 빈도 추출 ──────────────────────

function extractCandidateNamesFromSearch(
  searchResults: SearchResult[],
  extractedName: string
): Array<{ name: string; count: number; source: 'title' | 'snippet' }> {
  if (!searchResults || searchResults.length === 0) return []

  const extractedNorm = extractedName.replace(/\s+/g, '').toLowerCase()
  const freq = new Map<string, { count: number; source: 'title' | 'snippet' }>()

  for (const r of searchResults) {
    const texts = [
      { text: r.title || '', source: 'title' as const },
      { text: r.snippet || '', source: 'snippet' as const },
    ]

    for (const { text, source } of texts) {
      if (!text) continue

      for (const product of KNOWN_PRODUCTS) {
        const pNorm = product.name.replace(/\s+/g, '').toLowerCase()

        if (text.replace(/\s+/g, '').toLowerCase().includes(pNorm)) {
          const key = product.name
          const existing = freq.get(key)
          if (existing) {
            existing.count++
            if (source === 'title') existing.source = 'title'
          } else {
            freq.set(key, { count: 1, source })
          }
        }
      }

      const koreanProductPattern = /(?:하나더퍼스트|굿앤굿|프로미라이프|플래닛라이프|수호천사|착한가격|TheK|뉴인생설계)/gi
      const matches = text.match(koreanProductPattern)
      if (matches) {
        for (const m of matches) {
          const normalized = m.trim()
          const known = KNOWN_PRODUCTS.find(p =>
            p.name.replace(/\s+/g, '').toLowerCase() === normalized.replace(/\s+/g, '').toLowerCase()
          )
          if (known) {
            const key = known.name
            const existing = freq.get(key)
            if (existing) {
              existing.count++
            } else {
              freq.set(key, { count: 1, source })
            }
          }
        }
      }
    }
  }

  return Array.from(freq.entries())
    .map(([name, data]) => ({ name, ...data }))
    .filter(item => item.name.replace(/\s+/g, '').toLowerCase() !== extractedNorm)
    .sort((a, b) => b.count - a.count)
}

// ─── 메인 교정 함수 ──────────────────────────────────

export interface CorrectionResult {
  original: string
  corrected: string
  method: 'search_frequency' | 'alias_map' | 'fuzzy_match' | 'none'
  confidence: 'high' | 'medium' | 'low'
  detail: string
}

export function correctProductName(
  extractedName: string,
  searchResults?: SearchResult[]
): CorrectionResult {
  if (!extractedName || extractedName === '보험 상품') {
    return { original: extractedName, corrected: extractedName, method: 'none', confidence: 'low', detail: '추출명 없음' }
  }

  const norm = extractedName.replace(/\s+/g, '').toLowerCase()

  // ── 0단계: 이미 정답 사전에 있으면 그대로 ──
  const exactMatch = KNOWN_PRODUCTS.find(p =>
    p.name.replace(/\s+/g, '').toLowerCase() === norm
  )
  if (exactMatch) {
    return { original: extractedName, corrected: exactMatch.name, method: 'none', confidence: 'high', detail: '이미 정답' }
  }

  // ── 1단계: 검색 결과 빈도 기반 교정 (가장 강력) ──
  if (searchResults && searchResults.length > 0) {
    const candidates = extractCandidateNamesFromSearch(searchResults, extractedName)

    if (candidates.length > 0) {
      const best = candidates[0]

      const dist = levenshtein(norm, best.name.replace(/\s+/g, '').toLowerCase())
      const maxLen = Math.max(norm.length, best.name.replace(/\s+/g, '').length)
      const similarity = 1 - dist / maxLen

      if (best.count >= 3 && similarity >= 0.4) {
        return {
          original: extractedName,
          corrected: best.name,
          method: 'search_frequency',
          confidence: 'high',
          detail: `검색 ${best.count}회 등장, 유사도 ${(similarity * 100).toFixed(0)}%`
        }
      }

      if (best.count >= 2 && similarity >= 0.5) {
        return {
          original: extractedName,
          corrected: best.name,
          method: 'search_frequency',
          confidence: 'medium',
          detail: `검색 ${best.count}회 등장, 유사도 ${(similarity * 100).toFixed(0)}%`
        }
      }

      if (best.count >= 1 && similarity >= 0.7) {
        return {
          original: extractedName,
          corrected: best.name,
          method: 'search_frequency',
          confidence: 'medium',
          detail: `검색 ${best.count}회 등장, 유사도 ${(similarity * 100).toFixed(0)}%`
        }
      }
    }
  }

  // ── 2단계: alias 사전 직접 매핑 ──
  for (const product of KNOWN_PRODUCTS) {
    for (const alias of product.aliases) {
      if (alias.replace(/\s+/g, '').toLowerCase() === norm) {
        return {
          original: extractedName,
          corrected: product.name,
          method: 'alias_map',
          confidence: 'high',
          detail: `alias "${alias}" → "${product.name}"`
        }
      }
    }
  }

  // ── 3단계: fuzzy matching (편집 거리 기반) ──
  let bestMatch: KnownProduct | null = null
  let bestDist = Infinity
  let bestSimilarity = 0

  for (const product of KNOWN_PRODUCTS) {
    const pNorm = product.name.replace(/\s+/g, '').toLowerCase()
    const dist = levenshtein(norm, pNorm)
    const maxLen = Math.max(norm.length, pNorm.length)
    const similarity = 1 - dist / maxLen

    if (dist < bestDist && similarity >= 0.65) {
      bestDist = dist
      bestMatch = product
      bestSimilarity = similarity
    }
  }

  if (bestMatch && bestSimilarity >= 0.75) {
    return {
      original: extractedName,
      corrected: bestMatch.name,
      method: 'fuzzy_match',
      confidence: bestSimilarity >= 0.85 ? 'high' : 'medium',
      detail: `편집거리 ${bestDist}, 유사도 ${(bestSimilarity * 100).toFixed(0)}%`
    }
  }

  // ── 4단계: 검색 결과 텍스트에서 직접 정규식 탐색 (사전에 없는 상품) ──
  if (searchResults && searchResults.length > 0) {
    const allText = searchResults
      .map(r => `${r.title || ''} ${r.snippet || ''}`)
      .join(' ')

    const coreWords = extractedName.split(/\s+/).filter(w => w.length >= 2)

    for (const word of coreWords) {
      const extendedPattern = new RegExp(`[가-힣]{1,2}${escapeRegex(word)}|${escapeRegex(word)}[가-힣]{1,2}`, 'g')
      const extMatches = allText.match(extendedPattern)

      if (extMatches) {
        const countMap = new Map<string, number>()
        for (const m of extMatches) {
          const key = m.trim()
          if (key !== word && key.length > word.length) {
            countMap.set(key, (countMap.get(key) || 0) + 1)
          }
        }

        const sorted = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1])
        if (sorted.length > 0 && sorted[0][1] >= 2) {
          const correctedFull = extractedName.replace(word, sorted[0][0])
          return {
            original: extractedName,
            corrected: correctedFull,
            method: 'search_frequency',
            confidence: sorted[0][1] >= 3 ? 'medium' : 'low',
            detail: `검색 패턴 "${word}" → "${sorted[0][0]}" (${sorted[0][1]}회)`
          }
        }
      }
    }
  }

  return { original: extractedName, corrected: extractedName, method: 'none', confidence: 'low', detail: '교정 불필요 또는 매칭 실패' }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── 상품명 통합 교정 (분석 파이프라인용) ──────────────────

export function correctAndLog(
  extractedName: string,
  normalizedName: string,
  searchResults?: SearchResult[]
): { correctedRaw: string; correctedNormalized: string; correction: CorrectionResult } {
  const correction = correctProductName(normalizedName, searchResults)

  if (correction.method !== 'none') {
    console.log(`[상품명 교정] ✅ 교정 적용: "${correction.original}" → "${correction.corrected}" (${correction.method}, ${correction.confidence}, ${correction.detail})`)
  } else {
    console.log(`[상품명 교정] ℹ️ 교정 불필요: "${normalizedName}" (${correction.detail})`)
  }

  const correctedNormalized = correction.corrected
  const correctedRaw = correction.method !== 'none'
    ? extractedName.replace(
        new RegExp(escapeRegex(normalizedName), 'i'),
        correctedNormalized
      ) || correctedNormalized
    : extractedName

  return { correctedRaw, correctedNormalized, correction }
}
```

---

### `app/api/analyze-design-sheet/route.ts`

> **참고**: 전체 723줄. 설계서 이미지 분석 → 상품명 정규화 → Google CSE 검색 → Gemini Pro 최종 분석 → 상품명 교정 → Evidence Map/Conflict Axis 구축.
> 소스 코드는 위 "핵심 로직 상세" 섹션의 흐름도와 대응됩니다.
> 파일 전체는 프로젝트 내 `app/api/analyze-design-sheet/route.ts`에서 확인할 수 있습니다.

---

### `app/api/generate-qa/route.ts`

> **참고**: 전체 3,166줄. Q&A 생성의 모든 파이프라인(인증 → 상품명 구조화 → 검색 → 키워드 추출 → 질문/제목/답변/댓글 생성 → 정제 → 품질 게이트 → 응답)이 담긴 핵심 API 라우트입니다.
> 소스 코드는 위 "핵심 로직 상세" 섹션의 흐름도와 대응됩니다.
> 파일 전체는 프로젝트 내 `app/api/generate-qa/route.ts`에서 확인할 수 있습니다.

---

*전체 소스 코드 약 4,245줄 (product-name-correction 356 + analyze-design-sheet 723+ + generate-qa 3,166) 기준*
*최종 업데이트: 2026-03-17 (scrub 범위·해지/환급 금지·keyCoverages/designFocusLabel 전달·forbiddenPatterns)*
