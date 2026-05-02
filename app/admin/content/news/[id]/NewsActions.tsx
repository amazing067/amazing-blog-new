'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Copy, Download, CheckCircle2, X, RefreshCw, Loader2 } from 'lucide-react';

type Props = { id: string; status: string; title: string; bodyMd: string; publishUrl: string };

export default function NewsActions({ id, status, title, bodyMd, publishUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState(publishUrl);
  const [copied, setCopied] = useState(false);

  async function copyToCafe() {
    setBusy('copy');
    try {
      const res = await fetch(`/api/admin/content/news/${id}/download?format=cafe-text`);
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      alert('복사 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  function downloadMd() {
    setBusy('download');
    const blob = new Blob([`# ${title}\n\n${bodyMd}\n`], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    setTimeout(() => setBusy(null), 500);
  }

  async function call(action: string, path: string, label: string, body?: unknown) {
    if (!confirm(`${label} 진행할까요?`)) return;
    setBusy(action);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e) {
      alert(`${label} 실패: ` + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* 1. 카페용 복사 — 가장 큰 강조 */}
      <button
        disabled={!!busy}
        onClick={copyToCafe}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition"
      >
        {busy === 'copy' ? <Loader2 className="w-4 h-4 animate-spin" /> :
         copied ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> :
                  <Copy className="w-4 h-4" />}
        {copied ? '복사 완료!' : '카페용 텍스트 복사'}
      </button>

      <button
        disabled={!!busy}
        onClick={downloadMd}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50 transition"
      >
        <Download className="w-4 h-4" />
        .md 다운로드
      </button>

      {/* 2. 발행 마킹 */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
        <label className="text-xs font-medium text-slate-600 block">카페 게시 후 URL 입력 (선택)</label>
        <input
          type="url"
          placeholder="https://cafe.naver.com/..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-emerald-400 focus:outline-none"
        />
        <button
          disabled={!!busy || status === 'published'}
          onClick={() => call('publish', `/api/admin/content/news/${id}/publish-mark`, '발행 완료 마킹', { publish_url: url || null })}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {busy === 'publish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {status === 'published' ? '이미 발행됨' : '발행 완료'}
        </button>
      </div>

      {/* 3. 보조 액션 */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          disabled={!!busy}
          onClick={() => call('relint', `/api/admin/content/news/${id}/relint`, '재검수')}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50 transition"
        >
          {busy === 'relint' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          재검수
        </button>
        <button
          disabled={!!busy || status === 'expired'}
          onClick={() => call('reject', `/api/admin/content/news/${id}/reject`, '거절')}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 px-3 py-2 text-xs font-medium disabled:opacity-50 transition"
        >
          <X className="w-3.5 h-3.5" />
          거절
        </button>
      </div>
    </div>
  );
}
