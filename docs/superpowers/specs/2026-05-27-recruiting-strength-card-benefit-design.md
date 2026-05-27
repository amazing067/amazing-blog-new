# 리쿠르팅 강점 카드 — 혜택 중심 리디자인 (2026-05-27)

브랜치: `feat/recruiting-content`

## 배경 / 문제

리쿠르팅 카드뉴스(6장 세트)의 **강점 카드(slide index 3, `layout:'grid'`)**가 두 번 바뀌었다:
사물 아이콘(청진기·계산기) → 번호형(01~04). 둘 다 사용자 불만:

- 사물 아이콘 = 클립아트처럼 싸구려.
- 번호형 = "Prime 홈페이지채용"처럼 **코드네임/짧은 제목만** 적혀 외부인이 뭔지 모르고 넘김.
- 핵심 요구: 지원자가 **"아, 여기 진짜 좋은 곳이구나"**를 느끼게, **혜택을 멋들어지게 설명**해서 **누구나 들어오고 싶은 회사**로 보이게.

추가 제약(사용자):
- **줄바꿈을 의도적으로**: 두 줄이 될 거면 미리 구절 경계에서 끊고, **단어 중간에서 줄이 바뀌면 안 됨**.
- 회사의 진짜 무기는 **자체 개발 시스템**이지만(레퍼런스 `docs/amazing-division-reference.html`), 지원자는 코드네임이 아니라 **본인 이득**에 반응한다.

## 결정 (브레인스토밍 + 3종 샘플 비교로 확정)

**혜택 중심(benefit-first)** 으로 간다. 3종 샘플(혜택중심/시스템중심/혼합)을 1:1 카드로 렌더해 비교 → 사용자 선택 = **① 혜택 중심**.

- 강점 카드 = 크림 배경 위 **다크 타일 3개**(혜택), 그 아래 **옐로 캡스톤 띠 1개**(자체개발·연동 펀치라인).
- 시스템은 "주인공"이 아니라 혜택의 **근거**로 설명문에 녹인다(코드네임 노출 안 함).
- **캡스톤 = 차별점의 핵심**: 혜택으로 후킹한 뒤, "이게 가능한 이유 = 외부 SaaS가 아니라 **전부 직접 만들어서 고객관리까지 하나로 연동**된다"로 마무리. (사용자 강조: 직접 개발 → 전부 연동.)
- **고정 팩트뱅크**(AI 생성 폐기) — 사실 정확성 + 줄바꿈 100% 통제 위해. 다양성은 **풀에서 seed로 3개 선택**으로 확보(무지개 아님, 카피만 변주).
- 지원자 혜택이 약한 시스템은 제외: **Check(매니저 출퇴근 — "출퇴근 강제" 오해로 투잡 기피 유발), Prime(홈페이지)**.

샘플 시안: `docs/sample-benefit.html` (줄바꿈 다듬은 최종 비주얼).

## 혜택 팩트뱅크 (8개 → 세트마다 3개)

모든 항목은 `amazing-biz-server`/`amazing-biz-blog`에 실제 구현된 기능 기반. 설명문의 `\n`은 의도적 줄바꿈(구절 경계).

| # | head (옐로) | exp (크림, `\n`=줄바꿈) | 근거 시스템 |
|---|---|---|---|
| 1 | 지인영업, 안 해도 됩니다 | `검증된 고객을 매일 자동 배정\n콜드콜·지인영업 없이 상담만` | Server(DB·EMR 배정) |
| 2 | 콘텐츠는 AI가 씁니다 | `블로그·카페·카드뉴스를\nAI가 자동으로 써줍니다` | Blog |
| 3 | 초보도 첫날부터 든든하게 | `보장분석·세일즈북·검사도구를\n입사 첫 주부터 전부 손에` | Server·Brain·온보딩 |
| 4 | 검사가 상담을 열어줍니다 | `치매·유전자 검사로\n고객이 먼저 상담을 청합니다` | Brain |
| 5 | 30개사를 1초에 비교 | `같은 보장도 회사마다 보험료가\n다르니까, 가장 유리한 걸로` | Server(비교견적) |
| 6 | 거절당한 고객도 되살립니다 | `예외질환 검색으로\n"가입 불가"를 계약으로` | Server(예외질환) |
| 7 | 안 받은 실손, 찾아드립니다 | `고객이 놓친 진료비 청구를 찾아\n먼저 돌려주며 신뢰부터` | Server(실손청구 조회) |
| 8 | 진료내역, 즉시 조회 | `고객 병력을 바로 확인해\n정확한 보장·고지까지 한 번에` | Server(HIRA 진료내역) |

- 카드 제목(고정): `어메이징이 다른 이유`.
- **캡스톤(고정, 항상 노출)**: 칩 `외주 0` + 본문 `DB·진료내역·청구·고객관리까지\n전부 직접 만들어 하나로 연동`. (옐로 띠 = 카드의 시각적 클라이맥스.)
- **컴플라이언스**: 전 항목 직업안정법(고수익보장·확정수익 금지)·금소법 통과. recruit-lint 위반 표현 없음.

## 데이터 구조

`lib/content/types.ts` — point 슬라이드의 인포그래픽 레이아웃에 `'benefits'` 추가:
```ts
export type RecruitBenefit = { head: string; exp: string }; // exp의 \n = 의도적 줄바꿈
// point: layout?: 'default' | 'compare' | 'grid' | 'benefits';
//        benefits?: RecruitBenefit[];   // layout='benefits'일 때 (정확히 3개)
```
기존 `grid`/`gridItems`는 보험 카드 영향 없으니 타입에 남겨두되, 리쿠르팅 강점 슬라이드는 `benefits`로 전환.

