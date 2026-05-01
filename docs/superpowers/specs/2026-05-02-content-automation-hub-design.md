# Content Automation Hub — 설계서

- 작성일: 2026-05-02
- 작성자: induo@naver.com (amazing) + Claude
- 상태: 설계 승인 완료, 구현 계획 수립 직전
- 목적: 보험뉴스/블로그/인스타 카드뉴스를 매일 자동 또는 반자동으로 생성·심의·발행하는 관리자 전용 콘텐츠 허브 구축

---

## 1. 배경 및 목표

기존 amazing-biz-blog는 보험 카페 Q&A 자동 생성 시스템이다. 이 프로젝트는 카페 Q&A 외에 **블로그 글 / 인스타 카드뉴스 / 보험뉴스** 3종 콘텐츠를 매일 자동 또는 반자동으로 생산·발행하는 관리자 콘텐츠 허브를 추가한다.

### 핵심 제약 (사전 합의)

1. **보험설계사가 식별 가능한 상태로 SNS/블로그에 올리는 보험 콘텐츠는 사실상 거의 다 광고 심의 대상.** 카페 Q&A는 예외였으나, 이 프로젝트의 3개 채널은 심의 대상으로 설계한다.
2. **협회 광고심의(생보협/손보협) 자체는 자동화 불가.** 공식 API가 없고 사람이 협회 포털에 직접 제출해야 한다. 시스템은 심의 *주변* 단계만 자동화한다.
3. **네이버 블로그는 자동 포스팅 위험 (계정 정지·TOS 위반).** 반자동(다운로드 → 사람이 붙여넣기) 방식만 허용한다.
4. **인스타그램은 비즈니스 계정 + Facebook 페이지 + Graph API**로만 자동화한다.
5. **티스토리는 공식 API**로 완전 자동화 가능하다.

### 성공 기준

- 보험뉴스: open 모드에서 **하루 0분의 사람 작업으로 자동 발행**
- 블로그/카드뉴스: **콘텐츠당 약 5분** (협회 포털 PDF 업로드 + 심의번호 받아 어드민 입력)
- 모든 발행 결과는 감사 로그로 추적 가능
- 콘텐츠 다양성 보장 (반복적 표현·도입부 차단)

---

## 2. 채널별 운영 모델

| 채널 | 발행 방식 | 심의 처리 | 비고 |
|---|---|---|---|
| **보험뉴스** | 매일 자동 | open 모드: 광고 트리거 차단으로 협회 심의 면제 (정보성)<br>strict 모드: 심의번호 입력 후 자동 발행 | enforcement_mode 토글로 전환 가능 |
| **티스토리 블로그** | 완전 자동 (API) | 콘텐츠당 협회 심의 → 심의번호 입력 → 자동 발행 | 공식 OAuth |
| **인스타 카드뉴스** | 완전 자동 (Graph API) | 콘텐츠당 협회 심의 → 심의번호 입력 → 자동 발행 | 신규 비즈니스 계정 필요 |
| **네이버 블로그** | 반자동 (다운로드 → 사람이 붙여넣기) | 콘텐츠당 심의 → 심의번호 본문에 자동 삽입 후 다운로드 | Puppeteer 자동 로그인은 채택 안 함 |

### 운영 모델 (모델 3-C: 하이브리드 + 토글)

```
[보험뉴스]   open 모드 (default) — 광고 트리거 차단 → 자동 발행
            strict 모드 (toggle) — 심의번호 입력 후 자동 발행

[블로그·카드뉴스] AI 사전검수 → 심의 패키지 자동 PDF →
                  사람이 협회 제출(약 5분) → 심의번호 받기(수일~수주) →
                  어드민 입력(약 30초) → 자동 발행 (인스타·티스토리)
                                       또는 다운로드 (네이버)

[심의 만료] D-30 알림, 만료 시 자동 발행 정지
```

---

## 3. 시스템 아키텍처

