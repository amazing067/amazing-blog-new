import Link from 'next/link';
import { adminClient } from '@/lib/admin/guard';

const STATUSES = ['review','published','expired','failed','all'] as const;
type Status = typeof STATUSES[number];

export default async function NewsListPage({
  searchParams,
}: { searchParams?: Promise<{ status?: string }> }) {
  const sp = (await searchParams) ?? {};
  const status = (STATUSES.includes(sp.status as Status) ? sp.status : 'review') as Status;

  const supa = adminClient();
  let q = supa.from('content_items')
    .select('id, title, status, source_refs, created_at')
    .eq('type', 'news').order('created_at', { ascending: false }).limit(100);
  if (status !== 'all') q = q.eq('status', status);
  const { data: items } = await q;

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
      <div className="mb-4 flex gap-2">
        {STATUSES.map(s => (
          <Link key={s} href={`/admin/content/news?status=${s}`}
            className={`rounded border px-3 py-1 text-sm ${s===status?'bg-black text-white':'bg-white'}`}>{s}</Link>
        ))}
      </div>
      <table className="w-full border bg-white text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">제목</th>
            <th className="p-2">상태</th>
            <th className="p-2">위험도</th>
            <th className="p-2">출처</th>
            <th className="p-2">생성</th>
          </tr>
        </thead>
        <tbody>
          {(items ?? []).map((row: { id: string; title: string; status: string; source_refs: { source: string }[] | null; created_at: string }) => (
            <tr key={row.id} className="border-t hover:bg-gray-50">
              <td className="p-2">
                <Link href={`/admin/content/news/${row.id}`} className="text-blue-600 hover:underline">{row.title}</Link>
              </td>
              <td className="p-2 text-center">{row.status}</td>
              <td className="p-2 text-center">{lintMap.get(row.id) ?? '-'}</td>
              <td className="p-2 text-center">{row.source_refs?.[0]?.source ?? '-'}</td>
              <td className="p-2 text-center text-gray-500">{new Date(row.created_at).toLocaleString('ko-KR')}</td>
            </tr>
          ))}
          {(!items || items.length === 0) && (
            <tr><td colSpan={5} className="p-6 text-center text-gray-500">항목 없음</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
