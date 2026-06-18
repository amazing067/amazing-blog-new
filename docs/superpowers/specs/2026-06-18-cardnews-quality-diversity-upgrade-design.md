# 카드뉴스 품질·다양성 업그레이드 설계

- 작성일: 2026-06-18
- 대상: 자동 생성 카드뉴스 파이프라인 (`lib/content/*`, `app/api/cron/daily-card`)
- 배경: 2026-06-18 생성된 "고지의무 위반, 5년 안에 발견되면 보험금 못 받는다" 카드가 5월 14일 생성본과 사실상 동일하게 나옴. 원인 분석 + 반송 사유 7건 분석을 바탕으로 한 종합 업그레이드.

---

## 1. 문제 진단 (근거)

### 1-1. "같은 카드 반복"의 구조적 원인 (3중)
- **원인 A — outline 하드코딩**: `lib/content/topics.ts:71-73`에서 주제 `claim-non-disc`의 `outline` 4개가 코드에 고정. 생성 프롬프트(`lib/content/generator-card.ts:126-162`)가 이 outline을 "다룰 핵심 포인트"로 그대로 주입 → 같은 주제 재선정 시 입력이 100% 동일.
- **원인 B — 30일 차단창**: `app/api/cron/daily-card/route.ts:31-42`가 최근 30일 사용 주제만 제외. 5/14→6/18은 35일 경과로 창을 벗어나 재선정됨. 주제 풀이 28개(`grep -c slug` 기준)뿐이라 약 한 달 주기로 반복.
- **원인 C — 회피 장치 부재**: 프롬프트에 과거 콘텐츠 회피 로직 없음. 캐싱·seed 고정 없음. `temperature: 0.85`라 글자 단위로만 달라지고 뼈대·메시지는 동일.

### 1-2. 현재 모델
- 본문(슬라이드) 생성: `claude-haiku-4-5` (temp 0.85, max 4096, seed 없음) — `generator-card.ts:304`
- 사후 팩트체크: `gemini-2.5-flash` + Google Search 그라운딩 (temp 0.2) — `fact-check.ts:59`
- → 최저가 모델(haiku)로 본문을 만들고 검증만 Gemini가 사후에 하는 구조.

### 1-3. 반송 사유 분석 (DB `content_items` status='returned' 7건 실측)
| 순위 | 유형 | 건수 | 실제 사유 예 |
|---|---|---|---|
| 1 | 통계·수치 출처/증빙 누락 | 5/7 | "어떤 수치인지 증빙·출처(기관·자료명·발표일자) 기재" |
| 2 | 사실/의학 정확성 오류 | 2 | "0기는 암이 아닐 수도(상피내암)", "실손 표준화 후 보장 동일한데 다르다고 함" |
| 3 | 광고심의 금지표현 | 2 | "'함정'은 손보협회 금지단어", "'마지막 기회/거절당하다' 공포 조장 불가" |
| 4 | 필수 유의문구 누락 | 2 | 비과세 세법요건/유니버셜 납입면제/태아보험 유의문구 |
| 5 | 상품 목적 오인 | 1 | "연금보험에 '저축' 표현 → 오인 소지" |

### 1-4. 핵심 모순 (방어장치가 있는데 반송됨)
- `verified-stats.ts`가 비어 있음(`VERIFIED_STATS = []`) → 출처 검증 카탈로그가 텅 비어 출처 누락 발행 → 반송 1위 직접 원인.
- `forbidden-terms.ts`에 "함정" 등 실제 금지어 누락 → 심의 표현 미차단.
- `fact-check.ts`가 생성 "이후"에만 작동, 통과만 시킴 → 틀린 정보가 슬라이드에 박힘.

---

## 2. 목표
- 반송 사유 5개 유형 재발 **0** 지향.
- 같은 주제 재생성 시 임베딩 유사도 **< 0.85**.
- 본문 모델을 A/B로 **객관 결정**.
- 각 Phase **독립 배포 가능**.