```
┌────────────────────────────────────────────────────────────────────┐
│                  /admin/content  (관리자 전용 허브)                  │
│  ┌───────────┬──────────┬──────────┬──────────┬──────────────┐     │
│  │ 보험뉴스   │ 블로그   │ 카드뉴스 │ 채널/계정 │ 심의 라이브러리 │     │
│  └───────────┴──────────┴──────────┴──────────┴──────────────┘     │
└─────────────────────────────┬──────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
        [생성 파이프라인]  [심의 게이트]  [발행 디스패처]
                │             │             │
        ┌───────┼───────┐     │     ┌───────┼───────┐
        ▼       ▼       ▼     ▼     ▼       ▼       ▼
       뉴스   블로그   카드   AI    티스토리 인스타  네이버
       수집   생성기  렌더러  검수   어댑터   어댑터  다운로드
                              ↕
                            금지표현
                            룰엔진
```

---

## 4. 데이터 모델

### 4.1 `content_items` — 콘텐츠 단위

```sql
CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('news', 'blog', 'card', 'naver_blog')),
  title TEXT NOT NULL,
  body_md TEXT,                           -- 마크다운 본문
  body_html TEXT,                         -- 렌더 본문 (티스토리/인스타 캡션)
  image_urls TEXT[] DEFAULT '{}',         -- 첨부 이미지/카드 PNG
  source_refs JSONB DEFAULT '[]',         -- 원천 기사·데이터 메타
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','review','approved','published','expired','failed')),
  enforcement_mode TEXT NOT NULL DEFAULT 'open'
    CHECK (enforcement_mode IN ('open', 'strict')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON content_items (type, status);
CREATE INDEX ON content_items (scheduled_at) WHERE status = 'approved';
```

### 4.2 `compliance_records` — 심의 정보 (1:N — 동일 콘텐츠를 여러 채널에서 다른 심의로 발행 가능)

```sql
CREATE TABLE compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  compliance_number TEXT NOT NULL,         -- "제2026-XXXX호"
  authority TEXT NOT NULL
    CHECK (authority IN ('internal','klia','gia')),  -- 사내/생보협/손보협
  approved_at DATE NOT NULL,
  expires_at DATE NOT NULL,                -- 보통 approved_at + 1년
  document_url TEXT,                       -- 심의 통과서 PDF 저장 위치
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON compliance_records (content_id);
CREATE INDEX ON compliance_records (expires_at);
```

### 4.3 `channel_credentials` — 채널 자격증명 (암호화 저장)

```sql
CREATE TABLE channel_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL
    CHECK (channel IN ('tistory','instagram','threads')),
  account_name TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,    -- AES-256, key from env
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ
);
```

### 4.4 `publish_jobs` — 발행 큐

```sql
CREATE TABLE publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,                   -- tistory|instagram|naver_export
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','publishing','done','failed','cancelled')),
  result_url TEXT,                         -- 발행 후 URL
  error TEXT,
  attempt_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX ON publish_jobs (status, scheduled_at);
```

### 4.5 `compliance_lints` — AI 사전검수 결과

