// 두 가지 카드뉴스 디자인 시안 — 같은 데이터 모델로 렌더링.
// 실제 발행 시 1080×1080 PNG로 캡처될 카드. 미리보기에서는 aspect-square로 축소.

export type CardSlide =
  | { kind: 'cover'; eyebrow: string; title: string; subtitle: string; accent: string }
  | { kind: 'point'; number: string; title: string; body: string; highlight: string }
  | { kind: 'closing'; title: string; items: string[]; footer: string };

type Props = { slide: CardSlide; index: number; total: number };

// ════════════════════════════════════════════════
// (a) 카카오페이 스타일 — 흰 배경, 컬러 포인트, 정보 밀도 ↑
// ════════════════════════════════════════════════
export function KakaopayStyle({ slide, index, total }: Props) {
  const PageBadge = (
    <span className="absolute top-5 right-5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white text-[11px] font-bold">
      {index + 1}/{total}
    </span>
  );

  if (slide.kind === 'cover') {
    return (
      <div className="relative w-full h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 to-cyan-400" />
        {PageBadge}
        <div className="h-full flex flex-col justify-center px-7 py-8">
          <div className="inline-flex items-center self-start gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {slide.eyebrow}
          </div>
          <h2 className="text-[26px] font-extrabold text-slate-900 leading-[1.25] whitespace-pre-line tracking-tight">
            {slide.title}
          </h2>
          <p className="mt-3 text-[13px] text-slate-600 leading-snug">{slide.subtitle}</p>
          <div className="mt-auto pt-6">
            <span className="inline-flex items-center gap-1 rounded-md bg-yellow-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
              💡 {slide.accent}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div className="relative w-full h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {PageBadge}
        <div className="h-full flex flex-col px-7 py-8">
          <div className="text-[42px] font-black text-emerald-500 leading-none mb-3">{slide.number}</div>
          <h3 className="text-[22px] font-extrabold text-slate-900 leading-[1.3] whitespace-pre-line">
            {slide.title}
          </h3>
          <p className="mt-3 text-[13px] text-slate-600 leading-relaxed">{slide.body}</p>
          <div className="mt-auto pt-5">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5">
              <div className="text-[10px] font-bold text-emerald-700 mb-0.5">핵심</div>
              <div className="text-[13px] font-semibold text-emerald-900">{slide.highlight}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // closing
  return (
    <div className="relative w-full h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 to-cyan-400" />
      {PageBadge}
      <div className="h-full flex flex-col px-7 py-8">
        <div className="text-emerald-600 text-2xl mb-2">📌</div>
        <h3 className="text-[22px] font-extrabold text-slate-900 leading-tight">{slide.title}</h3>
        <ul className="mt-5 space-y-2.5">
          {slide.items.map((it, i) => (
            <li key={i} className="flex gap-2.5 items-start">
              <span className="flex-none w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold inline-flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-[13px] text-slate-700 leading-snug">{it}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-4 text-[10px] text-slate-400 border-t border-slate-100">
          {slide.footer}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// (b) 토스피드 스타일 — 컬러 배경, 대담한 타이포, 임팩트
// ════════════════════════════════════════════════
const TOSS_BG = ['bg-[#3182f6]', 'bg-[#1b64da]', 'bg-[#0050c8]', 'bg-[#0040a0]', 'bg-[#1a1a1a]'];

export function TossStyle({ slide, index, total }: Props) {
  const bg = TOSS_BG[index % TOSS_BG.length];
  const PageBadge = (
    <span className="absolute top-5 right-5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white text-[11px] font-bold backdrop-blur-sm">
      {index + 1}/{total}
    </span>
  );

  if (slide.kind === 'cover') {
    return (
      <div className={`relative w-full h-full ${bg} rounded-2xl overflow-hidden shadow-lg text-white`}>
        {/* 배경 장식 */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5" />
        {PageBadge}
        <div className="relative h-full flex flex-col justify-center px-7 py-8">
          <div className="inline-flex items-center self-start gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white/90 backdrop-blur-sm mb-6">
            #{slide.eyebrow}
          </div>
          <h2 className="text-[34px] font-black leading-[1.15] whitespace-pre-line tracking-tight">
            {slide.title}
          </h2>
          <p className="mt-4 text-[14px] text-white/85 leading-snug">{slide.subtitle}</p>
          <div className="mt-auto pt-6">
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-300 px-3 py-1 text-[12px] font-bold text-slate-900">
              ⚡ {slide.accent}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div className={`relative w-full h-full ${bg} rounded-2xl overflow-hidden shadow-lg text-white`}>
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/8" />
        {PageBadge}
        <div className="relative h-full flex flex-col px-7 py-8">
          <div className="text-[80px] font-black text-white/15 leading-none -ml-1 -mt-2">{slide.number}</div>
          <h3 className="text-[28px] font-black leading-[1.2] whitespace-pre-line -mt-6">{slide.title}</h3>
          <p className="mt-4 text-[14px] text-white/85 leading-relaxed">{slide.body}</p>
          <div className="mt-auto pt-5">
            <div className="rounded-xl bg-yellow-300 px-4 py-2.5">
              <div className="text-[14px] font-extrabold text-slate-900">{slide.highlight}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // closing
  return (
    <div className={`relative w-full h-full ${bg} rounded-2xl overflow-hidden shadow-lg text-white`}>
      <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-white/8" />
      {PageBadge}
      <div className="relative h-full flex flex-col px-7 py-8">
        <div className="text-yellow-300 text-3xl mb-2">📌</div>
        <h3 className="text-[26px] font-black leading-tight">{slide.title}</h3>
        <ul className="mt-5 space-y-3">
          {slide.items.map((it, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="flex-none w-7 h-7 rounded-full bg-yellow-300 text-slate-900 text-[12px] font-black inline-flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-[14px] text-white leading-snug font-medium pt-0.5">{it}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-4 text-[10px] text-white/60 border-t border-white/15">
          {slide.footer}
        </div>
      </div>
    </div>
  );
}
