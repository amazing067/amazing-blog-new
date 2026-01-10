# Q&A 생성기 개선 기능 TODO

이 문서는 보험 카페 Q&A 생성기에 추가할 개선 기능들을 기록합니다.
구현 시기: 추후 결정

---

## 🎯 우선순위 높음 (즉시 구현 가능)

### 0. 상품명 기반 질문글 자동 생성 (신규 아이디어)
**현재 상태**: 상품명을 수동으로 입력하고, 질문글을 별도로 생성해야 함

**요구사항**:
- 상품명 입력 필드 옆에 "AI 완성" 버튼 추가
- 버튼 클릭 시:
  1. 해당 상품명으로 사람들이 많이 찾는 보험 질문 패턴 검색
  2. 해당 상품의 설계서 정보 검색
  3. 검색된 정보를 바탕으로 질문글(제목 + 본문) 자동 생성
  4. 생성된 질문글을 질문 입력 필드에 자동으로 채워넣기

**효과**: 
- 상품명만 입력하면 실제 고객들이 많이 하는 질문 패턴을 기반으로 질문글 자동 생성
- 설계서 정보까지 포함하여 더 현실적이고 구체적인 질문 생성
- 작업 시간 대폭 단축

**구현 방법**:

#### 1단계: API 엔드포인트 생성
- **파일**: `app/api/generate-question-from-product/route.ts` (신규)
- **기능**:
  1. 상품명을 받아서 Google Search API로 검색
     - 검색 쿼리: `"{상품명}" 질문 OR "{상품명}" 궁금 OR "{상품명}" 후기`
     - 검색 쿼리: `"{상품명}" 설계서 OR "{상품명}" 보장내용 OR "{상품명}" 특약`
  2. 검색 결과에서 질문 패턴 추출 (Gemini AI 활용)
  3. 설계서 정보 추출 (Gemini AI 활용)
  4. 추출된 정보를 바탕으로 질문글 생성 (Gemini AI 활용)
  5. 생성된 질문글 반환 (제목 + 본문)

#### 2단계: UI에 버튼 추가
- **파일**: `app/dashboard/BlogGenerator.tsx`
- **위치**: 상품명 입력 필드 옆 (5278-5288 라인 근처)
- **UI**:
  ```tsx
  <div className="flex gap-2">
    <input ... />
    <button
      onClick={handleAutoGenerateQuestion}
      disabled={!qaFormData.productName || isGeneratingQuestion}
      className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
    >
      {isGeneratingQuestion ? (
        <>
          <Clock className="w-4 h-4 animate-spin" />
          생성 중...
        </>
      ) : (
        <>
          <Wand2 className="w-4 h-4" />
          AI 완성
        </>
      )}
    </button>
  </div>
  ```

#### 3단계: 검색 및 생성 로직
- **검색 전략**:
  1. **질문 패턴 검색**:
     - `"{상품명}" 질문`
     - `"{상품명}" 궁금`
     - `"{상품명}" 후기`
     - `"{상품명}" 가입 고민`
  2. **설계서 정보 검색**:
     - `"{상품명}" 설계서`
     - `"{상품명}" 보장내용`
     - `"{상품명}" 특약`
     - `"{상품명}" 보험료`
  3. **검색 결과 분석** (Gemini AI):
     - 질문 패턴에서 자주 나오는 키워드 추출
     - 고객들의 주요 고민 포인트 파악
     - 설계서 정보에서 보장내용, 특약, 보험료 정보 추출
  4. **질문글 생성** (Gemini AI):
     - 추출된 정보를 바탕으로 자연스러운 질문글 생성
     - 기존 `qa-prompt-final.ts`의 질문 생성 로직 활용
     - 제목과 본문을 분리하여 반환

#### 4단계: 생성된 질문글 자동 입력
- 생성된 질문글을 `qaFormData`에 자동으로 채워넣기
- 제목은 별도 필드가 있다면 해당 필드에, 없으면 본문에 포함
- 사용자가 수정 가능하도록 함

**기술 스택**:
- Google Custom Search API (이미 구현됨: `lib/google-search.ts`)
- Gemini API (이미 사용 중)
- 기존 질문 생성 프롬프트 활용 (`lib/prompts/qa-prompt-final.ts`)

**예상 검색 쿼리 예시**:
```
"KB손해보험 금쪽같은자녀보험 Plus" 질문
"KB손해보험 금쪽같은자녀보험 Plus" 궁금
"KB손해보험 금쪽같은자녀보험 Plus" 후기
"KB손해보험 금쪽같은자녀보험 Plus" 설계서
"KB손해보험 금쪽같은자녀보험 Plus" 보장내용
```

**생성 결과 예시**:
```
제목: KB손해보험 금쪽같은자녀보험 Plus 가입 고민 있어요

본문:
안녕하세요 아이가 태어나서 자녀보험을 알아보고 있는데요
KB손해보험 금쪽같은자녀보험 Plus를 설계서 받아봤어요
보험료가 월 5만원 정도 되는데 이게 적당한 금액인지 궁금해요
보장내용도 충분한지 확인하고 싶어서요
다른 상품과 비교해서 어떤 점이 좋은지도 알려주시면 감사하겠습니다
```

