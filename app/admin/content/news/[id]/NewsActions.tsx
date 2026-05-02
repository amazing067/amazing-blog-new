'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = { id: string; status: string; title: string; bodyMd: string; publishUrl: string };

export default function NewsActions({ id, status, title, bodyMd, publishUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(publishUrl);

  async function copyToCafe() {
    setBusy(true);
    const res = await fetch(`/api/admin/content/news/${id}/download?format=cafe-text`);
    const text = await res.text();
    setBusy(false);
    if (!res.ok) { alert('복사 준비 실패'); return; }
    await navigator.clipboard.writeText(text);
    alert('카페용 텍스트가 클립보드에 복사되었습니다.');
  }

  function downloadMd() {
    const blob = new Blob([`# ${title}\n\n${bodyMd}\n`], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function call(path: string, label: string, body?: unknown) {
    if (!confirm(`${label} 진행할까요?`)) return;
    setBusy(true);
    const res = await fetch(path, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) { alert(`${label} 실패: ${await res.text()}`); return; }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button disabled={busy} onClick={copyToCafe}
        className="w-full rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50">
        카페용 복사 (클립보드)
      </button>
      <button disabled={busy} onClick={downloadMd}
        className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50">
        .md 다운로드
      </button>
      <hr className="my-2" />
      <input
        type="url"
        placeholder="카페 게시 URL (선택)"
        value={url}
        onChange={e => setUrl(e.target.value)}
        className="w-full rounded border px-2 py-1 text-sm"
      />
      <button
        disabled={busy || status === 'published'}
        onClick={() => call(`/api/admin/content/news/${id}/publish-mark`, '발행 완료 마킹', { publish_url: url || null })}
        className="w-full rounded bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-50">
        발행 완료
      </button>
      <hr className="my-2" />
      <button disabled={busy || status === 'expired'} onClick={() => call(`/api/admin/content/news/${id}/reject`, '거절')}
        className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50">거절</button>
      <button disabled={busy} onClick={() => call(`/api/admin/content/news/${id}/relint`, '재검수')}
        className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50">재검수</button>
    </div>
  );
}
