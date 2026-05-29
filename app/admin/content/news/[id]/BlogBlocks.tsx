'use client';
// 블로그 본문 안에 임베드되는 시각 컴포넌트들.
// 카드뉴스 패턴: 콘텐츠가 박스 꽉 채움 (flex-col + justify-around) + 글자 크게 + 가운데 정렬.

import { CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

// ════════════════════════════════════════════════
// 1. 비교 카드
// 헤더: 항목 | A사 | B사 | C사
// 행: 보험료 | 12000 | 15000 | 13000
// ════════════════════════════════════════════════
export function CompareCard({ raw }: { raw: string }) {
  const lines = raw.trim().split('\n').filter(l => l.trim() && !/^[-=:|\s]+$/.test(l));
  if (lines.length < 2) return <pre>{raw}</pre>;
  const rows = lines.map(l => l.split('|').map(c => c.trim()));
  const header = rows[0];
  const body = rows.slice(1);
  const cardCount = header.length - 1;
  const tones = [
    'from-emerald-100 to-teal-50 ring-emerald-300 text-emerald-900',
    'from-blue-100 to-indigo-50 ring-blue-300 text-blue-900',
    'from-violet-100 to-fuchsia-50 ring-violet-300 text-violet-900',
    'from-amber-100 to-orange-50 ring-amber-300 text-amber-900',
  ];

  return (
    <div data-naver-image className="my-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">⚖️ 비교</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cardCount}, minmax(0, 1fr))` }}>
        {header.slice(1).map((name, i) => (
          <div key={i} className={`rounded-xl bg-gradient-to-br ring-2 ${tones[i % tones.length]} flex flex-col`}>
            {/* 헤더: 컬러 박스 안 꽉 채우는 큰 라벨 */}
            <div className="text-[20px] font-black text-center py-3 border-b-2 border-current/30">{name}</div>
            {/* 본문: 균등 분포로 카드 끝까지 꽉 차게 */}
            <ul className="flex-1 flex flex-col justify-around py-2 px-2">
              {body.map((row, j) => (
                <li key={j} className="text-center py-1.5">
                  <div className="text-[12px] font-bold opacity-65 uppercase tracking-wide mb-1">{row[0]}</div>
                  <div className="text-[18px] font-black leading-tight">{row[i + 1] ?? '-'}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// 2. 단계 카드
// 형식:
// 1. 약관 확인 | 본문 설명...
// 2. 청구 서류 준비 | 본문 설명...
// ════════════════════════════════════════════════
export function StepsCard({ raw }: { raw: string }) {
  const lines = raw.trim().split('\n').filter(l => l.trim());
  const steps = lines.map(l => {
    const m = l.match(/^\s*(\d+)[.)]?\s*(.+)/);
    if (!m) return null;
    const [title, ...desc] = m[2].split('|').map(s => s.trim());
    return { num: m[1], title, desc: desc.join(' | ') };
  }).filter(Boolean) as { num: string; title: string; desc: string }[];

  return (
    <div data-naver-image className="my-5">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">📋 단계별 진행</div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-4 items-stretch rounded-xl border-2 border-slate-200 bg-white shadow-sm hover:border-emerald-400 transition overflow-hidden">
            {/* 큰 숫자 영역 — 박스 끝까지 꽉 채움 */}
            <div className="flex-none w-20 bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center">
              <span className="text-4xl font-black leading-none">{s.num}</span>
            </div>
            {/* 본문 영역 — 큰 글자 + 패딩 적절 */}
            <div className="flex-1 py-4 pr-5 flex flex-col justify-center">
              <div className="font-extrabold text-slate-900 text-[18px] mb-1 leading-snug">{s.title}</div>
              {s.desc && <div className="text-[14px] text-slate-600 leading-relaxed">{s.desc}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ════════════════════════════════════════════════
// 3. 통계 박스 — 거대 숫자 + 라벨 (카드뉴스 통계 박스와 동일 톤)
// 형식: 80% | 분쟁 조정 청구인 승소율
// ════════════════════════════════════════════════
export function StatBox({ raw }: { raw: string }) {
  const lines = raw.trim().split('\n').filter(l => l.includes('|'));
  const stats = lines.map(l => {
    const [value, ...lab] = l.split('|').map(s => s.trim());
    return { value, label: lab.join(' | ') };
  });
  if (stats.length === 0) return <pre>{raw}</pre>;
  const cols = stats.length === 1 ? 'grid-cols-1' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
  return (
    <div data-naver-image className={`my-5 grid gap-2 ${cols}`}>
      {stats.map((s, i) => (
        <div key={i} className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-md flex flex-col justify-center items-center text-center px-4 py-7 min-h-[140px]">
          <div className="text-[44px] font-black leading-none tracking-tight">{s.value}</div>
          <div className="text-[13px] font-semibold opacity-80 mt-3 leading-snug">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════
// 4. 체크리스트 카드
// 형식:
// title: 가입 전 체크 항목
// - 약관에서 보장 범위 확인
// ════════════════════════════════════════════════
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
    <div data-naver-image className="my-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 ring-2 ring-emerald-300 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-emerald-200">
        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        <h4 className="font-black text-emerald-900 text-[18px]">{title}</h4>
      </div>
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="flex-none w-6 h-6 rounded-md bg-emerald-500 text-white text-[13px] font-black inline-flex items-center justify-center mt-0.5">✓</span>
            <span className="flex-1 text-[15px] text-emerald-900 font-medium leading-relaxed">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ════════════════════════════════════════════════
// 5. CTA 박스
// 형식:
// title: 골든타임을 놓치지 마세요
// body: 본문 한 단락
// hashtags: #암보험 #진단비
// ════════════════════════════════════════════════
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
    <div data-naver-image className="my-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-xl relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 -left-10 w-56 h-56 rounded-full bg-white/5" />
      <div className="relative px-7 py-7 flex flex-col">
        <div className="inline-flex items-center self-start gap-1.5 rounded-full bg-yellow-300 text-slate-900 px-3 py-1 text-[12px] font-extrabold mb-3">
          <Sparkles className="w-3.5 h-3.5" /> 지금 시작하세요
        </div>
        <h3 className="text-[26px] font-black leading-[1.2] mb-2">{title || '지금이 골든타임'}</h3>
        {body && <p className="text-white/95 text-[15px] leading-relaxed font-medium">{body}</p>}
        {hashtags && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {hashtags.split(/\s+/).filter(Boolean).map((tag, i) => (
              <span key={i} className="text-[12px] bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 font-semibold">
                {tag.startsWith('#') ? tag : '#' + tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// 6. SVG 인포그래픽 — ```svg 코드 블록 안의 SVG를 안전하게 렌더링
// ════════════════════════════════════════════════
export function SvgInfographic({ raw }: { raw: string }) {
  const sanitized = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  return (
    <div data-naver-image className="my-5 rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-5 flex justify-center">
      <div className="w-full max-w-full overflow-x-auto" dangerouslySetInnerHTML={{ __html: sanitized }} />
    </div>
  );
}

export function renderBlogBlock(language: string | undefined, raw: string) {
  switch ((language || '').toLowerCase()) {
    case 'compare':   return <CompareCard raw={raw} />;
    case 'steps':     return <StepsCard raw={raw} />;
    case 'stat':
    case 'stats':     return <StatBox raw={raw} />;
    case 'checklist': return <ChecklistCard raw={raw} />;
    case 'cta':       return <CtaBox raw={raw} />;
    case 'svg':       return <SvgInfographic raw={raw} />;
    default:          return null;
  }
}

export function NoteWarning({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 flex gap-3 items-start rounded-xl bg-rose-50 ring-1 ring-rose-200 p-4">
      <AlertTriangle className="flex-none w-5 h-5 text-rose-600 mt-0.5" />
      <div className="text-sm text-rose-900 leading-relaxed">{children}</div>
    </div>
  );
}
