'use client';
// 블로그 본문 안에 임베드되는 시각 컴포넌트들.
// generator가 ```compare / ```steps / ```stat / ```checklist / ```cta 형태로 출력하면
// MdComponents의 pre 핸들러가 패턴 매칭해서 이 컴포넌트로 렌더링.

import { ArrowRight, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

// 비교 카드 — 형식:
// 항목 | A사 | B사 | C사
// 보험료 | 12,000원 | 15,000원 | 13,000원
// ...
export function CompareCard({ raw }: { raw: string }) {
  const lines = raw.trim().split('\n').filter(l => l.trim() && !/^[-=:|\s]+$/.test(l));
  if (lines.length < 2) return <pre>{raw}</pre>;
  const rows = lines.map(l => l.split('|').map(c => c.trim()));
  const header = rows[0];
  const body = rows.slice(1);
  const cardCount = header.length - 1;
  const colorTones = ['from-emerald-50 to-teal-50 ring-emerald-200 text-emerald-900', 'from-blue-50 to-indigo-50 ring-blue-200 text-blue-900', 'from-violet-50 to-fuchsia-50 ring-violet-200 text-violet-900', 'from-amber-50 to-orange-50 ring-amber-200 text-amber-900'];

  return (
    <div className="my-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">⚖️ 비교</div>
      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${cardCount}, minmax(0, 1fr))` }}>
        {header.slice(1).map((name, i) => (
          <div key={i} className={`rounded-xl bg-gradient-to-br ring-1 px-4 py-4 ${colorTones[i % colorTones.length]}`}>
            <div className="text-base font-extrabold mb-3 text-center pb-2 border-b border-current/20">{name}</div>
            <ul className="space-y-2">
              {body.map((row, j) => (
                <li key={j} className="text-sm">
                  <div className="text-[11px] font-semibold opacity-70">{row[0]}</div>
                  <div className="font-bold mt-0.5">{row[i + 1] ?? '-'}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// 단계 카드 — 형식:
// 1. 약관 확인 | 본문 설명...
// 2. 청구 서류 준비 | 본문 설명...
// 3. ...
export function StepsCard({ raw }: { raw: string }) {
  const lines = raw.trim().split('\n').filter(l => l.trim());
  const steps = lines.map(l => {
    const m = l.match(/^\s*(\d+)[.)]?\s*(.+)/);
    if (!m) return null;
    const [title, ...desc] = m[2].split('|').map(s => s.trim());
    return { num: m[1], title, desc: desc.join(' | ') };
  }).filter(Boolean) as { num: string; title: string; desc: string }[];

  return (
    <div className="my-8 space-y-3">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">📋 단계별 진행</div>
      {steps.map((s, i) => (
        <div key={i} className="flex gap-4 items-start rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 transition">
          <div className="flex-none w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl font-black flex items-center justify-center shadow">
            {s.num}
          </div>
          <div className="flex-1 pt-1">
            <div className="font-bold text-slate-900 text-base mb-1">{s.title}</div>
            {s.desc && <div className="text-sm text-slate-600 leading-relaxed">{s.desc}</div>}
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="absolute -bottom-3 left-10 w-4 h-4 text-emerald-400 hidden" />
          )}
        </div>
      ))}
    </div>
  );
}

// 통계 박스 — 형식:
// 80% | 분쟁 조정 청구인 승소율
// 또는 (한 줄에 여러 통계):
// 80% | 승소율
// 90일 | 면책기간
// 1년 | 감액기간
export function StatBox({ raw }: { raw: string }) {
  const lines = raw.trim().split('\n').filter(l => l.includes('|'));
  const stats = lines.map(l => {
    const [value, ...lab] = l.split('|').map(s => s.trim());
    return { value, label: lab.join(' | ') };
  });
  if (stats.length === 0) return <pre>{raw}</pre>;
  return (
    <div className={`my-8 grid gap-3 ${stats.length === 1 ? 'grid-cols-1' : stats.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
      {stats.map((s, i) => (
        <div key={i} className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white p-5 text-center shadow-md">
          <div className="text-4xl font-black mb-1 leading-none">{s.value}</div>
          <div className="text-xs font-medium opacity-80 mt-2">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// 체크리스트 카드 — 형식:
// title: 가입 전 체크 항목
// - 약관에서 보장 범위 확인
// - 면책기간/감액기간 확인
// - ...
export function ChecklistCard({ raw }: { raw: string }) {
  const lines = raw.trim().split('\n');
  let title = '체크리스트';
  const items: string[] = [];
  for (const l of lines) {
    const t = l.match(/^title:\s*(.+)/i);
    if (t) { title = t[1].trim(); continue; }
    const m = l.match(/^[-*]\s*(.+)/);
    if (m) items.push(m[1].trim());
  }
  return (
    <div className="my-8 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        <h4 className="font-bold text-emerald-900 text-base">✅ {title}</h4>
      </div>
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2.5 items-start">
            <span className="flex-none w-5 h-5 rounded-md bg-emerald-500 text-white text-[11px] font-black inline-flex items-center justify-center mt-0.5">✓</span>
            <span className="text-sm text-emerald-900 leading-relaxed">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// CTA 박스 — 형식:
// title: 골든타임을 놓치지 마세요
// body: 본문 한 단락
// hashtags: #암보험 #진단비 #골든타임
export function CtaBox({ raw }: { raw: string }) {
  const lines = raw.trim().split('\n');
  let title = '';
  let body = '';
  let hashtags = '';
  for (const l of lines) {
    const tm = l.match(/^title:\s*(.+)/i);
    const bm = l.match(/^body:\s*(.+)/i);
    const hm = l.match(/^hashtags?:\s*(.+)/i);
    if (tm) title = tm[1];
    else if (bm) body = bm[1];
    else if (hm) hashtags = hm[1];
    else if (!title && l.trim()) title = l.trim();
    else if (!body && l.trim()) body += (body ? ' ' : '') + l.trim();
  }
  return (
    <div className="my-10 rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white p-8 shadow-xl relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 -left-10 w-56 h-56 rounded-full bg-white/5" />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-yellow-300 text-slate-900 px-3 py-1 text-xs font-extrabold mb-3">
          <Sparkles className="w-3 h-3" /> 지금 시작하세요
        </div>
        <h3 className="text-2xl font-black leading-tight mb-3">{title || '지금이 골든타임'}</h3>
        {body && <p className="text-white/90 text-sm leading-relaxed mb-4">{body}</p>}
        {hashtags && (
          <div className="flex flex-wrap gap-1.5">
            {hashtags.split(/\s+/).filter(Boolean).map((tag, i) => (
              <span key={i} className="text-xs bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 font-medium">
                {tag.startsWith('#') ? tag : '#' + tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// pre/code 블록의 언어로 분기 — code className에 'language-compare', 'language-steps' 등
export function renderBlogBlock(language: string | undefined, raw: string) {
  switch ((language || '').toLowerCase()) {
    case 'compare':   return <CompareCard raw={raw} />;
    case 'steps':     return <StepsCard raw={raw} />;
    case 'stat':
    case 'stats':     return <StatBox raw={raw} />;
    case 'checklist': return <ChecklistCard raw={raw} />;
    case 'cta':       return <CtaBox raw={raw} />;
    default:          return null;
  }
}

export function NoteWarning({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 flex gap-3 items-start rounded-xl bg-rose-50 ring-1 ring-rose-200 p-4">
      <AlertTriangle className="flex-none w-5 h-5 text-rose-600 mt-0.5" />
      <div className="text-sm text-rose-900 leading-relaxed">{children}</div>
    </div>
  );
}
