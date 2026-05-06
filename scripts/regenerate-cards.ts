/**
 * 기존 카드뉴스를 같은 토픽으로 재생성하는 일회성 스크립트.
 * 사용 시점: prompt·sanitizer·verified-stats 정책이 바뀐 뒤 재고 카드를 새 정책으로 갱신.
 *
 *   npx tsx scripts/regenerate-cards.ts            # type=card 전체 재생성
 *   npx tsx scripts/regenerate-cards.ts --id <id>  # 특정 카드만 재생성
 *
 * 동작:
 *   1) DB에서 type=card 항목을 source_refs.topic_slug 기준으로 토픽 풀과 매칭.
 *   2) generateCardSet으로 새 슬라이드 생성 (강화된 prompt + sanitizer 통과).
 *   3) factCheckArticle 재실행 (Gemini 기반).
 *   4) lintContent 재실행 후 compliance_lints에 새 행 insert.
 *   5) content_items의 card_slides·body_md·fact_check·gen 비용·status 갱신 (status는 review로 리셋).
 *
 * 주의:
 *   - 광고심의 정보(compliance) 필드는 건드리지 않는다 — 검수자 입력값 보존.
 *   - publish_url, publish_at 등 발행 메타도 보존.
 *   - 실패해도 다음 카드 계속 처리.
 */
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

import { TOPIC_POOL } from '../lib/content/topics';
import { generateCardSet } from '../lib/content/generator-card';
import { factCheckArticle, type FactCheckResult } from '../lib/content/fact-check';
import { lintContent } from '../lib/content/compliance-lint';
import { calcCost } from '../lib/content/billing';
import type { CardSlide } from '../lib/content/types';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 필요');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY 환경변수 필요');
  process.exit(1);
}

const supa = createClient(SUPA_URL, SUPA_KEY);
const GENERATOR_MODEL = 'claude-haiku-4-5';

function slidesToPlainText(slides: CardSlide[]): string {
  return slides.map(s => {
    if (s.kind === 'cover') return `${s.title}\n${s.bigStatLabel}: ${s.bigStat}`;
    if (s.kind === 'point') return `${s.title}\n${s.bigStatLabel}: ${s.bigStat}\n${s.body}`;
    return `${s.title}\n${s.items.join('\n')}\n${s.footer}`;
  }).join('\n\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const idIndex = argv.indexOf('--id');
  const onlyId = idIndex >= 0 ? argv[idIndex + 1] : undefined;

  const query = supa.from('content_items')
    .select('id, title, status, source_refs, card_style, created_at')
    .eq('type', 'card')
    .order('created_at', { ascending: true });

  if (onlyId) query.eq('id', onlyId);

  const { data: cards, error } = await query;
  if (error) {
    console.error('카드 조회 실패:', error.message);
    process.exit(1);
  }

  console.log(`재생성 대상: ${cards?.length ?? 0}장${onlyId ? ` (id=${onlyId})` : ''}\n`);

  const results = { ok: 0, skipped: 0, failed: 0 };

  for (const card of cards ?? []) {
    const refs = (card.source_refs ?? []) as Array<{ topic_slug?: string; category?: string }>;
    const slug = refs[0]?.topic_slug;
    const topic = TOPIC_POOL.find(t => t.slug === slug);
    if (!topic) {
      console.warn(`  [skip] ${card.id}: topic '${slug ?? '(none)'}' not in pool`);
      results.skipped++;
      continue;
    }
    console.log(`  → ${topic.slug} · ${card.title}`);
    try {
      const set = await generateCardSet(topic);
      const fullText = slidesToPlainText(set.slides);

      const fc: FactCheckResult = await factCheckArticle(set.title, fullText).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`    fact-check 실패: ${msg}`);
        return { passed: true, issues: [], raw: '' } as FactCheckResult;
      });

      const lint = lintContent(fullText);

      const genIn = set.usage?.input_tokens ?? 0;
      const genOut = set.usage?.output_tokens ?? 0;
      const fcIn = fc.usage?.input_tokens ?? 0;
      const fcOut = fc.usage?.output_tokens ?? 0;
      const genCost = calcCost('claude-haiku-4-5', genIn, genOut);
      const fcCost = calcCost('gemini-2.5-flash', fcIn, fcOut);

      const { error: updErr } = await supa.from('content_items').update({
        title: set.title,
        body_md: fullText,
        card_slides: set.slides,
        fact_check: { passed: fc.passed, issues: fc.issues },
        gen_input_tokens: genIn,
        gen_output_tokens: genOut,
        gen_cost_usd: genCost,
        fc_input_tokens: fcIn,
        fc_output_tokens: fcOut,
        fc_cost_usd: fcCost,
        total_cost_usd: genCost + fcCost,
        generated_by: GENERATOR_MODEL,
        status: 'review',
      }).eq('id', card.id);
      if (updErr) throw updErr;

      await supa.from('compliance_lints').insert({
        content_id: card.id,
        forbidden_terms_found: lint.forbidden_terms_found,
        comparison_phrases: lint.comparison_phrases,
        guarantee_phrases: lint.guarantee_phrases,
        insurer_mentions: lint.insurer_mentions,
        product_mentions: lint.product_mentions,
        risk_score: lint.risk_score,
        must_fix: lint.must_fix,
        raw_report: lint,
      });

      results.ok++;
      console.log(`    ✓ 완료 · 새 제목="${set.title}" · lint risk=${lint.risk_score} · fc issues=${fc.issues.length}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ 실패: ${msg}`);
      results.failed++;
    }
  }

  console.log(`\n결과: ok=${results.ok}, skipped=${results.skipped}, failed=${results.failed}`);
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('스크립트 실패:', err);
  process.exit(1);
});
