// 카드뉴스 하이브리드 디자인 — 토스 컬러 임팩트 + 카카오페이 정보 밀도 + 큰 아이콘.
// 1080×1080 인스타 정사각 비율, 5장 시리즈.
// 모든 폰트·여백은 container query units(cqw)로 카드 크기에 비례 → 1080px일 때 핸드폰에서도 잘 보이는 큰 글자.

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
      items: string[];
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

const TONES = [
  { bg: 'bg-[#1b64da]',  ink: 'text-white', sub: 'text-white/85', accent: 'bg-yellow-300', accentInk: 'text-slate-900', soft: 'bg-white/15' },
  { bg: 'bg-[#0f172a]',  ink: 'text-white', sub: 'text-white/80', accent: 'bg-emerald-400', accentInk: 'text-slate-900', soft: 'bg-white/10' },
  { bg: 'bg-[#7c3aed]',  ink: 'text-white', sub: 'text-white/85', accent: 'bg-amber-300', accentInk: 'text-slate-900', soft: 'bg-white/15' },
  { bg: 'bg-[#0e7490]',  ink: 'text-white', sub: 'text-white/85', accent: 'bg-pink-300', accentInk: 'text-slate-900', soft: 'bg-white/15' },
  { bg: 'bg-[#dc2626]',  ink: 'text-white', sub: 'text-white/85', accent: 'bg-yellow-300', accentInk: 'text-slate-900', soft: 'bg-white/15' },
];

// container query 기반 폰트 크기 — 카드 폭에 비례.
// 1080px 카드 기준: title 60px, body 32px, stat-value 96px 등. 핸드폰 인스타에서도 충분히 큼.
const F = {
  pageBadge:    'text-[2.4cqw] font-extrabold',     // ~26px @ 1080
  eyebrow:      'text-[2.6cqw] font-bold',           // ~28px
  coverTitle:   'text-[6cqw] font-black leading-[1.1]',   // ~64px
  coverSub:     'text-[2.8cqw] leading-relaxed',          // ~30px
  coverStat:    'text-[8.5cqw] font-black leading-none',  // ~92px
  statLabel:    'text-[2.2cqw] font-bold uppercase',      // ~24px
  pointWatermark:'text-[18cqw] font-black leading-none',  // ~194px
  pointEyebrow: 'text-[2.4cqw] font-bold uppercase tracking-wider', // ~26px
  pointTitle:   'text-[5.6cqw] font-black leading-[1.15]', // ~60px
  pointSub:     'text-[2.6cqw] font-semibold',             // ~28px
  pointBody:    'text-[2.9cqw] leading-[1.55]',            // ~31px
  pointStat:    'text-[4.2cqw] font-black',                // ~45px
  pointHL:      'text-[3.2cqw] font-extrabold leading-snug', // ~35px
  closingTitle: 'text-[5.2cqw] font-black leading-tight',  // ~56px
  closingSub:   'text-[2.7cqw] leading-snug',              // ~29px
  closingItem:  'text-[3.4cqw] font-bold leading-snug',    // ~37px
  footer:       'text-[1.8cqw]',                            // ~19px
  ctaChip:      'text-[2.4cqw] font-extrabold',            // ~26px
};

const CARD_BASE = 'relative w-full h-full rounded-2xl overflow-hidden shadow-xl';

// container-type을 inline style로 (Tailwind v4 JIT가 임의값 못 잡을 수 있어 안전한 inline)
const containerStyle = { containerType: 'size' } as React.CSSProperties;

