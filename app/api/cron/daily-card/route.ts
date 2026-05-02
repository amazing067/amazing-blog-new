import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin/guard';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { pickFreshTopics } from '@/lib/content/topic-picker';
import { generateCardSet } from '@/lib/content/generator-card';
import { factCheckArticle } from '@/lib/content/fact-check';
import { lintContent } from '@/lib/content/compliance-lint';
import type { CardSlide, EnforcementMode } from '@/lib/content/types';

const DAILY_LIMIT = 1;
const GENERATOR_MODEL = 'claude-haiku-4-5';

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

      const fc = await factCheckArticle(set.title, fullText).catch(err => {
        console.error('[daily-card] fact-check failed', err);
        return { passed: true, issues: [], raw: '' };
      });
      const highIssues = fc.issues.filter(i => i.severity === 'high').length;
      if (highIssues > 0) summary.fact_check_high_issues += highIssues;

      const lint = lintContent(fullText);

      const { data: inserted, error } = await supa.from('content_items').insert({
        type: 'card',
        title: set.title,
        body_md: fullText,                // 검색·복사용 평문
        card_slides: set.slides,           // 5장 JSON
        source_refs: [{
          topic_slug: topic.slug,
          category: topic.category,
          generated_by: GENERATOR_MODEL,
        }],
        status: 'review',
        enforcement_mode: mode,
        generated_by: GENERATOR_MODEL,
        fact_check: { passed: fc.passed, issues: fc.issues },
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
