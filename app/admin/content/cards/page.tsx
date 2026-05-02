import Link from 'next/link';
import { adminClient } from '@/lib/admin/guard';
import { HybridStyle } from '../card-preview/CardStyles';
import { Inbox, Clock, CheckCircle2, XCircle, AlertTriangle, Images } from 'lucide-react';
import type { CardSlide } from '@/lib/content/types';

const STATUSES = [
  { key: 'review',    label: '검토 대기', icon: Clock },
  { key: 'published', label: '발행 완료', icon: CheckCircle2 },
  { key: 'expired',   label: '거절',      icon: XCircle },
  { key: 'failed',    label: '실패',      icon: AlertTriangle },
  { key: 'all',       label: '전체',      icon: Inbox },
] as const;
type Status = typeof STATUSES[number]['key'];

const STATUS_BADGE: Record<string, string> = {
  review:    'bg-amber-100 text-amber-800 border-amber-200',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  expired:   'bg-gray-100 text-gray-600 border-gray-200',
  failed:    'bg-red-100 text-red-800 border-red-200',
};

export default async function CardsListPage({
  searchParams,
}: { searchParams?: Promise<{ status?: string }> }) {
  const sp = (await searchParams) ?? {};
  const status = (STATUSES.find(s => s.key === sp.status)?.key ?? 'review') as Status;

  const supa = adminClient();
  let q = supa.from('content_items')
    .select('id, title, status, source_refs, created_at, card_slides')
    .eq('type', 'card').order('created_at', { ascending: false }).limit(60);
  if (status !== 'all') q = q.eq('status', status);
  const { data: items } = await q;

  const { data: counts } = await supa.from('content_items').select('status').eq('type', 'card');
  const statusCount: Record<string, number> = {};
  for (const r of counts ?? []) statusCount[r.status] = (statusCount[r.status] ?? 0) + 1;
  statusCount.all = (counts ?? []).length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Images className="w-6 h-6 text-violet-600" />
          카드뉴스 검수 대기열
        </h2>
        <p className="mt-1 text-sm text-slate-500">매일 KST 08:30 자동 생성 · 5장 시리즈 · 1080×1080 PNG 다운로드</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUSES.map(s => {
          const Icon = s.icon;
          const isActive = s.key === status;
          const count = statusCount[s.key] ?? 0;
          return (
            <Link key={s.key} href={`/admin/content/cards?status=${s.key}`}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                isActive ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {s.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>{count}</span>
            </Link>
          );
        })}
      </div>

      {(!items || items.length === 0) ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
          <Images className="mx-auto w-12 h-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-700">생성된 카드뉴스가 없습니다</h3>
          <p className="mt-2 text-sm text-slate-500">
            매일 KST 08:30 자동 생성됩니다.<br />
            지금 즉시 만들려면 cron을 수동으로 한 번 실행하세요.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {(items ?? []).map((row: { id: string; title: string; status: string; created_at: string; card_slides: CardSlide[] | null; source_refs: { category?: string }[] | null }) => {
            const slides = row.card_slides ?? [];
            const cover = slides[0];
            const category = row.source_refs?.[0]?.category;
            return (
              <Link key={row.id} href={`/admin/content/cards/${row.id}`}
                className="group block rounded-2xl border border-slate-200 bg-white p-4 hover:border-violet-400 hover:shadow-lg transition">
                <div className="flex items-center gap-2 mb-3">
                  {category && (
                    <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 border border-violet-200">
                      🎴 {category}
                    </span>
                  )}
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status] ?? 'bg-slate-100 text-slate-700'}`}>
                    {STATUSES.find(s => s.key === row.status)?.label ?? row.status}
                  </span>
                  <span className="ml-auto text-xs text-slate-400">{new Date(row.created_at).toLocaleString('ko-KR')}</span>
                </div>
                <h3 className="font-semibold text-slate-900 leading-snug mb-3 line-clamp-2 group-hover:text-violet-700 transition">
                  {row.title}
                </h3>
                {cover && (
                  <div className="aspect-square">
                    <HybridStyle slide={cover} index={0} total={slides.length} />
                  </div>
                )}
                <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
                  <span>{slides.length}장 시리즈</span>
                  <span className="text-violet-600 group-hover:translate-x-1 transition">상세 →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