**주의사항**:
- 검색 API 호출 비용 고려 (Google Custom Search API 무료 할당량: 일 100회)
- 검색 결과가 없을 경우 대체 로직 필요
- 생성된 질문글의 품질 검증 필요

**구현 위치**:
- `app/api/generate-question-from-product/route.ts` - 신규 API 엔드포인트
- `app/dashboard/BlogGenerator.tsx` - UI 버튼 및 핸들러 추가
- `lib/google-search.ts` - 기존 검색 유틸리티 활용

---

### 1. 판매 포인트 AI 자동 생성 강화
**현재 상태**: 수동 입력 또는 AI 완성

**개선 사항**:
- 설계서 분석 시 자동 추출
- 상품명 기반 웹 검색으로 최신 장점 수집
- 경쟁사 비교 포인트 자동 생성

**효과**: 더 정확하고 최신 정보 반영

**구현 위치**:
- `app/api/generate-qa-field/route.ts` - 판매 포인트 생성 로직 강화
- `app/dashboard/BlogGenerator.tsx` - 판매 포인트 자동 생성 버튼 개선

**기술 스택**:
- Gemini API (웹 검색 통합)
- Google Search API (최신 정보 수집)
- 경쟁사 비교 로직

---

## 🧪 테스트 필요 (검증 후 구현)

### 2. 대화 시나리오 시뮬레이션
**문제**: 대화 흐름 예측 어려움

**해결 방안**:
- 생성 전 대화 흐름 미리보기
- 단계별 예상 질문/답변 미리보기
- 시나리오 수정 후 재생성

**효과**: 원하는 대화 흐름 확보

**구현 위치**:
- `app/dashboard/BlogGenerator.tsx` - 시뮬레이션 UI 추가
- `lib/prompts/qa-prompt-final.ts` - 시나리오 생성 프롬프트 추가

**테스트 항목**:
- [ ] 시뮬레이션 정확도 검증
- [ ] 사용자 만족도 테스트
- [ ] 실제 대화와의 일치도 측정

---

### 3. 감정 분석 및 최적화
**문제**: 고객 감정 반영 어려움

**해결 방안**:
- 질문에서 감정 분석 (긍정/부정/중립)
- 감정에 맞는 답변 톤 자동 조정
- 감정 변화 추적 (의심→신뢰)

**효과**: 고객 공감도 향상

**구현 위치**:
- `app/api/generate-qa/route.ts` - 감정 분석 로직 추가
- `lib/prompts/qa-prompt-final.ts` - 감정 기반 톤 조정

**테스트 항목**:
- [ ] 감정 분석 정확도 검증
- [ ] 감정별 답변 톤 효과 측정
- [ ] 고객 반응 개선도 확인

---

## 🔍 검증 필요 (사용자 피드백 수집 후 구현)

### 4. 일괄 생성 기능
**문제**: 여러 상품 Q&A 일괄 생성 필요

**해결 방안**:
- CSV/Excel 업로드로 일괄 생성
- 상품 목록 기반 자동 생성
- 진행 상황 모니터링

**효과**: 대량 작업 효율화

**구현 위치**:
- `app/api/generate-qa-batch/route.ts` - 일괄 생성 API
- `app/dashboard/BlogGenerator.tsx` - 일괄 생성 UI
- `lib/utils/csv-parser.ts` - CSV 파서 유틸리티

**검증 항목**:
- [ ] 사용자 수요 조사
- [ ] 일괄 생성 품질 검증
- [ ] 성능 최적화 필요 여부

---

### 5. 소셜 미디어 최적화
**문제**: 카페 외 플랫폼 활용 어려움

**해결 방안**:
- 인스타그램/페이스북용 짧은 버전 생성
- 해시태그 자동 생성
- 이미지 포함 버전 생성

**효과**: 마케팅 채널 확대

**구현 위치**:
- `app/api/generate-qa-social/route.ts` - 소셜 미디어 버전 생성
- `app/dashboard/BlogGenerator.tsx` - 소셜 미디어 탭 추가
- `lib/prompts/social-media-prompt.ts` - 소셜 미디어 프롬프트

**검증 항목**:
- [ ] 소셜 미디어 사용자 수요 조사
- [ ] 각 플랫폼별 최적 형식 검증
- [ ] 해시태그 효과 측정

---

### 6. 고객 피드백 루프
**문제**: 생성된 Q&A 개선점 파악 어려움

**해결 방안**:
- 고객 피드백 수집 기능
- 피드백 기반 자동 개선
- 인기 Q&A 패턴 학습

**효과**: 지속적 품질 개선

**구현 위치**:
- `app/api/qa/feedback/route.ts` - 피드백 수집 API
- `app/dashboard/BlogGenerator.tsx` - 피드백 UI
- `lib/analytics/qa-patterns.ts` - 패턴 분석 로직

