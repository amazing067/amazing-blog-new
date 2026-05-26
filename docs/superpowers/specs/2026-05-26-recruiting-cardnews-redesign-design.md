# 리쿠르팅 카드뉴스 리디자인 — 설계 문서

- 날짜: 2026-05-26
- 브랜치(예정): `feat/recruiting-content` 위에서 작업
- 관련: [[recruiting_content_track]], `2026-05-25-recruiting-content-framework-design.md`

## 1. 배경 — 해결할 3가지 문제

현재 리쿠르팅 카드뉴스(`RecruitStyle.tsx` v5)의 사용자 지적 3가지:

1. **색이 너무 다채로움** — `theme(index + colorOffset)`(`RecruitStyle.tsx:142`)가 7색 풀채도 팔레트를 슬라이드 index로 인덱싱 → **한 세트 7장이 무지개를 한 바퀴** 돈다. 브랜드가 안 잡히고 산만·유치. 2030 신뢰 카테고리와 반대 신호.
2. **가독성 나쁨** — ⓐ 제목·전부 Black Han Sans(헤비 일색, 긴 문장 뭉침), ⓑ 본문이 `t.sub`(저투명도 잉크)라 풀채도 배경 위 대비 부족, ⓒ 텍스트 뒤 노이즈/하프톤/워터마크가 가독성 깎음(`Deco`, `IconWatermark`), ⓓ 줄간격 1.02로 빡빡, ⓔ 타입 스케일 무규칙.
3. **사례에 이미지 부족** — 이미지는 커버(`bgImage`)에만 있고(`generate/route.ts:47`), 정작 "사례" 슬라이드(통념·증거)는 텍스트+아이콘뿐.

세 문제의 공통 뿌리: 카드가 **"시끄럽게"**에 최적화 → 필요한 건 **"신뢰감 있고 또렷하게"**.

## 2. 목표 / 비목표

**목표**
- 한 세트는 색이 통일되되 단조롭지 않게(쿨톤 인접색 + 뉴트럴 + 악센트 1색).
- 본문 가독성 대폭 개선(폰트 역할 분리·고대비·줄간격·노이즈 제거).
- 사례 카드(통념·증거)와 커버에 **듀오톤 사진** 추가. 스톡으로 시작, AI 생성으로 확장 가능한 구조.
- 인포그래픽(비교·강점) 카드가 **레이아웃을 꽉 채움**(빈 공간 X, 넘침 X), 글자 auto-fit.
- 1:1(1080×1080) 종횡비 유지(이미 시스템 기본).

**비목표(이번 범위 아님)**
- AI 이미지 생성 파이프라인 실제 구현(인터페이스만 열어두고 추후).
- 보험용(비-리쿠르팅) 카드 스타일 변경 — `RecruitStyle.tsx`만 건드림.
- 카드 cron 자동화(Phase 2 그대로).
- 세트 간 웜톤/그린/퍼플 변주(아키텍처는 허용하되 v1은 쿨톤만).

## 3. 확정된 디자인 결정

| 항목 | 결정 |
|------|------|
| 색 방향 | **A: 블루·틸·크림(뉴트럴) + 옐로 악센트.** 인접 쿨톤 통일, 풀채도 커버 |
| 카드 수 | **6장** (기존 7장에서 잉여 "중간 CTA" 제거) |
| 종횡비 | **1:1 (1080×1080)** — 이미 시스템 기본, 유지 |
| 타이포 | **하이브리드** — 커버 제목만 Black Han Sans(후킹), 본문은 Pretendard(800 제목 / 500 본문), 고대비·줄간격 1.5, 노이즈 제거 |
| 이미지 처리 | **듀오톤**(흑백 + 브랜드색 틴트 + 하단 그라데이션 + 흰 텍스트) |
| 이미지 소스 | **스톡 먼저**(큐레이션·로컬 번들), provider 구조로 AI 추후 드롭인 |
| 이미지 범위 | **커버·통념·증거(1·3·5)** 듀오톤 사진 ↔ 비교·강점(2·4) 크림 인포그래픽 교차 |

## 4. 6장 구조 & 카드별 사양

기존 7장(`generator-recruit-card.ts`의 `STRUCTURE`)에서 **point 05(중간 CTA) 제거** → 6장.

