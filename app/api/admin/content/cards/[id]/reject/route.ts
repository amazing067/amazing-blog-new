import { NextResponse } from 'next/server';
import { requireContentAccess, adminClient } from '@/lib/admin/guard';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireContentAccess();
  const { id } = await ctx.params;
  await adminClient().from('content_items').update({ status: 'expired' }).eq('id', id);
  return NextResponse.json({ ok: true });
}
