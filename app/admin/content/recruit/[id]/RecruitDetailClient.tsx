'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { domToBlob } from 'modern-screenshot';
import JSZip from 'jszip';
import { Download, CheckCircle2, X, Trash2, Loader2, ShieldCheck, ShieldAlert, Pencil, Save } from 'lucide-react';
import { RecruitCardStyle } from '../../card-preview/styles/RecruitStyle';
import SlideEditor from '../../cards/[id]/SlideEditor';
import type { CardSlide } from '@/lib/content/types';
import type { RecruitLintResult } from '@/lib/content/recruit-lint';

type Props = {
  id: string;
  title: string;
  status: string;
  publishUrl: string;
  slides: CardSlide[];
  imageUrls: string[];
  lint: RecruitLintResult | null;
  seed?: string;
};

// 리쿠르팅 인스타 캡션 — 심의 없음. 후킹 + CTA + 해시태그 5개(플레이북).
function buildRecruitCaption(title: string, slides: CardSlide[]): string {
  const cover = slides[0];
  const closing = slides[slides.length - 1];
  const hook = cover && cover.kind === 'cover' ? cover.title.replace(/\n/g, ' ') : title;
  const share = closing && closing.kind === 'closing' ? closing.footer : '궁금하면 DM 주세요 📩';
  return [
    title,
    '',
    hook,
    '',
    '👀 더 궁금하면 프로필 링크 / DM 📩',
    share,
    '',
    '#보험설계사 #GA취업 #보험영업 #재테크직장인 #N잡러',
  ].join('\n');
}

