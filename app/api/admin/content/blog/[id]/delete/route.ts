import { NextResponse } from 'next/server';
import { requireAdmin, adminClient } from '@/lib/admin/guard';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const { error } = await adminClient().from('content_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
