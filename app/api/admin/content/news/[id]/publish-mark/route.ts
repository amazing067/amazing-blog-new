import { NextResponse } from 'next/server';
import { requireContentAccess, adminClient } from '@/lib/admin/guard';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireContentAccess();
  const { id } = await ctx.params;
  const { publish_url } = await req.json().catch(() => ({}));
  await adminClient().from('content_items').update({
    status: 'published',
    publish_url: publish_url ?? null,
    published_at: new Date().toISOString(),
  }).eq('id', id);
  return NextResponse.json({ ok: true });
}
