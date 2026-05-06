import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminClient, requireAdmin } from '@/lib/admin/guard';
import { ArrowLeft, Images } from 'lucide-react';
import CardsDetailClient from './CardsDetailClient';
import type { CardSlide, ComplianceInfo, CardStyleKey } from '@/lib/content/types';

const STYLE_LABEL: Record<CardStyleKey, { name: string; cls: string }> = {
  A: { name: 'A · Bold Color (월)',     cls: 'bg-blue-100   text-blue-800   border-blue-200' },
  B: { name: 'B · Magazine (화)',       cls: 'bg-stone-100  text-stone-800  border-stone-200' },
  C: { name: 'C · Pastel (수)',         cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  D: { name: 'D · Dark Premium (목)',   cls: 'bg-neutral-900 text-amber-200  border-neutral-700' },
  E: { name: 'E · Data Report (금)',    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  F: { name: 'F · Y2K Retro (토)',      cls: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  review:    { label: '검토 대기', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  published: { label: '발행 완료', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  expired:   { label: '거절',      cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  failed:    { label: '실패',      cls: 'bg-red-100 text-red-800 border-red-200' },
};

export default async function CardsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireAdmin();
  const supa = adminClient();
  const { data: item } = await supa.from('content_items').select('*').eq('id', id).single();
  if (!item || item.type !== 'card') notFound();
  const { data: profile } = await supa.from('profiles').select('full_name').eq('id', user.id).single();
  const { data: lint } = await supa.from('compliance_lints')
    .select('*').eq('content_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();

  const slides = (item.card_slides ?? []) as CardSlide[];
  const statusInfo = STATUS_LABEL[item.status] ?? { label: item.status, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  const factCheck = item.fact_check as { passed: boolean; issues: { claim: string; reason: string; severity: 'high'|'medium'|'low' }[] } | null;
  const cardStyle = ((item.card_style as CardStyleKey | null) ?? 'A') as CardStyleKey;
  const styleInfo = STYLE_LABEL[cardStyle];
  // 해시태그 카테고리 매핑용 — daily-card cron이 source_refs에 category를 넣어둠
  const sourceRefs = (item.source_refs ?? []) as Array<{ category?: string | null }>;
  const category = sourceRefs[0]?.category ?? null;

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
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${styleInfo.cls}`} title="요일별 디자인 로테이션">
            {styleInfo.name}
          </span>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 leading-tight">{item.title}</h1>
        <p className="mt-2 text-sm text-slate-500">5장 시리즈 + 심의필 1장 · 생성 {new Date(item.created_at).toLocaleString('ko-KR')}</p>
      </div>

      <CardsDetailClient
        id={item.id}
        userId={user.id}
        defaultDesigner={(profile as { full_name?: string } | null)?.full_name ?? ''}
        title={item.title}
        status={item.status}
        publishUrl={item.publish_url ?? ''}
        slides={slides}
        compliance={(item.compliance as ComplianceInfo | null) ?? null}
        lint={lint}
        factCheck={factCheck}
        cardStyle={cardStyle}
        category={category}
      />
    </div>
  );
}
