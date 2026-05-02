import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminClient } from '@/lib/admin/guard';
import { ArrowLeft, Images } from 'lucide-react';
import CardsDetailClient from './CardsDetailClient';
import type { CardSlide } from '@/lib/content/types';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  review:    { label: '검토 대기', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  published: { label: '발행 완료', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  expired:   { label: '거절',      cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  failed:    { label: '실패',      cls: 'bg-red-100 text-red-800 border-red-200' },
};

export default async function CardsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supa = adminClient();
  const { data: item } = await supa.from('content_items').select('*').eq('id', id).single();
  if (!item || item.type !== 'card') notFound();
  const { data: lint } = await supa.from('compliance_lints')
    .select('*').eq('content_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();

  const slides = (item.card_slides ?? []) as CardSlide[];
  const statusInfo = STATUS_LABEL[item.status] ?? { label: item.status, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  const factCheck = item.fact_check as { passed: boolean; issues: { claim: string; reason: string; severity: 'high'|'medium'|'low' }[] } | null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/admin/content/cards" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> 카드뉴스 대기열
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 border border-violet-200">
            <Images className="w-3 h-3" /> 카드뉴스
          </span>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 leading-tight">{item.title}</h1>
        <p className="mt-2 text-sm text-slate-500">5장 시리즈 · 생성 {new Date(item.created_at).toLocaleString('ko-KR')}</p>
      </div>

      <CardsDetailClient
        id={item.id}
        title={item.title}
        status={item.status}
        publishUrl={item.publish_url ?? ''}
        slides={slides}
        lint={lint}
        factCheck={factCheck}
      />
    </div>
  );
}