| # | kind / role | 배경 | 폰트(제목) | 이미지 | 듀오톤 틴트 |
|---|------|------|-----------|--------|------------|
| 1 | cover | 듀오톤 사진 | Black Han Sans | ✅ | 블루 `#1E5BFF` |
| 2 | point 01 · compare(비교) | 크림 `#F1ECE0` | Pretendard 800 | ❌ 인포그래픽 | — |
| 3 | point 02 · 통념깨기 | 듀오톤 사진 | Pretendard 800 | ✅ | 틸 `#0E9AA7` |
| 4 | point 03 · grid(강점) | 크림 `#F1ECE0` | Pretendard 800 | ❌ 아이콘 2×2 | — |
| 5 | point 04 · 증거·사람 | 듀오톤 사진 | Pretendard 800 | ✅ | 딥블루 `#14307A` |
| 6 | closing · CTA | 비비드 틸 `#08AEBD` | Black Han Sans | ❌ | — |

리듬: **사진(채도)↔크림(차분)** 교차. 크림이 글·아이콘 많은 인포그래픽 카드로 가서 가독성 담당, 사진이 채도·이미지 담당.

## 5. 아키텍처 — 변경/신규 파일

### 5.1 `lib/content/recruit-color.ts` (대폭 변경)
- 현재 `recruitColorOffset` + 7색 무지개 인덱싱 **폐기**.
- 신규: **세트 단위 스킴(scheme) + 카드 역할(role) 기반 토큰**.
  ```ts
  export type RecruitRole = 'cover'|'compare'|'breakthrough'|'grid'|'evidence'|'closing';
  export type RecruitToken = { bg: string; ink: string; sub: string; accent: string; accentInk: string;
                               isPhoto: boolean; tint?: string };
  export type RecruitScheme = Record<RecruitRole, RecruitToken>;
  // 카드 index(0~5) → role 매핑은 고정. 한 세트는 한 scheme.
  export function recruitScheme(seed: string): RecruitScheme;  // v1은 쿨톤 스킴 1~2종(seed로 약한 변주)
  export function roleForIndex(i: number): RecruitRole;        // 0=cover,1=compare,2=breakthrough,3=grid,4=evidence,5=closing
  ```
- v1 쿨 스킴(블루/틸/크림/옐로) 토큰은 §7. **세트 간 변주**는 쿨톤 내 2~3 스킴(예: 블루-주도 vs 틸-주도)을 seed로 선택 — 무지개 아님.

### 5.2 `app/admin/content/card-preview/styles/RecruitStyle.tsx` (대폭 변경)
- `PALETTE`/`theme(index+offset)` 제거 → `recruitScheme(seed)` + `roleForIndex(index)`로 토큰 결정.
- **노이즈/하프톤 제거**: `Deco`의 fractalNoise·halftone·`IconWatermark`(텍스트 뒤) 삭제. 장식은 텍스트와 안 겹치는 선에서 최소만(또는 제거).
- **타이포 역할 분리**: 커버 제목 = `DISPLAY`(Black Han Sans). 그 외 제목·본문 = Pretendard. 본문 색은 `ink` 풀불투명(저투명도 `sub`는 보조 라벨에만). 줄간격: 제목 1.12~1.18 / 본문 1.5. §8 스케일 적용.
- **듀오톤 사진 렌더**(role.isPhoto): full-bleed `<img>` + 틴트 오버레이 + 하단 그라데이션 + 흰 텍스트. **캡처 안정성**은 §9 참조(런타임 CSS blend 금지, pre-bake).
- **인포그래픽 꽉 채움**(§10): compare/grid 블록 `flex-1 min-h-0`로 카드 바닥까지 stretch, 제목 상단 고정, 글자 auto-fit.
- `colorOffset` prop 제거, `seed`(content id) prop 전달로 변경.

### 5.3 `lib/content/recruit-image.ts` (신규 — provider 추상화)
```ts
export type RecruitImage = { src: string; tint: string };  // src=로컬 경로, tint=듀오톤 색
export type RecruitImageSlot = 'cover'|'breakthrough'|'evidence';
// v1: 큐레이션 스톡 풀에서 pillar+slot으로 선택. 추후 AI provider 동일 시그니처로 교체.
export function getRecruitImage(pillar: RecruitPillar, slot: RecruitImageSlot): RecruitImage;
```
- 기존 `recruit-illust.ts`는 일러스트 폴백으로 남기거나 흡수.
- 틴트는 slot별 고정(cover=블루, breakthrough=틸, evidence=딥블루) — scheme과 일치.