**검증 항목**:
- [ ] 피드백 수집 방법 검증
- [ ] 자동 개선 알고리즘 효과 측정
- [ ] 패턴 학습 정확도 확인

---

## 📋 구현 체크리스트

### 판매 포인트 AI 자동 생성 강화
- [ ] 설계서 분석 시 판매 포인트 자동 추출 로직 추가
- [ ] 상품명 기반 웹 검색 통합
- [ ] 경쟁사 비교 포인트 생성 로직 구현
- [ ] UI에 자동 생성 버튼 개선

### 대화 시나리오 시뮬레이션
- [ ] 시뮬레이션 프롬프트 작성
- [ ] 미리보기 UI 컴포넌트 구현
- [ ] 시나리오 수정 기능 추가
- [ ] 테스트 및 검증

### 감정 분석 및 최적화
- [ ] 감정 분석 API 통합
- [ ] 감정별 톤 조정 로직 구현
- [ ] 감정 변화 추적 기능 추가
- [ ] 테스트 및 검증

### 일괄 생성 기능
- [ ] CSV/Excel 파서 구현
- [ ] 일괄 생성 API 구현
- [ ] 진행 상황 모니터링 UI
- [ ] 사용자 수요 조사 및 검증

### 소셜 미디어 최적화
- [ ] 각 플랫폼별 프롬프트 작성
- [ ] 해시태그 생성 로직 구현
- [ ] 이미지 생성 기능 추가
- [ ] 사용자 수요 조사 및 검증

### 고객 피드백 루프
- [ ] 피드백 수집 시스템 구축
- [ ] 자동 개선 알고리즘 구현
- [ ] 패턴 분석 로직 개발
- [ ] 사용자 수요 조사 및 검증

---

## 🔗 관련 파일

- `lib/prompts/qa-prompt-final.ts` - Q&A 생성 프롬프트
- `app/api/generate-qa/route.ts` - Q&A 생성 API
- `app/api/generate-qa-field/route.ts` - 필드별 생성 API
- `app/dashboard/BlogGenerator.tsx` - Q&A 생성기 UI

---

## 📝 참고 사항

- 모든 기능은 기존 코드와의 호환성을 유지해야 함
- 테스트가 필요한 기능은 충분한 검증 후 배포
- 사용자 피드백을 지속적으로 수집하여 개선
- 성능 최적화를 고려한 구현 필요

---

---

## 🎯 상품명 자동완성 기능 (내일 개별 PDF 준비 후 구현)

### 목표
상품명을 더 다양하고 정확하게 자동으로 채워넣는 기능

### 선택된 아이디어: 하이브리드 방식 (아이디어 3)

**구조**:
1. 로컬 DB에 인기 상품명 저장 (빠른 자동완성)
2. DB에 없으면 웹 검색으로 보완
3. 검색 결과를 DB에 자동 저장 (학습)

**장점**:
- 빠른 응답 + 최신 정보
- 점진적 데이터 축적
- 비용 절감

### 구현 단계

#### 1단계: Supabase 테이블 생성
```sql
CREATE TABLE insurance_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  company TEXT,
  category TEXT,  -- 'damage' | 'life'
  keywords TEXT[],
  search_count INT DEFAULT 0,  -- 인기도 추적
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_name ON insurance_products(name);
CREATE INDEX idx_products_company ON insurance_products(company);
CREATE INDEX idx_products_category ON insurance_products(category);
```

#### 2단계: 자동완성 API 생성
- `/api/products/search?q=KB손해보험` → 상품명 목록 반환
- DB에서 먼저 검색, 없으면 웹 검색으로 보완

#### 3단계: UI에 자동완성 드롭다운 추가
- 상품명 입력 필드에 실시간 자동완성
- 선택 시 자동 입력

#### 4단계: 관리자 페이지에 상품명 관리 기능
- 상품명 추가/수정/삭제
- CSV 일괄 업로드

#### 5단계: 소식지 PDF 연동
- 개별 PDF 업로드 시 상품명 자동 추출
- 추출된 상품명을 DB에 자동 저장

### 관련 파일
- `app/api/products/search/route.ts` - 상품명 검색 API (신규)
- `app/api/products/route.ts` - 상품명 CRUD API (신규)
- `app/admin/products/page.tsx` - 상품명 관리 페이지 (신규)
- `app/dashboard/BlogGenerator.tsx` - 자동완성 UI 추가

### 참고 아이디어 (미선택)
- 아이디어 1: 웹 검색 기반 실시간 자동완성 (비용 높음)
- 아이디어 2: DB 기반만 (최신 정보 부족)
- 아이디어 4: Google Sheets 연동 (추가 설정 필요)
- 아이디어 5: 보험사 공식 API (제공 여부 불확실)

---

**마지막 업데이트**: 2025-01-XX
**작성자**: AI Assistant
**상태**: 대기 중 (내일 개별 PDF 준비 후 구현 예정)

