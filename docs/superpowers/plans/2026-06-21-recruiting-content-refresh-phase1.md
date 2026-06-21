# 리쿠르팅 콘텐츠 리프레시 — 1단계 구현 계획 (토픽 & 4:5 비율)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 리쿠르팅 카드의 타깃 파생(경력/신규), P3 "시스템=생존" 뉴스 3연작 토픽 추가, 카드 비율 1:1→4:5 전환, 비주얼 레시피 키트 문서화.

**Architecture:** 기존 `RecruitTopic`의 `target` 필드에서 타깃(experienced/newcomer/both)을 파생하는 순수 헬퍼를 추가(새 필드 없음, DRY). P3-income 기둥에 1200%룰 기반 토픽 3개를 `RECRUIT_TOPIC_POOL`에 추가하고 `recruit-lint`로 컴플라이언스 검증. 캡처·렌더 비율 하드코딩(1080²)을 4:5(1080×1350)로 변경.

**Tech Stack:** TypeScript, Next.js, Vitest(`npm run test` → `vitest run`), Supabase(content_items.card_slides JSONB).

## Global Constraints

- 리쿠르팅 컴플라이언스: `lintRecruit(text).risk_score < 25` 필수(must_fix=false). 소득보장("월 ○○ 보장/확정/가능","무조건","떼돈","쉽게 번다")·럭셔리 플렉스·유사수신·전화번호 금지.
- `RecruitTopic` 필수 필드 전부 채움: `slug, pillar, tone, target, title, hook, beats[], scenes{cover,breakthrough,evidence}`.
- 타깃 매핑: `career-changer`→experienced(A), `2030-newbie`/`side-job`→newcomer(B), `mix`→both.
- 카드 비율: 카드뉴스 4:5(1080×1350). 한글 텍스트는 이미지에 굽지 않음(템플릿 렌더).
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- 푸시 금지(로컬 커밋만) — 푸시=프로덕션 배포.

## File Structure

- `lib/content/recruit-audience.ts` (Create) — 타깃→오디언스 파생 헬퍼. 단일 책임.
- `lib/content/recruit-audience.test.ts` (Create) — 헬퍼 테스트.
- `lib/content/recruit-topics.ts` (Modify) — P3 뉴스 3연작 토픽 추가.
- `lib/content/recruit-topics.news.test.ts` (Create) — 신규 토픽 컴플라이언스·구조 테스트.
- `app/admin/content/recruit/[id]/RecruitDetailClient.tsx` (Modify) — 캡처 1080×1350, aspect-[4/5].
- `app/admin/content/card-preview/styles/RecruitStyle.tsx` (Modify) — 주석/높이 가정 검증.
- `docs/recruiting-visual-kit.md` (Create) — 비주얼·훅 레시피 키트.

## Out of scope (후속 별도 계획)

- **「새 릴스 생성」 진입점 + 힉스필드 연동** — 배경 라이브러리 저장구조·검수 UI·재사용 로직 설계 필요. 2단계 계획에서.
- 버튼 per-press 생성 직결(비용상 채택 안 함).

---

### Task 1: 타깃→오디언스 파생 헬퍼

**Files:**
- Create: `lib/content/recruit-audience.ts`
- Test: `lib/content/recruit-audience.test.ts`

**Interfaces:**
- Consumes: `RecruitTarget` from `lib/content/types.ts` (`'2030-newbie' | 'career-changer' | 'side-job' | 'mix'`)
- Produces: `recruitAudience(target: RecruitTarget): RecruitAudience` where `type RecruitAudience = 'experienced' | 'newcomer' | 'both'`

- [ ] **Step 1: 실패 테스트 작성**

`lib/content/recruit-audience.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { recruitAudience } from './recruit-audience';

describe('recruitAudience', () => {
  it('career-changer → experienced', () => {
    expect(recruitAudience('career-changer')).toBe('experienced');
  });
  it('2030-newbie → newcomer', () => {
    expect(recruitAudience('2030-newbie')).toBe('newcomer');
  });
  it('side-job → newcomer', () => {
    expect(recruitAudience('side-job')).toBe('newcomer');
  });
  it('mix → both', () => {
    expect(recruitAudience('mix')).toBe('both');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test -- recruit-audience`
Expected: FAIL — "Cannot find module './recruit-audience'"

- [ ] **Step 3: 최소 구현**

