## 설계서 이미지 분석 Vision AI 레퍼런스

> **역할**: 설계서 PNG/JPG 이미지를 읽어서 Q&A 생성기에 넘길 **정규화된 분석 결과**를 만드는 단계입니다.  
> **구현 위치**: `app/api/analyze-design-sheet/route.ts`

---

### 1. Vision AI 프롬프트 (Gemini)

#### 1-1. 1단계: 기본 정보 추출용 프롬프트 (`basicInfoPrompt`)

```ts
const basicInfoPrompt = `이 이미지는 보험 설계서/제안서입니다. 이미지에서 다음 정보만 추출해주세요:

**[추출할 정보]**
- 보험사명: 로고나 상단에 표시된 보험사 이름
- 보험 상품명: 제목이나 상품명란에 적힌 정확한 상품명
- 가입자 정보: 나이, 성별, 직업 (있는 경우)

**[출력 형식 - 반드시 JSON만 출력]**
{
  "productName": "보험사명 + 보험상품명",
  "targetPersona": "나이대 + 성별 + 직업 (있는 경우)",
  "premium": "월보험료 또는 연보험료 (있는 경우)",
  "coverages": ["담보명1", "담보명2"],
  "specialClauses": ["특약명1", "특약명2"]
}

⚠️ 이미지에 명시된 정확한 정보만 추출하세요. 추정하지 마세요.`
```

- 모델: `gemini-2.5-flash` → 실패 시 `gemini-2.5-pro`
- 목적: **상품명·타깃·보험료·담보·특약만** OCR 수준으로 뽑는 단계 (worry/selling은 아직 생성하지 않음)

#### 1-2. 3단계: 최종 분석 프롬프트 (`prompt`)

```ts
const prompt = `이 이미지는 보험 설계서/제안서입니다. 이미지를 자세히 읽고, 표시된 모든 텍스트와 데이터를 정확히 추출해주세요.

${basicInfoContext}        // 1단계에서 이미 추출한 JSON 내용을 사람이 읽기 좋게 넣어줌

${searchResultsText ? `**[최근 검색 요약]**
다음은 "${extractedProductName}"에 대한 최신 정보입니다. 이 정보를 참고하여 더 정확하고 현실적인 분석을 수행해주세요:
${searchResultsText}

⚠️ 검색 결과는 참고용이며, 이미지에 명시된 정보가 우선입니다.` : ''}

**[이미지 분석 단계]**

1단계: 이미지의 모든 텍스트를 OCR로 읽기
- 보험사 로고 주변의 텍스트 확인
- 제목, 부제목, 표 제목 등 모든 텍스트 읽기
- 표 안의 숫자와 텍스트 정확히 인식

2단계: 핵심 정보 추출
- **보험사명**: 로고 아래나 상단에 명시된 보험사 이름
- **보험 상품명**: 제목이나 상품명란에 적힌 정확한 상품명
- **가입자 정보**: 나이, 성별, 직업이 표시된 부분 찾기
- **보험료**: 금액이 표시된 부분 (월보험료, 연보험료 등)
- **특약/보장 내용**: 특약명, 보장금액 등이 나열된 부분

3단계: 보험 종류 판단
- 이미지에 "운전자보험"이라고 명시되어 있으면 → 운전자보험
- 이미지에 "실손의료비"라고 명시되어 있으면 → 실손의료비보험
- 이미지에 "치아보험"이라고 명시되어 있으면 → 치아보험
- **⚠️ 절대 추정하지 말고, 이미지에 명시된 정확한 상품명만 사용하세요!**

${searchResultsText ? `4단계: 검색 결과 활용
- 위의 검색 결과를 참고하여 이 상품에 대한 고객의 실제 고민점(worryPoint)을 파악하세요
- 검색 결과를 바탕으로 이 상품의 주요 장점(sellingPoint)을 현실적으로 정리하세요
- 검색 결과에 나온 최신 정보(후기, 특약, 장점 등)를 반영하여 더 정확한 분석을 제공하세요` : ''}

