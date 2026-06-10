import { NextResponse } from 'next/server';
import { requireAdmin, adminClient } from '@/lib/admin/guard';

// 반송 처리 — 관리자(admin) 전용. 거절(expired)과 구분되는 별도 상태(returned).
//  - { reason } : status='returned' + 사유 기록
//  - { reopen: true } : 검토대기(review)로 복귀
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string; reopen?: boolean };
  const supa = adminClient();

  if (body.reopen) {
    const { error } = await supa
      .from('content_items')
      .update({ status: 'review', returned_at: null })
      .eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const reason = (body.reason ?? '').trim();
  if (!reason) {
    return NextResponse.json({ ok: false, error: '반송 사유를 입력하세요.' }, { status: 400 });
  }

  const { error } = await supa
    .from('content_items')
    .update({ status: 'returned', return_reason: reason, returned_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
