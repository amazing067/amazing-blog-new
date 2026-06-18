import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin/guard';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { pickFreshTopics } from '@/lib/content/topic-picker';
import { generateCardSet } from '@/lib/content/generator-card';
import { factCheckArticle } from '@/lib/content/fact-check';
import { lintContent } from '@/lib/content/compliance-lint';
import { calcCost } from '@/lib/content/billing';
import { pickCardStyle } from '@/lib/content/style-picker';
import type { CardSlide, EnforcementMode } from '@/lib/content/types';

const DAILY_LIMIT = 1;
const GENERATOR_MODEL = 'claude-opus-4-8';

function slidesToPlainText(slides: CardSlide[]): string {
  return slides.map(s => {
    if (s.kind === 'cover') return `${s.title}\n${s.bigStatLabel}: ${s.bigStat}`;
    if (s.kind === 'point') return `${s.title}\n${s.bigStatLabel}: ${s.bigStat}\n${s.body}`;
    return `${s.title}\n${s.items.join('\n')}\n${s.footer}`;
  }).join('\n\n');
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supa = adminClient();

  const { data: setting } = await supa
    .from('content_settings').select('value').eq('key', 'news.enforcement_mode').single();
  const mode: EnforcementMode = (setting?.value as EnforcementMode) ?? 'open';

  // 카드뉴스용 30일 사용 슬러그 (보험뉴스와 분리: type='card'만 조회)
  const { data: recent } = await supa
    .from('content_items').select('source_refs')
    .eq('type', 'card').gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString());
  const usedSlugs = new Set<string>();
  for (const r of recent ?? []) {
    for (const ref of (r.source_refs ?? []) as Array<{ topic_slug?: string }>) {
      if (ref.topic_slug) usedSlugs.add(ref.topic_slug);
    }
  }

  const topics = pickFreshTopics(usedSlugs, DAILY_LIMIT);
  const summary = {
    picked: topics.length,
    generated: 0,
    fact_check_high_issues: 0,
    failed: 0,
    slugs: [] as string[],
  };

  for (const topic of topics) {
    try {
      const set = await generateCardSet(topic);
      const fullText = slidesToPlainText(set.slides);

      const fc = await factCheckArticle(set.title, fullText).catch((err): import('@/lib/content/fact-check').FactCheckResult => {
        console.error('[daily-card] fact-check failed', err);
        return { passed: true, issues: [], raw: '' };
      });
      const highIssues = fc.issues.filter(i => i.severity === 'high').length;
      if (highIssues > 0) summary.fact_check_high_issues += highIssues;

      const lint = lintContent(fullText);

      // 비용 계산
      const genIn = set.usage?.input_tokens ?? 0;
      const genOut = set.usage?.output_tokens ?? 0;
      const fcIn = fc.usage?.input_tokens ?? 0;
      const fcOut = fc.usage?.output_tokens ?? 0;
      const genCost = calcCost(GENERATOR_MODEL, genIn, genOut);
      const fcCost = calcCost('gemini-2.5-flash', fcIn, fcOut);

      const cardStyle = pickCardStyle();   // 요일별 자동 매핑 (월=A 화=B...토=F)

      const { data: inserted, error } = await supa.from('content_items').insert({
        type: 'card',
        title: set.title,
        body_md: fullText,
        card_slides: set.slides,
        card_style: cardStyle,
        source_refs: [{
          topic_slug: topic.slug,
          category: topic.category,
          generated_by: GENERATOR_MODEL,
        }],
        status: 'review',
        enforcement_mode: mode,
        generated_by: GENERATOR_MODEL,
        fact_check: { passed: fc.passed, issues: fc.issues },
        gen_input_tokens: genIn,
        gen_output_tokens: genOut,
        gen_cost_usd: genCost,
        fc_input_tokens: fcIn,
        fc_output_tokens: fcOut,
        fc_cost_usd: fcCost,
        total_cost_usd: genCost + fcCost,
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
      summary.slugs.push(topic.slug);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[daily-card] topic failed', topic.slug, msg);
      summary.failed++;
    }
  }
  return NextResponse.json({ ok: true, mode, model: GENERATOR_MODEL, ...summary });
}