```sql
CREATE TABLE compliance_lints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  forbidden_terms_found TEXT[] DEFAULT '{}',  -- ["최고","유일","100%",...]
  comparison_phrases TEXT[] DEFAULT '{}',
  risk_score INT,                              -- 0-100
  must_fix BOOLEAN DEFAULT FALSE,
  raw_report JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. 주요 모듈

| 모듈 | 위치 | 역할 |
|---|---|---|
| `news-collector` | `lib/content/news-collector.ts` | RSS/검색 → 후보 기사 수집·중복 제거 |
| `content-generator` | `lib/content/generator.ts` | 뉴스/블로그/카드 본문 생성 (모델 라우팅) |
| `card-renderer` | `lib/content/card-renderer.ts` | HTML/CSS 템플릿 + html2canvas → 1080×1080 PNG |
| `compliance-lint` | `lib/content/compliance-lint.ts` | 금지표현 룰엔진 + AI 검수 |
| `compliance-pdf` | `lib/content/compliance-pdf.ts` | 협회 제출용 패키지 PDF 생성 (jspdf 사용) |
| `channels/tistory` | `lib/channels/tistory.ts` | 티스토리 OAuth + 발행 |
| `channels/instagram` | `lib/channels/instagram.ts` | Graph API 발행 (캐러셀 카드뉴스 지원) |
| `channels/naver-export` | `lib/channels/naver-export.ts` | 네이버용 본문 .md + 이미지 zip |
| `dispatcher` | `app/api/cron/publish/route.ts` | 큐 소비 + 발행 + 심의번호 자동 삽입 |
| `daily-builder` | `app/api/cron/daily-build/route.ts` | 매일 새벽 초안 자동 생성 |
| `compliance-expiry-checker` | `app/api/cron/compliance-check/route.ts` | 심의 만료 알림·자동 정지 |

### 5.1 LLM 모델 라우팅 (생성 모듈)

- **보험뉴스 본문 / 블로그 긴 본문 → Gemini 2.5 Pro/Flash** (비용 우선, 기존 인프라 일관)
- **카드뉴스 슬라이드 카피 → Claude Haiku 4.5** (짧은 카피 다양성, 사용자 다양성 민감도 고려)
- **고품질 헤드라인/CTA 필요 시 → Claude Sonnet 4.6** 옵션 (수동 트리거)

### 5.2 카드뉴스 시각 렌더링

- **AI 이미지 생성은 금지** (한글 텍스트가 깨짐 — DALL·E/Imagen/Midjourney 공통 한계)
- HTML/CSS 템플릿 5~10종 → 본문 텍스트 주입 → `html2canvas`로 1080×1080 PNG 출력
- 폰트: Pretendard 또는 NotoSansKR
- 브랜드 색상·로고 자동 적용

---

## 6. 핵심 워크플로우

### 6.1 보험뉴스 — open 모드

```
[매일 06:00 Vercel Cron]
  → news-collector: RSS 3~5개 + 네이버 보험 검색 RSS에서 어제 기사 수집
  → 중복 제거 (제목+첫문단 해시 + 임베딩 유사도)
  → content-generator (Gemini): 정보성 톤 요약 (1건당 600~900자)
  → compliance-lint (STRICT 광고용어 차단):
      - 금지어 발견 → 자동 status='review' (사람 검수)
      - 금지어 없음 → status='approved'
  → publish_jobs에 06:30 발행 예약 (티스토리)

[06:30 Vercel Cron]
  → dispatcher: status='approved' AND scheduled_at<=now() 인 publish_jobs 처리
  → 티스토리 어댑터 호출 → 발행 → result_url 저장 → status='published'
```

### 6.2 블로그·카드뉴스 — strict 모드

```
[관리자가 어드민에서 "글 만들기" / "카드뉴스 만들기"]
  → content-generator: 본문/카피 생성 (Gemini 또는 Claude Haiku)
  → 카드뉴스인 경우 card-renderer: PNG 생성
  → compliance-lint: AI 사전검수 + 금지어 룰엔진
  → 어드민 미리보기

[관리자 클릭: "심의 패키지 다운로드"]
  → compliance-pdf: 본문 + 출처 + 작성자 + 이미지 → 협회 양식 PDF
  → 관리자가 협회 포털에 직접 제출 (시스템 외부)

[심의번호 발급 후 관리자가 어드민에서 입력]
  → compliance_records insert (number, authority, approved_at, expires_at)
  → 시스템이 본문 끝에 "심의필 제2026-XXXX호 (~2027-MM-DD)" 자동 삽입
  → publish_jobs에 예약 시각으로 큐 추가

[예약 시각 도래]
  → dispatcher: 채널별 어댑터 호출
  → 인스타: Graph API (캐러셀 업로드)
  → 티스토리: OAuth API
  → 네이버: zip 다운로드 링크 발급 (관리자가 받아서 직접 게시)
```

### 6.3 심의 만료 추적

```
[매일 09:00 Vercel Cron — compliance-expiry-checker]
  → expires_at 기준:
      - D-30 → 어드민 알림 배지
      - D-7  → 강조 알림
      - D 도래 → 해당 콘텐츠의 미래 publish_jobs 자동 cancel,
                content_items.status='expired'
