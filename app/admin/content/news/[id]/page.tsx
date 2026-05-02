import { notFound } from 'next/navigation';
import { adminClient } from '@/lib/admin/guard';
import NewsActions from './NewsActions';

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supa = adminClient();
  const { data: item } = await supa.from('content_items').select('*').eq('id', id).single();
  if (!item) notFound();
  const { data: lint } = await supa.from('compliance_lints')
    .select('*').eq('content_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <article className="rounded border bg-white p-6 md:col-span-2">
        <h2 className="mb-2 text-2xl font-bold">{item.title}</h2>
        <div className="mb-4 text-sm text-gray-500">상태: {item.status} · {new Date(item.created_at).toLocaleString('ko-KR')}</div>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-7">{item.body_md}</pre>
      </article>
      <aside className="rounded border bg-white p-4">
        <h3 className="mb-2 font-semibold">사전검수</h3>
        {lint ? (
          <ul className="space-y-1 text-sm">
            <li>위험도: <strong>{lint.risk_score}</strong></li>
            <li>금지표현: {lint.forbidden_terms_found?.join(', ') || '-'}</li>
            <li>비교표현: {lint.comparison_phrases?.join(', ') || '-'}</li>
            <li>보장단정: {lint.guarantee_phrases?.join(', ') || '-'}</li>
            <li className="text-red-700">보험사명: {lint.insurer_mentions?.join(', ') || '-'}</li>
            <li className="text-red-700">상품명: {lint.product_mentions?.join(', ') || '-'}</li>
          </ul>
        ) : <p className="text-sm text-gray-500">검수 결과 없음</p>}
        <hr className="my-4" />
        <NewsActions
          id={item.id}
          status={item.status}
          title={item.title}
          bodyMd={item.body_md ?? ''}
          publishUrl={item.publish_url ?? ''}
        />
      </aside>
    </div>
  );
}