신규 `lib/content/recruit-strengths.ts`:
```ts
export const RECRUIT_STRENGTH_POOL: RecruitBenefit[] = [ ...8개... ];
export const RECRUIT_STRENGTH_TITLE = '어메이징이 다른 이유';
export const RECRUIT_STRENGTH_CAPSTONE = {
  chip: '외주 0',
  text: 'DB·진료내역·청구·고객관리까지\n전부 직접 만들어 하나로 연동',
};
/** seed(=topic.slug, 생성 시점 확정값)로 결정적 3개 선택 — 토픽마다 변주, 무작위 아님. */
export function pickStrengths(seed: string, n = 3): RecruitBenefit[];
```
타입: `point` 슬라이드에 `capstone?: { chip: string; text: string }` 추가(benefits 레이아웃에서만 사용). 라우트가 주입.

## 렌더 (`RecruitStyle.tsx`)

- `GridBlock`(번호형) 제거 → **`BenefitBlock`** 신설: `flex-1`로 다크 타일 3개를 세로 stretch + 그 아래 **캡스톤 띠**(flex-none).
  - 타일: `background:t.ink`, 둥근 모서리, 세로 중앙정렬.
  - head: Pretendard 800, **옐로 #FFD23D 고정**(grid 역할의 t.accent는 블루라 다크 타일 위 대비 약함 → 전역 옐로 사용), ~4.7cqw, 1줄, `word-break:keep-all`.
  - exp: Pretendard 600, `color:t.bg`(크림), ~3.1cqw, `whiteSpace:'pre-line'`(=`\n`을 줄바꿈으로) + `word-break:keep-all`.
  - 캡스톤: 옐로(`t.accent`) 배경 띠. 칩(다크 배경·옐로 텍스트·모노 `외주 0`) + 본문(다크 텍스트 800, `pre-line`+`keep-all`).
- 강점 슬라이드 분기: `layout==='benefits' && slide.benefits` → `BenefitBlock`(slide.capstone 함께 렌더). (기존 `grid` 분기는 보험/하위호환용으로 남김.)
- 그리드 역할(grid) 악센트가 블루(#1E5BFF)라 옐로 캡스톤과 다름 → 캡스톤은 전역 옐로(#FFD23D) 고정 사용(샘플 기준).

### 레이아웃 fit (필수 — 샘플에서 글씨 박스 밖 넘침 잡음)
3타일 + 캡스톤 + 제목 + 닷이 1080 안에 빡빡 → 다음으로 해결(샘플 `docs/sample-benefit.html`에서 검증):
- **제목 1줄**(`어메이징이 다른 이유`, ~6.2cqw). 2줄 제목은 공간 부족 → 1줄 고정. (현 코드 `bodyTitleStyle` auto-fit과 호환되나, 강점 카드 제목은 짧게 고정.)
- **타일 상하 여백**(`padding: ~2.4cqw 4cqw`) + `overflow:hidden`(어떤 풀 조합이든 안 삐져나오게 안전망).
- head ~4.6cqw(1줄) · exp ~3.05cqw(2줄, `pre-line`+`keep-all`) · 타일 gap ~1.1cqw · 스택 gap ~2.4cqw.
- 풀 8개 헤드라인 최장("거절당한 고객도 되살립니다" 12자)도 타일폭에서 1줄. exp 각 줄도 1줄 안에 들어가도록 카피 작성(이미 `\n`로 통제).
- 캡스톤 텍스트 ~3.1cqw 2줄. 칩 모노 ~3cqw.
- **공통 타이포 원칙**: 리쿠르팅 카드 텍스트는 `word-break:keep-all`(단어 중간 줄바꿈 금지). 고정 카피는 `\n` 수동 줄바꿈을 `pre-line`으로 렌더.

## 생성 / 주입 (`route.ts` + 생성기)

- 듀오톤 이미지 주입과 동일 패턴: AI 생성 후 **slide index 3을 팩트뱅크로 덮어씀**(라우트에서 `pickStrengths(topic.slug)` → `{kind:'point', layout:'benefits', benefits, title}` 조립). seed=`topic.slug`는 생성 시점에 확정값이라 id 타이밍 문제 없음. → 강점 카드는 **AI를 안 거침**(할루시 차단·줄바꿈 보존).
- `generator-recruit-card.ts`: 슬라이드 4 STRUCTURE/프롬프트에서 grid 산출 부담 제거(간단 placeholder 또는 기존 grid 유지하되 라우트가 덮어씀). 토큰 절약 위해 프롬프트에서 슬라이드4 본문 생성 축소.

## 검증

- `recruit-lint`: 8개 카피 전부 통과 확인(테스트 추가).
- `pickStrengths` 단위 테스트: 같은 seed→같은 3개(결정적), 서로 다른 seed→분포 변주, 중복 없음.
- tsc 0 · eslint 0.
- 어드민 🎯탭에서 새 카드 생성 → 강점 카드(4번) 다크 타일 3개·줄바꿈·PNG export 육안 확인.

## 범위 밖 (이번 작업 아님)

- 다른 5개 카드(커버·비교·통념·증거·CTA)의 카피 리라이트 — 단, `keep-all` 줄바꿈 원칙은 공통 적용. (후속에서 동일 기준으로 점검 가능.)
- 시스템 코드네임을 전면에 내세우는 별도 "시스템 시리즈" — 추후 옵션.
- 세트 간 색 스킴 변주(웜톤 추가 등) — 듀오톤 틴트 정합성 정리 후 별도.
