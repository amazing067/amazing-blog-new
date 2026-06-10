import { requireContentAccess, adminClient } from '@/lib/admin/guard';
import { mdToCafeText } from '@/lib/content/cafe-formatter';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireContentAccess();
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') ?? 'md';

  const { data: item } = await adminClient()
    .from('content_items').select('title, body_md').eq('id', id).single();
  if (!item) return new Response('not found', { status: 404 });

  if (format === 'cafe-text') {
    const text = `${item.title}\n\n${mdToCafeText(item.body_md ?? '')}`;
    return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const md = `# ${item.title}\n\n${item.body_md ?? ''}\n`;
  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="news-${id}.md"`,
    },
  });
}
