import { NextResponse } from 'next/server';
import { requireContentAccess, adminClient } from '@/lib/admin/guard';
import { lintContent } from '@/lib/content/compliance-lint';
import { LINT_ENABLED } from '@/lib/content/lint-config';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireContentAccess();
  const { id } = await ctx.params;
  const { body_md } = await req.json().catch(() => ({}));
  if (typeof body_md !== 'string') {
    return NextResponse.json({ error: 'body_md required' }, { status: 400 });
  }
  const supa = adminClient();
  await supa.from('content_items').update({ body_md }).eq('id', id);

  if (LINT_ENABLED.blog) {
    const lint = lintContent(body_md);
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
  return NextResponse.json({ ok: true });
}
