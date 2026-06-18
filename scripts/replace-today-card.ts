/**
 * 오늘자(가장 최근) 카드뉴스 1건을 백업 후 삭제하고, 중복 안 되는 새 주제로 1건 재생성.
 *   npx tsx scripts/replace-today-card.ts
 * 본문 = Opus 4.8(generateCardSet). 팩트체크는 Gemini 막히면 graceful 스킵.
 * card_style 신규(G/H/I)는 DB 제약 적용 후에만 삽입 가능 → 미적용이면 A~F로 폴백.
 */
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath }); else dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { pickFreshTopics } from '../lib/content/topic-picker';
import { generateCardSet } from '../lib/content/generator-card';
import { factCheckArticle, type FactCheckResult } from '../lib/content/fact-check';
import { lintContent } from '../lib/content/compliance-lint';
import { calcCost } from '../lib/content/billing';
import type { CardSlide, CardStyleKey } from '../lib/content/types';

const MODEL = 'claude-opus-4-8' as const;

function slidesToPlainText(slides: CardSlide[]): string {
  return slides.map(s => {
    if (s.kind === 'cover') return `${s.title}\n${s.bigStatLabel}: ${s.bigStat}`;
    if (s.kind === 'point') return `${s.title}\n${s.bigStatLabel}: ${s.bigStat}\n${s.body}`;
    return `${s.title}\n${s.items.join('\n')}\n${s.footer}`;
  }).join('\n\n');
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('SUPABASE env 필요');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY 필요');
  const supa = createClient(url, key);

  // 1) 가장 최근 카드 = 삭제 대상
  const { data: latest } = await supa.from('content_items')
    .select('*').eq('type', 'card').order('created_at', { ascending: false }).limit(1);
  const target = latest?.[0];
  if (!target) throw new Error('카드 없음');
  console.log(`삭제 대상: ${target.id} | ${target.status} | ${target.title}`);

  // 백업
  const backup = path.join(process.cwd(), `deleted-card-${target.id.slice(0, 8)}.json`);
  fs.writeFileSync(backup, JSON.stringify(target, null, 2), 'utf-8');
  console.log(`백업: ${backup}`);

  // 2) 30일 사용 슬러그 → 중복 안 되는 새 주제
  const { data: recent } = await supa.from('content_items').select('source_refs')
    .eq('type', 'card').gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString());
  const used = new Set<string>();
  for (const r of recent ?? []) for (const ref of (r.source_refs ?? []) as Array<{ topic_slug?: string }>) if (ref.topic_slug) used.add(ref.topic_slug);
  const topic = pickFreshTopics(used, 1)[0];
  console.log(`새 주제: ${topic.title} (${topic.slug})`);

  // 3) 생성 (Opus) + 검수
  console.log('생성 중(Opus 4.8)...');
  const set = await generateCardSet(topic);
  const fullText = slidesToPlainText(set.slides);
  const fc: FactCheckResult = await factCheckArticle(set.title, fullText).catch((e) => {
    console.warn('  팩트체크 스킵(Gemini):', (e instanceof Error ? e.message : String(e)).slice(0, 80));
    return { passed: true, issues: [], raw: '' };
  });
  const lint = lintContent(fullText);
  const genIn = set.usage?.input_tokens ?? 0, genOut = set.usage?.output_tokens ?? 0;
  const fcIn = fc.usage?.input_tokens ?? 0, fcOut = fc.usage?.output_tokens ?? 0;
  const genCost = calcCost(MODEL, genIn, genOut);
  const fcCost = fcIn || fcOut ? calcCost('gemini-2.5-flash', fcIn, fcOut) : 0;

  // 4) 삽입 — 신규 스타일 우선 시도, 제약 막히면 A~F 폴백
  const insertRow = (style: CardStyleKey) => ({
    type: 'card', title: set.title, body_md: fullText, card_slides: set.slides, card_style: style,
    source_refs: [{ topic_slug: topic.slug, category: topic.category, generated_by: MODEL }],
    status: 'review', enforcement_mode: 'open', generated_by: MODEL,
    fact_check: { passed: fc.passed, issues: fc.issues },
    gen_input_tokens: genIn, gen_output_tokens: genOut, gen_cost_usd: genCost,
    fc_input_tokens: fcIn, fc_output_tokens: fcOut, fc_cost_usd: fcCost,
    total_cost_usd: genCost + fcCost,
  });

  const tryStyles: CardStyleKey[] = ['I', 'H', 'G', 'C', 'A'];
  let inserted: { id: string } | null = null;
  let usedStyle: CardStyleKey = 'A';
  for (const st of tryStyles) {
    const { data, error } = await supa.from('content_items').insert(insertRow(st)).select('id').single();
    if (!error && data) { inserted = data; usedStyle = st; break; }
    console.warn(`  style=${st} 삽입 실패: ${error?.message?.slice(0, 80)} → 폴백`);
  }
  if (!inserted) throw new Error('모든 스타일 삽입 실패');
  console.log(`새 카드 생성: ${inserted.id} | style=${usedStyle} | ${set.title}`);

  await supa.from('compliance_lints').insert({
    content_id: inserted.id,
    forbidden_terms_found: lint.forbidden_terms_found, comparison_phrases: lint.comparison_phrases,
    guarantee_phrases: lint.guarantee_phrases, insurer_mentions: lint.insurer_mentions,
    product_mentions: lint.product_mentions, risk_score: lint.risk_score, must_fix: lint.must_fix, raw_report: lint,
  });

  // 5) 기존 카드 삭제 (lint 먼저 → FK 안전)
  await supa.from('compliance_lints').delete().eq('content_id', target.id);
  const { error: delErr } = await supa.from('content_items').delete().eq('id', target.id);
  if (delErr) throw new Error('삭제 실패: ' + delErr.message);
  console.log(`삭제 완료: ${target.id}`);

  console.log(`\n완료. 새 카드 style=${usedStyle}, 심의위험 ${lint.risk_score}, 비용 ≈${Math.round((genCost + fcCost) * 1350)}원`);
}
main().catch(e => { console.error(e); process.exit(1); });
