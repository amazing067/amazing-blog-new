## Gemini 사용 정리

이 문서는 현재 프로젝트에서 **Gemini를 어디서, 어떤 모델을, 어떤 용도로 사용하는지**를 로직별로 정리한 것입니다.

---

## 1. 메인 생성 로직

### 1-1. Q&A 자동 생성 (`app/api/generate-qa/route.ts`)

- **용도**: 보험 카페용 Q&A 자동 생성 (질문·답변·댓글 스레드 전체).
- **사용 모델 / 전략**
  - 비용 테이블 정의:
    - `gemini-2.0-flash`
    - `gemini-2.5-flash`
    - `gemini-2.5-pro`
  - 공통 헬퍼 `generateContentWithFallback` 사용:
    - `useFlash = true` (Flash 우선):  
      - `gemini-2.5-flash` → 실패 시 `gemini-2.0-flash`
    - `useFlash = false` (Pro 우선):  
      - `gemini-2.5-pro` → 실패 시 `gemini-2.5-flash` → `gemini-2.0-flash`
  - **단계별 실제 사용**
    - Step 1 (질문 생성): `useFlash = true` → Flash 계열로 생성.
    - Step 2 (답변 생성): `useFlash = false` → Pro 우선, 실패 시 Flash 계열 폴백.
    - Step 3 (대화형 댓글 스레드):
      - 홀수 step(고객 댓글): `useFlash = true` (Flash 우선).
      - 짝수 step(설계사 댓글): `useFlash = false` (Pro 우선).
- **특징**
  - 모든 Gemini 호출에서 **Google Grounding(tools: `googleSearch`)**를 활성화하고,  
    그라운딩 메타데이터(검색 쿼리·청크 수)를 로그로 남김.
  - 각 호출의 `usageMetadata`를 읽어 `tokenUsage`에 쌓고, 최종적으로 `tokenBreakdown`과 함께 `usage_logs`에 저장.
  - 품질 게이트(길이·키워드 과밀 등)를 통과시키면서 `qualityWarnings`를 함께 기록.
  - 성공 후에는 **RPM 제한 대응을 위해 호출마다 1초 지연**을 두고 다음 요청을 보냄.

### 1-2. 블로그/콘텐츠 생성 (`app/api/generate/route.ts`)

- **용도**: 블로그·콘텐츠 생성 (Grounding 포함) 메인 엔드포인트.
- **사용 모델 / 전략**
  - 비용 테이블: `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`.
  - 실제 호출:
    - `const models = ['gemini-2.5-pro', 'gemini-2.0-flash']`
      - 우선 `gemini-2.5-pro`, 실패 시 `gemini-2.0-flash`로 폴백.
    - Gemini REST API를 직접 호출하고 **Grounding(내장 실시간 검색)** 기능을 활용.
- **특징**
  - 여러 단계로 프롬프트를 조립한 뒤, 최종 프롬프트를 Gemini에 전달.
  - 토큰·비용은 위 3개 모델 단가를 기준으로 계측.

---

## 2. 서브 생성/도우미 로직

### 2-1. 상품 기반 질문 생성 (`app/api/generate-question-from-product/route.ts`)

- **용도**: 상품명 + 검색 결과를 바탕으로 “질문글 + 답변 포인트” 생성.
- **사용 모델**
  - `gemini-2.5-flash` 고정  
    → 주석 상 “비용·속도 위해 Flash 사용”.

### 2-2. 필드 전용 Q&A 생성 (`app/api/generate-qa-field/route.ts`)

- **용도**: Q&A에서 특정 필드(제목만, 요약만 등)를 따로 뽑는 경량 API.
- **사용 모델**
  - `gemini-2.5-flash` 고정 (빠른 응답용).

---

## 3. Vision / 문서 분석

### 3-1. 설계서 분석 (`app/api/analyze-design-sheet/route.ts`)

- **용도**: 보험 설계서(문서/이미지) 분석.
- **사용 모델 / 전략**
  - `GEMINI_API_KEY`로 **Gemini Vision** 초기화.
  - 단계별 폴백 시나리오:
    - **basic (1단계)**: `gemini-2.5-flash` → 실패 시 `gemini-2.5-pro`
    - **final (3단계)**: `gemini-2.5-pro` → 실패 시 `gemini-2.5-flash` → `gemini-2.0-flash`
  - 모든 호출에서 **Google Grounding** 활성화 (`tools: [{ googleSearch: {} }]`).
- **특징**
  - Vision 입력(이미지/설계서)을 텍스트로 해석·요약한 뒤, JSON 파싱 및 후처리로 상품명·담보·특약 등을 뽑아냄.
  - 각 호출의 그라운딩 결과(웹 검색 쿼리, 검색된 청크 수)를 상세 로그로 남김.
  - 성공 시마다 1초 지연을 둬 RPM 제한을 피하도록 설계.
  - 반환값에 `provider: 'gemini'` 명시.

### 3-2. 의료 이미지 분석 (`app/api/analyze-medical-image/route.ts`)

- **용도**: 의료 이미지 분석.
- **사용 모델 / 전략**
  - Vision 초기화 후 폴백 순서:
    - `gemini-2.5-pro` → `gemini-2.0-flash`