```

### 6.4 enforcement 토글

- 어드민 설정 페이지에 `news.enforcement_mode` 토글 (open/strict)
- `strict`로 전환 시:
  - 신규 보험뉴스는 6.2 흐름(심의번호 입력 후 발행)을 따름
  - 기존 큐의 미발행 항목은 처리 정책 선택지 제공 (즉시 보류 vs 그대로 발행)

---

## 7. 첫 스프린트 범위 (보험뉴스 채널 MVP)

### 만들 것

- DB 스키마 4개 테이블 (`content_items`, `compliance_records`, `channel_credentials`, `publish_jobs`) + RLS
- `/admin/content/news` 페이지 (목록 / 미리보기 / 승인 / 발행 상태)
- `news-collector` v1 (RSS 3~5개 소스 + Gemini 요약)
- `compliance-lint` 룰엔진 v1 (금지표현 50개 + 비교표현 패턴)
- `enforcement_mode` 토글 (어드민 설정)
- **티스토리 어댑터** (인스타·네이버는 다음 스프린트)
- 일일 Cron 2개:
  - `/api/cron/daily-build` (매일 06:00, 인증 헤더)
  - `/api/cron/publish` (매 5분, 큐 소비)
- 채널 자격증명 암호화 저장 + 어드민 등록 UI (티스토리 OAuth 연동)

### 안 만들 것 (다음 스프린트)

- 인스타 어댑터, 네이버 다운로드, 카드 렌더러
- 블로그 시리즈 생성기, 협회 PDF 패키지(이건 카드/블로그 스프린트와 함께)
- 심의 만료 체커 (보험뉴스 open 모드는 심의번호 없으므로 다음 스프린트로)

### 예상 기간

4~6일

---

## 8. 보안·운영

- **자격증명**: AES-256-GCM 암호화, 키는 `CHANNEL_CRED_SECRET` 환경변수
- **어드민 권한**: 기존 `lib/auth/permissions.ts`의 `admin` 롤만 접근 (`/admin/content/*` 라우트 보호)
- **Vercel Cron 인증**: `Authorization: Bearer ${CRON_SECRET}` 헤더 검증
- **감사 로그**: `publish_jobs`에 시도 횟수·결과 URL·에러 보존
- **비용 통제**: `daily-builder`는 일 생성량 상한 (channel별 default 5건/일)
- **Gemini 호출 시 광고 금지표현 system prompt에 명시** — 생성 단계부터 차단

---

## 9. 외부 시스템 셋업 (사용자 작업 필요, 시스템 외부)

1. **티스토리 OAuth 앱 등록** → Client ID/Secret 발급 → 어드민 채널 등록 화면에서 OAuth 플로우
2. **Instagram 비즈니스 계정 신규 생성** + Facebook 페이지 생성 + 연결 → Meta for Developers 앱 → Long-Lived Token 발급
3. **RSS 소스 확정** (현재 후보: 한국보험신문, 보험매일, 인슈넷, 네이버 보험 검색 RSS) — 첫 스프린트 시작 전 확정

---

## 10. 미해결·이후 결정 사항

- 첫 스프린트 enforcement_mode 기본값을 `open`으로 시작할지, `strict`로 시작할지 — 첫 스프린트 시작 전 1회 확인
- RSS 소스 최종 확정 (위 후보 중)
- 카드뉴스 디자인 템플릿 — 첫 카드뉴스 스프린트 시작 시 디자인 시안 별도
- 향후: 다중 작성자(설계사별 계정) 운영 모델 고려할지 — 지금은 어드민 1명 모델

---

# 부록 A — 첫 스프린트 실행 가이드 (내일 그대로 시작)

## A.1 사용할 Skills (순서대로)

| 단계 | Skill | 목적 |
|---|---|---|
| 1 | `superpowers:writing-plans` | 본 사양서를 기반으로 첫 스프린트 구현 계획서 작성 (작업 단위로 쪼갠 plan.md 생성) |
| 2 | `superpowers:test-driven-development` | 핵심 로직(compliance-lint, news-collector 중복 제거, dispatcher) TDD로 작성 |
| 3 | `superpowers:executing-plans` | plan.md 따라 순서대로 구현, 체크포인트마다 검증 |
| 4 | `superpowers:verification-before-completion` | "완료" 선언 전 모든 cron·발행·검수 동작 실제 실행으로 검증 |
| 5 | `supabase:supabase` (필요 시) | Supabase 마이그레이션·RLS 작성 |
| 6 | `vercel:vercel-functions` (필요 시) | Vercel Cron 설정·인증 헤더 패턴 확인 |
| 7 | `commit-commands:commit` | 단계별 커밋 |

**시작 트리거**: 내일 세션에서 사용자가 "어제 사양서 그대로 가자" 라고 하면 → `superpowers:writing-plans` 호출 → 본 사양서 경로 참조 → 첫 스프린트 plan 작성 → 사용자 승인 → `superpowers:executing-plans` 진입.

## A.2 첫 스프린트 작업 목록 (순서대로)

### Step 1 — 환경 준비 (0.5일)
- [ ] Supabase 마이그레이션 작성 (`supabase/migrations/2026XXXX_content_hub.sql`)
- [ ] 4개 테이블 생성 + RLS 정책 (admin만 read/write)
- [ ] 환경변수 설계 (부록 B 참조)
- [ ] `lib/content/` 디렉터리 골격 생성

### Step 2 — 룰엔진 + 검수 로직 (1일, TDD)
- [ ] `lib/content/forbidden-terms.ts` — 금지표현 50개 사전 (+ 변형 정규식)
- [ ] `lib/content/compliance-lint.ts` — 룰엔진 (테스트 먼저)
- [ ] 비교표현 패턴 검출 ("가장", "최고", "유일", "100%", "확실히", "보장된" 등 + 다른 회사명 비교)
- [ ] 단위 테스트: 각 패턴이 올바르게 검출/통과되는지

### Step 3 — 뉴스 수집기 (1일)
- [ ] `lib/content/rss-fetcher.ts` — RSS 파싱 (xml2js 또는 fast-xml-parser)
- [ ] `lib/content/news-collector.ts` — 다중 소스 수집 + 중복 제거 (제목+첫문단 SHA256, 1주일 윈도우)
- [ ] `lib/content/generator.ts` — Gemini 호출 래퍼 (정보성 톤 system prompt, 광고용어 차단 명시)
- [ ] 환경변수: `GEMINI_API_KEY`, RSS URL 목록

### Step 4 — 어드민 페이지 (1.5일)
- [ ] `app/admin/content/layout.tsx` — 어드민 레이아웃 (admin 롤 가드)
- [ ] `app/admin/content/news/page.tsx` — 뉴스 목록 (status별 필터)
- [ ] `app/admin/content/news/[id]/page.tsx` — 미리보기 + 승인/거절/수정 + lint 결과 표시
- [ ] `app/admin/content/settings/page.tsx` — `enforcement_mode` 토글
- [ ] `app/api/admin/content/news/route.ts` — CRUD API
- [ ] `app/api/admin/content/news/[id]/approve/route.ts` — 승인 액션

### Step 5 — 티스토리 어댑터 (1일)
- [ ] `lib/channels/tistory.ts` — OAuth 토큰 교환 + 글 발행 API 호출
- [ ] `app/api/admin/channels/tistory/oauth/start/route.ts` — OAuth 시작
- [ ] `app/api/admin/channels/tistory/oauth/callback/route.ts` — 콜백 + 토큰 저장 (암호화)
- [ ] `lib/crypto.ts` — AES-256-GCM 암복호화 (env: `CHANNEL_CRED_SECRET`)
- [ ] 환경변수: `TISTORY_CLIENT_ID`, `TISTORY_CLIENT_SECRET`

### Step 6 — Cron 워크플로우 (0.5일)
- [ ] `app/api/cron/daily-build/route.ts` — 매일 06:00, 인증 헤더 검증, 수집·생성·검수·큐 등록
- [ ] `app/api/cron/publish/route.ts` — 매 5분, 큐 소비, 티스토리 발행, 결과 저장
- [ ] `vercel.json` 또는 `vercel.ts` cron 설정 (현재 프로젝트의 cron 패턴 따라가기)
- [ ] 환경변수: `CRON_SECRET`

### Step 7 — 통합 검증 (0.5일)
- [ ] 수동 트리거로 daily-build 1회 실행 → 어드민에서 결과 확인
- [ ] 1건 승인 → publish cron 수동 트리거 → 티스토리에 실제 발행 확인
- [ ] 금지어 포함 콘텐츠가 review로 빠지는지 확인
- [ ] enforcement_mode 토글 후 동작 변경 확인

## A.3 파일 트리 (생성될 파일)

```
app/
  admin/content/
    layout.tsx
    news/
      page.tsx
      [id]/page.tsx
    settings/
      page.tsx
  api/
    admin/
      content/news/route.ts
      content/news/[id]/approve/route.ts
      channels/tistory/oauth/start/route.ts
      channels/tistory/oauth/callback/route.ts
    cron/
      daily-build/route.ts
      publish/route.ts
lib/
  content/
    forbidden-terms.ts
    compliance-lint.ts
    rss-fetcher.ts
    news-collector.ts
    generator.ts
  channels/
    tistory.ts
  crypto.ts
supabase/migrations/
  2026XXXX_content_hub.sql
vercel.ts (또는 vercel.json — 기존 프로젝트 컨벤션 따름)
```

## A.4 모듈별 코드 로직 개요

### `lib/content/forbidden-terms.ts`
```ts
// 금지표현 카테고리 + 정규식 패턴 export
export const ABSOLUTE_TERMS = [
  '최고', '유일', '제일', '단연', '독보적',
  '100%', '완벽', '확실', '절대', '무조건',
  // ... 총 50개
];
export const COMPARISON_PATTERNS = [
  /다른 (회사|보험사)보다/,
  /타사 대비/,
  /업계 (최(저|고)|최초|유일)/,
  // ...
];
export const GUARANTEE_TERMS = ['보장됩니다', '확실히 받을 수 있', /* ... */];
```

### `lib/content/compliance-lint.ts`
```ts
type LintResult = {
  forbidden_terms_found: string[];
  comparison_phrases: string[];
  risk_score: number;        // 0-100
  must_fix: boolean;          // true면 자동 review로 보냄
  suggestions: string[];
};
export function lintContent(text: string): LintResult { /* ... */ }
```
- 단순 substring 매칭 + 정규식
- score = (forbidden 개수 × 20) + (comparison 개수 × 15), cap 100
- must_fix = score >= 30

### `lib/content/rss-fetcher.ts`
```ts
export async function fetchRSS(url: string): Promise<RSSItem[]> {
  // fetch → fast-xml-parser → 정규화된 RSSItem[] 반환
}
```

### `lib/content/news-collector.ts`
```ts
export async function collectDailyNews(): Promise<CandidateArticle[]> {
  // 1. 모든 RSS 소스 fetch (Promise.all)
  // 2. 어제~오늘 날짜 필터
  // 3. SHA256(title + first200chars) 해시로 중복 제거
  //    → DB의 최근 7일 source_refs와 대조
  // 4. CandidateArticle[] 반환
}
```

### `lib/content/generator.ts`
```ts
export async function generateNewsSummary(
  article: CandidateArticle,
  mode: 'open' | 'strict'
): Promise<{ title: string; body_md: string; }> {
  // Gemini 2.5 Flash 호출
  // system prompt에 광고 금지표현·비교표현 명시 (open 모드는 더 엄격)
  // 600~900자, 정보성 톤
}

