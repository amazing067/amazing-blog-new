import { NextResponse } from 'next/server';
import { requireAdmin, adminClient } from '@/lib/admin/guard';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const { number, expires } = await req.json().catch(() => ({}));
  await adminClient().from('content_items').update({
    compliance_number: number || null,
    compliance_expires: expires || null,
  }).eq('id', id);
  return NextResponse.json({ ok: true });
}
