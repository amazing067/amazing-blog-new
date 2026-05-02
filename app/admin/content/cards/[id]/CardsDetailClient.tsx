'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { Download, CheckCircle2, X, Trash2, Loader2, Shield, Search } from 'lucide-react';
import { HybridStyle } from '../../card-preview/CardStyles';
import type { CardSlide, ComplianceInfo } from '@/lib/content/types';

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

export default function CardsDetailClient({ id, userId, defaultDesigner, title, status, publishUrl, slides, compliance, lint, factCheck }: Props) {
  const router = useRouter();
  const captureRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState(publishUrl);

  // 광고심의 폼 — ApprovalGenerator와 동일 구조
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

  // 최초 마운트 시 localStorage에서 default 채우기 (사용자가 BlogGenerator에서 한 번 입력했다면 자동)
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
      // localStorage 동기화 (BlogGenerator와 공유)
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

  async function downloadAllPng() {
    setBusy('download');
    try {
      const zip = new JSZip();
      const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
      const folder = zip.folder(safeTitle);
      if (!folder) throw new Error('zip folder fail');

      for (let i = 0; i < captureRefs.current.length; i++) {
        const el = captureRefs.current[i];
        if (!el) continue;
        const canvas = await html2canvas(el, {
          scale: 1,
          useCORS: true,
          backgroundColor: null,
          logging: false,
        });
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
        if (!blob) continue;
        folder.file(`slide-${String(i + 1).padStart(2, '0')}.png`, blob);
      }

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
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
          {slides.map((s, i) => (
            <div key={i} className="aspect-square">
              <div ref={(el) => { captureRefs.current[i] = el; }} className="w-full h-full">
                <HybridStyle slide={s} index={i} total={slides.length} compliance={comp} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 사이드바 */}
      <div className="space-y-4">
        {/* 광고심의필 정보 — BlogGenerator의 ApprovalGenerator 구조 */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-bold text-amber-900 mb-1">📋 광고심의필 정보</h3>
          <p className="text-[11px] text-amber-800 mb-3 leading-relaxed">
            협회 심의 통과 후 받은 정보를 입력하면 마지막 카드 하단에 즉시 반영됩니다.
            등록번호·지점명은 블로그 생성기와 공유됩니다.
          </p>
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
          <h3 className="font-bold text-violet-900 mb-3">5장 PNG 다운로드</h3>
          <button
            disabled={!!busy}
            onClick={downloadAllPng}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50 transition"
          >
            {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            5장 PNG zip 다운로드
          </button>
          <p className="mt-2 text-xs text-violet-700">
            인스타그램 새 게시글 → 5장 캐러셀로 업로드하세요.
          </p>
        </div>

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
    </div>
  );
}