`lib/content/recruit-audience.ts`:
```typescript
import type { RecruitTarget } from './types';

export type RecruitAudience = 'experienced' | 'newcomer' | 'both';

/** 두 버튼(A 경력자 / B 신규) 필터링용 — 기존 target에서 파생(새 필드 없음). */
export function recruitAudience(target: RecruitTarget): RecruitAudience {
  switch (target) {
    case 'career-changer':
      return 'experienced';
    case '2030-newbie':
    case 'side-job':
      return 'newcomer';
    case 'mix':
      return 'both';
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- recruit-audience`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/content/recruit-audience.ts lib/content/recruit-audience.test.ts
git commit -m "feat(recruit): 타깃→오디언스(경력/신규/both) 파생 헬퍼

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: P3 "시스템=생존" 뉴스 3연작 토픽 추가

**Files:**
- Modify: `lib/content/recruit-topics.ts` (배열 `RECRUIT_TOPIC_POOL`에 항목 추가)
- Test: `lib/content/recruit-topics.news.test.ts`

**Interfaces:**
- Consumes: `RECRUIT_TOPIC_POOL: RecruitTopic[]` from `./recruit-topics`; `lintRecruit` from `./recruit-lint`; `recruitAudience` from `./recruit-audience`
- Produces: 3개 신규 토픽 slug — `p3-cap-equalized`, `p3-system-or-out`, `p3-our-apps` (모두 `pillar: 'P3-income'`, `target: 'career-changer'`)

- [ ] **Step 1: 실패 테스트 작성**

`lib/content/recruit-topics.news.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { RECRUIT_TOPIC_POOL } from './recruit-topics';
import { lintRecruit } from './recruit-lint';
import { recruitAudience } from './recruit-audience';

const NEWS_SLUGS = ['p3-cap-equalized', 'p3-system-or-out', 'p3-our-apps'];

describe('P3 뉴스 3연작', () => {
  it('3개 토픽이 모두 존재하고 P3-income·career-changer', () => {
    for (const slug of NEWS_SLUGS) {
      const t = RECRUIT_TOPIC_POOL.find((x) => x.slug === slug);
      expect(t, slug).toBeDefined();
      expect(t!.pillar).toBe('P3-income');
      expect(t!.target).toBe('career-changer');
      expect(recruitAudience(t!.target)).toBe('experienced');
    }
  });

  it('hook·title·beats가 컴플라이언스를 통과(must_fix=false)', () => {
    for (const slug of NEWS_SLUGS) {
      const t = RECRUIT_TOPIC_POOL.find((x) => x.slug === slug)!;
      const text = [t.title, t.hook, ...t.beats].join(' ');
      const r = lintRecruit(text);
      expect(r.must_fix, `${slug}: ${JSON.stringify(r)}`).toBe(false);
    }
  });

  it('필수 필드(scenes 3슬롯) 채워짐', () => {
    for (const slug of NEWS_SLUGS) {
      const t = RECRUIT_TOPIC_POOL.find((x) => x.slug === slug)!;
      expect(t.scenes.cover.length).toBeGreaterThan(0);
      expect(t.scenes.breakthrough.length).toBeGreaterThan(0);
      expect(t.scenes.evidence.length).toBeGreaterThan(0);
      expect(t.beats.length).toBeGreaterThanOrEqual(4);
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test -- recruit-topics.news`
Expected: FAIL — 토픽 미존재(`toBeDefined` 실패)

- [ ] **Step 3: 토픽 3개 추가**

