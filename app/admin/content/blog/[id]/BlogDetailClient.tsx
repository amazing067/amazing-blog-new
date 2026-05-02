'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Copy, Download, CheckCircle2, X, Trash2, Loader2, Shield, Search, Pencil, Save, Code } from 'lucide-react';
import { mdComponents } from '../../news/[id]/MdComponents';
import type { ComplianceInfo } from '@/lib/content/types';

const LS_REG = (uid: string) => `insurance_registration_number_${uid}`;
const LS_BRANCH = (uid: string) => `insurance_branch_name_${uid}`;

type Props = {
  id: string;
  userId: string;
  defaultDesigner: string;
  title: string;
  bodyMd: string;
  metaDescription: string;
  status: string;
  publishUrl: string;
  compliance: ComplianceInfo | null;
  lint: {
    risk_score: number;
    forbidden_terms_found: string[] | null;
    comparison_phrases: string[] | null;
    guarantee_phrases: string[] | null;
    insurer_mentions: string[] | null;
    product_mentions: string[] | null;
  } | null;
  factCheck: { passed: boolean; issues: { claim: string; reason: string; severity: 'high'|'medium'|'low' }[] } | null;
};

const SEV: Record<string, { bg: string; label: string }> = {
  high:   { bg: 'bg-red-100 text-red-800 border-red-200',     label: '⛔ 발행 차단' },
  medium: { bg: 'bg-amber-100 text-amber-800 border-amber-200', label: '⚠️ 사람 검수' },
  low:    { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: 'ℹ️ 참고' },
};

function riskTone(score: number) {
  if (score >= 60) return { text: 'text-red-700',     bar: 'bg-red-500',     label: '위험' };
  if (score >= 30) return { text: 'text-amber-700',   bar: 'bg-amber-500',   label: '주의' };
  return                  { text: 'text-emerald-700', bar: 'bg-emerald-500', label: '안전' };
}