// 카드뉴스용 (다음 스프린트, 본 스프린트에선 미사용)
export async function generateCardCopy(/* ... */) {
  // Claude Haiku 4.5 호출
}
```

### `lib/channels/tistory.ts`
```ts
export async function publishToTistory(
  cred: ChannelCredentials,
  content: ContentItem
): Promise<{ url: string }> {
  // 1. 토큰 복호화
  // 2. POST https://www.tistory.com/apis/post/write
  //    title, content, blogName, visibility=3 (공개)
  // 3. 응답에서 URL 추출
}
```

### `lib/crypto.ts`
```ts
export function encrypt(plaintext: string): string { /* AES-256-GCM */ }
export function decrypt(ciphertext: string): string { /* ... */ }
// key = process.env.CHANNEL_CRED_SECRET (32 bytes hex)
```

### `app/api/cron/daily-build/route.ts`
```ts
export async function GET(req: Request) {
  // 1. 인증 헤더 검증 (Bearer ${CRON_SECRET})
  // 2. settings에서 enforcement_mode 조회
  // 3. collectDailyNews()
  // 4. 각 후보에 대해:
  //    - generateNewsSummary(article, mode)
  //    - lintContent(body)
  //    - mode='open' && !lint.must_fix → status='approved' + publish_jobs 등록(06:30)
  //    - 그 외 → status='review'
  // 5. 결과 요약 반환
}
```

### `app/api/cron/publish/route.ts`
```ts
export async function GET(req: Request) {
  // 1. 인증 헤더 검증
  // 2. publish_jobs WHERE status='queued' AND scheduled_at <= NOW() LIMIT 10
  // 3. 각 job:
  //    - status='publishing'
  //    - content_items + compliance_records (있으면) 조회
  //    - 본문 끝에 심의번호 자동 삽입 (있는 경우)
  //    - channel별 어댑터 호출
  //    - status='done' + result_url 또는 status='failed' + error
  //    - attempt_count 증가, 3회 실패 시 영구 실패
}
```

### `app/admin/content/news/page.tsx`
```tsx
// Server Component
// - status 탭: review | approved | published | all
// - 테이블: 제목, 생성일, 출처, lint risk, 상태
// - 행 클릭 → /admin/content/news/[id]
```

### `app/admin/content/news/[id]/page.tsx`
```tsx
// 미리보기 + lint 결과 (forbidden_terms_found 하이라이트)
// 액션: [승인 → approved + 큐 등록] [거절 → expired] [본문 수정 후 재검수]
// 출처 링크 표시
```

## A.5 DB RLS 정책 (요약)

```sql
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_lints ENABLE ROW LEVEL SECURITY;