export function HybridStyle({ slide, index, total }: Props) {
  const t = TONES[index % TONES.length];
  const Icon = ICONS[slide.iconKey];

  const PageBadge = (
    <div className={`absolute top-[5%] right-[5%] inline-flex items-center justify-center w-[10%] h-[10%] rounded-full ${t.soft} ${t.ink} ${F.pageBadge} backdrop-blur-sm`}>
      {index + 1}/{total}
    </div>
  );

  const BgDeco = (
    <>
      <div className="absolute -top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-white/8" />
      <div className="absolute -bottom-[25%] -left-[20%] w-[70%] h-[70%] rounded-full bg-white/5" />
    </>
  );

  if (slide.kind === 'cover') {
    return (
      <div style={containerStyle} className={`${CARD_BASE} ${t.bg} ${t.ink}`}>
        {BgDeco}{PageBadge}
        <div className="relative h-full flex flex-col px-[7%] py-[7%]">
          <div className={`inline-flex items-center self-start gap-[0.5cqw] rounded-full ${t.soft} px-[3%] py-[1.5%] ${F.eyebrow} backdrop-blur-sm mb-[5%]`}>
            #{slide.eyebrow}
          </div>

          <div className="flex items-start gap-[5%] mb-[3%]">
            <div className={`flex-none ${t.soft} rounded-2xl p-[3%] backdrop-blur-sm`}>
              <Icon className={`${t.ink}`} style={{ width: '10cqw', height: '10cqw' }} strokeWidth={2} />
            </div>
            <h2 className={`flex-1 ${F.coverTitle} tracking-tight whitespace-pre-line`}>
              {slide.title}
            </h2>
          </div>

          <p className={`${F.coverSub} ${t.sub} mb-[5%]`}>{slide.subtitle}</p>

          <div className={`mt-auto rounded-2xl ${t.soft} backdrop-blur-sm p-[5%]`}>
            <div className={`${F.statLabel} ${t.sub} mb-[1cqw]`}>{slide.stat.label}</div>
            <div className={`${F.coverStat}`}>{slide.stat.value}</div>
          </div>

          <div className={`mt-[3%] inline-flex items-center gap-[1cqw] ${t.accent} ${t.accentInk} rounded-full px-[3%] py-[1.5%] ${F.ctaChip} self-start`}>
            <Zap style={{ width: '2.4cqw', height: '2.4cqw' }} /> 슬라이드를 넘겨보세요
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div style={containerStyle} className={`${CARD_BASE} ${t.bg} ${t.ink}`}>
        {BgDeco}{PageBadge}
        <div className="relative h-full flex flex-col px-[7%] py-[7%]">
          <div className={`absolute top-[2%] left-[5%] ${F.pointWatermark} ${t.ink} opacity-10 select-none pointer-events-none`}>
            {slide.number}
          </div>

          <div className="relative flex items-start gap-[4%] mb-[3%] pt-[3%]">
            <div className={`flex-none ${t.soft} rounded-2xl p-[3%] backdrop-blur-sm`}>
              <Icon className={`${t.ink}`} style={{ width: '8cqw', height: '8cqw' }} strokeWidth={2} />
            </div>
            <div className="flex-1 pt-[1%]">
              <div className={`${F.pointEyebrow} ${t.sub}`}>POINT {slide.number}</div>
              <h3 className={`${F.pointTitle} mt-[1%] whitespace-pre-line`}>{slide.title}</h3>
            </div>
          </div>

          <p className={`${F.pointSub} ${t.sub} mb-[3%]`}>{slide.subtitle}</p>
          <p className={`${F.pointBody} ${t.ink} mb-[4%]`}>{slide.body}</p>

          <div className="mt-auto space-y-[2cqw]">
            <div className={`rounded-xl ${t.soft} backdrop-blur-sm px-[4%] py-[3%] flex items-baseline justify-between gap-[3cqw]`}>
              <span className={`${F.statLabel} ${t.sub}`}>{slide.stat.label}</span>
              <span className={`${F.pointStat} ${t.ink}`}>{slide.stat.value}</span>
            </div>
            <div className={`rounded-xl ${t.accent} ${t.accentInk} px-[5%] py-[4%]`}>
              <div className={`${F.statLabel} opacity-70 mb-[0.5cqw]`}>한 줄 정리</div>
              <div className={F.pointHL}>{slide.highlight}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle} className={`${CARD_BASE} ${t.bg} ${t.ink}`}>
      {BgDeco}{PageBadge}
      <div className="relative h-full flex flex-col px-[7%] py-[7%]">
        <div className="flex items-start gap-[4%] mb-[2%]">
          <div className={`flex-none ${t.soft} rounded-2xl p-[3%] backdrop-blur-sm`}>
            <Icon className={`${t.ink}`} style={{ width: '8cqw', height: '8cqw' }} strokeWidth={2} />
          </div>
          <div className="flex-1 pt-[1%]">
            <div className={`${F.pointEyebrow} ${t.sub}`}>📌 SUMMARY</div>
            <h3 className={`${F.closingTitle} mt-[1%]`}>{slide.title}</h3>
          </div>
        </div>

        <p className={`${F.closingSub} ${t.sub} mb-[5%]`}>{slide.subtitle}</p>

        <ul className="space-y-[2.5cqw]">
          {slide.items.map((it, i) => (
            <li key={i} className={`rounded-xl ${t.soft} backdrop-blur-sm p-[4%] flex gap-[3%] items-center`}>
              <span className={`flex-none rounded-full ${t.accent} ${t.accentInk} ${F.statLabel} inline-flex items-center justify-center`}
                    style={{ width: '7cqw', height: '7cqw' }}>
                {i + 1}
              </span>
              <span className={`flex-1 ${F.closingItem}`}>{it}</span>
            </li>
          ))}
        </ul>

        <div className={`mt-auto pt-[3%] ${F.footer} ${t.sub} border-t border-white/15`}>
          {slide.footer}
        </div>
      </div>
    </div>
  );
}
