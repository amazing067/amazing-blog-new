import { NextResponse } from 'next/server';
import { requireAdmin, adminClient } from '@/lib/admin/guard';
import { lintRecruit } from '@/lib/content/recruit-lint';
import type { CardSlide } from '@/lib/content/types';

function flatten(slides: CardSlide[]): string {
  return slides.map(s =>
    s.kind === 'cover' ? `${s.eyebrow} ${s.title} ${s.bigStat} ${s.bigStatLabel}`
    : s.kind === 'point' ? `${s.title} ${s.body} ${s.bigStat} ${s.bigStatLabel}`
    : `${s.title} ${s.items.join(' ')} ${s.footer}`).join('\n');
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const slides = body?.slides as CardSlide[] | undefined;
  if (!Array.isArray(slides) || slides.length !== 6) {
    return NextResponse.json({ error: 'slides는 정확히 6개여야 합니다' }, { status: 400 });
  }

  const supa = adminClient();
  const flat = flatten(slides);
  await supa.from('content_items').update({ card_slides: slides, body_md: flat }).eq('id', id);

  // 리쿠르팅 가드레일 재실행
  const lint = lintRecruit(flat);
  await supa.from('compliance_lints').insert({
    content_id: id,
    forbidden_terms_found: [], comparison_phrases: [], guarantee_phrases: [],
    insurer_mentions: [], product_mentions: [],
    risk_score: lint.risk_score,
    must_fix: lint.must_fix,
    raw_report: lint,
  });

  return NextResponse.json({ ok: true, lint });
}
