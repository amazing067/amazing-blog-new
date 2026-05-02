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
  const mode: EnforcementMode = (setting?.value as EnforcementMode) ?? 'open';

  const { data: recent } = await supa
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[daily-build] item failed', c.title, msg);
      summary.failed++;
    }
  }
  return NextResponse.json({ ok: true, mode, ...summary });
}
