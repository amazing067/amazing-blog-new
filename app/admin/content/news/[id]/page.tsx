import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminClient } from '@/lib/admin/guard';
import NewsActions from './NewsActions';
import { ArrowLeft, ExternalLink, Shield, AlertCircle, CheckCircle2, Newspaper, Calendar, Tag, Search } from 'lucide-react';
import ArticleBody from './ArticleBody';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  review:    { label: '검토 대기', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  published: { label: '발행 완료', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  expired:   { label: '거절',      cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  failed:    { label: '실패',      cls: 'bg-red-100 text-red-800 border-red-200' },
};

function riskTone(score: number) {
  if (score >= 60) return { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     bar: 'bg-red-500',     label: '위험' };
  if (score >= 30) return { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   bar: 'bg-amber-500',   label: '주의' };
  return                  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-500', label: '안전' };
}

type LintRow = {
  risk_score: number;
  forbidden_terms_found: string[] | null;
  comparison_phrases: string[] | null;
  guarantee_phrases: string[] | null;
  insurer_mentions: string[] | null;
  product_mentions: string[] | null;
};

type FactCheckData = {
  passed: boolean;
  issues: { claim: string; reason: string; severity: 'high' | 'medium' | 'low' }[];
};

function FactCheckPanel({ data }: { data: FactCheckData }) {
  const sevColor: Record<string, { bg: string; text: string; label: string }> = {
    high:   { bg: 'bg-red-100 text-red-800 border-red-200',    text: 'text-red-800',   label: '⛔ 발행 차단' },
    medium: { bg: 'bg-amber-100 text-amber-800 border-amber-200', text: 'text-amber-800', label: '⚠️ 사람 검수' },
    low:    { bg: 'bg-slate-100 text-slate-700 border-slate-200', text: 'text-slate-700', label: 'ℹ️ 참고' },
  };

  return (
    <div className={`rounded-2xl border shadow-sm p-5 ${data.passed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Search className={`w-5 h-5 ${data.passed ? 'text-emerald-600' : 'text-red-600'}`} />
        <h3 className={`font-semibold ${data.passed ? 'text-emerald-700' : 'text-red-700'}`}>
          AI 사실 검증 · Google 검색 기반
        </h3>
      </div>
      {data.issues.length === 0 ? (
        <div className="text-sm text-emerald-700">의심되는 사실관계 없음 ✓</div>
      ) : (
        <div className="space-y-3">
          {data.issues.map((iss, i) => (
            <div key={i} className="rounded-xl bg-white/60 border border-white/80 p-3">
              <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium mb-1.5 ${sevColor[iss.severity].bg}`}>
                {sevColor[iss.severity].label}
              </div>
              <div className="text-xs font-medium text-slate-600 mb-1">의심 진술</div>
              <div className="text-sm text-slate-800 mb-2 line-clamp-2">{iss.claim}</div>
              <div className="text-xs font-medium text-slate-600 mb-1">검증 결과</div>
              <div className={`text-sm ${sevColor[iss.severity].text}`}>{iss.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChipList({ title, items, danger }: { title: string; items: string[] | null | undefined; danger?: boolean }) {
  const list = items ?? [];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">{title}</span>
        <span className={`text-xs font-mono ${list.length > 0 ? (danger ? 'text-red-600' : 'text-amber-600') : 'text-slate-400'}`}>
          {list.length}
        </span>
      </div>
      {list.length === 0 ? (
        <div className="text-xs text-slate-400 italic">검출 없음</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {list.map((s, i) => (
            <span
              key={i}
              className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${
                danger ? 'bg-red-100 text-red-800 border border-red-200'
                       : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supa = adminClient();
  const { data: item } = await supa.from('content_items').select('*').eq('id', id).single();
  if (!item) notFound();
  const { data: lint } = await supa.from('compliance_lints')
    .select('*').eq('content_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle<LintRow>();

  const tone = lint ? riskTone(lint.risk_score) : null;
  const statusInfo = STATUS_LABEL[item.status] ?? { label: item.status, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  const sourceRef = (item.source_refs as { source?: string; link?: string; pubDate?: string; topic_slug?: string; category?: string; generated_by?: string }[] | null)?.[0];
  const isAiGenerated = !!sourceRef?.topic_slug;
  const sourceLabel = sourceRef?.category ?? sourceRef?.source ?? '보험뉴스';

  return (
    <div>
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/admin/content/news" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> 검수 대기열
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
            <Newspaper className="w-3 h-3" /> 보험뉴스
          </span>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 본문 */}
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden lg:col-span-2">
          {/* 헤더 영역 (그라데이션) */}
          <div className="bg-gradient-to-br from-slate-50 to-emerald-50/40 border-b border-slate-100 p-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 shadow-sm">
                <Tag className="w-3 h-3" /> {sourceLabel}
              </span>
              {isAiGenerated && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 border border-violet-200">
                  AI 생성
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3 h-3" />
                {new Date(item.created_at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' })}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 leading-tight tracking-tight">{item.title}</h1>
          </div>

          {/* 본문 영역 — 카카오페이 머니콘텐츠 톤 마크다운 컴포넌트 */}
          <div className="px-8 py-10">
            <div className="max-w-none" id="naver-article-body">
              <ArticleBody markdown={item.body_md ?? ''} />
            </div>

            {/* 출처/생성 박스 */}
            {(sourceRef?.link || isAiGenerated) && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <ExternalLink className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {sourceRef?.link ? (
                      <>
                        <div className="text-xs font-medium text-slate-500 mb-1">원문 출처</div>
                        <a href={sourceRef.link} target="_blank" rel="noopener noreferrer"
                           className="text-sm text-emerald-700 hover:underline break-all">
                          {sourceRef.link}
                        </a>
                      </>
                    ) : (
                      <>
                        <div className="text-xs font-medium text-slate-500 mb-1">생성 정보</div>
                        <div className="text-sm text-slate-700">
                          AI 자동 생성 콘텐츠 · 카테고리 {sourceRef?.category}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </article>

        {/* 사이드바 */}
        <div className="space-y-4">
          {/* Fact-Check 결과 (Gemini + Google Search) */}
          {item.fact_check && (
            <FactCheckPanel data={item.fact_check as { passed: boolean; issues: { claim: string; reason: string; severity: 'high' | 'medium' | 'low' }[] }} />
          )}

          {/* 광고심의 위험도 카드 */}
          <div className={`rounded-2xl border shadow-sm p-5 ${tone ? tone.bg + ' ' + tone.border : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Shield className={`w-5 h-5 ${tone?.text ?? 'text-slate-400'}`} />
              <h3 className={`font-semibold ${tone?.text ?? 'text-slate-700'}`}>광고심의 위험도</h3>
            </div>
            {lint ? (
              <>
                <div className="flex items-baseline justify-between mb-2">
                  <span className={`text-3xl font-bold ${tone!.text}`}>{lint.risk_score}</span>
                  <span className={`text-sm font-medium ${tone!.text}`}>/ 100 · {tone!.label}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/70">
                  <div className={`h-full ${tone!.bar}`} style={{ width: `${Math.min(100, lint.risk_score)}%` }} />
                </div>
                <div className="mt-4 space-y-3">
                  <ChipList title="광고 절대표현" items={lint.forbidden_terms_found} />
                  <ChipList title="비교 표현" items={lint.comparison_phrases} />
                  <ChipList title="보장 단정" items={lint.guarantee_phrases} />
                  <ChipList title="🚫 보험사명 노출" items={lint.insurer_mentions} danger />
                  <ChipList title="🚫 상품명 노출" items={lint.product_mentions} danger />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <AlertCircle className="w-4 h-4" /> 검수 결과 없음 — 재검수 클릭
              </div>
            )}
          </div>

          {/* 액션 카드 */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-slate-700">카페 게시 액션</h3>
            </div>
            <NewsActions
              id={item.id}
              status={item.status}
              title={item.title}
              bodyMd={item.body_md ?? ''}
              publishUrl={item.publish_url ?? ''}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