-- 모든 테이블: admin 롤만 SELECT/INSERT/UPDATE/DELETE
-- service_role은 cron 함수에서 우회 (server-side)
CREATE POLICY admin_all_content ON content_items
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');
-- (다른 테이블도 동일 패턴, 마이그레이션에 모두 명시)
```

---

# 부록 B — 환경변수 체크리스트

| 변수 | 용도 | 첫 스프린트 필수 |
|---|---|---|
| `GEMINI_API_KEY` | 뉴스 요약 생성 | ✅ (기존 사용 중) |
| `ANTHROPIC_API_KEY` | (다음 스프린트 카드뉴스용 Claude Haiku) | ⬜ |
| `SUPABASE_URL` | DB | ✅ (기존) |
| `SUPABASE_SERVICE_ROLE_KEY` | cron 서버측 | ✅ (기존) |
| `CRON_SECRET` | Vercel Cron 인증 헤더 | ✅ (신규) |
| `CHANNEL_CRED_SECRET` | 채널 토큰 AES 암호화 키 (32 bytes hex) | ✅ (신규) |
| `TISTORY_CLIENT_ID` | OAuth | ✅ (신규) |
| `TISTORY_CLIENT_SECRET` | OAuth | ✅ (신규) |
| `TISTORY_REDIRECT_URI` | OAuth 콜백 | ✅ (신규) |
| `RSS_SOURCES` | 콤마 구분 RSS URL (또는 코드에 상수) | ✅ (신규) |
| `INSTAGRAM_*` | (다음 스프린트) | ⬜ |
| `META_GRAPH_TOKEN` | (다음 스프린트) | ⬜ |

---

# 부록 C — 사용자 외부 작업 체크리스트 (시스템과 병행)

## 첫 스프린트 시작 전 (당일 작업)
- [ ] 티스토리 OAuth 앱 등록 → Client ID / Secret 발급
  - https://www.tistory.com/guide/api/manage/register
  - 콜백 URL: `https://<your-domain>/api/admin/channels/tistory/oauth/callback`
