import Link from 'next/link';
import { adminClient } from '@/lib/admin/guard';
import { Newspaper, Clock, AlertTriangle, CheckCircle2, XCircle, Inbox } from 'lucide-react';

const STATUSES = [
  { key: 'review',    label: '검토 대기', icon: Clock,         color: 'amber' },
  { key: 'published', label: '발행 완료', icon: CheckCircle2,  color: 'emerald' },
  { key: 'expired',   label: '거절',      icon: XCircle,       color: 'gray' },
  { key: 'failed',    label: '실패',      icon: AlertTriangle, color: 'red' },
  { key: 'all',       label: '전체',      icon: Inbox,         color: 'slate' },
] as const;
type Status = typeof STATUSES[number]['key'];

const STATUS_BADGE: Record<string, string> = {
  review:    'bg-amber-100 text-amber-800 border-amber-200',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  expired:   'bg-gray-100 text-gray-600 border-gray-200',
  failed:    'bg-red-100 text-red-800 border-red-200',
};

function riskTone(score: number | null | undefined) {
  if (score == null) return { bg: 'bg-gray-100', text: 'text-gray-500', bar: 'bg-gray-300', label: '-' };
  if (score >= 60)   return { bg: 'bg-red-50',   text: 'text-red-700',  bar: 'bg-red-500',   label: '위험' };
  if (score >= 30)   return { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', label: '주의' };
  return                    { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500', label: '안전' };
}

export default async function NewsListPage({
  searchParams,
}: { searchParams?: Promise<{ status?: string }> }) {
  const sp = (await searchParams) ?? {};
  const status = (STATUSES.find(s => s.key === sp.status)?.key ?? 'review') as Status;

  const supa = adminClient();
  let q = supa.from('content_items')
    .select('id, title, status, source_refs, created_at, body_md')
    .eq('type', 'news').order('created_at', { ascending: false }).limit(100);
  if (status !== 'all') q = q.eq('status', status);
  const { data: items } = await q;

  // 상태별 카운트 (탭에 숫자 표시)
  const { data: counts } = await supa.from('content_items')
    .select('status').eq('type', 'news');
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
      {/* 페이지 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-emerald-600" />
            보험뉴스 검수 대기열
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            매일 06:00 자동 수집 · 광고심의 검수 후 카페 게시 준비
          </p>
        </div>
      </div>

      {/* 상태 탭 */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUSES.map(s => {
          const Icon = s.icon;
          const isActive = s.key === status;
          const count = statusCount[s.key] ?? 0;
          return (
            <Link
              key={s.key}
              href={`/admin/content/news?status=${s.key}`}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {s.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-600'
              }`}>{count}</span>
            </Link>
          );
        })}
      </div>

      {/* 카드 그리드 */}
      {(!items || items.length === 0) ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
          <Inbox className="mx-auto w-12 h-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-700">수집된 뉴스가 없습니다</h3>
          <p className="mt-2 text-sm text-slate-500">
            매일 06:00 자동으로 RSS에서 수집됩니다.<br />
            지금 바로 수집하려면 cron을 수동으로 한 번 실행하세요.
          </p>
          <div className="mt-4 inline-block rounded-lg bg-slate-100 px-3 py-2 text-xs font-mono text-slate-600">
            curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; http://localhost:3000/api/cron/daily-build
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(items ?? []).map((row: { id: string; title: string; status: string; source_refs: { source?: string; topic_slug?: string; category?: string }[] | null; created_at: string; body_md: string | null }) => {
            const score = lintMap.get(row.id);
            const tone = riskTone(score);
            const ref = row.source_refs?.[0];
            const source = ref?.category ?? ref?.source ?? '보험뉴스';
            const preview = (row.body_md ?? '').replace(/[#*`>_~\-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
            return (
              <Link
                key={row.id}
                href={`/admin/content/news/${row.id}`}
                className="group block rounded-2xl border border-slate-200 bg-white p-5 hover:border-emerald-400 hover:shadow-lg transition"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    📰 {source}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {STATUSES.find(s => s.key === row.status)?.label ?? row.status}
                  </span>
                </div>

                <h3 className="font-semibold text-slate-900 leading-snug line-clamp-2 group-hover:text-emerald-700 transition">
                  {row.title}
                </h3>
                <p className="mt-2 text-sm text-slate-500 line-clamp-2">{preview}</p>

                {/* 위험도 게이지 */}
                <div className={`mt-4 rounded-lg ${tone.bg} px-3 py-2`}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-semibold ${tone.text}`}>광고심의 위험도 · {tone.label}</span>
                    <span className={`font-mono ${tone.text}`}>{score ?? '-'}{score != null ? ' / 100' : ''}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                    <div className={`h-full ${tone.bar}`} style={{ width: `${Math.min(100, score ?? 0)}%` }} />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                  <span>{new Date(row.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Seoul' })}</span>
                  <span className="text-emerald-600 group-hover:translate-x-1 transition">상세 →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