### 5.4 `public/recruit-photos/` (신규 — 큐레이션 스톡)
- 무료 상업이용(Unsplash/Pexels) **국적 티 안 나는 장면**(노트북·책상·손·카페·도시·창가) 사진을 pillar/slot별 카테고리로 번들.
- **로컬 번들 필수**(외부 URL 런타임 fetch 금지 — PNG 캡처 타이밍/CORS 불안정).
- 듀오톤은 §9 결정에 따라 **pre-bake**(이미 틴트 적용된 JPG 저장) 또는 grayscale 원본 + SVG 필터.

### 5.5 `app/api/admin/content/recruit/generate/route.ts` (변경)
- 커버만이 아니라 **1·3·5 슬롯에 이미지 주입**: `getRecruitImage(topic.pillar, slot)` → 해당 slide의 `image` 필드.

### 5.6 `lib/content/types.ts` (변경)
- `CardSlide`에 이미지 필드 추가:
  - `cover`: 기존 `bgImage?:string` → `image?: RecruitImage`로 일반화(틴트 포함). 하위호환 위해 `bgImage` 유지 가능.
  - `point`: `image?: RecruitImage` 추가(통념·증거용 full-bleed 듀오톤).
- `GeneratedCardSet.slides` 주석 "정확히 5장" → 콘텐츠 타입별(보험 5 / 리쿠르팅 6) 명시.

### 5.7 `lib/content/generator-recruit-card.ts` (변경)
- `STRUCTURE` 7장 → **6장**(중간 CTA 제거). 프롬프트 흐름·JSON 예시·point 번호(01 compare, 02 통념, 03 grid, 04 증거) 갱신.
- `validateRecruitSlides`: `length !== 7` → `!== 6`, kind 시퀀스 `cover, point×4, closing`.
- 가드레일·sanitizer·모델(`claude-haiku-4-5`)·분량 가이드 유지.

### 5.8 테스트 (변경)
- `recruit-lint.test.ts` 등 7장 가정 테스트 → 6장.
- 신규: `recruit-color` 스킴/역할 매핑 단위테스트, `recruit-image` provider 선택 테스트.

## 6. 데이터 흐름

```
RECRUIT_TOPIC_POOL → pickFreshRecruitTopics → topic(pillar/tone/target)
  → generateRecruitCardSet(topic)  [Claude haiku, 6장 JSON]
  → route: getRecruitImage(pillar, slot) for slot in {cover,breakthrough,evidence}
           → slide.image = {src,tint}
  → content_items.card_slides 저장
프리뷰/상세: RecruitCardStyle({slide, index, total, seed})
  → recruitScheme(seed) + roleForIndex(index) → 토큰
  → role.isPhoto면 듀오톤 사진, 아니면 크림 인포그래픽 / 비비드 CTA
export: 1080×1080 clone → domToBlob (PNG)
```

## 7. 색 스킴 토큰 (v1 쿨 — 블루/틸/크림/옐로)

| role | bg | ink | sub | accent | accentInk | photo/tint |
|------|----|-----|-----|--------|-----------|-----------|
| cover | (사진) | #fff | rgba(255,255,255,.85) | #FFD23D | #11224d | ✅ #1E5BFF |
| compare | #F1ECE0 | #123A4A | rgba(18,58,74,.66) | #0E9AA7 | #fff | ❌ |
| breakthrough | (사진) | #fff | rgba(255,255,255,.9) | #FFD23D | #11224d | ✅ #0E9AA7 |
| grid | #F1ECE0 | #123A4A | rgba(18,58,74,.66) | #1E5BFF | #fff | ❌ |
| evidence | (사진) | #fff | rgba(255,255,255,.9) | #FFD23D | #11224d | ✅ #14307A |
| closing | #08AEBD | #fff | rgba(255,255,255,.9) | #FFD23D | #11224d | ❌ |

악센트 옐로는 전 카드 고정. 크림 카드의 악센트(칩·강조)는 틸/블루(크림 위 대비 확보).

## 8. 타입 스케일 (1:1 / cqw 기준, auto-fit)

