# Q&A 생성기 개선 기능 TODO

이 문서는 보험 카페 Q&A 생성기에 추가할 개선 기능들을 기록합니다.
구현 시기: 추후 결정

---

## 🎯 우선순위 높음 (즉시 구현 가능)

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