- [ ] RSS 소스 최종 확정 (4개 후보 중)
- [ ] enforcement_mode 시작값 확정 (`open` 추천)

## 다음 스프린트(인스타) 시작 전 — 시간 여유 있을 때 미리
- [ ] 인스타그램 계정 신규 생성 (브랜드명, 이메일 새로 만드는 것 추천)
- [ ] 프로페셔널 → 비즈니스 전환
- [ ] Facebook 페이지 생성 (같은 브랜드명)
- [ ] 인스타 ↔ Facebook 페이지 연결
- [ ] [Meta for Developers](https://developers.facebook.com) 앱 등록
- [ ] Instagram Graph API 권한 신청 → Long-Lived Token 발급
- [ ] 토큰을 어드민 채널 등록 화면에서 입력 (자동 암호화 저장)

---

# 부록 D — 내일 세션 시작 프롬프트 예시

> "어제 사양서(`docs/superpowers/specs/2026-05-02-content-automation-hub-design.md`) 그대로 첫 스프린트 시작하자. enforcement_mode 기본값은 open으로, RSS는 한국보험신문/보험매일/인슈넷 3개로 시작하자."

→ 이 문장이 들어오면 즉시 `superpowers:writing-plans` 스킬을 호출해서 본 사양서의 부록 A.2 단계를 plan.md로 변환하고, 사용자 승인 후 `superpowers:executing-plans`로 진입.