`lib/content/recruit-topics.ts` — `RECRUIT_TOPIC_POOL` 배열의 마지막 항목 뒤(닫는 `]` 직전)에 추가:
```typescript
  {
    slug: 'p3-cap-equalized',
    pillar: 'P3-income',
    tone: 'flex-reframed',
    target: 'career-changer',
    title: '이제 어느 GA를 가도 수수료 상한은 똑같습니다',
    hook: '2026년 7월부터 1200%룰이 GA까지 확대됐어요. 수수료로 줄 세우던 시대가 끝납니다.',
    beats: [
      '7월 1200%룰 GA 확대 — 수수료·시책·정착지원금 합산 상한 적용',
      '회사마다 달랐던 조건이 제도적으로 평준화',
      '그럼 무엇으로 회사를 고를까 — 남는 건 일하는 방식',
      '시스템이 곧 차이가 되는 시대',
      '시스템 보고 판단하세요 — DM 「시스템」',
    ],
    scenes: {
      cover: 'Clean minimal infographic background, equal-height bars aligned to one ceiling line, cool blue and teal palette, lots of negative space at top, no text, no letters',
      breakthrough: 'Abstract data flow lines converging to a single level threshold, cool blue tones, editorial tech feel, no text',
      evidence: 'Tidy desk corner with a tablet showing abstract dashboard shapes (no readable text), cool tone, shallow depth of field, no text',
    },
  },
  {
    slug: 'p3-system-or-out',
    pillar: 'P3-income',
    tone: 'authentic',
    target: 'career-changer',
    title: '수수료가 같아진 지금, 시스템 없는 곳은 못 버팁니다',
    hook: '중소 GA 설계사는 줄고 있어요. 수수료로 경쟁이 안 되면 남는 건 시스템뿐이니까요.',
    beats: [
      '수수료 평준화로 회사 간 금전 차별화 종료',
      '인프라 없는 조직은 설계사 이탈이 빨라지는 흐름',
      '교육·리드·고객관리 지원이 실제 활동 여건을 좌우',
      '시스템을 갖춘 곳이 설계사를 받쳐주는 구조',
      '어떤 환경에서 일할지 지금 점검하세요 — DM 「시스템」',
    ],
    scenes: {
      cover: 'Two contrasting abstract structures, one sturdy and one crumbling, cool blue and teal duotone, generous top negative space, no text, no letters',
      breakthrough: 'Solid architectural framework lines holding steady, cool tone, editorial, no text',
      evidence: 'Hands resting on a laptop at a calm organized desk, faceless, candid natural light, muted cool tones, no text',
    },
  },
  {
    slug: 'p3-our-apps',
    pillar: 'P3-income',
    tone: 'authentic',
    target: 'career-changer',
    title: '그래서 우리는 직접 만들었습니다',
    hook: '고객 자동배정, 30개사 1초 비교, 예외질환 전환까지. 외주 없이 전부 우리가 만든 전용앱이에요.',
    beats: [
      '지인영업 대신 검증된 고객을 자동 배정',
      '같은 보장도 30개사를 1초에 비교',
      '가입 거절 고객도 예외질환 검색으로 다시 살림',
      '진료내역·실손청구까지 한 화면에서',
      '외주 0, 전부 직접 만들어 하나로 연동 — DM 「시스템」',
    ],
    scenes: {
      cover: 'Clean app-interface inspired abstract panels arranged in a grid, cool blue and teal, tech editorial, top negative space, no readable text, no letters',
      breakthrough: 'Abstract comparison grid of many cards condensing into one highlighted card, cool tone, no text',
      evidence: 'Tablet on a desk showing abstract dashboard panels (no readable text), faceless hands nearby, candid cool tone, no text',
    },
  },
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- recruit-topics.news`
Expected: PASS (3 tests). 만약 컴플라이언스 실패 시 해당 토픽의 문구에서 적발어 제거 후 재실행.

- [ ] **Step 5: 전체 테스트 회귀 확인**

Run: `npm run test`
Expected: 기존 테스트 + 신규 모두 PASS

- [ ] **Step 6: 커밋**

