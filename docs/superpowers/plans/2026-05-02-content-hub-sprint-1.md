# Content Automation Hub — Sprint 1 (반자동 보험뉴스 파이프라인)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매일 06:00 RSS 3개에서 보험뉴스를 수집·요약·검수해 어드민 검수 대기열로 쌓는다. 사람이 본문을 검토·수정 후 "카페용 복사"로 클립보드에 받아 카페에 직접 붙여넣고 "발행 완료" 클릭으로 마무리한다. 자동 발행은 이번 sprint에서 안 한다.

**Architecture:** Supabase 3 테이블(`content_items`, `compliance_lints`, `content_settings`) + RLS. `lib/content/`에 RSS 수집·생성·검수 모듈. `/admin/content/news/*`에서 사람이 검수·복사·발행마킹. `/api/cron/daily-build`만 자동(매일 06:00 KST). 룰엔진은 광고 절대표현·비교표현·보장단정에 더해 **보험사명·상품명 직접 언급도 차단**.

**Tech Stack:** Next.js 16 App Router, Supabase, Gemini 2.5 Flash (`@google/generative-ai`), `fast-xml-parser`, Vercel Cron, Vitest.

**확정된 사용자 답변 (2026-05-02):**
- 이번 sprint = **반자동만** (자동 발행·OAuth·토큰 암호화 전부 다음 sprint로)
- 티스토리/인스타 자동 발행 = **별도 sprint**에서 추가
- 보험뉴스 채널 = **카페에 사람이 붙여넣기**
- RSS 3개: 한국보험신문 / 보험매일 / 인슈넷 (URL은 `RSS_SOURCES`에 채워넣음)
- 룰엔진 보강: **보험사명·상품명 직접 언급 단독 차단** + 광고 절대표현·비교·보장단정

**상위 사양서:** `docs/superpowers/specs/2026-05-02-content-automation-hub-design.md` (4.5 `compliance_lints` 별도 테이블 반영, 4.3 `channel_credentials` / 4.4 `publish_jobs`는 다음 sprint로)

---

## File Structure

### 신규 생성
```
supabase/migrations/
  20260502_content_hub.sql                     # 3 테이블 + RLS

lib/content/
  forbidden-terms.ts                           # 광고 + 보험사명 + 상품명 사전
  compliance-lint.ts                           # 룰엔진
  compliance-lint.test.ts
  rss-fetcher.ts
  rss-fetcher.test.ts
  news-collector.ts
  news-collector.test.ts
  generator.ts                                 # Gemini 뉴스 요약 (익명화 강화)
  cafe-formatter.ts                            # md → 카페 본문 plain text 변환
  cafe-formatter.test.ts
  types.ts

lib/admin/
  guard.ts                                     # requireAdmin + adminClient

lib/
  cron-auth.ts

app/admin/content/
  layout.tsx
  news/page.tsx                                # 목록
  news/[id]/page.tsx                           # 상세
  news/[id]/NewsActions.tsx                    # 클라이언트 (복사/다운로드/마킹/거절/재검수)

app/api/admin/content/news/[id]/
  reject/route.ts
  relint/route.ts
  publish-mark/route.ts                        # 발행 완료 마킹
  download/route.ts                            # .md 파일

app/api/cron/
  daily-build/route.ts

vercel.json                                    # cron 1개
vitest.config.ts
```

### 수정
```
package.json
.env.local.example
```

---

## Task 0: 환경 준비

**Files:** Modify `package.json`; Create `vitest.config.ts`, `.env.local.example`, `lib/content/types.ts`.

- [ ] **Step 1: 의존성 설치**
```bash
npm install fast-xml-parser
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: `package.json` scripts 보강** (`upload-premium-data` 윗줄)
```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: `vitest.config.ts`**
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    coverage: { provider: 'v8' },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 4: `.env.local.example`**
```
# Content Hub Sprint 1
CRON_SECRET=                            # openssl rand -hex 32
RSS_SOURCES=                            # 형식: 한국보험신문|<URL>,보험매일|<URL>,인슈넷|<URL>
```

- [ ] **Step 5: `lib/content/types.ts`**
```ts
export type EnforcementMode = 'open' | 'strict';

export type RSSItem = {
  source: string;
  title: string;
  link: string;
  pubDate: string;
  description: string;
};

export type CandidateArticle = {
  source: string;
  title: string;
  link: string;
  pubDate: string;
  excerpt: string;
  contentHash: string;
};

export type LintResult = {
  forbidden_terms_found: string[];
  comparison_phrases: string[];
  guarantee_phrases: string[];
  insurer_mentions: string[];      // 신규
  product_mentions: string[];      // 신규
  risk_score: number;
  must_fix: boolean;
  suggestions: string[];
};

export type GeneratedSummary = {
  title: string;
  body_md: string;
};
```

- [ ] **Step 6: sanity 테스트**

`lib/content/compliance-lint.test.ts` (임시):
```ts
import { describe, it, expect } from 'vitest';
describe('vitest sanity', () => { it('runs', () => expect(1+1).toBe(2)); });
```

Run: `npm test` → Expected: 1 passed

- [ ] **Step 7: 커밋**
```bash
git add package.json package-lock.json vitest.config.ts .env.local.example lib/content/types.ts lib/content/compliance-lint.test.ts
git commit -m "chore(content-hub): vitest 도입 + sprint1 환경변수 스캐폴딩"
```

---

## Task 1: DB 스키마 (3 테이블 + RLS)

**Files:** Create `supabase/migrations/20260502_content_hub.sql`.

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/20260502_content_hub.sql`:
```sql
-- Content Automation Hub — Sprint 1 (반자동)
-- 다음 sprint에서 추가될 테이블: publish_jobs, channel_credentials, compliance_records

CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('news','blog','card','naver_blog')),
  title TEXT NOT NULL,
  body_md TEXT,
  body_html TEXT,
  image_urls TEXT[] DEFAULT '{}',
  source_refs JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'review'
    CHECK (status IN ('draft','review','approved','published','expired','failed')),
  enforcement_mode TEXT NOT NULL DEFAULT 'open'
    CHECK (enforcement_mode IN ('open','strict')),
  publish_url TEXT,                    -- 사람이 카페 게시 후 입력하는 URL (선택)
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_content_items_type_status ON content_items (type, status);

CREATE TABLE compliance_lints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  forbidden_terms_found TEXT[] DEFAULT '{}',
  comparison_phrases TEXT[] DEFAULT '{}',
  guarantee_phrases TEXT[] DEFAULT '{}',
  insurer_mentions TEXT[] DEFAULT '{}',
  product_mentions TEXT[] DEFAULT '{}',
  risk_score INT NOT NULL,
  must_fix BOOLEAN NOT NULL,
  raw_report JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_compliance_lints_content ON compliance_lints (content_id, created_at DESC);

CREATE TABLE content_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO content_settings (key, value) VALUES ('news.enforcement_mode', '"open"'::jsonb);

-- RLS
ALTER TABLE content_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_lints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_settings  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  );
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['content_items','compliance_lints','content_settings']
  LOOP
    EXECUTE format('CREATE POLICY admin_select_%I ON %I FOR SELECT TO authenticated USING (is_admin());', t, t);
    EXECUTE format('CREATE POLICY admin_insert_%I ON %I FOR INSERT TO authenticated WITH CHECK (is_admin());', t, t);
    EXECUTE format('CREATE POLICY admin_update_%I ON %I FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());', t, t);
    EXECUTE format('CREATE POLICY admin_delete_%I ON %I FOR DELETE TO authenticated USING (is_admin());', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
CREATE TRIGGER trg_content_items_updated_at BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_content_settings_updated_at BEFORE UPDATE ON content_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 2: 사용자 외부 작업 (체크포인트)**
> Supabase 콘솔 → SQL Editor에 `supabase/migrations/20260502_content_hub.sql` 통째로 붙여넣어 실행. 완료 후 알려주세요.

- [ ] **Step 3: 적용 확인 후 커밋**
```bash
git add supabase/migrations/20260502_content_hub.sql
git commit -m "feat(content-hub): DB 스키마(3 테이블 + RLS, 반자동 sprint 1)"
```

---

## Task 2: 룰엔진 v2 (보험사명·상품명 차단 포함, TDD)

**Files:** Create `lib/content/forbidden-terms.ts`, replace `lib/content/compliance-lint.test.ts`, create `lib/content/compliance-lint.ts`.

- [ ] **Step 1: `lib/content/forbidden-terms.ts`**
```ts
export const ABSOLUTE_TERMS = [
  '최고','최상','최저','최대','최소','제일','단연',
  '독보적','유일','유일한','독점','단독',
  '100%','완벽','완전','확실','확실히','절대','절대로',
  '무조건','반드시','틀림없이','의심없이',
  '대박','특별한','파격','획기적',
];

export const COMPARISON_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /다른\s*(회사|보험사|상품)\s*(보다|에\s*비해)/g, label: '타사 비교' },
  { pattern: /타사\s*(대비|보다|비교)/g, label: '타사 대비' },
  { pattern: /업계\s*(최저|최고|최초|유일|1위)/g, label: '업계 최상급' },
  { pattern: /국내\s*(최저|최고|최초|유일|1위)/g, label: '국내 최상급' },
  { pattern: /(보다|대비)\s*(더\s*)?(저렴|싼|싸고|좋고|우수)/g, label: '비교 우위' },
];

export const GUARANTEE_TERMS = [
  '보장됩니다','보장된','보장 됩니다','확실히 받을 수','반드시 받을 수',
  '무조건 받을 수','꼭 받을 수','평생 보장','영구 보장','100% 보장',
  '확정 보장','손해 없','손실 없','원금 보장',
];

// 보험사명 직접 언급 — 단독 등장만으로 차단 (가중치 매우 큼)
export const INSURER_NAMES = [
  // 생보
  '삼성생명','한화생명','교보생명','신한라이프','미래에셋생명',
  'NH농협생명','동양생명','ABL생명','KB라이프','메트라이프','메트라이프생명',
  '푸본현대생명','흥국생명','iM라이프','DGB생명','BNP파리바카디프생명',
  '하나생명','처브라이프','라이나생명','AIA생명','동양생명',
  // 손보
  '삼성화재','DB손해보험','현대해상','KB손해보험','메리츠화재',
  '롯데손해보험','한화손해보험','NH농협손해보험','AXA손해보험','악사손해보험',
  '하나손해보험','캐롯손해보험','MG손해보험','흥국화재','농협손해보험',
];

// 상품명/특약 패턴 (구체 상품명 + 따옴표 둘러싼 상품명 + "(상품명)" 형태)
export const PRODUCT_NAME_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /['"`「『][^'"`」』\n]{2,40}?(보험|특약|플랜|어시스트|케어|라이프)['"`」』]/g, label: '따옴표 상품명' },
  { pattern: /[가-힣A-Za-z0-9]{2,20}(보험|연금|저축|적금)\s*\(/g, label: '괄호 상품명' },
  { pattern: /\b(무배당|배당부)\s*[가-힣A-Za-z0-9]{2,30}/g, label: '무배당/배당부 상품' },
];
```

- [ ] **Step 2: 테스트 작성 (RED)**

`lib/content/compliance-lint.test.ts` (sanity 덮어쓰기):
```ts
import { describe, it, expect } from 'vitest';
import { lintContent } from './compliance-lint';

describe('lintContent', () => {
  it('clean text passes', () => {
    const r = lintContent('이번 달 자동차보험 갱신 안내입니다. 신규 약관이 반영되었습니다.');
    expect(r.risk_score).toBe(0);
    expect(r.must_fix).toBe(false);
  });

  it('detects absolute terms', () => {
    const r = lintContent('업계 최고의 상품, 100% 만족');
    expect(r.forbidden_terms_found).toContain('최고');
    expect(r.forbidden_terms_found).toContain('100%');
    expect(r.must_fix).toBe(true);
  });

  it('detects comparison phrases', () => {
    const r = lintContent('다른 보험사보다 저렴하고 타사 대비 우수합니다.');
    expect(r.comparison_phrases.length).toBeGreaterThanOrEqual(2);
    expect(r.must_fix).toBe(true);
  });

  it('detects guarantee phrases', () => {
    const r = lintContent('이 상품은 평생 보장 됩니다. 손해 없습니다.');
    expect(r.guarantee_phrases.length).toBeGreaterThanOrEqual(2);
    expect(r.must_fix).toBe(true);
  });

  it('detects insurer name even in neutral context', () => {
    // 단순 언급만으로 차단되어야 함
    const r = lintContent('삼성생명이 신상품을 출시했다고 발표했다.');
    expect(r.insurer_mentions).toContain('삼성생명');
    expect(r.must_fix).toBe(true);
    expect(r.risk_score).toBeGreaterThanOrEqual(50);
  });

  it('detects multiple insurer names', () => {
    const r = lintContent('현대해상과 DB손해보험이 협의 중이다.');
    expect(r.insurer_mentions).toEqual(expect.arrayContaining(['현대해상', 'DB손해보험']));
    expect(r.must_fix).toBe(true);
  });

  it('detects product name in quotes', () => {
    const r = lintContent('"행복한 노후 연금보험"이 출시되었다.');
    expect(r.product_mentions.length).toBeGreaterThanOrEqual(1);
    expect(r.must_fix).toBe(true);
  });

  it('caps risk_score at 100', () => {
    const text = '삼성생명 한화생명 교보생명 최고 100% 다른 보험사보다 좋고 보장됩니다.';
    expect(lintContent(text).risk_score).toBe(100);
  });

  it('produces suggestions for each detection', () => {
    const r = lintContent('100% 보장됩니다. 삼성화재 분석.');
    expect(r.suggestions.some(s => s.includes('100%'))).toBe(true);
    expect(r.suggestions.some(s => s.includes('삼성화재'))).toBe(true);
  });

  it('keeps must_fix false for benign single mention', () => {
    expect(lintContent('해당 상품은 가입 조건이 있습니다.').must_fix).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트 실행 (RED)**

Run: `npm test` → Expected: 10 failed (compliance-lint.ts 미존재)

- [ ] **Step 4: `lib/content/compliance-lint.ts`**
```ts
import {
  ABSOLUTE_TERMS, COMPARISON_PATTERNS, GUARANTEE_TERMS,
  INSURER_NAMES, PRODUCT_NAME_PATTERNS,
} from './forbidden-terms';
import type { LintResult } from './types';

const W_FORBIDDEN = 20;
const W_COMPARISON = 15;
const W_GUARANTEE = 25;
const W_INSURER = 50;       // 단독 언급만으로 must_fix
const W_PRODUCT = 40;
const MUST_FIX_THRESHOLD = 30;

export function lintContent(text: string): LintResult {
  const forbidden_terms_found = ABSOLUTE_TERMS.filter(t => text.includes(t));

  const comparison_phrases: string[] = [];
  for (const { pattern, label } of COMPARISON_PATTERNS) {
    const m = text.match(pattern);
    if (m) for (const x of m) comparison_phrases.push(`${label}: "${x}"`);
  }

  const guarantee_phrases = GUARANTEE_TERMS.filter(t => text.includes(t));

  const insurer_mentions = INSURER_NAMES.filter(n => text.includes(n));

  const product_mentions: string[] = [];
  for (const { pattern, label } of PRODUCT_NAME_PATTERNS) {
    const m = text.match(pattern);
    if (m) for (const x of m) product_mentions.push(`${label}: "${x}"`);
  }

  const raw =
    forbidden_terms_found.length * W_FORBIDDEN +
    comparison_phrases.length * W_COMPARISON +
    guarantee_phrases.length * W_GUARANTEE +
    insurer_mentions.length * W_INSURER +
    product_mentions.length * W_PRODUCT;
  const risk_score = Math.min(100, raw);
  const must_fix = risk_score >= MUST_FIX_THRESHOLD;

  const suggestions: string[] = [];
  for (const t of forbidden_terms_found) suggestions.push(`광고 절대표현 "${t}" 제거 또는 정량 표현으로 대체`);
  for (const c of comparison_phrases) suggestions.push(`비교 표현 ${c} 삭제 — 객관적 사실만 기술`);
  for (const g of guarantee_phrases) suggestions.push(`보장성 단정 "${g}" 제거 — 약관 조건 명시`);
  for (const n of insurer_mentions) suggestions.push(`보험사명 "${n}" 익명화 — "한 생명보험사", "주요 손해보험사" 등으로 대체`);
  for (const p of product_mentions) suggestions.push(`상품명 ${p} 일반명사로 대체 — "실손의료보험", "암보험" 등`);

  return {
    forbidden_terms_found,
    comparison_phrases,
    guarantee_phrases,
    insurer_mentions,
    product_mentions,
    risk_score,
    must_fix,
    suggestions,
  };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test` → Expected: 10 passed

- [ ] **Step 6: 커밋**
```bash
git add lib/content/forbidden-terms.ts lib/content/compliance-lint.ts lib/content/compliance-lint.test.ts
git commit -m "feat(content-hub): 룰엔진 v2 (보험사명·상품명 단독 차단 포함)"
```

---

## Task 3: RSS 수집 + Gemini 요약 (익명화 강화, TDD)

**Files:** Create `lib/content/rss-fetcher.ts(.test.ts)`, `lib/content/news-collector.ts(.test.ts)`, `lib/content/generator.ts`.

- [ ] **Step 1: `lib/content/rss-fetcher.test.ts`**
```ts
import { describe, it, expect } from 'vitest';
import { parseRSSXml } from './rss-fetcher';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>한국보험신문</title>
  <item>
    <title><![CDATA[자동차보험 손해율 발표]]></title>
    <link>https://example.com/a/1</link>
    <pubDate>Sat, 02 May 2026 09:00:00 +0900</pubDate>
    <description><![CDATA[<p>금감원이 발표한...</p>]]></description>
  </item>
  <item>
    <title>실손보험 약관 개정</title>
    <link>https://example.com/a/2</link>
    <pubDate>Sat, 02 May 2026 10:00:00 +0900</pubDate>
    <description>실손보험 4세대 약관이...</description>
  </item>
</channel></rss>`;

describe('parseRSSXml', () => {
  it('parses CDATA + HTML descriptions', () => {
    const items = parseRSSXml(SAMPLE, '한국보험신문');
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('자동차보험 손해율 발표');
    expect(items[0].source).toBe('한국보험신문');
    expect(items[0].description).toContain('금감원');
  });
  it('returns empty on malformed', () => {
    expect(parseRSSXml('<not-xml', 'X')).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행 (RED)** — `npm test` → 2 failed.

- [ ] **Step 3: `lib/content/rss-fetcher.ts`**
```ts
import { XMLParser } from 'fast-xml-parser';
import type { RSSItem } from './types';

const parser = new XMLParser({
  ignoreAttributes: true,
  cdataPropName: '__cdata',
  parseTagValue: true,
});

function pickText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o.__cdata === 'string') return o.__cdata;
    if (typeof o['#text'] === 'string') return o['#text'] as string;
  }
  return String(node);
}

export function parseRSSXml(xml: string, sourceName: string): RSSItem[] {
  let parsed: unknown;
  try { parsed = parser.parse(xml); } catch { return []; }
  const channel = (parsed as any)?.rss?.channel;
  if (!channel) return [];
  const raw = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
  return raw.map((it: any): RSSItem => ({
    source: sourceName,
    title: pickText(it.title).trim(),
    link: pickText(it.link).trim(),
    pubDate: new Date(pickText(it.pubDate)).toISOString(),
    description: pickText(it.description),
  })).filter((it: RSSItem) => it.title && it.link);
}

export async function fetchRSS(url: string, sourceName: string): Promise<RSSItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'amazing-biz-blog/1.0 (content-hub)' },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.warn(`[rss-fetcher] ${sourceName} ${url} → HTTP ${res.status}`);
    return [];
  }
  return parseRSSXml(await res.text(), sourceName);
}
```

- [ ] **Step 4: 테스트 통과 확인** — `npm test` → 12 passed.

- [ ] **Step 5: `lib/content/news-collector.test.ts`**
```ts
import { describe, it, expect } from 'vitest';
import { dedupeArticles, hashArticle } from './news-collector';
import type { RSSItem } from './types';

const mk = (title: string, desc: string, source = 'A'): RSSItem => ({
  source, title, link: `https://x/${encodeURIComponent(title)}`,
  pubDate: '2026-05-02T09:00:00.000Z', description: desc,
});

describe('hashArticle', () => {
  it('stable hash', () => {
    expect(hashArticle('a','b')).toBe(hashArticle('a','b'));
    expect(hashArticle('a','b')).toMatch(/^[0-9a-f]{64}$/);
  });
  it('differs on content change', () => {
    expect(hashArticle('a','b')).not.toBe(hashArticle('a','c'));
  });
});

describe('dedupeArticles', () => {
  it('removes exact duplicates', () => {
    const items = [mk('t1','x'), mk('t1','x','B'), mk('t2','y')];
    expect(dedupeArticles(items, new Set())).toHaveLength(2);
  });
  it('removes already-seen', () => {
    const a = mk('seen','body');
    const seen = new Set([hashArticle(a.title, a.description.slice(0,200))]);
    const out = dedupeArticles([a, mk('new','body')], seen);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('new');
  });
  it('strips HTML in excerpt', () => {
    const out = dedupeArticles([mk('t','<p>본문 <b>강조</b> 끝</p>')], new Set());
    expect(out[0].excerpt).toBe('본문 강조 끝');
  });
});
```

- [ ] **Step 6: 테스트 실행 (RED)** — `npm test` → 5 추가 failed.

- [ ] **Step 7: `lib/content/news-collector.ts`**
```ts
import { createHash } from 'node:crypto';
import { fetchRSS } from './rss-fetcher';
import type { CandidateArticle, RSSItem } from './types';

export function hashArticle(title: string, excerptOrDesc: string): string {
  const norm = (title.trim() + '|' + excerptOrDesc.trim().slice(0, 200)).replace(/\s+/g, ' ');
  return createHash('sha256').update(norm).digest('hex');
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function dedupeArticles(items: RSSItem[], seenHashes: Set<string>): CandidateArticle[] {
  const out: CandidateArticle[] = [];
  const local = new Set<string>();
  for (const it of items) {
    const excerpt = stripHtml(it.description).slice(0, 200);
    const h = hashArticle(it.title, excerpt);
    if (seenHashes.has(h) || local.has(h)) continue;
    local.add(h);
    out.push({
      source: it.source, title: it.title, link: it.link,
      pubDate: it.pubDate, excerpt, contentHash: h,
    });
  }
  return out;
}

export type CollectorSource = { name: string; url: string };

export async function collectDailyNews(
  sources: CollectorSource[], recentHashes: Set<string>,
): Promise<CandidateArticle[]> {
  const lists = await Promise.all(
    sources.map(({ url, name }) =>
      fetchRSS(url, name).catch(err => {
        console.warn(`[news-collector] ${name} 실패`, err);
        return [];
      }),
    ),
  );
  const flat = lists.flat();
  const cutoff = Date.now() - 36 * 60 * 60 * 1000;
  const recent = flat.filter(it => new Date(it.pubDate).getTime() >= cutoff);
  return dedupeArticles(recent, recentHashes);
}

export function parseRssSourcesEnv(env: string | undefined): CollectorSource[] {
  if (!env) return [];
  return env.split(',').map(p => {
    const [name, url] = p.split('|').map(s => s.trim());
    return { name, url };
  }).filter(s => s.name && s.url);
}
```

- [ ] **Step 8: 테스트 통과 확인** — `npm test` → 17 passed.

- [ ] **Step 9: `lib/content/generator.ts` (익명화 강화)**
```ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CandidateArticle, EnforcementMode, GeneratedSummary } from './types';

const ANONYMIZATION_RULES = `
**중요**: 원문 기사에 등장하는 모든 보험사명·상품명은 본문에서 다음과 같이 익명화하세요:
- 보험사명("삼성생명","DB손해보험","현대해상" 등) → "한 생명보험사","주요 손해보험사","업계","대형 보험사" 등
- 상품명("○○보험","○○플랜" 등) → "실손의료보험","자동차보험","암보험" 등 일반명사
- 인용이 불가피해도 회사명·상품명은 본문에 절대 노출 금지.

다음 광고 표현도 절대 금지:
- 절대표현: 최고/최상/최저/최대/제일/유일/100%/완벽/확실/절대/무조건
- 비교표현: 다른 보험사보다, 타사 대비, 업계 1위
- 보장단정: "보장됩니다", "확실히 받을 수 있", "평생 보장", "원금 보장"

정량 사실(통계·금감원/금융위 발표·약관 변경 등)만 정보성 톤으로 서술.
`;

const TEMPLATE = (article: CandidateArticle, mode: EnforcementMode) => `
당신은 보험 정보 전문 에디터입니다. 아래 기사 메타를 바탕으로 600~900자 분량의 정보성 보도 요약을 작성하세요.
출력은 JSON 한 객체만, 코드블록 없이:
{ "title": "...", "body_md": "..." }

요구사항:
- 톤: 객관적·중립·정보성. 광고·권유성 어조 금지.
- 본문은 마크다운, 단락 2~4개. 첫 단락에 핵심 사실 요약, 이후 배경/숫자/맥락.
- 출처는 본문 마지막에 "[출처: ${article.source}](${article.link})" 형태 1줄.

${ANONYMIZATION_RULES}

[기사 메타]
- 매체: ${article.source}
- 원제: ${article.title}
- 발행일: ${article.pubDate}
- 원문 발췌: ${article.excerpt}
`;

export async function generateNewsSummary(
  article: CandidateArticle, mode: EnforcementMode,
): Promise<GeneratedSummary> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(TEMPLATE(article, mode));
  const text = result.response.text().trim();
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('Gemini 응답 JSON 미발견: ' + text.slice(0, 200));
  const obj = JSON.parse(text.slice(s, e + 1));
  if (typeof obj.title !== 'string' || typeof obj.body_md !== 'string') {
    throw new Error('Gemini 응답 형식 오류');
  }
  return { title: obj.title, body_md: obj.body_md };
}
```

- [ ] **Step 10: `lib/content/cafe-formatter.test.ts`**
```ts
import { describe, it, expect } from 'vitest';
import { mdToCafeText } from './cafe-formatter';

describe('mdToCafeText', () => {
  it('strips heading markers', () => {
    expect(mdToCafeText('# 제목\n\n본문')).toContain('제목');
    expect(mdToCafeText('# 제목\n\n본문')).not.toContain('#');
  });
  it('preserves link as "텍스트 (URL)"', () => {
    const out = mdToCafeText('[출처: A](https://x/1)');
    expect(out).toContain('출처: A');
    expect(out).toContain('https://x/1');
  });
  it('drops bold/italic/code markers', () => {
    expect(mdToCafeText('**굵게** *기울* `코드`')).toBe('굵게 기울 코드');
  });
  it('keeps paragraph breaks', () => {
    const out = mdToCafeText('첫 단락\n\n둘째 단락');
    expect(out).toMatch(/첫 단락\n\n둘째 단락/);
  });
});
```

- [ ] **Step 11: 테스트 실행 (RED)** — 4 failed.

- [ ] **Step 12: `lib/content/cafe-formatter.ts`**
```ts
// 마크다운 → 카페 본문 plain text 변환
// 카페 에디터는 마크다운 미지원이므로 마커를 제거하고 공백만 정리.

export function mdToCafeText(md: string): string {
  return md
    // 헤딩 #
    .replace(/^#{1,6}\s+/gm, '')
    // 링크 [text](url) → "text (url)"
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    // 굵게/기울임/코드
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    // 인라인 이미지 마커 (없을 가능성 크지만 방어)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // 리스트 -, * → 그대로 두고 마커는 보존 (카페에서 보기 좋게)
    .trim();
}
```

- [ ] **Step 13: 테스트 통과 확인** — `npm test` → 21 passed.

- [ ] **Step 14: 빌드 검증**
Run: `npm run build` → Expected: 성공.

- [ ] **Step 15: 커밋**
```bash
git add lib/content/rss-fetcher.ts lib/content/rss-fetcher.test.ts lib/content/news-collector.ts lib/content/news-collector.test.ts lib/content/generator.ts lib/content/cafe-formatter.ts lib/content/cafe-formatter.test.ts
git commit -m "feat(content-hub): RSS+중복제거+Gemini 익명화 요약+카페 포매터"
```

---

## Task 4: 어드민 페이지 + 액션

**Files:** Create `lib/admin/guard.ts`, `app/admin/content/layout.tsx`, `app/admin/content/news/page.tsx`, `app/admin/content/news/[id]/page.tsx`, `app/admin/content/news/[id]/NewsActions.tsx`, `app/api/admin/content/news/[id]/{reject,relint,publish-mark,download}/route.ts`.

- [ ] **Step 1: `lib/admin/guard.ts`**
```ts
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = raw?.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '');
  let role: string | null = null;
  if (key && key.length >= 50 && key.startsWith('eyJ')) {
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
    const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
    role = (data?.role as string) ?? null;
  } else {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    role = (data?.role as string) ?? null;
  }
  if (role !== 'admin') redirect('/dashboard');
  return { user, supabase };
}

export function adminClient() {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = raw?.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}
```

- [ ] **Step 2: `app/admin/content/layout.tsx`**
```tsx
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← 어드민</Link>
          <h1 className="text-lg font-semibold">Content Hub</h1>
          <nav className="ml-auto flex gap-4 text-sm">
            <Link href="/admin/content/news">보험뉴스</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: `app/admin/content/news/page.tsx`**
```tsx
import Link from 'next/link';
import { adminClient } from '@/lib/admin/guard';

const STATUSES = ['review','published','expired','failed','all'] as const;
type Status = typeof STATUSES[number];

export default async function NewsListPage({
  searchParams,
}: { searchParams?: Promise<{ status?: string }> }) {
  const sp = (await searchParams) ?? {};
  const status = (STATUSES.includes(sp.status as Status) ? sp.status : 'review') as Status;

  const supa = adminClient();
  let q = supa.from('content_items')
    .select('id, title, status, source_refs, created_at')
    .eq('type', 'news').order('created_at', { ascending: false }).limit(100);
  if (status !== 'all') q = q.eq('status', status);
  const { data: items = [] } = await q;

  // 각 item의 최신 lint risk_score
  const ids = (items ?? []).map((r: any) => r.id);
  const lintMap = new Map<string, number>();
  if (ids.length) {
    const { data: lints } = await supa.from('compliance_lints')
      .select('content_id, risk_score, created_at')
      .in('content_id', ids).order('created_at', { ascending: false });
    for (const l of lints ?? []) {
      if (!lintMap.has(l.content_id)) lintMap.set(l.content_id, l.risk_score);
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {STATUSES.map(s => (
          <Link key={s} href={`/admin/content/news?status=${s}`}
            className={`rounded border px-3 py-1 text-sm ${s===status?'bg-black text-white':'bg-white'}`}>{s}</Link>
        ))}
      </div>
      <table className="w-full border bg-white text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">제목</th>
            <th className="p-2">상태</th>
            <th className="p-2">위험도</th>
            <th className="p-2">출처</th>
            <th className="p-2">생성</th>
          </tr>
        </thead>
        <tbody>
          {(items ?? []).map((row: any) => (
            <tr key={row.id} className="border-t hover:bg-gray-50">
              <td className="p-2">
                <Link href={`/admin/content/news/${row.id}`} className="text-blue-600 hover:underline">{row.title}</Link>
              </td>
              <td className="p-2 text-center">{row.status}</td>
              <td className="p-2 text-center">{lintMap.get(row.id) ?? '-'}</td>
              <td className="p-2 text-center">{row.source_refs?.[0]?.source ?? '-'}</td>
              <td className="p-2 text-center text-gray-500">{new Date(row.created_at).toLocaleString('ko-KR')}</td>
            </tr>
          ))}
          {(!items || items.length === 0) && (
            <tr><td colSpan={5} className="p-6 text-center text-gray-500">항목 없음</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: `app/admin/content/news/[id]/page.tsx`**
```tsx
import { notFound } from 'next/navigation';
import { adminClient } from '@/lib/admin/guard';
import NewsActions from './NewsActions';

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supa = adminClient();
  const { data: item } = await supa.from('content_items').select('*').eq('id', id).single();
  if (!item) notFound();
  const { data: lint } = await supa.from('compliance_lints')
    .select('*').eq('content_id', id).order('created_at', { ascending: false }).limit(1).single();

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <article className="rounded border bg-white p-6 md:col-span-2">
        <h2 className="mb-2 text-2xl font-bold">{item.title}</h2>
        <div className="mb-4 text-sm text-gray-500">상태: {item.status} · {new Date(item.created_at).toLocaleString('ko-KR')}</div>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-7">{item.body_md}</pre>
      </article>
      <aside className="rounded border bg-white p-4">
        <h3 className="mb-2 font-semibold">사전검수</h3>
        {lint ? (
          <ul className="space-y-1 text-sm">
            <li>위험도: <strong>{lint.risk_score}</strong></li>
            <li>금지표현: {lint.forbidden_terms_found?.join(', ') || '-'}</li>
            <li>비교표현: {lint.comparison_phrases?.join(', ') || '-'}</li>
            <li>보장단정: {lint.guarantee_phrases?.join(', ') || '-'}</li>
            <li className="text-red-700">보험사명: {lint.insurer_mentions?.join(', ') || '-'}</li>
            <li className="text-red-700">상품명: {lint.product_mentions?.join(', ') || '-'}</li>
          </ul>
        ) : <p className="text-sm text-gray-500">검수 결과 없음</p>}
        <hr className="my-4" />
        <NewsActions
          id={item.id}
          status={item.status}
          title={item.title}
          bodyMd={item.body_md ?? ''}
          publishUrl={item.publish_url ?? ''}
        />
      </aside>
    </div>
  );
}
```

- [ ] **Step 5: `app/admin/content/news/[id]/NewsActions.tsx`**
```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = { id: string; status: string; title: string; bodyMd: string; publishUrl: string };

export default function NewsActions({ id, status, title, bodyMd, publishUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(publishUrl);

  async function copyToCafe() {
    setBusy(true);
    const res = await fetch(`/api/admin/content/news/${id}/download?format=cafe-text`);
    const text = await res.text();
    setBusy(false);
    if (!res.ok) { alert('복사 준비 실패'); return; }
    await navigator.clipboard.writeText(text);
    alert('카페용 텍스트가 클립보드에 복사되었습니다.');
  }

  function downloadMd() {
    const blob = new Blob([`# ${title}\n\n${bodyMd}\n`], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function call(path: string, label: string, body?: any) {
    if (!confirm(`${label} 진행할까요?`)) return;
    setBusy(true);
    const res = await fetch(path, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) { alert(`${label} 실패: ${await res.text()}`); return; }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button disabled={busy} onClick={copyToCafe}
        className="w-full rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50">
        카페용 복사 (클립보드)
      </button>
      <button disabled={busy} onClick={downloadMd}
        className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50">
        .md 다운로드
      </button>
      <hr className="my-2" />
      <input
        type="url"
        placeholder="카페 게시 URL (선택)"
        value={url}
        onChange={e => setUrl(e.target.value)}
        className="w-full rounded border px-2 py-1 text-sm"
      />
      <button
        disabled={busy || status === 'published'}
        onClick={() => call(`/api/admin/content/news/${id}/publish-mark`, '발행 완료 마킹', { publish_url: url || null })}
        className="w-full rounded bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-50">
        발행 완료
      </button>
      <hr className="my-2" />
      <button disabled={busy || status === 'expired'} onClick={() => call(`/api/admin/content/news/${id}/reject`, '거절')}
        className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50">거절</button>
      <button disabled={busy} onClick={() => call(`/api/admin/content/news/${id}/relint`, '재검수')}
        className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50">재검수</button>
    </div>
  );
}
```

- [ ] **Step 6: `app/api/admin/content/news/[id]/reject/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { requireAdmin, adminClient } from '@/lib/admin/guard';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  await adminClient().from('content_items').update({ status: 'expired' }).eq('id', id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: `app/api/admin/content/news/[id]/relint/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { requireAdmin, adminClient } from '@/lib/admin/guard';
import { lintContent } from '@/lib/content/compliance-lint';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const supa = adminClient();
  const { data: item } = await supa.from('content_items').select('body_md').eq('id', id).single();
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const lint = lintContent(item.body_md ?? '');
  await supa.from('compliance_lints').insert({
    content_id: id,
    forbidden_terms_found: lint.forbidden_terms_found,
    comparison_phrases: lint.comparison_phrases,
    guarantee_phrases: lint.guarantee_phrases,
    insurer_mentions: lint.insurer_mentions,
    product_mentions: lint.product_mentions,
    risk_score: lint.risk_score,
    must_fix: lint.must_fix,
    raw_report: lint,
  });
  return NextResponse.json({ ok: true, lint });
}
```

- [ ] **Step 8: `app/api/admin/content/news/[id]/publish-mark/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { requireAdmin, adminClient } from '@/lib/admin/guard';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const { publish_url } = await req.json().catch(() => ({}));
  await adminClient().from('content_items').update({
    status: 'published',
    publish_url: publish_url ?? null,
    published_at: new Date().toISOString(),
  }).eq('id', id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 9: `app/api/admin/content/news/[id]/download/route.ts`**
```ts
import { requireAdmin, adminClient } from '@/lib/admin/guard';
import { mdToCafeText } from '@/lib/content/cafe-formatter';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') ?? 'md';

  const { data: item } = await adminClient()
    .from('content_items').select('title, body_md').eq('id', id).single();
  if (!item) return new Response('not found', { status: 404 });

  if (format === 'cafe-text') {
    const text = `${item.title}\n\n${mdToCafeText(item.body_md ?? '')}`;
    return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  // default md
  const md = `# ${item.title}\n\n${item.body_md ?? ''}\n`;
  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="news-${id}.md"`,
    },
  });
}
```

- [ ] **Step 10: 빌드** — `npm run build` → 성공.

- [ ] **Step 11: 커밋**
```bash
git add lib/admin/guard.ts app/admin/content app/api/admin/content
git commit -m "feat(content-hub): 어드민 뉴스 목록/상세 + 카페복사·다운로드·발행마킹·재검수·거절 API"
```

---

## Task 5: daily-build cron (반자동, 모두 review로 입력)

**Files:** Create `lib/cron-auth.ts`, `app/api/cron/daily-build/route.ts`, `vercel.json`.

- [ ] **Step 1: `lib/cron-auth.ts`**
```ts
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}
```

- [ ] **Step 2: `app/api/cron/daily-build/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin/guard';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { collectDailyNews, parseRssSourcesEnv } from '@/lib/content/news-collector';
import { generateNewsSummary } from '@/lib/content/generator';
import { lintContent } from '@/lib/content/compliance-lint';
import type { EnforcementMode } from '@/lib/content/types';

const DAILY_LIMIT = 5;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supa = adminClient();

  const { data: setting } = await supa
    .from('content_settings').select('value').eq('key', 'news.enforcement_mode').single();
  const mode: EnforcementMode = (setting?.value as any) ?? 'open';

  const { data: recent = [] } = await supa
    .from('content_items').select('source_refs')
    .eq('type', 'news').gte('created_at', new Date(Date.now() - 7 * 86400_000).toISOString());
  const seen = new Set<string>();
  for (const r of recent ?? []) {
    for (const ref of (r.source_refs ?? []) as Array<{ contentHash?: string }>) {
      if (ref.contentHash) seen.add(ref.contentHash);
    }
  }

  const sources = parseRssSourcesEnv(process.env.RSS_SOURCES);
  if (sources.length === 0) return NextResponse.json({ error: 'RSS_SOURCES not configured' }, { status: 500 });

  const candidates = await collectDailyNews(sources, seen);
  const picked = candidates.slice(0, DAILY_LIMIT);

  const summary = { collected: candidates.length, generated: 0, failed: 0 };
  for (const c of picked) {
    try {
      const gen = await generateNewsSummary(c, mode);
      const lint = lintContent(gen.body_md);
      const { data: inserted, error } = await supa
        .from('content_items').insert({
          type: 'news',
          title: gen.title,
          body_md: gen.body_md,
          source_refs: [{ source: c.source, link: c.link, pubDate: c.pubDate, contentHash: c.contentHash }],
          status: 'review',                  // 반자동 — 항상 review
          enforcement_mode: mode,
        }).select('id').single();
      if (error || !inserted) throw error ?? new Error('insert failed');
      await supa.from('compliance_lints').insert({
        content_id: inserted.id,
        forbidden_terms_found: lint.forbidden_terms_found,
        comparison_phrases: lint.comparison_phrases,
        guarantee_phrases: lint.guarantee_phrases,
        insurer_mentions: lint.insurer_mentions,
        product_mentions: lint.product_mentions,
        risk_score: lint.risk_score,
        must_fix: lint.must_fix,
        raw_report: lint,
      });
      summary.generated++;
    } catch (err: any) {
      console.error('[daily-build] item failed', c.title, err?.message);
      summary.failed++;
    }
  }
  return NextResponse.json({ ok: true, mode, ...summary });
}
```

- [ ] **Step 3: `vercel.json`**
```json
{
  "crons": [
    { "path": "/api/cron/daily-build", "schedule": "0 21 * * *" }
  ]
}
```
> UTC 21:00 = KST 06:00. Vercel은 환경변수 `CRON_SECRET` 설정 시 cron 호출에 자동으로 `Authorization: Bearer ${CRON_SECRET}` 헤더를 붙임.

- [ ] **Step 4: 빌드** — `npm run build` → 성공.

- [ ] **Step 5: 커밋**
```bash
git add lib/cron-auth.ts app/api/cron vercel.json
git commit -m "feat(content-hub): daily-build cron (반자동: 모두 review로 입력)"
```

---

## Task 6: 통합 검증 (수동 E2E)

- [ ] **Step 1: `.env.local` 채우기 (사용자)**
- `GEMINI_API_KEY` (기존)
- `SUPABASE_SERVICE_ROLE_KEY` (기존)
- `CRON_SECRET` — `openssl rand -hex 32` 또는 PowerShell `[Convert]::ToHexString((1..32 | %{ Get-Random -Maximum 256 }))`
- `RSS_SOURCES` — 형식: `한국보험신문|<URL>,보험매일|<URL>,인슈넷|<URL>` (실제 RSS URL 확인 후 입력)

- [ ] **Step 2: dev 서버 시작**
```
npm run dev
```

- [ ] **Step 3: daily-build 수동 트리거**
PowerShell:
```powershell
$env_text = Get-Content .env.local -Raw
$secret = ($env_text | Select-String 'CRON_SECRET=([^\s]+)').Matches[0].Groups[1].Value
curl.exe -H "Authorization: Bearer $secret" http://localhost:3000/api/cron/daily-build
```
Expected: `{ "ok": true, "mode": "open", "collected": N, "generated": M, "failed": 0 }` (M ≤ 5)

문제 시:
- `collected: 0` → RSS_SOURCES 형식·URL 확인
- `generated: 0` → GEMINI_API_KEY 확인 또는 모델 응답 형식 로그

- [ ] **Step 4: 어드민에서 확인**
브라우저로 `/admin/content/news?status=review` → 항목 N개 표시 확인.
상세 페이지 진입 → 본문 + lint 카드(보험사명·상품명 행이 비어 있어야 정상, 있으면 익명화 실패 → generator 프롬프트 강화 또는 재검수)

- [ ] **Step 5: 카페 복사·붙여넣기 워크플로우**
1. 상세 페이지 → "카페용 복사" 클릭 → 클립보드에 plain text 들어감 확인 (메모장 등에 붙여넣기로 검증)
2. 카페에 실제 게시 (선택)
3. 카페 URL 입력 후 "발행 완료" 클릭 → `/admin/content/news?status=published`로 이동 확인

- [ ] **Step 6: 룰엔진 검출 검증**
1. 어드민 상세에서 본문 끝에 일부러 "삼성생명 분석" 추가하고 (DB 직접 수정 또는 빠른 테스트로) "재검수" 클릭
2. lint 결과의 보험사명 행에 "삼성생명" 등장하는지 확인

- [ ] **Step 7: 최종 커밋 (검증 통과)**
```bash
git commit --allow-empty -m "chore(content-hub): sprint 1 통합 검증 통과 (반자동 보험뉴스 E2E)"
```

---

## Self-Review

1. **사양서 매핑**:
   - 4.1 content_items ✅ (publish_url 컬럼 추가, publish_jobs/compliance_records는 다음 sprint)
   - 4.5 compliance_lints ✅ (별도 테이블 + insurer_mentions/product_mentions 신규)
   - 부록 A.2 Step 1~7 → Task 0~6에 매핑 (단, Step 5 채널 어댑터 = "카페 복사/다운로드"로 변경, Step 6 publish cron = 다음 sprint)
   - 부록 A.4 룰엔진/생성기 → 보험사명·상품명 차단 보강 반영
2. **타입 일관성**: `LintResult.insurer_mentions/product_mentions` ↔ DB `compliance_lints` 컬럼 ↔ 어드민 표시 일치.
3. **placeholder 없음**: 모든 코드 블록 실제 동작.
4. **외부 작업**: Supabase SQL 적용(Task 1), `.env.local` 채우기(Task 6) — 두 군데뿐.

---

진행: Inline. Task 0부터 즉시 실행.