**[출력 형식 - 반드시 JSON만 출력]**
{
  "productName": "보험사명 + 보험상품명 (1단계에서 추출한 정보를 기반으로, 이미지에서 정확히 확인)",
  "targetPersona": "나이대 + 성별 + 직업 (1단계에서 추출한 정보를 기반으로, 이미지에서 정확히 확인)",
  "worryPoint": "이 보험을 고려하는 고객의 실제 고민 (검색 결과를 반드시 참고하여 구체적이고 현실적으로 작성)",
  "sellingPoint": "이 보험의 주요 장점 2-3개 (검색 결과를 반드시 참고하여 정확하게 작성)",
  "premium": "월보험료 또는 연보험료",
  "coverages": ["담보명1", "담보명2", "담보명3"],
  "specialClauses": ["특약명1", "특약명2"]
}

⚠️ **중요**: 
- productName, targetPersona, premium, coverages, specialClauses는 1단계에서 이미 추출한 정보를 우선 사용하되, 이미지를 다시 확인하여 정확성을 검증하세요.
- worryPoint와 sellingPoint는 반드시 검색 결과를 참고하여 구체적이고 현실적으로 작성하세요. 일반적인 문구가 아닌, 이 상품에 특화된 내용을 작성하세요.

**[최종 확인]**
- productName: 이미지에 실제로 보이는 보험사명과 상품명인가?
- 보험 종류: 이미지에 명시된 보험 종류와 일치하는가?
- worryPoint: 검색 결과를 참고하여 실제 고객 고민을 반영했는가?
- sellingPoint: 검색 결과를 참고하여 현실적인 장점을 정리했는가?
- 모든 정보는 이미지에서 직접 읽은 내용을 우선하고, 검색 결과는 보완적으로 활용하세요.`
```

- 모델: `gemini-2.5-pro` → 실패 시 `gemini-2.5-flash` → `gemini-2.0-flash`
- 목적: **worryPoint/sellingPoint까지 포함한 최종 설계서 분석 결과** 생성

---

### 2. 응답 데이터 구조 (Schema)

#### 2-1. Vision 응답 1단계 (`basicData`)

```ts
type BasicData = {
  productName: string              // "보험사명 + 보험상품명" 또는 '보험 상품'
  targetPersona?: string           // "30대 여성 직장인" 등 (있을 경우)
  premium?: string                 // "월 3만원", "연 36만원" 등
  coverages?: string[]             // 담보명 배열
  specialClauses?: string[]        // 특약명 배열
}
```

#### 2-2. Vision 최종 분석 응답 (`analysisData`)

```ts
type AnalysisData = {
  productName: string              // 최종 상품명 (이미지 기준)
  targetPersona: string            // 나이대 + 성별 + 직업
  worryPoint: string               // 고객 고민 설명 한 문단
  sellingPoint: string             // 주요 장점 1~2문장
  premium: string                  // 월/연 보험료
  coverages: string[]              // 담보명 배열
  specialClauses: string[]         // 특약명 배열
}
```

파싱 실패/거부 응답 시에는 `basicData`와 검색 결과를 기반으로 **fallback `analysisData`**를 구성합니다.

#### 2-3. 설계서 분석 API 최종 응답 (`/api/analyze-design-sheet`)

```ts
type KeyCoverageCategory = 'cancer' | 'brain' | 'heart' | 'surgery' | 'injury' | 'death' | 'disability' | 'other'

type KeyCoverage = {
  rawName: string
  normalizedName: string
  amount: string
  renewalType: 'renewal' | 'non_renewal' | 'unknown'
  category: KeyCoverageCategory
  customerLabel: string
}

type EvidenceMap = {
  questionFacts: string[]
  answerFacts: string[]
  forbiddenPatterns: string[]
}

type ConflictAxis = {
  keyword: string
  keywordNatural: string
  proCondition: string
  conCondition: string
  summary: string
} | null

type KeywordSeedProfile = {
  marketHead: string
  productCore: string
  personaLongtail: string
  intentHead: string
  concernCandidates: string[]
}

type AnalyzeDesignSheetResponse = {
  success: true
  data: {
    productName: string
    rawProductName: string
    topicCore: string
    topicConcern: string
    topicConcernSearch: string
    displayProductName: string
    companyShort: string
    personaBucket: string
    targetPersona: string
    worryPoint: string
    sellingPoint: string
    premium: string
    coverages: string[]
    specialClauses: string[]
    nameCorrection: { ... } | null
    analysisSource: 'design_sheet'
    validatedProductName: string
    validationReason: string
    validationConfidence: 'high' | 'medium' | 'low'
    searchSummary: string
    searchKeywordHints: string[]
    evidenceMap: EvidenceMap
    conflictAxis: ConflictAxis
    internalConcern: string | null
    customerConcernCandidates: string[]
    recommendedMarketHead: string
    keywordSeedProfile: KeywordSeedProfile
    keyCoverages: KeyCoverage[]        // 고객형 핵심보장 최대 5개 (담보 기반 후처리)
    keyCoveragesCount: number
    selectedConcernSource: string | null   // 'coverage' | 'balance' | 'special' | 'structure_fallback'
    selectedConcernReason: string | null
    concernCandidatesCount: number
  }
  usage: { customSearchCount: number; customSearchCost: number }
}
```

