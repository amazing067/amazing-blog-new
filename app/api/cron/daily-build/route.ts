import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin/guard';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { pickFreshTopics } from '@/lib/content/topic-picker';
import { generateTopicArticle } from '@/lib/content/generator';
import { lintContent } from '@/lib/content/compliance-lint';
import type { EnforcementMode } from '@/lib/content/types';

const DAILY_LIMIT = 2;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supa = adminClient();

  const { data: setting } = await supa
    .from('content_settings').select('value').eq('key', 'news.enforcement_mode').single();
  const mode: EnforcementMode = (setting?.value as EnforcementMode) ?? 'open';

  // 최근 30일에 사용한 주제 slug 집합 (재사용 방지)
  const { data: recent } = await supa
    .from('content_items').select('source_refs')
    .eq('type', 'news').gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString());
  const usedSlugs = new Set<string>();
  for (const r of recent ?? []) {
    for (const ref of (r.source_refs ?? []) as Array<{ topic_slug?: string }>) {
      if (ref.topic_slug) usedSlugs.add(ref.topic_slug);
    }
  }

  const topics = pickFreshTopics(usedSlugs, DAILY_LIMIT);

  const summary = { picked: topics.length, generated: 0, failed: 0, slugs: [] as string[] };
  for (const topic of topics) {
    try {
      const gen = await generateTopicArticle(topic);
      const lint = lintContent(gen.body_md);
      const { data: inserted, error } = await supa
        .from('content_items').insert({
          type: 'news',
          title: gen.title,
          body_md: gen.body_md,
          source_refs: [{
            topic_slug: topic.slug,
            category: topic.category,
            generated_by: 'gemini-2.5-flash',
          }],
          status: 'review',
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
      summary.slugs.push(topic.slug);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[daily-build] topic failed', topic.slug, msg);
      summary.failed++;
    }
  }
  return NextResponse.json({ ok: true, mode, ...summary });
}
