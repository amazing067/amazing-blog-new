import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminClient, requireContentAccess } from '@/lib/admin/guard';
import { ArrowLeft, Target } from 'lucide-react';
import RecruitDetailClient from './RecruitDetailClient';
import type { CardSlide } from '@/lib/content/types';
import type { RecruitLintResult } from '@/lib/content/recruit-lint';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  review:    { label: '검토 대기', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  published: { label: '발행 완료', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  expired:   { label: '거절',      cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  failed:    { label: '실패',      cls: 'bg-red-100 text-red-800 border-red-200' },
};

const PILLAR_LABEL: Record<string, string> = {
  'P1-empathy': '공감·자극', 'P2-system': '시스템·교육', 'P3-income': '소득(리프레이밍)', 'P4-lifestyle': '자유·디지털', 'P5-story': '후기·스토리',
};

export default async function RecruitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireContentAccess();
  const supa = adminClient();
  const { data: item } = await supa.from('content_items').select('*').eq('id', id).single();
  if (!item || item.type !== 'recruit-card') notFound();

  const { data: lintRow } = await supa.from('compliance_lints')
    .select('*').eq('content_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const recruitLint = (lintRow?.raw_report ?? null) as RecruitLintResult | null;

  const slides = (item.card_slides ?? []) as CardSlide[];
  const statusInfo = STATUS_LABEL[item.status] ?? { label: item.status, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  const sourceRefs = (item.source_refs ?? []) as Array<{ pillar?: string | null; tone?: string | null }>;
  const pillar = sourceRefs[0]?.pillar ?? null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/admin/content/recruit" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> 리쿠르팅 대기열
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-lime-50 px-2.5 py-1 text-xs font-medium text-lime-700 border border-lime-200">
            <Target className="w-3 h-3" /> 리쿠르팅
          </span>
          {pillar && (
            <span className="inline-flex items-center rounded-full border border-lime-200 bg-lime-50 px-3 py-1 text-xs font-medium text-lime-700">
              {PILLAR_LABEL[pillar] ?? pillar}
            </span>
          )}
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 leading-tight">{item.title}</h1>
        <p className="mt-2 text-sm text-slate-500">6장 캐러셀 · 전용 트렌디 디자인 · 생성 {new Date(item.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
      </div>

      <RecruitDetailClient
        id={item.id}
        title={item.title}
        status={item.status}
        publishUrl={item.publish_url ?? ''}
        slides={slides}
        lint={recruitLint}
        seed={item.id}
      />
    </div>
  );
}
