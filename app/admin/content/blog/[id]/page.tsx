import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminClient, requireContentAccess } from '@/lib/admin/guard';
import { ArrowLeft, FileText } from 'lucide-react';
import BlogDetailClient from './BlogDetailClient';
import type { ComplianceInfo } from '@/lib/content/types';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  review:    { label: '검토 대기', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved:  { label: '확정',      cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  returned:  { label: '반송',      cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  published: { label: '발행 완료', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  expired:   { label: '거절',      cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  failed:    { label: '실패',      cls: 'bg-red-100 text-red-800 border-red-200' },
};

export default async function BlogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role } = await requireContentAccess();
  const isAdmin = role === 'admin';
  const supa = adminClient();
  const { data: item } = await supa.from('content_items').select('*').eq('id', id).single();
  if (!item || item.type !== 'blog') notFound();
  const { data: profile } = await supa.from('profiles').select('full_name').eq('id', user.id).single();
  const { data: lint } = await supa.from('compliance_lints')
    .select('*').eq('content_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();

  const returnedHidden = item.status === 'returned' && !isAdmin;
  const statusInfo = returnedHidden
    ? STATUS_LABEL.review
    : (STATUS_LABEL[item.status] ?? { label: item.status, cls: 'bg-slate-100 text-slate-700 border-slate-200' });
  const factCheck = item.fact_check as { passed: boolean; issues: { claim: string; reason: string; severity: 'high'|'medium'|'low' }[] } | null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin/content/blog" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> 블로그 대기열
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">
            <FileText className="w-3 h-3" /> 블로그
          </span>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <h1 className="text-3xl font-bold text-slate-900 leading-tight">{item.title}</h1>
        {item.meta_description && (
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">{item.meta_description}</p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          생성 {new Date(item.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · {(item.body_md?.length ?? 0).toLocaleString('ko-KR')}자
        </p>
      </div>

      <BlogDetailClient
        id={item.id}
        userId={user.id}
        defaultDesigner={(profile as { full_name?: string } | null)?.full_name ?? ''}
        title={item.title}
        bodyMd={item.body_md ?? ''}
        metaDescription={item.meta_description ?? ''}
        status={item.status}
        publishUrl={item.publish_url ?? ''}
        compliance={(item.compliance as ComplianceInfo | null) ?? null}
        lint={lint}
        factCheck={factCheck}
        isAdmin={isAdmin}
        returnReason={(item.return_reason as string | null) ?? null}
      />
    </div>
  );
}