export default function BlogDetailClient({ id, userId, defaultDesigner, title, bodyMd: initialBody, metaDescription, status, publishUrl, compliance, lint, factCheck }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState(publishUrl);
  const [body, setBody] = useState(initialBody);
  const [editing, setEditing] = useState(false);
  const dirty = body !== initialBody;

  const [comp, setComp] = useState<ComplianceInfo>({
    company: compliance?.company ?? '프라임에셋',
    branch: compliance?.branch ?? '',
    designer: compliance?.designer ?? defaultDesigner,
    registration: compliance?.registration ?? '',
    number: compliance?.number ?? '',
    start_date: compliance?.start_date ?? '',
    end_date: compliance?.end_date ?? '',
    include_warning: compliance?.include_warning ?? true,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return;
    const storedReg = localStorage.getItem(LS_REG(userId)) || '';
    const storedBranch = localStorage.getItem(LS_BRANCH(userId)) || '';
    setComp(prev => ({
      ...prev,
      branch: prev.branch || storedBranch,
      registration: prev.registration || storedReg,
    }));
  }, [userId]);

  function updateComp<K extends keyof ComplianceInfo>(field: K, value: ComplianceInfo[K]) {
    setComp(prev => {
      const next = { ...prev, [field]: value };
      if (typeof window !== 'undefined' && userId) {
        if (field === 'registration') localStorage.setItem(LS_REG(userId), String(value ?? ''));
        if (field === 'branch') localStorage.setItem(LS_BRANCH(userId), String(value ?? ''));
      }
      return next;
    });
  }

  async function saveCompliance() {
    setBusy('compliance');
    try {
      const res = await fetch(`/api/admin/content/blog/${id}/compliance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comp),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e) {
      alert('심의번호 저장 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function saveBody() {
    setBusy('body');
    try {
      const res = await fetch(`/api/admin/content/blog/${id}/body`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body_md: body }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditing(false);
      router.refresh();
    } catch (e) {
      alert('본문 저장 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function copyAsHtml() {
    setBusy('copyhtml');
    try {
      const res = await fetch(`/api/admin/content/blog/${id}/download?format=html`);
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      await navigator.clipboard.writeText(text);
      alert('블로그 게시용 HTML이 클립보드에 복사되었습니다.');
    } catch (e) {
      alert('복사 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  function downloadFile(format: 'html' | 'md') {
    const a = document.createElement('a');
    a.href = `/api/admin/content/blog/${id}/download?format=${format}&dl=1`;
    a.download = `blog-${id}.${format}`;
    a.click();
  }

  async function call(action: string, path: string, label: string, body?: unknown, method: 'POST'|'DELETE' = 'POST') {
    if (!confirm(`${label} 진행할까요?`)) return;
    setBusy(action);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      if (action === 'delete') router.push('/admin/content/blog');
      else router.refresh();
    } catch (e) {
      alert(`${label} 실패: ` + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  const tone = lint ? riskTone(lint.risk_score) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 본문 */}
      <article className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* 편집 모드 컨트롤 바 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Pencil className={`w-4 h-4 ${editing ? 'text-blue-600' : 'text-slate-400'}`} />
            <span className="text-sm font-semibold text-slate-700">본문</span>
            {dirty && <span className="text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">수정됨 · 저장 필요</span>}
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button disabled={!!busy}
                  onClick={() => { if (confirm('수정 취소?')) { setBody(initialBody); setEditing(false); } }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-50">취소</button>
                <button disabled={!!busy || !dirty} onClick={saveBody}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 disabled:opacity-50">
                  {busy === 'body' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  저장
                </button>
              </>
            ) : (
              <button disabled={!!busy} onClick={() => setEditing(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white inline-flex items-center gap-1.5 disabled:opacity-50">
                <Pencil className="w-3.5 h-3.5" /> 본문 편집
              </button>
            )}
          </div>
        </div>
        {/* 본문 영역 */}
        <div className="px-8 py-8">
          {editing ? (
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className="w-full min-h-[600px] rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono leading-relaxed focus:border-blue-400 focus:outline-none"
            />
          ) : (
            <div className="max-w-none">
              <ReactMarkdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]} rehypePlugins={[rehypeRaw]} components={mdComponents}>
                {body}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </article>

      {/* 사이드바 */}
      <div className="space-y-4">
        {/* 다운로드 */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h3 className="font-bold text-blue-900 mb-2">블로그 게시용 다운로드</h3>
          <p className="text-[11px] text-blue-800 mb-3 leading-relaxed">
            심의번호 입력하면 본문 끝에 자동 삽입됩니다.
          </p>
          <button disabled={!!busy} onClick={copyAsHtml}
            className="w-full mb-2 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50 transition">
            {busy === 'copyhtml' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            HTML 클립보드 복사
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!!busy} onClick={() => downloadFile('html')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 hover:bg-white px-3 py-2 text-xs font-medium text-blue-700 disabled:opacity-50 transition">
              <Code className="w-3.5 h-3.5" /> .html
            </button>
            <button disabled={!!busy} onClick={() => downloadFile('md')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 hover:bg-white px-3 py-2 text-xs font-medium text-blue-700 disabled:opacity-50 transition">
              <Download className="w-3.5 h-3.5" /> .md
            </button>
          </div>
        </div>

        {/* 발행 마킹 */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
          <label className="text-xs font-medium text-slate-600 block">블로그 게시 후 URL</label>
          <input type="url" placeholder="https://blog.naver.com/..." value={url} onChange={e => setUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-emerald-400 focus:outline-none" />
          <button disabled={!!busy || status === 'published'}
            onClick={() => call('publish', `/api/admin/content/blog/${id}/publish-mark`, '발행 완료 마킹', { publish_url: url || null })}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 transition">
            {busy === 'publish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {status === 'published' ? '이미 발행됨' : '발행 완료'}
          </button>
        </div>

        {/* 광고심의 폼 */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-bold text-amber-900 mb-1">📋 광고심의필 정보</h3>
          <p className="text-[11px] text-amber-800 mb-3 leading-relaxed">
            입력하면 다운로드 시 본문 마지막에 자동 삽입됩니다.
          </p>
          <div className="space-y-2.5">
            {[
              ['지점명', 'branch', 'text', '예: 강남지점'],
              ['설계사명', 'designer', 'text', ''],
              ['협회등록번호', 'registration', 'text', '예: 12345678'],
              ['심의번호', 'number', 'text', '제2026-1234호'],
            ].map(([label, key, type, ph]) => (
              <div key={key as string}>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">{label}</label>
                <input type={type as string} placeholder={ph as string}
                  value={(comp[key as keyof ComplianceInfo] as string) ?? ''}
                  onChange={e => updateComp(key as keyof ComplianceInfo, e.target.value as never)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">시작일</label>
                <input type="date" value={comp.start_date ?? ''} onChange={e => updateComp('start_date', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">종료일</label>
                <input type="date" value={comp.end_date ?? ''} onChange={e => updateComp('end_date', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={comp.include_warning ?? true} onChange={e => updateComp('include_warning', e.target.checked)} className="rounded" />
              경고 문구 포함
            </label>
            <button disabled={!!busy} onClick={saveCompliance}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 transition">
              {busy === 'compliance' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              저장
            </button>
          </div>
        </div>

        {/* Fact Check */}
        {factCheck && (
          <div className={`rounded-2xl border p-5 ${factCheck.passed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Search className={`w-5 h-5 ${factCheck.passed ? 'text-emerald-600' : 'text-red-600'}`} />
              <h3 className={`font-semibold ${factCheck.passed ? 'text-emerald-700' : 'text-red-700'}`}>AI 사실 검증 · Google 검색 기반</h3>
            </div>
            {factCheck.issues.length === 0 ? (
              <div className="text-sm text-emerald-700">의심되는 사실관계 없음 ✓</div>
            ) : (
              <div className="space-y-2">
                {factCheck.issues.slice(0, 5).map((iss, i) => (
                  <div key={i} className="rounded-xl bg-white/60 border border-white/80 p-3">
                    <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium mb-1 ${SEV[iss.severity].bg}`}>
                      {SEV[iss.severity].label}
                    </div>
                    <div className="text-xs text-slate-800 mb-1 line-clamp-2">{iss.claim}</div>
                    <div className="text-xs text-slate-700">{iss.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 광고심의 lint */}
        {lint && tone && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Shield className={`w-5 h-5 ${tone.text}`} />
              <h3 className={`font-semibold ${tone.text}`}>광고심의 위험도</h3>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <span className={`text-3xl font-bold ${tone.text}`}>{lint.risk_score}</span>
              <span className={`text-sm font-medium ${tone.text}`}>/ 100 · {tone.label}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full ${tone.bar}`} style={{ width: `${Math.min(100, lint.risk_score)}%` }} />
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              <li>금지표현: {lint.forbidden_terms_found?.join(', ') || '-'}</li>
              <li>비교표현: {lint.comparison_phrases?.join(', ') || '-'}</li>
              <li>보장단정: {lint.guarantee_phrases?.join(', ') || '-'}</li>
              <li className="text-red-700">보험사명: {lint.insurer_mentions?.join(', ') || '-'}</li>
              <li className="text-red-700">상품명: {lint.product_mentions?.join(', ') || '-'}</li>
            </ul>
          </div>
        )}

        {/* 보조 액션 */}
        <div className="grid grid-cols-2 gap-2">
          <button disabled={!!busy || status === 'expired'}
            onClick={() => call('reject', `/api/admin/content/blog/${id}/reject`, '거절')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 px-3 py-2 text-xs font-medium disabled:opacity-50 transition">
            <X className="w-3.5 h-3.5" /> 거절
          </button>
          <button disabled={!!busy}
            onClick={() => call('delete', `/api/admin/content/blog/${id}/delete`, '영구 삭제 (되돌릴 수 없음)', undefined, 'DELETE')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 px-3 py-2 text-xs font-medium disabled:opacity-50 transition">
            {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            영구 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
