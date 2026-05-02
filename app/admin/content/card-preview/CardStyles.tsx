// 카드뉴스 — 인스타 핸드폰 피드(약 400px)에서 한눈에 들어오는 큼지막한 디자인.
// 한 카드 = 한 메시지. 거대 통계/헤딩 + 짧은 보조 텍스트만. 시각 hierarchy 명확.

import {
  TrendingDown, AlertTriangle, Gift, Shield, Sparkles,
  Stethoscope, Calculator, Baby, ArrowRight, Search,
  ClipboardCheck, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CardSlide, CardIconKey } from '@/lib/content/types';

export type { CardSlide };

const ICONS: Record<CardIconKey, LucideIcon> = {
  sparkles: Sparkles, shield: Shield,
  trendingDown: TrendingDown, alert: AlertTriangle,
  gift: Gift, stethoscope: Stethoscope,
  calculator: Calculator, baby: Baby,
  search: Search, clipboard: ClipboardCheck,
  zap: Zap, arrow: ArrowRight,
};

type Props = {
  slide: CardSlide;
  index: number;
  total: number;
  compliance?: { number?: string | null; expires?: string | null };
};

const TONES = [
  { bg: 'bg-[#1b64da]',  ink: 'text-white', sub: 'text-white/85', accent: 'bg-yellow-300', accentText: 'text-yellow-300',  accentInk: 'text-slate-900', soft: 'bg-white/15' },
  { bg: 'bg-[#0f172a]',  ink: 'text-white', sub: 'text-white/80', accent: 'bg-emerald-400', accentText: 'text-emerald-400', accentInk: 'text-slate-900', soft: 'bg-white/10' },
  { bg: 'bg-[#7c3aed]',  ink: 'text-white', sub: 'text-white/85', accent: 'bg-amber-300', accentText: 'text-amber-300',   accentInk: 'text-slate-900', soft: 'bg-white/15' },
  { bg: 'bg-[#0e7490]',  ink: 'text-white', sub: 'text-white/85', accent: 'bg-pink-300', accentText: 'text-pink-300',     accentInk: 'text-slate-900', soft: 'bg-white/15' },
  { bg: 'bg-[#dc2626]',  ink: 'text-white', sub: 'text-white/85', accent: 'bg-yellow-300', accentText: 'text-yellow-300',  accentInk: 'text-slate-900', soft: 'bg-white/15' },
];

// container query units 기반 폰트 — 인스타 피드(~400px)에서 잘 보이도록 큼지막하게.
// 1080px 카드 기준 환산 (cqw → px):
//  헤딩 96~120px, 본문 44~52px, 거대 통계 168~192px
// 폰트 크기 — 박스 안의 글자도 끝까지 채우는 큼지막한 크기.
// 1080px 카드 기준 환산.
const F = {
  pageBadge:    'text-[3cqw] font-extrabold',                                  // ~32px
  eyebrow:      'text-[3.8cqw] font-extrabold uppercase tracking-wider',       // ~41px
  coverTitle:   'text-[12cqw] font-black leading-[1.05] tracking-tight',       // ~130px
  coverBigStat: 'text-[20cqw] font-black leading-none',                         // ~216px
  coverStatLab: 'text-[3.4cqw] font-bold uppercase tracking-wide whitespace-nowrap truncate', // ~37px, 한 줄 강제
  pointEyebrow: 'text-[3.6cqw] font-extrabold uppercase tracking-wider whitespace-nowrap',    // 한 줄
  pointTitle:   'text-[10cqw] font-black leading-[1.05] tracking-tight',        // ~108px (메인 = 가장 큼)
  pointBigStat: 'text-[14cqw] font-black leading-none tracking-tight',          // ~151px (보조 시각)
  pointStatLab: 'text-[3.2cqw] font-bold uppercase tracking-wide whitespace-nowrap truncate', // 한 줄 강제
  pointBody:    'text-[4.2cqw] leading-[1.45]',                                 // ~45px (보조 설명)
  closingTitle: 'text-[7.5cqw] font-black leading-[1.1]',                       // ~81px (1줄에 들어가게)
  closingItem:  'text-[5cqw] font-bold leading-tight',                          // ~54px (한 줄에 들어가게)
  closingItemNum:'text-[4.4cqw] font-black',                                    // ~48px
  footer:       'text-[2.4cqw]',                                                // ~26px
  ctaChip:      'text-[4cqw] font-extrabold',                                   // ~43px
};

const containerStyle = { containerType: 'size' } as React.CSSProperties;
const CARD_BASE = 'relative w-full h-full rounded-2xl overflow-hidden shadow-xl';

