'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2 } from 'lucide-react';

// 수동 생성 버튼 — 안 쓴 앵글 1개를 골라 6장 리쿠르팅 카드를 생성하고 상세로 이동.
export default function RecruitGenerateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/content/recruit/generate', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || '생성 실패');
      router.push(`/admin/content/recruit/${data.id}`);
    } catch (e) {
      alert('생성 실패: ' + (e instanceof Error ? e.message : String(e)));
      setBusy(false);
    }
  }

  return (
    <button
      onClick={generate}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl bg-lime-500 hover:bg-lime-600 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm disabled:opacity-50 transition"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      {busy ? '생성 중… (~10초)' : '✨ 새 카드 생성'}
    </button>
  );
}