---

## 3. 설계 — 5개 Phase

진행 순서: **Phase 1 → Phase 2(A/B, 모델 결정 게이트) → Phase 3 → Phase 4 → Phase 5.**
Phase 2의 A/B 결과를 보고 본문 모델을 확정한 뒤 Phase 3·5를 그 모델 위에서 진행한다.

### Phase 1 — 반송 피드백 루프 + 금지어 강화 (코드만, 즉효)
1. **금지어 확장** `lib/content/forbidden-terms.ts`
   - 부정·비하: `함정`, `낚시`, `호구`, `사기`, `뒤통수`
   - 공포·다급: `마지막 기회`, `거절당하`, `늦기 전에`, `지금 아니면`, `더 늦으면`, 단정형 `못 받는다`
   - `compliance-lint.ts` 가중치에 반영, 30점 임계 초과 시 자동 반송.
2. **반송 사유 → 프롬프트 음성 주입** (핵심)
   - 소스: `content_items` where `status='returned' AND type='card'`, 같은 `category` 우선 + 전체 공통, 최근 **5건**.
   - `generator-card.ts`의 `PROMPT(topic)`에 `returnLessons` 블록 추가("과거 이런 이유로 반송됨 — 반드시 피하라").
3. **카테고리별 필수 유의문구** `lib/content/disclaimers.ts` (신규)
   - 연금·저축성: 비과세=세법요건 충족 시 / 유니버셜=납입면제·중도인출 경고
   - 태아·어린이: "태아보험=어린이보험+태아특약, 출생 후 보장"
   - 연금보험: "저축" 표현 금지(목적 오인)
   - 생성 규칙 + 후처리 검증 양쪽에 강제.
- 산출물: `forbidden-terms.ts` 확장, `disclaimers.ts` 신규, `generator-card.ts` 프롬프트 주입, `compliance-lint.ts` 가중치 보강.

### Phase 2 — 모델 A/B 하네스 (Opus 4.8 vs Gemini 2.5 Pro)  ★모델 결정 게이트
1. **형태**: `scripts/model-ab-card.ts`(1회성) + 정적 HTML 리포트. 운영 코드 미수정, 승자 결정 후에만 `generator-card.ts` 모델 교체.
2. **고정 테스트 세트 (주제 3개 × 2모델 = 카드 6개)**:
   - `claim-non-disc` 고지의무 5년 (이번 사건 당사자, 사실성 난이도)
   - 암·진단 1개 (0기 상피내암 — 의학 정확성)
   - 실손 1개 (표준화 보장 동일 — 사실 오류 빈발)
3. **자동 채점 지표**:
   - 사실성(★★★): `fact-check.ts` 통과율, high-severity 수
   - 출처 채움률(★★★): bigStat에 verified source 매핑된 슬라이드 비율
   - 금지어/심의(★★★): `compliance-lint.ts` 위험점수(낮을수록 우수)
   - 중복도(★★): 5월 기존 카드와 임베딩 유사도(낮을수록 우수)
   - 구조 준수(★★): `validateSlides()` 통과
   - 비용/지연(★): 토큰 단가×토큰, 생성 시간
   - 정성(★★★): HTML 좌우 나란히 — 사람이 톤·후킹 최종 판단
4. **산출물**: `scripts/model-ab-card.ts`, `model-ab-report.html`(좌 Opus/우 Gemini 슬라이드 + 지표표 + 종합점수), 결론 1줄("프로덕션 본문 모델 = ___ 채택").

### Phase 3 — 큐레이티드 팩트뱅크 (반송 1위 해결)
1. **채우는 방법**: `domain-researcher`/`deep-research`로 주제별 핵심 통계의 신뢰 출처 검증해 `verified-stats.ts` 채움.
   - 출처 화이트리스트: 공공기관(금감원·KIDI·심평원·통계청)·의학학회·대학병원·국제기관만. **URL 필수**, 클릭 검증 완료.
   - 항목: `keywords[]`, `stat`(≤6자), `label`(≤12자), `source{organization,name,url}`, `retrieved_at`.
   - 못 찾으면 숫자 없이 개념어로(기존 `BIG_STAT_RULES` 유지).