export default function RecruitDetailClient({ id, title, status, publishUrl, slides: initialSlides, imageUrls = [], lint, seed = '' }: Props) {
  const router = useRouter();
  const isImageCard = imageUrls.length > 0;
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState(publishUrl);
  const [slides, setSlides] = useState<CardSlide[]>(initialSlides);
  const [editing, setEditing] = useState(false);
  const dirty = JSON.stringify(slides) !== JSON.stringify(initialSlides);

  function updateSlide(i: number, next: CardSlide) {
    setSlides(prev => prev.map((s, idx) => (idx === i ? next : s)));
  }

  async function saveSlides() {
    setBusy('slides');
    try {
      const res = await fetch(`/api/admin/content/recruit/${id}/slides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditing(false);
      router.refresh();
    } catch (e) {
      alert('슬라이드 저장 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  function discardChanges() {
    if (!confirm('수정 내용을 취소하고 원래대로 되돌립니다. 진행할까요?')) return;
    setSlides(initialSlides);
    setEditing(false);
  }

  async function downloadAllPng() {
    setBusy('download');
    try {
      const zip = new JSZip();
      const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
      const folder = zip.folder(safeTitle);
      if (!folder) throw new Error('zip folder fail');

      // 이미지형 카드: 렌더된 PNG를 직접 받아 압축 (캡처 불필요)
      if (isImageCard) {
        let ok = 0;
        for (let i = 0; i < imageUrls.length; i++) {
          const resp = await fetch(imageUrls[i]);
          if (!resp.ok) continue;
          folder.file(`slide-${String(i + 1).padStart(2, '0')}.png`, await resp.blob());
          ok++;
        }
        if (ok === 0) throw new Error('이미지를 불러오지 못했습니다.');
        folder.file('instagram_caption.txt', '﻿' + buildRecruitCaption(title, slides));
        const archive = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(archive);
        a.download = `${safeTitle}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
        return;
      }

      const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-slide-capture]'))
        .sort((a, b) => Number(a.dataset.slideIndex ?? 0) - Number(b.dataset.slideIndex ?? 0));
      if (elements.length === 0) throw new Error('캡처할 슬라이드를 찾지 못했습니다. 새로고침 후 다시 시도하세요.');

      let ok = 0;
      for (const el of elements) {
        const i = Number(el.dataset.slideIndex ?? 0);
        const clone = el.cloneNode(true) as HTMLElement;
        clone.style.width = '1080px';
        clone.style.height = '1080px';
        clone.style.position = 'fixed';
        clone.style.left = '-99999px';
        clone.style.top = '0';
        clone.style.zIndex = '-1';
        document.body.appendChild(clone);
        await document.fonts.ready;
        await new Promise(r => setTimeout(r, 300));
        try {
          const blob = await domToBlob(clone, { width: 1080, height: 1080, scale: 1, backgroundColor: '#ffffff', type: 'image/png', quality: 1 });
          if (blob) { folder.file(`slide-${String(i + 1).padStart(2, '0')}.png`, blob); ok++; }
        } finally {
          document.body.removeChild(clone);
        }
      }
      if (ok === 0) throw new Error('모든 슬라이드 캡처가 실패했습니다.');

      folder.file('instagram_caption.txt', '﻿' + buildRecruitCaption(title, slides));
      const archive = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(archive);
      a.download = `${safeTitle}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert('PNG 다운로드 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  // publish-mark / reject / delete 는 type-무관 라우트라 카드뉴스 라우트 재사용.
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
      if (action === 'delete') router.push('/admin/content/recruit');
      else router.refresh();
    } catch (e) {
      alert(`${label} 실패: ` + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  const total = slides.length;
  const safe = !lint || (!lint.must_fix && lint.risk_score === 0);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 6장 미리보기 — 캡처 대상 */}
      <div className="lg:col-span-2 space-y-6">
        {!isImageCard && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Pencil className={`w-4 h-4 ${editing ? 'text-lime-600' : 'text-slate-400'}`} />
            <span className="text-sm font-semibold text-slate-700">슬라이드 편집 (6장)</span>
            {dirty && <span className="text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">수정됨 · 저장 필요</span>}
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button disabled={!!busy} onClick={discardChanges}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-50">취소</button>
                <button disabled={!!busy || !dirty} onClick={saveSlides}
                  className="text-xs px-3 py-1.5 rounded-lg bg-lime-600 hover:bg-lime-700 text-white inline-flex items-center gap-1.5 disabled:opacity-50">
                  {busy === 'slides' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
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
        )}

        {isImageCard ? (
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
            {imageUrls.map((u, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <img src={u} alt={`슬라이드 ${i + 1}`} className="block w-full h-auto" />
              </div>
            ))}
          </div>
        ) : editing ? (
          <div className="space-y-5">
            {slides.map((s, i) => (
              <div key={i} className="grid gap-4 grid-cols-1 lg:grid-cols-2 items-stretch">
                <div className="aspect-square">
                  <SlideEditor slide={s} index={i} onChange={(next) => updateSlide(i, next)} />
                </div>
                <div className="aspect-square">
                  <div data-slide-capture data-slide-index={i} className="w-full h-full">
                    <RecruitCardStyle slide={s} index={i} total={total} seed={seed} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
            {slides.map((s, i) => (
              <div key={i} className="aspect-square">
                <div data-slide-capture data-slide-index={i} className="w-full h-full">
                  <RecruitCardStyle slide={s} index={i} total={total} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 사이드바 */}
      <div className="space-y-4">
        {/* PNG 다운로드 */}
        <div className="rounded-2xl border border-lime-200 bg-lime-50 p-5">
          <h3 className="font-bold text-lime-900 mb-2">PNG + 캡션 다운로드</h3>
          <p className="text-[11px] text-lime-800 mb-3 leading-relaxed">
            6장 PNG + <strong>instagram_caption.txt</strong> (후킹·CTA·해시태그 5개). 심의필 슬라이드 없음.
          </p>
          <button disabled={!!busy} onClick={downloadAllPng}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50 transition">
            {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            zip 다운로드 (6장)
          </button>
        </div>

        {/* 발행 마킹 */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
          <label className="text-xs font-medium text-slate-600 block">인스타 게시 후 URL (선택)</label>
          <input type="url" placeholder="https://instagram.com/p/..." value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-emerald-400 focus:outline-none" />
          <button disabled={!!busy || status === 'published'}
            onClick={() => call('publish', `/api/admin/content/cards/${id}/publish-mark`, '발행 완료 마킹', { publish_url: url || null })}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 transition">
            {busy === 'publish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {status === 'published' ? '이미 발행됨' : '발행 완료'}
          </button>
        </div>

        {/* 가드레일 결과 */}
        <div className={`rounded-2xl border p-5 shadow-sm ${safe ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            {safe ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-red-600" />}
            <h3 className={`font-semibold ${safe ? 'text-emerald-700' : 'text-red-700'}`}>리쿠르팅 가드레일</h3>
          </div>
          {!lint ? (
            <p className="text-sm text-slate-500">검사 기록 없음</p>
          ) : safe ? (
            <p className="text-sm text-emerald-700">위반 없음 ✓ (직업안정법·금소법·다단계·연락처 모두 통과)</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              <li className="flex justify-between"><span>위험도</span><span className="font-mono font-bold text-red-700">{lint.risk_score} / 100</span></li>
              <li className="text-red-700">소득 보장: {lint.income_guarantee.join(', ') || '-'}</li>
              <li className="text-red-700">럭셔리 인증: {lint.luxury_flex.join(', ') || '-'}</li>
              <li className="text-red-700">유사수신 연상: {lint.mlm_signal.join(', ') || '-'}</li>
              <li className="text-amber-700">전화번호: {lint.phone_numbers.join(', ') || '-'}</li>
            </ul>
          )}
        </div>

        {/* 보조 액션 — 재사용 라우트 */}
        <div className="grid grid-cols-2 gap-2">
          <button disabled={!!busy || status === 'expired'}
            onClick={() => call('reject', `/api/admin/content/cards/${id}/reject`, '거절')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 px-3 py-2 text-xs font-medium disabled:opacity-50 transition">
            <X className="w-3.5 h-3.5" /> 거절
          </button>
          <button disabled={!!busy}
            onClick={() => call('delete', `/api/admin/content/cards/${id}/delete`, '영구 삭제 (되돌릴 수 없음)', undefined, 'DELETE')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 px-3 py-2 text-xs font-medium disabled:opacity-50 transition">
            {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            영구 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
