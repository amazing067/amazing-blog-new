'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Copy, CheckCircle2, X, RefreshCw, Loader2, Trash2, FileDown, ImageDown } from 'lucide-react';
import { copyArticleForNaver } from '@/lib/content/naver-clipboard';
import { downloadArticlePdf } from '@/lib/content/article-pdf';
import { downloadArticleImages } from '@/lib/content/article-image';

type Props = { id: string; status: string; title: string; bodyMd: string; publishUrl: string };

const articleEl = () => document.getElementById('naver-article-body') as HTMLElement | null;

export default function NewsActions({ id, status, title, publishUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState(publishUrl);
  const [copied, setCopied] = useState(false);
  const [naverProg, setNaverProg] = useState<string | null>(null);

  async function copyForNaver() {
    const el = articleEl();
    if (!el) { alert('본문을 찾지 못했습니다.'); return; }
    setBusy('naver');
    setNaverProg(null);
    try {
      await copyArticleForNaver(el, title, {
        onProgress: (d, t) => setNaverProg(t > 0 ? `이미지 변환 ${d}/${t}` : null),
      });
      alert('네이버 블로그용으로 복사됐습니다.\n네이버 글쓰기 화면에서 붙여넣기(Ctrl+V) 하세요.\n(통계·비교 같은 시각 블록은 이미지로, 본문은 글자로 들어갑니다)');
    } catch (e) {
      alert('복사 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
      setNaverProg(null);
    }
  }

  async function downloadPdf() {
    const el = articleEl();
    if (!el) { alert('본문을 찾지 못했습니다.'); return; }
    setBusy('pdf');
    try {
      await downloadArticlePdf(el, title);
    } catch (e) {
      alert('PDF 생성 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function downloadImages() {
    const el = articleEl();
    if (!el) { alert('본문을 찾지 못했습니다.'); return; }
    setBusy('image');
    try {
      const { count } = await downloadArticleImages(el, title);
      alert(count > 1
        ? `전체 이미지 ${count}장이 ZIP으로 저장됐습니다. 네이버에 순서대로 올리세요.`
        : '전체 이미지(PNG)가 저장됐습니다.');
    } catch (e) {
      alert('이미지 생성 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

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

  async function call(action: string, path: string, label: string, body?: unknown, method: 'POST' | 'DELETE' = 'POST') {
    if (!confirm(`${label} 진행할까요?`)) return;
    setBusy(action);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      if (action === 'delete') {
        router.push('/admin/content/news');
      } else {
        router.refresh();
      }
    } catch (e) {
      alert(`${label} 실패: ` + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* 1. 네이버 블로그용 복사 — 서식글+이미지 (가장 강조) */}
      <button
        disabled={!!busy}
        onClick={copyForNaver}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50 transition"
      >
        {busy === 'naver' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
        {busy === 'naver' ? (naverProg ?? '복사 준비 중…') : '네이버 블로그용 복사'}
      </button>

      {/* 2. 전체 이미지로 저장 (긴 글은 여러 장 ZIP) */}
      <button
        disabled={!!busy}
        onClick={downloadImages}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition"
      >
        {busy === 'image' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
        전체 이미지로 저장
      </button>

      {/* 3. PDF 다운로드 */}
      <button
        disabled={!!busy}
        onClick={downloadPdf}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition"
      >
        {busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        PDF 다운로드
      </button>

      {/* 3. 카페용 텍스트 복사 (순수 텍스트) */}
      <button
        disabled={!!busy}
        onClick={copyToCafe}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50 transition"
      >
        {busy === 'copy' ? <Loader2 className="w-4 h-4 animate-spin" /> :
         copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                  <Copy className="w-4 h-4" />}
        {copied ? '복사 완료!' : '카페용 텍스트 복사 (순수 텍스트)'}
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
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 px-3 py-2 text-xs font-medium disabled:opacity-50 transition"
        >
          <X className="w-3.5 h-3.5" />
          거절
        </button>
      </div>

      {/* 4. 영구 삭제 */}
      <button
        disabled={!!busy}
        onClick={() => call('delete', `/api/admin/content/news/${id}/delete`, '영구 삭제 (되돌릴 수 없음)', undefined, 'DELETE')}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 px-3 py-2 text-xs font-medium disabled:opacity-50 transition mt-2"
      >
        {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        영구 삭제
      </button>
    </div>
  );
}