export function HybridStyle({ slide, index, total, compliance }: Props) {
  const t = TONES[index % TONES.length];
  const Icon = ICONS[slide.iconKey];

  const PageBadge = (
    <div className={`absolute top-[5%] right-[5%] inline-flex items-center justify-center w-[11%] h-[11%] rounded-full ${t.soft} ${t.ink} ${F.pageBadge} backdrop-blur-sm`}>
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
        <div className="relative h-full flex flex-col px-[5%] py-[5%]">
          {/* eyebrow */}
          <div className={`inline-flex items-center self-start gap-[1cqw] rounded-full ${t.soft} px-[3.5%] py-[1.5%] ${F.eyebrow} backdrop-blur-sm`}>
            #{slide.eyebrow}
          </div>

          {/* 제목 — 큼지막, 자동 줄바꿈, 강제 \n 제거 */}
          <h2 className={`mt-[6%] ${F.coverTitle} whitespace-normal break-keep`}>
            {slide.title.replace(/\n/g, ' ')}
          </h2>

          {/* 거대 통계 — 메인 시각 포인트. 글자 길이에 따라 폰트 자동 축소 */}
          <div className="mt-auto flex items-end justify-between gap-[3cqw] overflow-hidden">
            <div className="flex-1 min-w-0">
              <div className={`${F.coverStatLab} ${t.sub} mb-[1cqw]`}>{slide.bigStatLabel}</div>
              <div className={`font-black leading-none break-keep`}
                   style={{ fontSize: `clamp(8cqw, ${Math.max(8, 80 / Math.max(slide.bigStat.length, 1))}cqw, 20cqw)` }}>
                {slide.bigStat}
              </div>
            </div>
            <div className={`flex-none ${t.soft} rounded-full p-[4%] backdrop-blur-sm`}>
              <Icon style={{ width: '13cqw', height: '13cqw' }} className={t.ink} strokeWidth={2.5} />
            </div>
          </div>

          {/* CTA 칩 */}
          <div className={`mt-[5%] inline-flex items-center gap-[1.2cqw] ${t.accent} ${t.accentInk} rounded-full px-[4%] py-[2%] ${F.ctaChip} self-start`}>
            <Zap style={{ width: '4cqw', height: '4cqw' }} strokeWidth={3} /> 슬라이드 →
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div style={containerStyle} className={`${CARD_BASE} ${t.bg} ${t.ink}`}>
        {BgDeco}{PageBadge}
        <div className="relative h-full flex flex-col px-[5%] py-[5%]">
          {/* POINT 라벨 + 아이콘 */}
          <div className={`flex items-center justify-between`}>
            <div className={`${F.pointEyebrow} ${t.sub}`}>POINT {slide.number}</div>
            <div className={`flex-none ${t.soft} rounded-full p-[3%] backdrop-blur-sm`}>
              <Icon style={{ width: '8cqw', height: '8cqw' }} className={t.ink} strokeWidth={2.5} />
            </div>
          </div>

          {/* 메인 헤딩 — 가장 큰 글자, 제목 역할 */}
          <h3 className={`mt-[5%] ${F.pointTitle} whitespace-normal break-keep`}>
            {slide.title.replace(/\n/g, ' ')}
          </h3>

          {/* 거대 숫자 — 보조 시각 임팩트 (헤딩의 핵심을 한 번 더 강조) */}
          <div className={`mt-[6%] flex items-baseline gap-[2cqw]`}>
            <div className={`${F.pointBigStat} ${t.accentText}`}>
              {slide.bigStat}
            </div>
            <div className={`${F.pointStatLab} ${t.sub} pb-[2cqw]`}>{slide.bigStatLabel}</div>
          </div>

          {/* 본문 — 부연 설명 (가장 작은 글자, 흐림) */}
          <p className={`mt-auto ${F.pointBody} ${t.sub}`}>{slide.body}</p>
        </div>
      </div>
    );
  }

  // closing
  return (
    <div style={containerStyle} className={`${CARD_BASE} ${t.bg} ${t.ink}`}>
      {BgDeco}{PageBadge}
      <div className="relative h-full flex flex-col px-[5%] py-[5%]">
        {/* SUMMARY 라벨 — 좌측 정렬, 우측 아이콘 박스는 PageBadge와 겹쳐 제거 */}
        <div className={`flex items-center gap-[2cqw]`}>
          <div className={`${t.soft} rounded-full p-[2.5%] backdrop-blur-sm`}>
            <Icon style={{ width: '6cqw', height: '6cqw' }} className={t.ink} strokeWidth={2.5} />
          </div>
          <div className={`${F.eyebrow} ${t.sub}`}>📌 SUMMARY</div>
        </div>

        <h3 className={`mt-[5%] ${F.closingTitle} whitespace-normal break-keep`}>
          {slide.title.replace(/\n/g, ' ')}
        </h3>

        <ul className="mt-[6%] space-y-[3.5cqw]">
          {slide.items.map((it, i) => (
            <li key={i} className={`rounded-2xl ${t.soft} backdrop-blur-sm px-[3.5%] py-[3%] flex gap-[2.5cqw] items-center`}>
              <span className={`flex-none rounded-full ${t.accent} ${t.accentInk} ${F.closingItemNum} inline-flex items-center justify-center`}
                    style={{ width: '11cqw', height: '11cqw' }}>
                {i + 1}
              </span>
              <span className={`flex-1 ${F.closingItem}`}>{it}</span>
            </li>
          ))}
        </ul>

        <div className={`mt-auto pt-[3%] ${F.footer} ${t.sub} border-t border-white/15`}>
          {compliance?.number ? (
            <>
              <div className={`font-bold ${t.ink}`}>
                광고심의필 {compliance.number}
                {compliance.expires && <span className={`${t.sub} font-normal ml-[1.5cqw]`}>유효 ~{compliance.expires}</span>}
              </div>
              <div className={`mt-[0.5cqw] ${t.sub}`}>{slide.footer}</div>
            </>
          ) : (
            slide.footer
          )}
        </div>
      </div>
    </div>
  );
}
