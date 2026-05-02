// 카드뉴스 하이브리드 디자인 — 토스 컬러 임팩트 + 카카오페이 정보 밀도 + 큰 아이콘 일러스트.
// 1080×1080 인스타 정사각 비율, 5장 시리즈.

import {
  TrendingDown, AlertTriangle, Gift, Shield, Sparkles,
  Stethoscope, Calculator, Baby, ArrowRight, Search,
  ClipboardCheck, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type CardSlide =
  | {
      kind: 'cover';
      eyebrow: string;
      title: string;
      subtitle: string;
      stat: { value: string; label: string };
      iconKey: keyof typeof ICONS;
    }
  | {
      kind: 'point';
      number: string;
      title: string;
      subtitle: string;
      body: string;
      highlight: string;
      stat: { value: string; label: string };
      iconKey: keyof typeof ICONS;
    }
  | {
      kind: 'closing';
      title: string;
      subtitle: string;
      items: Array<{ title: string; desc: string }>;
      footer: string;
      iconKey: keyof typeof ICONS;
    };

const ICONS = {
  sparkles: Sparkles, shield: Shield,
  trendingDown: TrendingDown, alert: AlertTriangle,
  gift: Gift, stethoscope: Stethoscope,
  calculator: Calculator, baby: Baby,
  search: Search, clipboard: ClipboardCheck,
  zap: Zap, arrow: ArrowRight,
} satisfies Record<string, LucideIcon>;

type Props = { slide: CardSlide; index: number; total: number };

// 카드별 컬러 톤 — 페이지 인덱스에 따라 다른 컬러로 시리즈 흐름 만들기
const TONES = [
  { bg: 'bg-[#1b64da]',  ink: 'text-white',    sub: 'text-white/85', accent: 'bg-yellow-300', accentInk: 'text-slate-900', soft: 'bg-white/15', stat: 'bg-white/15 text-white' },
  { bg: 'bg-[#0f172a]',  ink: 'text-white',    sub: 'text-white/80', accent: 'bg-emerald-400', accentInk: 'text-slate-900', soft: 'bg-white/10', stat: 'bg-white/10 text-white' },
  { bg: 'bg-[#7c3aed]',  ink: 'text-white',    sub: 'text-white/85', accent: 'bg-amber-300', accentInk: 'text-slate-900', soft: 'bg-white/15', stat: 'bg-white/15 text-white' },
  { bg: 'bg-[#0e7490]',  ink: 'text-white',    sub: 'text-white/85', accent: 'bg-pink-300', accentInk: 'text-slate-900', soft: 'bg-white/15', stat: 'bg-white/15 text-white' },
  { bg: 'bg-[#dc2626]',  ink: 'text-white',    sub: 'text-white/85', accent: 'bg-yellow-300', accentInk: 'text-slate-900', soft: 'bg-white/15', stat: 'bg-white/15 text-white' },
];

export function HybridStyle({ slide, index, total }: Props) {
  const t = TONES[index % TONES.length];
  const Icon = ICONS[slide.iconKey];

  const PageBadge = (
    <div className={`absolute top-4 right-4 inline-flex items-center justify-center w-9 h-9 rounded-full ${t.soft} ${t.ink} text-xs font-extrabold backdrop-blur-sm`}>
      {index + 1}/{total}
    </div>
  );

  const BgDeco = (
    <>
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/8" />
      <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-white/5" />
    </>
  );

  if (slide.kind === 'cover') {
    return (
      <div className={`relative w-full h-full ${t.bg} ${t.ink} rounded-2xl overflow-hidden shadow-xl`}>
        {BgDeco}{PageBadge}
        <div className="relative h-full flex flex-col px-6 py-7">
          {/* eyebrow + title */}
          <div className={`inline-flex items-center self-start gap-1.5 rounded-full ${t.soft} px-3 py-1 text-[11px] font-bold backdrop-blur-sm mb-4`}>
            #{slide.eyebrow}
          </div>

          {/* 큰 아이콘 + 제목 가로 배치 */}
          <div className="flex items-start gap-4 mb-3">
            <div className={`flex-none ${t.soft} rounded-2xl p-3 backdrop-blur-sm`}>
              <Icon className={`w-10 h-10 ${t.ink}`} strokeWidth={2} />
            </div>
            <h2 className="flex-1 text-[26px] font-black leading-[1.15] tracking-tight whitespace-pre-line">
              {slide.title}
            </h2>
          </div>

          <p className={`text-[13px] ${t.sub} leading-relaxed mb-5`}>{slide.subtitle}</p>

          {/* 큰 통계 박스 */}
          <div className={`mt-auto rounded-2xl ${t.soft} backdrop-blur-sm p-4`}>
            <div className={`text-[11px] font-bold ${t.sub} mb-1`}>{slide.stat.label}</div>
            <div className={`text-[34px] font-black leading-none ${t.ink}`}>{slide.stat.value}</div>
          </div>

          {/* 하단 CTA */}
          <div className={`mt-3 inline-flex items-center gap-1.5 ${t.accent} ${t.accentInk} rounded-full px-3 py-1.5 text-[11px] font-extrabold self-start`}>
            <Zap className="w-3 h-3" /> 슬라이드를 넘겨보세요
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div className={`relative w-full h-full ${t.bg} ${t.ink} rounded-2xl overflow-hidden shadow-xl`}>
        {BgDeco}{PageBadge}
        <div className="relative h-full flex flex-col px-6 py-7">
          {/* 큰 페이지 번호 (배경 워터마크) */}
          <div className={`absolute top-2 left-4 text-[88px] font-black leading-none ${t.ink} opacity-10 select-none`}>
            {slide.number}
          </div>

          {/* 헤더: 작은 라벨 + 큰 아이콘 */}
          <div className="relative flex items-start gap-3 mb-3 pt-3">
            <div className={`flex-none ${t.soft} rounded-2xl p-2.5 backdrop-blur-sm`}>
              <Icon className={`w-8 h-8 ${t.ink}`} strokeWidth={2} />
            </div>
            <div className="flex-1 pt-1">
              <div className={`text-[11px] font-bold ${t.sub} uppercase tracking-wider`}>POINT {slide.number}</div>
              <h3 className={`text-[22px] font-black leading-[1.2] mt-1 whitespace-pre-line ${t.ink}`}>
                {slide.title}
              </h3>
            </div>
          </div>

          {/* 부제 */}
          <p className={`text-[12px] font-semibold ${t.sub} mb-3 -mt-1`}>{slide.subtitle}</p>

          {/* 본문 */}
          <p className={`text-[13.5px] ${t.ink} leading-relaxed mb-4`}>{slide.body}</p>

          {/* 통계 박스 + 핵심 박스 */}
          <div className="mt-auto space-y-2">
            <div className={`rounded-xl ${t.soft} backdrop-blur-sm px-3.5 py-2.5 flex items-baseline justify-between gap-3`}>
              <span className={`text-[10px] font-bold ${t.sub} uppercase tracking-wide`}>{slide.stat.label}</span>
              <span className={`text-[20px] font-black ${t.ink}`}>{slide.stat.value}</span>
            </div>
            <div className={`rounded-xl ${t.accent} ${t.accentInk} px-4 py-3`}>
              <div className="text-[10px] font-bold opacity-70 mb-0.5">한 줄 정리</div>
              <div className="text-[14px] font-extrabold leading-snug">{slide.highlight}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // closing
  return (
    <div className={`relative w-full h-full ${t.bg} ${t.ink} rounded-2xl overflow-hidden shadow-xl`}>
      {BgDeco}{PageBadge}
      <div className="relative h-full flex flex-col px-6 py-7">
        {/* 큰 아이콘 가운데 */}
        <div className="flex items-start gap-3 mb-2">
          <div className={`flex-none ${t.soft} rounded-2xl p-2.5 backdrop-blur-sm`}>
            <Icon className={`w-8 h-8 ${t.ink}`} strokeWidth={2} />
          </div>
          <div className="flex-1 pt-1">
            <div className={`text-[11px] font-bold ${t.sub} uppercase tracking-wider`}>📌 SUMMARY</div>
            <h3 className={`text-[22px] font-black leading-tight mt-1 ${t.ink}`}>{slide.title}</h3>
          </div>
        </div>

        <p className={`text-[12.5px] ${t.sub} mb-4 leading-snug`}>{slide.subtitle}</p>

        {/* 체크리스트 카드 — 각 항목에 desc */}
        <ul className="space-y-2.5">
          {slide.items.map((it, i) => (
            <li key={i} className={`rounded-xl ${t.soft} backdrop-blur-sm p-3`}>
              <div className="flex gap-2.5 items-start">
                <span className={`flex-none w-6 h-6 rounded-full ${t.accent} ${t.accentInk} text-[11px] font-black inline-flex items-center justify-center mt-0.5`}>
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className={`text-[13px] font-bold ${t.ink} leading-tight`}>{it.title}</div>
                  <div className={`text-[11px] ${t.sub} leading-snug mt-0.5`}>{it.desc}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className={`mt-auto pt-3 text-[9.5px] ${t.sub} border-t ${t.ink === 'text-white' ? 'border-white/15' : 'border-slate-200'}`}>
          {slide.footer}
        </div>
      </div>
    </div>
  );
}