```bash
git add lib/content/recruit-topics.ts lib/content/recruit-topics.news.test.ts
git commit -m "feat(recruit): P3 시스템=생존 뉴스 3연작 토픽(1200%룰) 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 카드 비율 1:1 → 4:5 (1080×1350)

**Files:**
- Modify: `app/admin/content/recruit/[id]/RecruitDetailClient.tsx` (캡처 높이 + aspect 클래스)
- Modify: `app/admin/content/card-preview/styles/RecruitStyle.tsx` (주석 갱신)

**Interfaces:**
- Consumes: 없음(레이아웃 변경). cqw는 너비(1080) 기준이라 가로 사이징 불변, 세로 공간만 증가.
- Produces: 캡처 PNG 1080×1350, 미리보기 컨테이너 4:5.

- [ ] **Step 1: 캡처 높이 변경**

`app/admin/content/recruit/[id]/RecruitDetailClient.tsx` 라인 93-94:
```typescript
clone.style.width = '1080px';
clone.style.height = '1350px';
```
라인 103 `domToBlob` 호출:
```typescript
domToBlob(clone, { width: 1080, height: 1350, scale: 1, /* 기존 나머지 옵션 유지 */ });
```

- [ ] **Step 2: 미리보기 aspect 클래스 변경**

같은 파일 라인 182, 185, 196의 `className="aspect-square"` → `className="aspect-[4/5]"` (3곳 모두).

- [ ] **Step 3: RecruitStyle 주석 갱신**

`app/admin/content/card-preview/styles/RecruitStyle.tsx` 라인 6 주석:
```
// ⑤ 4:5(1080×1350) 기준 cqw — 가로 1080 기준, 세로 1350
```
(cqw는 너비 기준이라 폰트/요소 계산식 변경 불필요. 컨테이너 높이만 4:5로 늘어남.)

- [ ] **Step 4: 빌드 + 시각 검증**

Run: `npm run build`
Expected: 타입/빌드 에러 없음.

수동 확인(검증 게이트): dev 서버에서 리쿠르팅 카드 상세 → 미리보기가 세로로 길어진 4:5인지, 요소가 위/아래 잘리거나 과하게 비지 않는지. PNG 다운로드 → 1080×1350인지.
- 만약 세로 여백이 과하면 RecruitStyle의 슬라이드 패딩/정렬을 후속 조정(이 태스크 범위 내 미세조정 허용).

- [ ] **Step 5: 커밋**

```bash
git add "app/admin/content/recruit/[id]/RecruitDetailClient.tsx" "app/admin/content/card-preview/styles/RecruitStyle.tsx"
git commit -m "feat(recruit): 카드 비율 1:1 → 4:5(1080x1350) 전환

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 비주얼·훅 레시피 키트 문서

**Files:**
- Create: `docs/recruiting-visual-kit.md`

**Interfaces:** 문서 only. 스펙 §②③의 레시피를 재사용 가능한 키트로 고정.

- [ ] **Step 1: 키트 문서 작성**

`docs/recruiting-visual-kit.md` — 아래 내용 포함:
- 트랙별 모델/프롬프트: B(신규)=`soul_2` + "candid, shot on iPhone, natural light, slightly grainy, imperfect framing, no retouching, muted cool tones"; A(경력)=`recraft-v4-1`(브랜드색 hex 잠금 #1E5BFF·#0E9AA7) or `nano_banana_pro`. 금지어 목록(cinematic/editorial/premium/perfect skin/heavy duotone).
- 공통 철칙: 얼굴X, 한글X(템플릿/프리미어에서), 카드 4:5(1080×1350)/릴스 9:16(1080×1920), 프롬프트 끝 `no text, no letters, no logo`, 4:5 프로필 그리드 상하단 135px 크롭 안전영역.
- 훅 공식: A=`[업계 사실]+[되묻는 질문]`, B=`[현타 공감 장면]+[전환 가능성 암시]`, 공통 5규칙, CTA(A "DM 시스템"/B "DM 어메이징").
- 릴스: Seedance 2.0 + 오디오 ON, 시퀀스(훅+본문+시스템 실화면+CTA), 시스템은 실제 앱화면 녹화.
- 후처리: `upscale_image`.
- 힉스필드 비용 메모: 생성만 과금·재사용 무료, balance 상시체크.

- [ ] **Step 2: 커밋**

```bash
git add docs/recruiting-visual-kit.md
git commit -m "docs(recruit): 비주얼·훅 레시피 키트(트랙별 모델/프롬프트/비율/훅)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §① 타깃 2종 → Task 1(파생 헬퍼). P3 뉴스 3연작 → Task 2. ✅
- §② 훅 강화 규칙 → Task 4(키트에 공식 고정) + Task 2 신규 토픽이 공식 적용. (기존 27토픽 일괄 재작성은 비축 단계 콘텐츠 작업으로, 본 계획 제외 — 코드 변경 아님)
- §③ 비주얼 레시피 → Task 4. 비율 4:5 → Task 3. ✅
- §④ 운영/비용 → 키트(Task 4)에 비용·balance 메모. 「새 릴스 생성」 진입점 → **후속 별도 계획(명시적 Out of scope)**.

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. 토픽 문구 전부 실값. 캡처 옵션 "기존 나머지 옵션 유지"는 실제 파일의 domToBlob 인자(폰트 임베드 등)를 보존하라는 지시 — 실행자가 라인 103 원본을 그대로 두고 width/height만 교체.

**Type consistency:** `RecruitAudience`(Task1) ↔ Task2 테스트에서 동일 사용. `RecruitTarget` 값들은 types.ts 정의와 일치. 신규 토픽은 `RecruitTopic` 전 필드 충족.
