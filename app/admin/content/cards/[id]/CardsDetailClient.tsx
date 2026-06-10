'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { domToBlob } from 'modern-screenshot';
import JSZip from 'jszip';
import { Download, CheckCircle2, X, Trash2, Loader2, Shield, Search, Pencil, Save, Send, Undo2 } from 'lucide-react';
import { CardStyleRouter } from '../../card-preview/CardStyles';
import { ComplianceSlide } from '../../card-preview/ComplianceSlide';
import SlideEditor from './SlideEditor';
import type { CardSlide, ComplianceInfo, CardStyleKey } from '@/lib/content/types';
import { buildCaption } from '@/lib/content/caption-builder';
import { DESIGNERS, DESIGNER_REG_DEFAULTS, LS_REG_BY_DESIGNER, DESIGNER_PHONE_DEFAULTS, LS_PHONE_BY_DESIGNER, isKnownDesigner, type DesignerName } from '@/lib/content/designers';

type Props = {
  id: string;
  userId: string;
  defaultDesigner: string;
  title: string;
  status: string;
  publishUrl: string;
  slides: CardSlide[];
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
  cardStyle: CardStyleKey;
  category?: string | null;
  sentAt?: string | null;
  isAdmin?: boolean;
  returnReason?: string | null;
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

// BlogGenerator의 ApprovalGenerator와 동일한 localStorage 키 (사용자별)
const LS_REG = (uid: string) => `insurance_registration_number_${uid}`;
const LS_BRANCH = (uid: string) => `insurance_branch_name_${uid}`;

// 돌아가며 광고심의받는 설계사 명단·등록번호 — @/lib/content/designers 공용 모듈 사용

function todayKst(): string {
  // 한국 시각 기준 YYYY-MM-DD — 브라우저 TZ에 무관하게 Asia/Seoul로 포맷
  // (sv-SE 로케일은 YYYY-MM-DD 형식 보장)
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
// 광고심의 유효기간: 시작일로부터 1년 - 1일 (예: 2026-05-13 → 2027-05-12)
function oneYearMinusOneDay(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const next = new Date(Date.UTC(y + 1, m - 1, d - 1));
  return next.toISOString().slice(0, 10);
}

export default function CardsDetailClient({ id, userId, defaultDesigner, title, status, publishUrl, slides: initialSlides, compliance, lint, factCheck, cardStyle, category, sentAt, isAdmin = false, returnReason }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState(publishUrl);

  // 슬라이드 편집 모드 + 로컬 슬라이드 state (즉시 미리보기)
  const [slides, setSlides] = useState<CardSlide[]>(initialSlides);
  const [editing, setEditing] = useState(false);
  const dirty = JSON.stringify(slides) !== JSON.stringify(initialSlides);

  function updateSlide(i: number, next: CardSlide) {
    setSlides(prev => prev.map((s, idx) => idx === i ? next : s));
  }

  async function saveSlides() {
    setBusy('slides');
    try {
      const res = await fetch(`/api/admin/content/cards/${id}/slides`, {
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

  // 광고심의 폼 — ApprovalGenerator와 동일 구조
  const [comp, setComp] = useState<ComplianceInfo>({
    company: compliance?.company ?? '프라임에셋',
    branch: compliance?.branch ?? '',
    designer: compliance?.designer ?? defaultDesigner,
    phone: compliance?.phone ?? '',
    registration: compliance?.registration ?? '',
    number: compliance?.number ?? '',
    start_date: compliance?.start_date ?? '',
    end_date: compliance?.end_date ?? '',
    include_warning: compliance?.include_warning ?? true,
  });

  // 최초 마운트 시 localStorage에서 default 채우기 + 빈 날짜는 오늘/+1년 자동 세팅
  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return;
    const storedBranch = localStorage.getItem(LS_BRANCH(userId)) || '';
    setComp(prev => {
      // 설계사명이 4명 중 하나면: 고정값 우선 → LS 캐시 → 빈값
      const regFromDesigner = isKnownDesigner(prev.designer)
        ? (DESIGNER_REG_DEFAULTS[prev.designer]
            || localStorage.getItem(LS_REG_BY_DESIGNER(prev.designer))
            || '')
        : '';
      const regFromUser = localStorage.getItem(LS_REG(userId)) || '';
      const phoneFromDesigner = isKnownDesigner(prev.designer)
        ? (DESIGNER_PHONE_DEFAULTS[prev.designer]
            || localStorage.getItem(LS_PHONE_BY_DESIGNER(prev.designer))
            || '')
        : '';
      const start = prev.start_date || todayKst();
      const end = prev.end_date || oneYearMinusOneDay(start);
      return {
        ...prev,
        branch: prev.branch || storedBranch,
        registration: prev.registration || regFromDesigner || regFromUser,
        phone: prev.phone || phoneFromDesigner,
        start_date: start,
        end_date: end,
      };
    });
  }, [userId]);

  function updateComp<K extends keyof ComplianceInfo>(field: K, value: ComplianceInfo[K]) {
    setComp(prev => {
      const next = { ...prev, [field]: value };
      // 시작일 변경 시 종료일을 +1년-1일로 자동 재계산
      if (field === 'start_date' && typeof value === 'string' && value) {
        next.end_date = oneYearMinusOneDay(value);
      }
      if (typeof window !== 'undefined' && userId) {
        if (field === 'branch') localStorage.setItem(LS_BRANCH(userId), String(value ?? ''));
        if (field === 'registration') {
          // 4명 중 하나면 그 사람 캐시에, 아니면 기존 사용자별 키에 저장
          if (isKnownDesigner(next.designer)) {
            localStorage.setItem(LS_REG_BY_DESIGNER(next.designer), String(value ?? ''));
          } else {
            localStorage.setItem(LS_REG(userId), String(value ?? ''));
          }
        }
        // 전화번호도 4명 중 하나면 그 사람 캐시에 저장(다음에 칩 누를 때 복원)
        if (field === 'phone' && isKnownDesigner(next.designer)) {
          localStorage.setItem(LS_PHONE_BY_DESIGNER(next.designer), String(value ?? ''));
        }
      }
      return next;
    });
  }

  // 4명 칩 클릭 — 설계사명 + 그 사람의 등록번호를 한 번에 채움
  // 우선순위: 고정 DEFAULTS → LS 캐시 → 현재값 유지(미설정 시 직접 입력 유도)
  function pickDesigner(name: DesignerName) {
    setComp(prev => {
      const def = DESIGNER_REG_DEFAULTS[name];
      const cached = typeof window !== 'undefined'
        ? localStorage.getItem(LS_REG_BY_DESIGNER(name)) || ''
        : '';
      const reg = def || cached;
      const phoneDef = DESIGNER_PHONE_DEFAULTS[name];
      const phoneCached = typeof window !== 'undefined'
        ? localStorage.getItem(LS_PHONE_BY_DESIGNER(name)) || ''
        : '';
      const phone = phoneDef || phoneCached;
      return {
        ...prev,
        designer: name,
        registration: reg || prev.registration,
        phone: phone || prev.phone,
      };
    });
  }

  async function saveCompliance() {
    setBusy('compliance');
    try {
      const res = await fetch(`/api/admin/content/cards/${id}/compliance`, {
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

  // 심의 확정 — 최신 심의필을 저장한 뒤 status='approved'로 승격(검토대기에서 제외)
  async function confirmApprove() {
    if (!comp.number?.trim()) {
      alert('심의필번호를 입력한 뒤 확정하세요.');
      return;
    }
    if (!confirm('이 카드를 확정(심의 승인) 처리할까요? 검토대기 목록에서 빠집니다.')) return;
    setBusy('approve');
    try {
      // 1) 최신 심의필 저장 (저장과 확정을 한 번에 — "저장 안 됨" 혼선 방지)
      const r1 = await fetch(`/api/admin/content/cards/${id}/compliance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(comp),
      });
      if (!r1.ok) throw new Error(await r1.text());
      // 2) 확정
      const r2 = await fetch(`/api/admin/content/cards/${id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: true }),
      });
      if (!r2.ok) throw new Error(await r2.text());
      router.refresh();
    } catch (e) {
      alert('확정 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  // 확정 취소 — 검토대기로 되돌림
  async function revertApprove() {
    if (!confirm('확정을 취소하고 검토대기로 되돌릴까요?')) return;
    setBusy('approve');
    try {
      const res = await fetch(`/api/admin/content/cards/${id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: false }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e) {
      alert('되돌리기 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  // 반송 처리 (관리자 전용) — 사유 입력 후 status='returned'
  async function returnCard() {
    const reason = window.prompt('반송 사유를 입력하세요 (관리자만 보입니다):', returnReason ?? '');
    if (reason == null) return; // 취소
    if (!reason.trim()) { alert('반송 사유를 입력해야 합니다.'); return; }
    setBusy('return');
    try {
      const res = await fetch(`/api/admin/content/cards/${id}/return`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e) {
      alert('반송 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  // 반송 취소 → 검토대기로 복귀 (관리자 전용)
  async function reopenCard() {
    if (!confirm('반송을 취소하고 검토대기로 되돌릴까요?')) return;
    setBusy('return');
    try {
      const res = await fetch(`/api/admin/content/cards/${id}/return`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reopen: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e) {
      alert('되돌리기 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  // DOM 요소 1개를 1080×1080 PNG Blob으로 캡처 (다운로드 로직과 동일 기법)
  async function captureElToBlob(el: HTMLElement): Promise<Blob> {
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
      const blob = await domToBlob(clone, {
        width: 1080, height: 1080, scale: 1, backgroundColor: '#ffffff', type: 'image/png', quality: 1,
      });
      if (!blob) throw new Error('이미지 변환 실패(blob null)');
      return blob;
    } finally {
      document.body.removeChild(clone);
    }
  }

  // 설계사방(amazing-biz-server)으로 전송 — 본문 5장 + 공유용 심의필 1장(설계사 정보 비움)
  async function sendToServer() {
    if (editing) { alert('편집 모드에서는 전송할 수 없습니다. 먼저 저장하세요.'); return; }
    if (!confirm('이 카드뉴스를 설계사방으로 보낼까요?\n설계사명·협회등록번호는 비워서 전송됩니다(각 설계사가 본인 정보로 채워 사용).')) return;
    setBusy('send');
    try {
      // 1) 본문 슬라이드 캡처 (data-slide-capture 중 index < slides.length)
      const contentEls = Array.from(document.querySelectorAll<HTMLElement>('[data-slide-capture]'))
        .filter(el => Number(el.dataset.slideIndex ?? -1) < slides.length)
        .sort((a, b) => Number(a.dataset.slideIndex ?? 0) - Number(b.dataset.slideIndex ?? 0));
      // 2) 공유용 심의필 슬라이드 (설계사 정보 비움 — 화면 밖 전용 노드)
      const shareEl = document.querySelector<HTMLElement>('[data-share-compliance]');
      if (!contentEls.length || !shareEl) {
        throw new Error('슬라이드 요소를 찾지 못했습니다. 새로고침 후 다시 시도하세요.');
      }

      // 3) multipart로 묶어 전송 — 서버가 공개버킷 업로드(고정 경로·캐시버스트) 후 ingest
      const fd = new FormData();
      let n = 1;
      for (const el of contentEls) fd.append('images', await captureElToBlob(el), `slide-${String(n++).padStart(2, '0')}.png`);
      fd.append('images', await captureElToBlob(shareEl), `slide-${String(n++).padStart(2, '0')}.png`);

      const res = await fetch(`/api/admin/content/cards/${id}/send-to-server`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '전송 실패');
      alert(`설계사방으로 전송 완료 (${data.count ?? ''}장)`);
      router.refresh();
    } catch (e) {
      alert('전송 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function downloadAllPng() {
    setBusy('download');
    try {
      const zip = new JSZip();
      const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
      const folder = zip.folder(safeTitle);
      if (!folder) throw new Error('zip folder fail');

      // ref 대신 DOM 직접 조회 — 편집/비편집 모드 전환 시 ref 동기화 이슈 회피
      const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-slide-capture]'))
        .sort((a, b) => Number(a.dataset.slideIndex ?? 0) - Number(b.dataset.slideIndex ?? 0));

      console.log(`[capture] 캡처 대상 슬라이드 ${elements.length}개 발견`);
      if (elements.length === 0) {
        throw new Error('캡처할 슬라이드 요소를 찾지 못했습니다. 페이지 새로고침 후 다시 시도하세요.');
      }

      let successCount = 0;
      for (const el of elements) {
        const i = Number(el.dataset.slideIndex ?? 0);
        // off-screen 1080×1080 컨테이너로 clone — cqw가 1080 기준으로 정확히 계산됨
        const clone = el.cloneNode(true) as HTMLElement;
        clone.style.width = '1080px';
        clone.style.height = '1080px';
        clone.style.position = 'fixed';
        clone.style.left = '-99999px';
        clone.style.top = '0';
        clone.style.zIndex = '-1';
        document.body.appendChild(clone);

        // 폰트·이미지 로딩 + 레이아웃 안정 대기
        await document.fonts.ready;
        await new Promise(r => setTimeout(r, 300));

        try {
          // modern-screenshot — container query units(cqw), flex auto-margin, modern CSS 정확히 지원
          const blob = await domToBlob(clone, {
            width: 1080,
            height: 1080,
            scale: 1,
            backgroundColor: '#ffffff',
            type: 'image/png',
            quality: 1,
          });
          if (!blob) {
            console.warn(`[capture] slide ${i + 1}: blob null`);
            continue;
          }
          folder.file(`slide-${String(i + 1).padStart(2, '0')}.png`, blob);
          successCount++;
        } catch (capErr) {
          console.error(`[capture] slide ${i + 1} 실패:`, capErr);
          throw new Error(`슬라이드 ${i + 1} 캡처 실패: ${capErr instanceof Error ? capErr.message : String(capErr)}`);
        } finally {
          document.body.removeChild(clone);
        }
      }

      if (successCount === 0) {
        throw new Error('모든 슬라이드 캡처가 실패했습니다.');
      }

      // 인스타 캡션 + 해시태그 + 광고심의 메모를 한 .txt로 동봉.
      // 협회 반송 사유: "캡션·해시태그도 준법심의 대상이라 압축파일에 포함해야 함" 대응.
      // BOM을 붙여 메모장이 UTF-8로 자동 인식하게 한다.
      const captionText = buildCaption({ title, slides, compliance: comp, category });
      const captionWithBom = '﻿' + captionText;
      folder.file('instagram_caption.txt', captionWithBom);

      const archive = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(archive);
      a.download = `${safeTitle}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      console.log(`[capture] ${successCount}장 다운로드 완료`);
    } catch (e) {
      alert('PNG 다운로드 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  // 협회 승인 후 심의필번호만 채워 6번째 카드 한 장만 다시 받고 싶을 때 사용.
  // zip 전체 재다운로드를 피하기 위해 분리된 흐름.
  async function downloadCompliancePng() {
    setBusy('compliance-download');
    try {
      const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
      const el = document.querySelector<HTMLElement>(
        `[data-slide-capture][data-slide-index="${slides.length}"]`
      );
      if (!el) {
        throw new Error('심의필 슬라이드를 찾지 못했습니다. 심의 정보를 먼저 저장하세요.');
      }

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
        const blob = await domToBlob(clone, {
          width: 1080,
          height: 1080,
          scale: 1,
          backgroundColor: '#ffffff',
          type: 'image/png',
          quality: 1,
        });
        if (!blob) throw new Error('blob null');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${safeTitle}_심의필.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        console.log('[capture] 심의필 슬라이드 1장 다운로드 완료');
      } finally {
        document.body.removeChild(clone);
      }
    } catch (e) {
      alert('심의필 PNG 다운로드 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
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
      if (action === 'delete') router.push('/admin/content/cards');
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
      {/* 카드 5장 미리보기 — 캡처 대상 */}
      <div className="lg:col-span-2 space-y-6">
        {/* 반송 배너 — 관리자 전용 */}
        {isAdmin && status === 'returned' && (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <Undo2 className="w-4 h-4 text-rose-600 mt-0.5 flex-none" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-rose-800">반송됨 <span className="font-normal text-rose-500 text-[11px]">· 관리자만 표시</span></p>
                  {returnReason && <p className="mt-1 text-sm text-rose-700 whitespace-pre-wrap break-words">{returnReason}</p>}
                </div>
              </div>
              <button
                disabled={!!busy}
                onClick={reopenCard}
                className="flex-none text-xs px-3 py-1.5 rounded-lg border border-rose-300 bg-white text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                {busy === 'return' ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : '검토대기로 되돌리기'}
              </button>
            </div>
          </div>
        )}

        {/* 편집 모드 컨트롤 바 */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Pencil className={`w-4 h-4 ${editing ? 'text-violet-600' : 'text-slate-400'}`} />
            <span className="text-sm font-semibold text-slate-700">슬라이드 편집</span>
            {dirty && <span className="text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">수정됨 · 저장 필요</span>}
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  disabled={!!busy}
                  onClick={discardChanges}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-50"
                >취소</button>
                <button
                  disabled={!!busy || !dirty}
                  onClick={saveSlides}
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {busy === 'slides' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  저장
                </button>
              </>
            ) : (
              <button
                disabled={!!busy}
                onClick={() => setEditing(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Pencil className="w-3.5 h-3.5" /> 본문 편집
              </button>
            )}
          </div>
        </div>

        {/* 슬라이드 표시 — 편집 모드: 좌우 분할 / 비편집: 2열 그리드 */}
        {(() => {
          const showCompliance = !!(comp.number || comp.start_date || comp.end_date || comp.designer || comp.registration);
          const total = slides.length + (showCompliance ? 1 : 0);

          if (editing) {
            // 편집 모드 — 슬라이드별 [편집 폼 | 미리보기] 좌우 분할
            return (
              <div className="space-y-5">
                {slides.map((s, i) => (
                  <div key={i} className="grid gap-4 grid-cols-1 lg:grid-cols-2 items-stretch">
                    <div className="aspect-square">
                      <SlideEditor slide={s} index={i} onChange={(next) => updateSlide(i, next)} />
                    </div>
                    <div className="aspect-square">
                      <div data-slide-capture data-slide-index={i} className="w-full h-full">
                        <CardStyleRouter cardStyle={cardStyle} slide={s} index={i} total={total} compliance={comp} />
                      </div>
                    </div>
                  </div>
                ))}
                {showCompliance && (
                  <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 items-stretch">
                    <div className="aspect-square rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 flex flex-col justify-center">
                      <p className="font-bold text-base mb-2">📋 6번째 심의필 슬라이드</p>
                      <p className="text-sm leading-relaxed">이 카드는 우측 사이드바의 <strong>광고심의필 정보 폼</strong>에서 수정합니다.</p>
                      <p className="mt-3 text-xs leading-relaxed">회사명 · 지점명 · 설계사명 · 협회등록번호 · 심의번호 · 시작/종료일 · 경고문구 포함 여부.</p>
                    </div>
                    <div className="aspect-square">
                      <div data-slide-capture data-slide-index={slides.length} className="w-full h-full">
                        <ComplianceSlide compliance={comp} index={slides.length} total={total} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // 비편집 모드 — 기존 2열 그리드
          return (
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
              {slides.map((s, i) => (
                <div key={i} className="aspect-square">
                  <div data-slide-capture data-slide-index={i} className="w-full h-full">
                    <CardStyleRouter cardStyle={cardStyle} slide={s} index={i} total={total} compliance={comp} />
                  </div>
                </div>
              ))}
              {showCompliance && (
                <div className="aspect-square">
                  <div data-slide-capture data-slide-index={slides.length} className="w-full h-full">
                    <ComplianceSlide compliance={comp} index={slides.length} total={total} />
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* 사이드바 */}
      <div className="space-y-4">
        {/* 광고심의필 정보 — BlogGenerator의 ApprovalGenerator 구조 */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-bold text-amber-900 mb-1">📋 광고심의필 정보</h3>
          <p className="text-[11px] text-amber-800 mb-3 leading-relaxed">
            협회 심의 통과 후 받은 정보를 입력하면 마지막 카드 하단에 즉시 반영됩니다.
            지점명은 블로그 생성기와 공유됩니다.
          </p>
          {/* 4명 돌아가며 광고심의 — 빠른 전환 칩 (설계사명 + 협회등록번호 동시 교체) */}
          <div className="mb-3">
            <label className="text-[11px] font-medium text-amber-900 block mb-1.5">빠른 전환</label>
            <div className="flex flex-wrap gap-1.5">
              {DESIGNERS.map(name => {
                const active = comp.designer === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => pickDesigner(name)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                      active
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-amber-700 leading-relaxed">
              누르면 설계사명·협회등록번호가 그 사람 값으로 바뀝니다. 등록번호를 직접 입력하면 자동 저장되어 다음에 같은 사람을 누를 때 복원됩니다.
            </p>
          </div>
          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">회사명</label>
              <input type="text" value={comp.company}
                onChange={e => updateComp('company', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">지점명</label>
              <input type="text" placeholder="예: 강남지점" value={comp.branch ?? ''}
                onChange={e => updateComp('branch', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">설계사명</label>
              <input type="text" value={comp.designer ?? ''}
                onChange={e => updateComp('designer', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">연락처</label>
              <input type="text" placeholder="예: 010-1234-5678" value={comp.phone ?? ''}
                onChange={e => updateComp('phone', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">협회등록번호</label>
              <input type="text" placeholder="예: 12345678" value={comp.registration ?? ''}
                onChange={e => updateComp('registration', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">심의번호</label>
              <input type="text" placeholder="제2026-1234호" value={comp.number ?? ''}
                onChange={e => updateComp('number', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">시작일</label>
                <input type="date" value={comp.start_date ?? ''}
                  onChange={e => updateComp('start_date', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">종료일</label>
                <input type="date" value={comp.end_date ?? ''}
                  onChange={e => updateComp('end_date', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={comp.include_warning ?? true}
                onChange={e => updateComp('include_warning', e.target.checked)}
                className="rounded" />
              경고 문구 포함 (&ldquo;본 광고는 광고심의기준을 준수하였으며...&rdquo;)
            </label>
            <button
              disabled={!!busy}
              onClick={saveCompliance}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 transition"
            >
              {busy === 'compliance' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              저장
            </button>
          </div>
        </div>

        {/* PNG 다운로드 */}
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
          <h3 className="font-bold text-violet-900 mb-3">PNG + 캡션 다운로드</h3>
          <p className="text-[11px] text-violet-700 mb-2">
            본문 5장 + 심의필 1장 = <strong>총 6장 PNG</strong> (심의 정보 입력 시) <br />
            + <strong>instagram_caption.txt</strong> (캡션·해시태그·심의 메모)
          </p>
          <button
            disabled={!!busy}
            onClick={downloadAllPng}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50 transition"
          >
            {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            zip 다운로드 (전체)
          </button>
          <p className="mt-2 text-xs text-violet-700 leading-relaxed">
            인스타 새 게시글 → 캐러셀로 PNG 업로드, <strong>caption.txt 내용을 더보기 본문에 붙여넣기</strong>.
            캡션·해시태그도 준법심의 대상이므로 협회 제출 시 zip 통째로 첨부하세요.
          </p>

          {/* 협회 승인 후 심의필번호만 채워 6번째 카드 한 장만 다시 받기 */}
          {(() => {
            const hasCompliance = !!(comp.number || comp.start_date || comp.end_date || comp.designer || comp.registration);
            return (
              <div className="mt-4 pt-4 border-t border-violet-200">
                <p className="text-[11px] text-violet-800 mb-2 leading-relaxed">
                  협회 승인 후 <strong>심의필번호만 추가</strong>로 받았다면, 6번째 카드 한 장만 따로 받기:
                </p>
                <button
                  disabled={!!busy || !hasCompliance}
                  onClick={downloadCompliancePng}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {busy === 'compliance-download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  심의필 카드만 PNG
                </button>
                {!hasCompliance && (
                  <p className="mt-1.5 text-[11px] text-amber-700">심의 정보를 먼저 저장하세요.</p>
                )}
              </div>
            );
          })()}
        </div>

        {/* 심의 확정 */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">심의 확정</h3>
            {status === 'approved' ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">✅ 확정됨</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">검토 대기</span>
            )}
          </div>
          {status === 'approved' ? (
            <>
              <p className="text-[11px] text-emerald-700 leading-relaxed">심의 승인 확정됨 — 검토대기 목록에서 제외됩니다.</p>
              <button
                disabled={!!busy}
                onClick={revertApprove}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                검토대기로 되돌리기
              </button>
            </>
          ) : (
            <>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                협회 심의 통과 후 심의필번호를 입력하면 <strong>확정</strong>할 수 있습니다. 확정 시 심의필 정보가 함께 저장됩니다.
              </p>
              <button
                disabled={!!busy || !comp.number?.trim()}
                onClick={confirmApprove}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                확정 (심의 승인)
              </button>
              {!comp.number?.trim() && (
                <p className="text-[11px] text-amber-700">심의필번호를 입력하면 확정 버튼이 활성화됩니다.</p>
              )}
            </>
          )}
        </div>

        {/* 설계사방으로 보내기 — 확정된 카드만 */}
        {status === 'approved' && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
            <h3 className="text-sm font-bold text-slate-800">설계사방으로 보내기</h3>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              어메이징사업부 서버(설계사방)로 전송합니다. <strong>설계사명·협회등록번호는 비워서</strong> 보내며, 각 설계사가 본인 정보로 채워 사용합니다.
            </p>
            <button
              disabled={!!busy || editing}
              onClick={sendToServer}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 transition"
            >
              {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sentAt ? '설계사방에 다시 보내기' : '설계사방으로 보내기'}
            </button>
            {sentAt && (
              <p className="text-[11px] text-emerald-700">✅ 전송됨 · {new Date(sentAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
            )}
            {editing && <p className="text-[11px] text-amber-700">편집 모드에서는 전송할 수 없습니다. 먼저 저장하세요.</p>}
          </div>
        )}

        {/* 발행 마킹 */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
          <label className="text-xs font-medium text-slate-600 block">인스타 게시 후 URL (선택)</label>
          <input
            type="url"
            placeholder="https://instagram.com/p/..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-emerald-400 focus:outline-none"
          />
          <button
            disabled={!!busy || status === 'published'}
            onClick={() => call('publish', `/api/admin/content/cards/${id}/publish-mark`, '발행 완료 마킹', { publish_url: url || null })}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 transition"
          >
            {busy === 'publish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {status === 'published' ? '이미 발행됨' : '발행 완료'}
          </button>
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
              <div className="space-y-3">
                {factCheck.issues.map((iss, i) => (
                  <div key={i} className="rounded-xl bg-white/60 border border-white/80 p-3">
                    <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium mb-1.5 ${SEV[iss.severity].bg}`}>
                      {SEV[iss.severity].label}
                    </div>
                    <div className="text-xs font-medium text-slate-600 mb-1">의심 진술</div>
                    <div className="text-sm text-slate-800 mb-2 line-clamp-2">{iss.claim}</div>
                    <div className="text-xs font-medium text-slate-600 mb-1">검증 결과</div>
                    <div className="text-sm text-slate-700">{iss.reason}</div>
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

        {/* 반송 — 관리자 전용 (사유 입력) */}
        {isAdmin && status !== 'returned' && (
          <button
            disabled={!!busy}
            onClick={returnCard}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 px-3 py-2 text-xs font-medium disabled:opacity-50 transition"
          >
            {busy === 'return' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
            반송 (사유 입력)
          </button>
        )}

        {/* 보조 액션 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={!!busy || status === 'expired'}
            onClick={() => call('reject', `/api/admin/content/cards/${id}/reject`, '거절')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 px-3 py-2 text-xs font-medium disabled:opacity-50 transition"
          >
            <X className="w-3.5 h-3.5" /> 거절
          </button>
          <button
            disabled={!!busy}
            onClick={() => call('delete', `/api/admin/content/cards/${id}/delete`, '영구 삭제 (되돌릴 수 없음)', undefined, 'DELETE')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 px-3 py-2 text-xs font-medium disabled:opacity-50 transition"
          >
            {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            영구 삭제
          </button>
        </div>
      </div>

      {/* 공유용(설계사 정보 비움) 심의필 — 화면 밖, 설계사방 전송 캡처 전용 */}
      <div aria-hidden style={{ position: 'fixed', left: '-99999px', top: 0, width: '1080px', height: '1080px', zIndex: -1, pointerEvents: 'none' }}>
        <div data-share-compliance className="w-full h-full">
          <ComplianceSlide compliance={comp} index={slides.length} total={slides.length + 1} shareBlank />
        </div>
      </div>
    </div>
  );
}
