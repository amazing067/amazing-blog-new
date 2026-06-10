import { NextResponse } from 'next/server';
import { requireContentAccess, adminClient } from '@/lib/admin/guard';
import type { ComplianceInfo } from '@/lib/content/types';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireContentAccess();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<ComplianceInfo>;
  const compliance: ComplianceInfo = {
    company: body.company || '프라임에셋',
    branch: body.branch || '',
    designer: body.designer || '',
    phone: body.phone || '',
    registration: body.registration || '',
    number: body.number || '',
    start_date: body.start_date || '',
    end_date: body.end_date || '',
    include_warning: body.include_warning ?? true,
  };
  const { error } = await adminClient().from('content_items').update({ compliance }).eq('id', id);
  if (error) {
    // 그동안 이 에러가 무시돼 "저장됨"처럼 보였음 → 이제 실제 실패를 전달한다.
    // (예: compliance 컬럼 미적용 시 'column ... does not exist')
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