- 커버 제목(BHS): 글자수별 auto-fit `len≤8→13.5 / ≤14→11 / ≤20→9 / else 7.6cqw`, line-height 1.1.
- 본문 카드 제목(Pretendard 800): 8.5~10cqw, line-height 1.18.
- 본문 텍스트(Pretendard 500): 3.6~3.9cqw, **line-height 1.5**, 풀불투명 `ink`.
- 비교 항목 / 그리드 라벨: 항목 수·길이로 auto-fit(3~4.2cqw), break-keep.
- 보조 라벨·eyebrow(mono): 2.7~2.9cqw.
- **모든 본문 대비 ≥ WCAG AA**(사진 카드는 그라데이션으로 확보).

## 9. 듀오톤 & 캡처 안정성 (핵심 기술 결정)

`domToBlob`(html-to-image 계열)이 CSS `mix-blend-mode`·`filter: grayscale` 를 **PNG로 안정 렌더 못 할 수 있음** — 이게 과거 실사→일러스트 전환의 한 이유(캡처 불안정).

**결정: 듀오톤을 런타임 CSS가 아니라 pre-bake로.**
- 큐레이션 시점에 사진을 **이미 듀오톤 적용된 JPG**(slot 틴트별)로 변환해 `public/recruit-photos/`에 저장(Node `sharp` 등 — 빌드/스크립트 1회).
- 카드 렌더는 평범한 `<img>` + 하단 그라데이션 div(흰 텍스트 가독성용)만 → **캡처 100% 안정**.
- 대안(차선): grayscale 원본 + SVG `feColorMatrix` 필터(blend보다 캡처 호환 높음). pre-bake가 1순위.

## 10. 인포그래픽 "꽉 채움" 규칙 (사용자 요구)

비교(compare)·강점(grid) 카드:
- 컨테이너 `flex flex-col`, 제목 `flex-none`(상단 고정), 콘텐츠 블록 `flex-1 min-h-0`로 **카드 바닥까지 stretch**.
- compare: 두 칼럼 `flex-1` + `justify-center`, 항목은 칼럼 높이에 맞춰 간격 분배. 항목 수·길이로 글자 auto-fit.
- grid: 2×2 `grid-rows-2 flex-1`, 셀이 높이만큼 늘어남. 라벨 auto-fit·break-keep.
- 짧으면 빈 공간 없이 채우고, 길면 글자 줄여 안 넘치게. (기존 v5 의도 계승·강화 — 1:1 높이 기준 임계값 재튜닝.)

## 11. 리스크 & 미해결

- **듀오톤 캡처**: pre-bake로 해소(§9). `sharp` 의존 추가 필요.
- **스톡 큐레이션 노동**: 국적-중립 장면 컷을 pillar×slot로 충분히 모아야 함(슬롯당 3~5장). 초기 수작업.
- **인물 사진 진정성**: 가짜 인물 후기 리스크 → v1은 **얼굴 없는 장면 컷 위주**(손·노트북·뒷모습). 실제 인물 후기는 별도.
- **세트 간 변주 약함 우려**: 쿨톤 2~3 스킴 + 사진 다양성으로 충분한지 출시 후 점검. 부족하면 웜톤 스킴 추가(아키텍처 이미 허용).
- **라이선스**: 스톡은 무료 상업이용만, 출처 트래킹.

## 12. 빌드 순서(개략)

1. 타입 확장(`types.ts`) + 색 스킴/역할(`recruit-color.ts`) + 단위테스트.
2. `RecruitStyle.tsx` 리워크: 스킴·타이포·노이즈 제거·인포그래픽 꽉채움(이미지 없이 먼저, 크림/비비드/CTA 카드 완성).
3. 이미지 provider(`recruit-image.ts`) + `public/recruit-photos/` 큐레이션 + 듀오톤 pre-bake 스크립트.
4. `RecruitStyle`에 듀오톤 사진 카드(1·3·5) 렌더 결합 + 캡처 검증(실제 PNG 확인).
5. 생성기 6장화(`generator-recruit-card.ts` + `route.ts`) + 테스트 갱신.
6. 12회 배치 생성 → 색·가독성·이미지·캡처 육안 검증.

## 13. 성공 기준

- 한 세트 6장이 쿨톤으로 통일돼 보이고(무지개 X), 세트끼리는 구분됨.
- 본문이 모든 카드에서 또렷이 읽힘(저대비·노이즈 없음).
- 1·3·5에 듀오톤 사진이 들어가고 PNG export가 깨지지 않음.
- 비교·강점 카드가 빈 공간/넘침 없이 꽉 참.
- 1:1 1080×1080 export 정상.
