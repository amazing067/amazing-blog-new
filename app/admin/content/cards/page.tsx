import Link from 'next/link';
import { adminClient } from '@/lib/admin/guard';
import { CardStyleRouter } from '../card-preview/CardStyles';
import { Inbox, Clock, CheckCircle2, XCircle, AlertTriangle, Images, ChevronRight } from 'lucide-react';
import type { CardSlide, CardStyleKey, ComplianceInfo } from '@/lib/content/types';

const STYLE_BADGE: Record<CardStyleKey, { name: string; cls: string }> = {
  A: { name: 'A·Bold',     cls: 'bg-blue-100    text-blue-800    border-blue-200' },
  B: { name: 'B·Magazine', cls: 'bg-stone-100   text-stone-800   border-stone-200' },
  C: { name: 'C·Pastel',   cls: 'bg-orange-100  text-orange-800  border-orange-200' },
  D: { name: 'D·Premium',  cls: 'bg-neutral-900 text-amber-200   border-neutral-700' },
  E: { name: 'E·Report',   cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  F: { name: 'F·Y2K',      cls: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
};

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

// status='review'이지만 협회 심의번호가 채워진 행은 별도 배지로 구분.
const APPROVED_BADGE_CLS = 'bg-emerald-50 text-emerald-700 border-emerald-300';

function riskTone(score: number | null | undefined) {
  if (score == null) return 'text-slate-400';
  if (score >= 60) return 'text-red-700';
  if (score >= 30) return 'text-amber-700';
  return 'text-emerald-700';
}

export default async function CardsListPage({
  searchParams,
}: { searchParams?: Promise<{ status?: string }> }) {
  const sp = (await searchParams) ?? {};
  const status = (STATUSES.find(s => s.key === sp.status)?.key ?? 'review') as Status;

  const supa = adminClient();
  // billing 컬럼이 적용 안 됐을 수도 있어 별표 select로 안전하게 (없으면 그냥 undefined)
  let q = supa.from('content_items')
    .select('*')
    .eq('type', 'card').order('created_at', { ascending: false }).limit(200);
  if (status !== 'all') q = q.eq('status', status);
  const { data: items, error } = await q;
  if (error) console.error('[cards/list] supabase error:', error.message);

  const { data: counts } = await supa.from('content_items').select('status').eq('type', 'card');
  const statusCount: Record<string, number> = {};
  for (const r of counts ?? []) statusCount[r.status] = (statusCount[r.status] ?? 0) + 1;
  statusCount.all = (counts ?? []).length;

  const ids = (items ?? []).map((r: { id: string }) => r.id);
  const lintMap = new Map<string, number>();
  if (ids.length) {
    const { data: lints } = await supa.from('compliance_lints')
      .select('content_id, risk_score, created_at')
      .in('content_id', ids).order('created_at', { ascending: false });
    for (const l of lints ?? []) {
      if (!lintMap.has(l.content_id)) lintMap.set(l.content_id, l.risk_score);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Images className="w-6 h-6 text-violet-600" />
          카드뉴스 검수 대기열
        </h2>
        <p className="mt-1 text-sm text-slate-500">매일 KST 08:00 자동 생성 · 5장 시리즈 + 심의필 = 6장 PNG zip</p>
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
            매일 KST 08:00 자동 생성됩니다.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <ul className="divide-y divide-slate-100">
            {(items ?? []).map((row: { id: string; title: string; status: string; created_at: string; card_slides: CardSlide[] | null; source_refs: { category?: string }[] | null; total_cost_usd: number | null; card_style: CardStyleKey | null; compliance: ComplianceInfo | null }) => {
              const slides = row.card_slides ?? [];
              const cover = slides[0];
              const category = row.source_refs?.[0]?.category;
              const score = lintMap.get(row.id);
              const styleKey = (row.card_style ?? 'A') as CardStyleKey;
              const styleInfo = STYLE_BADGE[styleKey];
              const approved = row.status === 'review' && !!row.compliance?.number?.trim();
              const badgeCls = approved ? APPROVED_BADGE_CLS : (STATUS_BADGE[row.status] ?? 'bg-slate-100 text-slate-700');
              const badgeLabel = approved ? '심의 완료' : (STATUSES.find(s => s.key === row.status)?.label ?? row.status);
              return (
                <li key={row.id}>
                  <Link href={`/admin/content/cards/${row.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-violet-50/50 transition group">
                    {/* 작은 썸네일 (90px) — 해당 디자인 그대로 */}
                    <div className="flex-none w-[90px] h-[90px]">
                      {cover ? (
                        <CardStyleRouter cardStyle={styleKey} slide={cover} index={0} total={slides.length} />
                      ) : (
                        <div className="w-full h-full rounded-xl bg-slate-100" />
                      )}
                    </div>
                    {/* 메인 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${styleInfo.cls}`} title="요일별 디자인">
                          {styleInfo.name}
                        </span>
                        {category && (
                          <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 border border-violet-200">
                            🎴 {category}
                          </span>
                        )}
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeCls}`}>
                          {approved && <CheckCircle2 className="w-3 h-3 mr-0.5" />}
                          {badgeLabel}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900 leading-snug line-clamp-1 group-hover:text-violet-700 transition">
                        {row.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                        <span>{new Date(row.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Seoul' })}</span>
                        {score != null && (
                          <span className={`font-mono font-semibold ${riskTone(score)}`}>위험도 {score}</span>
                        )}
                        {row.total_cost_usd != null && (
                          <span className="font-mono text-slate-400">${row.total_cost_usd.toFixed(3)}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="flex-none w-5 h-5 text-slate-300 group-hover:text-violet-600 group-hover:translate-x-0.5 transition" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
