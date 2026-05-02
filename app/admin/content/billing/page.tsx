import { adminClient } from '@/lib/admin/guard';
import { formatKrw, formatUsd, USD_TO_KRW } from '@/lib/content/billing';
import { Newspaper, Images, DollarSign, Calendar, TrendingUp } from 'lucide-react';

type Row = {
  id: string;
  type: string;
  title: string;
  created_at: string;
  gen_input_tokens: number | null;
  gen_output_tokens: number | null;
  gen_cost_usd: number | null;
  fc_input_tokens: number | null;
  fc_output_tokens: number | null;
  fc_cost_usd: number | null;
  total_cost_usd: number | null;
};

export default async function BillingPage() {
  const supa = adminClient();
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: items } = await supa
    .from('content_items')
    .select('id, type, title, created_at, gen_input_tokens, gen_output_tokens, gen_cost_usd, fc_input_tokens, fc_output_tokens, fc_cost_usd, total_cost_usd')
    .not('total_cost_usd', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  const rows: Row[] = (items ?? []) as Row[];

  // 집계
  const totalUsd = rows.reduce((s, r) => s + (r.total_cost_usd ?? 0), 0);
  const newsRows = rows.filter(r => r.type === 'news');
  const cardRows = rows.filter(r => r.type === 'card');
  const newsTotal = newsRows.reduce((s, r) => s + (r.total_cost_usd ?? 0), 0);
  const cardTotal = cardRows.reduce((s, r) => s + (r.total_cost_usd ?? 0), 0);

  // 일별 집계
  const byDay = new Map<string, { news: number; card: number; count: number }>();
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    const cur = byDay.get(day) ?? { news: 0, card: 0, count: 0 };
    if (r.type === 'news') cur.news += r.total_cost_usd ?? 0;
    else if (r.type === 'card') cur.card += r.total_cost_usd ?? 0;
    cur.count++;
    byDay.set(day, cur);
  }
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const maxDayCost = Math.max(0.0001, ...days.map(([, v]) => v.news + v.card));

  // 월별 누적
  const month = new Date().toISOString().slice(0, 7);
  const thisMonthRows = rows.filter(r => r.created_at.startsWith(month));
  const thisMonthTotal = thisMonthRows.reduce((s, r) => s + (r.total_cost_usd ?? 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-emerald-600" />
          AI 콘텐츠 생성 비용
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          최근 30일 · 1 USD ≈ {USD_TO_KRW.toLocaleString('ko-KR')}원 환산
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Stat icon={Calendar} title="이번 달" usd={thisMonthTotal} sub={`${thisMonthRows.length}건`} color="emerald" />
        <Stat icon={TrendingUp} title="최근 30일" usd={totalUsd} sub={`${rows.length}건`} color="blue" />
        <Stat icon={Newspaper} title="보험뉴스" usd={newsTotal} sub={`${newsRows.length}건`} color="teal" />
        <Stat icon={Images} title="카드뉴스" usd={cardTotal} sub={`${cardRows.length}건`} color="violet" />
      </div>

      {/* 일별 차트 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">일별 비용 (최근 30일)</h3>
        {days.length === 0 ? (
          <p className="text-sm text-slate-500">데이터 없음. 첫 cron 실행 후 표시됩니다.</p>
        ) : (
          <div className="space-y-1.5">
            {days.map(([day, v]) => {
              const total = v.news + v.card;
              const newsW = (v.news / maxDayCost) * 100;
              const cardW = (v.card / maxDayCost) * 100;
              return (
                <div key={day} className="grid grid-cols-[80px_1fr_120px] items-center gap-3 text-xs">
                  <span className="font-mono text-slate-500">{day.slice(5)}</span>
                  <div className="flex h-5 w-full overflow-hidden rounded bg-slate-100">
                    {newsW > 0 && <div className="bg-teal-500" style={{ width: `${newsW}%` }} title={`보험뉴스 ${formatKrw(v.news)}`} />}
                    {cardW > 0 && <div className="bg-violet-500" style={{ width: `${cardW}%` }} title={`카드뉴스 ${formatKrw(v.card)}`} />}
                  </div>
                  <span className="text-right font-mono text-slate-700">{formatKrw(total)} <span className="text-slate-400">({v.count})</span></span>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-500" /> 보험뉴스</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-500" /> 카드뉴스</span>
        </div>
      </div>

      {/* 콘텐츠별 상세 */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">콘텐츠별 상세 (최근 30일)</h3>
        </div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">데이터 없음</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">생성일</th>
                <th className="px-4 py-2 text-left">종류</th>
                <th className="px-4 py-2 text-left">제목</th>
                <th className="px-4 py-2 text-right">생성</th>
                <th className="px-4 py-2 text-right">검증</th>
                <th className="px-4 py-2 text-right">합계</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-xs text-slate-500 font-mono">{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.type === 'card' ? 'bg-violet-100 text-violet-800' : 'bg-teal-100 text-teal-800'
                    }`}>
                      {r.type === 'card' ? '🎴 카드뉴스' : '📰 보험뉴스'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-700 max-w-[260px] truncate">{r.title}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-slate-600">
                    {formatUsd(r.gen_cost_usd ?? 0)}
                    <div className="text-[10px] text-slate-400">{(r.gen_input_tokens ?? 0)}+{r.gen_output_tokens ?? 0} tok</div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-slate-600">
                    {formatUsd(r.fc_cost_usd ?? 0)}
                    <div className="text-[10px] text-slate-400">{(r.fc_input_tokens ?? 0)}+{r.fc_output_tokens ?? 0} tok</div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">
                    {formatUsd(r.total_cost_usd ?? 0)}
                    <div className="text-[10px] font-normal text-slate-500">{formatKrw(r.total_cost_usd ?? 0)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, title, usd, sub, color }: { icon: typeof DollarSign; title: string; usd: number; sub: string; color: 'emerald' | 'blue' | 'teal' | 'violet' }) {
  const tone = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue:    'border-blue-200 bg-blue-50 text-blue-700',
    teal:    'border-teal-200 bg-teal-50 text-teal-700',
    violet:  'border-violet-200 bg-violet-50 text-violet-700',
  }[color];
  return (
    <div className={`rounded-2xl border ${tone} p-5`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</span>
        <Icon className="w-5 h-5 opacity-70" />
      </div>
      <div className="text-2xl font-black mb-1">{formatKrw(usd)}</div>
      <div className="text-xs opacity-70">{formatUsd(usd)} · {sub}</div>
    </div>
  );
}