- **특징**
  - 각 시도 실패 시 로그를 남기고, 모든 모델 실패 시 에러 throw.

### 3-3. PDF 분석 (`app/api/parse-pdf/route.ts`, `app/api/parse-pdf-from-url/route.ts`)

- **용도**: PDF(파일 또는 URL)에서 **상품명·회사명 등 메타 정보 추출**.
- **사용 모델**
  - `gemini-2.5-flash` (비용 절감을 위해 Flash 사용).
- **특징**
  - 텍스트 추출 후 Gemini로 의미 분석 → 구조화된 필드로 매핑.

---

## 4. 통계·관리 화면용 비용 계산

아래 API들은 **Gemini를 직접 호출하지 않고**, 이미 기록된 `tokenBreakdown`을 바탕으로 **비용만 계산**합니다.

- `app/api/stats/route.ts`
- `app/api/admin/stats/route.ts`
- `app/api/admin/quality-kpi/route.ts`

공통으로 사용하는 **모델별 단가 테이블**:

- `gemini-2.0-flash`: prompt / completion USD per 1M tokens
- `gemini-2.5-flash`
- `gemini-2.5-pro`

`usage_logs.meta.tokenBreakdown` 안의  
`{ model, promptTokens, candidatesTokens }[]` 를 읽어서,

- 총 비용(USD)
- 환율을 적용한 비용(KRW)

을 계산하고, 관리자 통계·KPI 화면에서 사용합니다.

---

## 5. 테스트 / 헬스체크

### 5-1. API 상태 점검 (`app/api/test-apis/route.ts`)

- **용도**: 운영자용 API 연결 상태 점검.
- **Gemini 관련**
  - `GoogleGenerativeAI(GEMINI_API_KEY)`를 이용해 `gemini-2.5-pro`로 간단한 프롬프트를 호출.
  - 연결 성공/실패 여부를 `results.tests.gemini`에 기록.
  - 별도로:
    - `hasGeminiKey`: 환경변수 존재 여부
    - `geminiKey`: 마스킹된 키 문자열

---

## 6. 프론트엔드 측 언급

### 6-1. 블로그 생성 화면 (`app/dashboard/BlogGenerator.tsx`)

- 프론트엔드에서 직접 Gemini를 호출하지는 않습니다.
- 주석으로 “실제 Gemini API 호출”이라고 적혀 있고,
  실제 모델 호출은 모두 **서버 라우트(`/api/generate`)**에서 처리합니다.

---

## 7. 요약

- **주요 텍스트 생성**
  - Q&A: `generate-qa`  
    - 플로우에 따라 `gemini-2.5-pro / 2.5-flash / 2.0-flash` 조합 사용.
  - 블로그·콘텐츠: `generate`  
    - `gemini-2.5-pro` 우선, 실패 시 `gemini-2.0-flash` + Grounding.

- **보조 생성·필드 생성**
  - `generate-question-from-product`, `generate-qa-field`  
    - `gemini-2.5-flash` 고정.

- **Vision·문서 분석**
  - `analyze-design-sheet`, `analyze-medical-image`, `parse-pdf*`  
    - Vision + Text 형태로 `2.5-pro / 2.5-flash / 2.0-flash` 조합 사용.

- **비용·KPI**
  - admin 통계·품질 KPI는 Gemini를 직접 호출하지 않고,  
    `usage_logs`에 기록된 `tokenBreakdown`을 기준으로 비용만 재계산.

- **헬스체크**
  - `test-apis`에서 `gemini-2.5-pro`로 연결 상태를 점검.

---

## 8. 오류·폴백 동작 개요

- **공통 헬퍼(`generate-qa`, `analyze-design-sheet` 등)** 에서는 다음 오류를 감지해 폴백합니다.
  - **모델 없음 / 잘못된 모델 이름**
    - `"Model not found"`, `"Invalid model"`, HTTP 404 등 포함 여부로 판단.
    - 현재 모델이 실패해도 다음 모델이 남아 있으면, **다음 모델로 즉시 폴백**.
  - **할당량·속도 제한 관련 오류**
    - `"429"`, `"quota"`, `"rate limit"`, `"Too Many Requests"`, `"Resource has been exhausted"`,  
      `"QuotaFailure"`, `"insufficient_quota"` 등 문자열 포함 여부로 판단.
    - 할당량 오류이고 다음 모델이 있으면:
      - 로그에 “할당량 초과 → 다음 모델 폴백”을 남기고,
      - **1초 대기 후 다음 모델 시도**.
  - **기타 실패**
    - 마지막 모델이 아니면 로그를 남기고 1초 대기 후 다음 모델로 시도.
    - 모든 모델이 실패하면  
      `모든 모델 시도 실패 (모델1 → 모델2 → …)` 형식의 에러를 throw.

- **현재 로그 기준 상태**
  - 첨부된 실제 호출 로그(설계서 분석 + Q&A 생성)에서는:
    - `gemini-2.5-flash`, `gemini-2.5-pro` 호출이 **모두 1회 시도에 성공**했고,
    - 위에 정의된 오류·폴백 분기(모델 없음/할당량 초과 등)는 **발동되지 않은 상태**입니다.
  - `usage_logs`에도 `tokenBreakdown`과 비용, 커스텀 서치 횟수 등이 정상적으로 기록되고 있습니다.

