import { NextResponse } from 'next/server';
import { requireContentAccess, adminClient } from '@/lib/admin/guard';
import { lintContent } from '@/lib/content/compliance-lint';
import { LINT_ENABLED } from '@/lib/content/lint-config';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireContentAccess();
  const { id } = await ctx.params;

  if (!LINT_ENABLED.news) {
    return NextResponse.json({
      ok: false,
      disabled: true,
      message: '보험뉴스 룰엔진이 비활성화돼 있습니다 (lint-config.ts에서 토글)',
    }, { status: 200 });
  }

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
