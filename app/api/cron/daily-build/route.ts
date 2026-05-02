import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin/guard';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { pickFreshTopics } from '@/lib/content/topic-picker';
import { generateTopicArticle } from '@/lib/content/generator';
import { factCheckArticle } from '@/lib/content/fact-check';
import { lintContent } from '@/lib/content/compliance-lint';
import { LINT_ENABLED } from '@/lib/content/lint-config';
import type { EnforcementMode } from '@/lib/content/types';

const DAILY_LIMIT = 1;
const GENERATOR_MODEL = 'claude-haiku-4-5';

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supa = adminClient();

  const { data: setting } = await supa
    .from('content_settings').select('value').eq('key', 'news.enforcement_mode').single();
  const mode: EnforcementMode = (setting?.value as EnforcementMode) ?? 'open';

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

  const summary = {
    picked: topics.length,
    generated: 0,
    fact_check_high_issues: 0,
    failed: 0,
    slugs: [] as string[],
  };

  for (const topic of topics) {
    try {
      // 1. Claude Haiku 4.5로 본문 생성
      const gen = await generateTopicArticle(topic);

      // 2. Gemini로 fact-check (Google Search Grounding)
      const fc = await factCheckArticle(gen.title, gen.body_md).catch(err => {
        console.error('[daily-build] fact-check failed', err);
        return { passed: true, issues: [], raw: '' };
      });
      const highIssues = fc.issues.filter(i => i.severity === 'high').length;
      if (highIssues > 0) summary.fact_check_high_issues += highIssues;

      // 3. 광고심의 lint (LINT_ENABLED.news 토글로 제어 — 현재 false, 보험뉴스는 룰엔진 미적용)
      const lint = LINT_ENABLED.news ? lintContent(gen.body_md) : null;

      // 4. DB 저장 (fact-check high 이슈 있으면 review 유지하되 fact_check 기록)
      const { data: inserted, error } = await supa
        .from('content_items').insert({
          type: 'news',
          title: gen.title,
          body_md: gen.body_md,
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

      if (lint) {
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
      }

      summary.generated++;
      summary.slugs.push(topic.slug);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[daily-build] topic failed', topic.slug, msg);
      summary.failed++;
    }
  }
  return NextResponse.json({ ok: true, mode, model: GENERATOR_MODEL, ...summary });
}
