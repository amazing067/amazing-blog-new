import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin/guard';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { pickFreshTopics } from '@/lib/content/topic-picker';
import { generateBlogPost } from '@/lib/content/generator-blog';
import { factCheckArticle } from '@/lib/content/fact-check';
import { lintContent } from '@/lib/content/compliance-lint';
import { LINT_ENABLED } from '@/lib/content/lint-config';
import { calcCost } from '@/lib/content/billing';
import type { EnforcementMode } from '@/lib/content/types';

const DAILY_LIMIT = 1;
const GENERATOR_MODEL = 'claude-haiku-4-5';

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supa = adminClient();

  const { data: setting } = await supa
    .from('content_settings').select('value').eq('key', 'news.enforcement_mode').single();
  const mode: EnforcementMode = (setting?.value as EnforcementMode) ?? 'open';

  // 블로그용 30일 사용 슬러그
  const { data: recent } = await supa
    .from('content_items').select('source_refs')
    .eq('type', 'blog').gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString());
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
    errors: [] as string[],
  };

  for (const topic of topics) {
    try {
      const post = await generateBlogPost(topic);

      const fc = await factCheckArticle(post.title, post.body_md).catch((err): import('@/lib/content/fact-check').FactCheckResult => {
        console.error('[daily-blog] fact-check failed', err);
        return { passed: true, issues: [], raw: '' };
      });
      const highIssues = fc.issues.filter(i => i.severity === 'high').length;
      if (highIssues > 0) summary.fact_check_high_issues += highIssues;

      // 블로그도 룰엔진 적용 (광고심의 대상)
      const lint = LINT_ENABLED.blog ? lintContent(post.body_md) : null;

      const genIn = post.usage?.input_tokens ?? 0;
      const genOut = post.usage?.output_tokens ?? 0;
      const fcIn = fc.usage?.input_tokens ?? 0;
      const fcOut = fc.usage?.output_tokens ?? 0;
      const genCost = calcCost('claude-haiku-4-5', genIn, genOut);
      const fcCost = calcCost('gemini-2.5-flash', fcIn, fcOut);

      const { data: inserted, error } = await supa.from('content_items').insert({
        type: 'blog',
        title: post.title,
        body_md: post.body_md,
        meta_description: post.meta_description,
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
      let msg: string;
      if (err instanceof Error) msg = err.message;
      else if (err && typeof err === 'object') {
        const obj = err as Record<string, unknown>;
        msg = String(obj.message ?? obj.code ?? '') + (obj.details ? ` (${obj.details})` : '');
        if (!msg.trim()) msg = JSON.stringify(err);
      } else msg = String(err);
      console.error('[daily-blog] topic failed', topic.slug, msg, err);
      summary.failed++;
      summary.errors.push(`${topic.slug}: ${msg}`);
    }
  }
  return NextResponse.json({ ok: true, mode, model: GENERATOR_MODEL, ...summary });
}
