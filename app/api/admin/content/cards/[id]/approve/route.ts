import { NextResponse } from 'next/server';
import { requireContentAccess, adminClient } from '@/lib/admin/guard';

// 심의 확정(승인) 토글 — status: review ↔ approved
// 확정하려면 광고심의필번호(compliance.number)가 저장돼 있어야 한다.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireContentAccess();
  const { id } = await ctx.params;
  const { approved = true } = (await req.json().catch(() => ({}))) as { approved?: boolean };
  const supa = adminClient();

  if (approved) {
    const { data: row, error: readErr } = await supa
      .from('content_items')
      .select('compliance')
      .eq('id', id)
      .single();
    if (readErr) {
      return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
    }
    const number = ((row?.compliance as { number?: string } | null)?.number ?? '').trim();
    if (!number) {
      return NextResponse.json(
        { ok: false, error: '심의필번호를 먼저 입력·저장한 뒤 확정할 수 있습니다.' },
        { status: 400 }
      );
    }
  }

  const { error } = await supa
    .from('content_items')
    .update({ status: approved ? 'approved' : 'review' })
    .eq('id', id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