- **keyCoverages**: `coverages` 배열을 서버에서 정규화·카테고리 분류한 뒤 우선순위(cancer/brain/heart/surgery 우선)로 정렬, 최대 5개. 치매/뇌 관련(`치매`, `알츠하이머`, `CDR`, `인지기능` 등)은 `brain`으로 분류.
- **topicConcern / topicConcernSearch / worryPoint**: concern 후보(coverage → balance → special → structure_fallback) 중 메인 보장 축(mainAxis)과 맞는 것을 선택. 선택 후 `scrubNoRefundStructureTerm`으로 해약환급금미지급형 등 구조어를 제거해 최종 축에 노출하지 않음.

---

### 3. 이미지 처리 API 로직 개요

#### 3-1. 라우트 위치

- 파일: `app/api/analyze-design-sheet/route.ts`
- HTTP: `POST /api/analyze-design-sheet`
- 입력: `{ imageBase64: string }` (`data:image/png;base64,...` 또는 순수 base64)

#### 3-2. 처리 단계

1. **입력 파싱 / MIME 검출**
   - `imageBase64`에서 헤더 제거 → `base64Data`
   - 파일 크기 추정 → 20MB 초과 시 경고 로그 (하드 차단은 아님)
   - `mimeType` 자동 감지 (`jpeg/png/webp`)

2. **Gemini 클라이언트 초기화**
   - `GEMINI_API_KEY` 환경변수 필수
   - `generateContentWithFallback(prompt, base64Data, mimeType, stage)` 헬퍼로 모든 Vision 호출 래핑
   - basic/final stage에 따라 모델 순서 변경

3. **1단계: 기본 정보 추출 (`basicInfoPrompt`)**
   - Flash 우선 (`gemini-2.5-flash` → `2.5-pro`)
   - code block 제거/제어문자 제거 후 JSON 파싱 → `basicData`
   - 실패 시 정규식으로 `"productName"`만 추출해서 최소 정보 확보

4. **3단계: 최종 분석** — 검색 없이 설계서만 사용. basicData + 분석 가이드만 주입.

5. **상품명 정규화 & 교정** — normalizeExtractedProductName, correctAndLog(alias·fuzzy).

6. **축 기반 검색** — topicConcern/companyShort 확정 시에만, 브랜드+축으로 1~2회 검색, 결과 없으면 포기 → searchSummary.

7. **(구) 3단계 상세** — Pro 우선 (`gemini-2.5-pro` → `2.5-flash` → `2.0-flash`)
   - basicData + 검색 요약 + 분석 단계 가이드 + JSON 출력 스펙을 모두 프롬프트에 주입
   - JSON 파싱 실패 시:
     - 거부 메시지 패턴(“죄송합니다”, “cannot assist” 등) → basicData + 검색 결과 기반 auto worry/selling 생성
     - 그 외에는 `productName/targetPersona/...`를 개별 정규식으로 뽑아 fallback `analysisData` 구성

6. **상품명 정규화 & Ground Truth 교정**
   - `normalizeExtractedProductName` → 내부 코드/로마숫자/무배당 제거
   - 검색 결과를 이용한 Ground Truth Validation (1단계 vs 3단계 이름 빈도 비교)
   - `correctAndLog`로 alias·fuzzy·검색 타이틀 빈도 기반 최종 상품명 교정

