import Link from 'next/link';
import { adminClient } from '@/lib/admin/guard';
import { RecruitCardStyle, recruitColorOffset } from '../card-preview/styles/RecruitStyle';
import { Inbox, Clock, CheckCircle2, XCircle, AlertTriangle, Target, ChevronRight } from 'lucide-react';
import RecruitGenerateButton from './RecruitGenerateButton';
import type { CardSlide } from '@/lib/content/types';

const PILLAR_LABEL: Record<string, string> = {
  'P1-empathy': '공감', 'P2-system': '시스템', 'P3-income': '소득', 'P4-lifestyle': '일상', 'P5-story': '스토리',
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

function riskTone(score: number | null | undefined) {
  if (score == null) return 'text-slate-400';
  if (score >= 25) return 'text-red-700';
  return 'text-emerald-700';
}

export default async function RecruitListPage({
  searchParams,
}: { searchParams?: Promise<{ status?: string }> }) {
  const sp = (await searchParams) ?? {};
  const status = (STATUSES.find(s => s.key === sp.status)?.key ?? 'review') as Status;

  const supa = adminClient();
  let q = supa.from('content_items').select('*')
    .eq('type', 'recruit-card').order('created_at', { ascending: false }).limit(200);
  if (status !== 'all') q = q.eq('status', status);
  const { data: items, error } = await q;
  if (error) console.error('[recruit/list] supabase error:', error.message);

  const { data: counts } = await supa.from('content_items').select('status').eq('type', 'recruit-card');
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-lime-600" />
            리쿠르팅 카드 검수
          </h2>
          <p className="mt-1 text-sm text-slate-500">설계사 모집 · 7장 캐러셀 · 전용 트렌디 디자인 · 심의 면제(가드레일 자동) · 수동 생성 → 검수 → PNG</p>
        </div>
        <RecruitGenerateButton />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUSES.map(s => {
          const Icon = s.icon;
          const isActive = s.key === status;
          const count = statusCount[s.key] ?? 0;
          return (
            <Link key={s.key} href={`/admin/content/recruit?status=${s.key}`}
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
          <Target className="mx-auto w-12 h-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-700">생성된 리쿠르팅 카드가 없습니다</h3>
          <p className="mt-2 text-sm text-slate-500">우측 상단 <strong className="text-lime-700">✨ 새 카드 생성</strong> 버튼으로 시작하세요.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <ul className="divide-y divide-slate-100">
            {(items ?? []).map((row: { id: string; title: string; status: string; created_at: string; card_slides: CardSlide[] | null; source_refs: { pillar?: string }[] | null; total_cost_usd: number | null }) => {
              const slides = row.card_slides ?? [];
              const cover = slides[0];
              const pillar = row.source_refs?.[0]?.pillar;
              const score = lintMap.get(row.id);
              const badgeCls = STATUS_BADGE[row.status] ?? 'bg-slate-100 text-slate-700';
              const badgeLabel = STATUSES.find(s => s.key === row.status)?.label ?? row.status;
              return (
                <li key={row.id}>
                  <Link href={`/admin/content/recruit/${row.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-lime-50/50 transition group">
                    <div className="flex-none w-[90px] h-[90px]">
                      {cover ? (
                        <RecruitCardStyle slide={cover} index={0} total={slides.length} colorOffset={recruitColorOffset(row.id)} />
                      ) : (
                        <div className="w-full h-full rounded-xl bg-slate-100" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        {pillar && (
                          <span className="inline-flex items-center rounded-full bg-lime-50 px-2 py-0.5 text-[11px] font-medium text-lime-700 border border-lime-200">
                            🎯 {PILLAR_LABEL[pillar] ?? pillar}
                          </span>
                        )}
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeCls}`}>
                          {badgeLabel}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900 leading-snug line-clamp-1 group-hover:text-lime-700 transition">
                        {row.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                        <span>{new Date(row.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        {score != null && (
                          <span className={`font-mono font-semibold ${riskTone(score)}`}>가드레일 {score}</span>
                        )}
                        {row.total_cost_usd != null && (
                          <span className="font-mono text-slate-400">${row.total_cost_usd.toFixed(3)}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="flex-none w-5 h-5 text-slate-300 group-hover:text-lime-600 group-hover:translate-x-0.5 transition" />
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