2. **작동 흐름**(기존 로직 유지, 카탈로그만 채움): AI source 후보 → `parseSource()` fuzzy 매칭 → 매칭 시 출처 표시, 미매칭 시 숫자 제거(환각 차단).
3. **범위**: 1차 확장된 주제 풀 중 통계 필요 주제 우선 20~30개. 유지: 분기 1회 URL 재검증 + 운영자 반송 시 카탈로그 추가 루프.
4. **산출물**: `verified-stats.ts` 20~30개, `docs/verified-stats-sources.md`(검증 메모).

### Phase 4 — 중복 해결 (주제 확장 + outline 변형 + pgvector)
1. **주제 풀 확장** `lib/content/topics.ts`: 28 → 60개+, 8개 카테고리 균형 유지.
2. **outline 변형** (핵심): `outline: string[]` → `outlineVariants: string[][]`(주제당 2~3개). `topic-picker.ts`가 최근 안 쓴 변형 선택. `types.ts`·`topic-picker.ts` 동반 수정.
3. **pgvector 유사도 가드**: `content_items`에 `embedding vector` 컬럼 + pgvector 확장(마이그레이션). 저장 시 본문(제목+슬라이드 텍스트)을 Gemini 임베딩(`text-embedding-004`)으로 벡터화. 새 카드 생성 후 기존 카드와 코사인 유사도 ≥0.9면 다른 outline 변형으로 1회 재생성, 그래도 높으면 스킵+로그.
4. **차단창 연장** `daily-card/route.ts`: 30일 → 60일.
- 산출물: `topics.ts`(60+) & `outlineVariants` 스키마 전환, pgvector 마이그레이션+임베딩/유사도 로직, 차단창 60일.

### Phase 5 — 2-pass 사실검증
1. **자가 교정 루프** `generator-card.ts` + `daily-card/route.ts`:
   1. (Phase 2 승자 모델)로 생성
   2. `fact-check.ts` 실행
   3. high-severity 발견 시 지적 내용을 프롬프트에 주입해 **최대 1회** 자동 재생성
   4. 재검증 통과 → 저장 / 여전히 high → `status='review'`로 두고 사유 기록.
   - 무한루프·비용 방지: 재생성 1회 상한.
- 산출물: 2-pass 파이프라인.

---

## 4. 테스트 전략
- **단위**: `compliance-lint`(금지어 점수), `parseSource`(매칭/환각 차단), `topic-picker`(변형 선택·중복 회피), 유사도 가드(임계값).
- **통합**: 생성→fact-check→재생성→저장 파이프라인을 mock 모델로.
- **회귀**: `scripts/regenerate-cards.ts`로 과거 카드 일부 재생성 → 반송 사유 재발 안 함 확인.

## 5. 롤아웃
- Phase별 독립 배포. 배포는 `git push origin main`만(Vercel CLI 금지 — 메모리 정책).
- Phase 1 배포 → 반송율 관찰 → Phase 2 A/B → 사장님 모델 결정 → 본문 모델 교체 배포 → Phase 3 → Phase 4(마이그레이션 포함) → Phase 5.

## 6. 성공 기준
- 반송 사유 5개 유형 재발 0.
- 같은 주제 재생성 시 유사도 < 0.85.
- A/B로 본문 모델 객관 결정 완료.

## 7. 비고 / 리스크
- Phase 4 pgvector 마이그레이션은 Supabase에 pgvector 확장 활성화 필요.
- 본문 모델 상향(Opus/Gemini Pro) 시 일일 생성 비용 증가 — A/B의 비용 지표로 가성비 판단.
- 임베딩 모델 호출 비용/지연 — 저장 시 1회만, 영향 미미.
