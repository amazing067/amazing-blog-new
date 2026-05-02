import { NextResponse } from 'next/server';
import { requireAdmin, adminClient } from '@/lib/admin/guard';
import { lintContent } from '@/lib/content/compliance-lint';
import { LINT_ENABLED } from '@/lib/content/lint-config';
import type { CardSlide } from '@/lib/content/types';

function slidesToPlainText(slides: CardSlide[]): string {
  return slides.map(s => {
    if (s.kind === 'cover') return `${s.title}\n${s.bigStatLabel}: ${s.bigStat}`;
    if (s.kind === 'point') return `${s.title}\n${s.bigStatLabel}: ${s.bigStat}\n${s.body}`;
    return `${s.title}\n${s.items.join('\n')}\n${s.footer}`;
  }).join('\n\n');
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const slides = body?.slides as CardSlide[] | undefined;
  if (!Array.isArray(slides) || slides.length !== 5) {
    return NextResponse.json({ error: 'slides는 정확히 5개여야 합니다' }, { status: 400 });
  }

  const supa = adminClient();
  const fullText = slidesToPlainText(slides);

  // body_md(검색·복사용)와 card_slides 동시 업데이트
  await supa.from('content_items').update({
    card_slides: slides,
    body_md: fullText,
  }).eq('id', id);

  // 카드뉴스 lint 재실행 (LINT_ENABLED.card 기준)
  if (LINT_ENABLED.card) {
    const lint = lintContent(fullText);
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