7. **keyCoverages 구축 (담보 후처리)**
   - `normalizeCoverageNameForCustomer` → `inferCoverageCategory` → `buildKeyCoverages(cleanCoverages)`
   - **inferCoverageCategory**: 치매/뇌(`치매`, `알츠하이머`, `CDR`, `인지기능` 등) → `brain`, 암/뇌혈관/심장/수술/상해/사망/장해 → 각 카테고리, 나머지 `other`
   - **buildKeyCoverages**: 카테고리 우선순위(cancer/brain/heart > surgery > injury 등)로 정렬 후 상위 5개, 중복 제거
   - 로그: `[설계서 분석] keyCoverages 생성: { originalCoverages, finalKeyCoverages, names }`

8. **Concern 후보 생성 및 최종 선택**
   - **buildCoverageConcernCandidates(keyCoverages)**: coverage 축 후보 (암만/수술위주/사망위주/상해위주 등). **injury_only**는 상해 2개 이상 + 질병·뇌·암·심장 없음 + 기타·사망·장해 합산 ≤1일 때만 생성.
   - **buildBalanceConcernCandidates**: 보장 종류 적음·보험료·other 비중 등
   - **buildStructureConcernFallbacks**: 상품명/구조에서 추론한 fallback (해약환급금·세만기·납입기간 등). 이 축은 **메인 concern으로 쓰지 않고** 구조어(해약환급금미지급형)는 최종에서 제거.
   - **chooseBestConcernCandidate**: keyCoverages로 **mainAxis**(brain/cancer/heart 등) 추론 후, mainAxis와 어긋나는 coverage 후보(예: injury_only인데 mainAxis가 brain)에는 큰 페널티 적용. source 우선순위: coverage > balance > special > structure_fallback.
   - 선택 후 `topicConcern` / `topicConcernSearch` / `worryPoint` / `sellingPoint` 설정.

9. **구조어 제거 (해약환급금미지급형 등)**
   - **scrubNoRefundStructureTerm**: `topicConcern`, `topicConcernSearch`, `worryPoint`, `sellingPoint`, `customerConcernCandidates`에서 "해약환급금 미지급형"/"해약환급금"을 중립 표현으로 치환. 최종 축/요약에 해당 단어가 노출되지 않도록 함.
   - 내부 구조어 금지 패턴(`bannedPatterns`)으로 걸리면 topicConcern/topicConcernSearch를 일반 문장으로 대체한 뒤, 그 결과에도 scrub 적용.

10. **Evidence Map / Conflict Axis / 고객형 고민 후보군 & Seed Profile**
   - `buildCoverageEvidence`로 보장 요약
   - `questionFacts` / `answerFacts` / `forbiddenPatterns` 작성
   - `buildConflictAxis(topicConcern, topicConcernSearch)` 호출
   - `translateInternalConcernToCustomerCandidates` → `sanitizeCandidates`(내부어·scrub 적용) → 3~5개 concern 후보
   - `recommendedMarketHead`, `keywordSeedProfile` 구성

11. **고객형 고민 후보군 & Market Head & Seed Profile**
   - `detectProductGroup`로 productGroup 판별
   - `translateInternalConcernToCustomerCandidates`로 내부 concern 기반 후보군 생성
   - `sanitizeCustomerFacingKeyword` + `isInternalProductTerm` + `scrubNoRefundStructureTerm`으로 정제 후 3~5개 유지
   - `recommendedMarketHead` / `keywordSeedProfile` 구성

12. **최종 응답 반환**
   - `data` 블록: canonical payload + evidenceMap + conflictAxis + concern/keyword 상류 정보
   - `usage` 블록: customSearchCount / customSearchCost

---

### 4. 연관 문서

- `docs/qa-system-full-reference.md` — 전체 Q&A 시스템 아키텍처 + analyze/generate 흐름 요약
- `docs/qa-system-part1-lib-utils.md` — `insurance-terminology`, `quality-gate`, `title-family`, `topic-utils` 상세
- `docs/qa-system-part2-api.md` — `analyze-design-sheet` 및 `generate-qa` 라우트 전체 코드 설명

