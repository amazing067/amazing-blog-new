'use client';
// 리쿠르팅 전용 카드 스타일 v5 — 텍스트/레이아웃 피드백 반영.
// 피드백: ①글 많으면 안 읽음 → 포인트만·짧게 ②짧으면 밑이 빔 ③글자는 꽉 차되 레이아웃 밖 X.
// 해법: (a) 제목 길이별 폰트 auto-fit(짧으면 크게/길면 작게) (b) 콘텐츠 flex-1로 세로 꽉 채움
//        (c) 비교/그리드 칼럼·셀이 높이만큼 늘어남. 색은 슬라이드 index별 비비드 변주.
import {
  TrendingDown, AlertTriangle, Gift, Shield, Sparkles,
  Stethoscope, Calculator, Baby, ArrowRight, Search, ClipboardCheck, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CardSlide, CardIconKey, RecruitCompare, RecruitGridItem } from '@/lib/content/types';

type Props = { slide: CardSlide; index: number; total: number };

const ICONS: Record<CardIconKey, LucideIcon> = {
  sparkles: Sparkles, shield: Shield, trendingDown: TrendingDown, alert: AlertTriangle,
  gift: Gift, stethoscope: Stethoscope, calculator: Calculator, baby: Baby,
  search: Search, clipboard: ClipboardCheck, zap: Zap, arrow: ArrowRight,
};

const DISPLAY = "'Black Han Sans', sans-serif";
const MONO = 'var(--font-geist-mono), ui-monospace, monospace';
const SANS = "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const containerStyle = { containerType: 'size' } as React.CSSProperties;

type Theme = { bg: string; ink: string; sub: string; pop: string; chipBg: string; chipInk: string };
const PALETTE: Theme[] = [
  { bg: '#FFD23D', ink: '#1a1206', sub: 'rgba(26,18,6,.66)',     pop: '#FF3D7F', chipBg: '#1a1206', chipInk: '#FFD23D' },
  { bg: '#FF5A4D', ink: '#ffffff', sub: 'rgba(255,255,255,.85)', pop: '#FFE34D', chipBg: '#ffffff', chipInk: '#FF5A4D' },
  { bg: '#2D6BFF', ink: '#ffffff', sub: 'rgba(255,255,255,.85)', pop: '#C6F000', chipBg: '#C6F000', chipInk: '#11224d' },
  { bg: '#C6F000', ink: '#0b0b09', sub: 'rgba(11,11,9,.62)',     pop: '#FF3D7F', chipBg: '#0b0b09', chipInk: '#C6F000' },
  { bg: '#9B5CFF', ink: '#ffffff', sub: 'rgba(255,255,255,.86)', pop: '#FFD23D', chipBg: '#FFD23D', chipInk: '#2a0a5c' },
  { bg: '#FF7A1A', ink: '#1a0a02', sub: 'rgba(26,10,2,.62)',     pop: '#ffffff', chipBg: '#1a0a02', chipInk: '#FF7A1A' },
  { bg: '#FF3D7F', ink: '#ffffff', sub: 'rgba(255,255,255,.86)', pop: '#FFE34D', chipBg: '#ffffff', chipInk: '#FF3D7F' },
];
const theme = (i: number): Theme => PALETTE[i % PALETTE.length];
const CARD = 'relative w-full h-full overflow-hidden rounded-2xl';

// 제목 글자 길이별 auto-fit — 짧으면 크게(꽉 차게), 길면 작게(안 넘침)
function titleStyle(text: string, big = false): React.CSSProperties {
  const len = (text || '').replace(/\s/g, '').length;
  const scale = big ? 1 : 0.86; // 정보 카드(compare/grid)는 살짝 작게
  const base = len <= 8 ? 13.5 : len <= 12 ? 11.5 : len <= 18 ? 9.4 : len <= 24 ? 7.8 : 6.8;
  return { fontFamily: DISPLAY, fontSize: `${(base * scale).toFixed(1)}cqw`, lineHeight: 1.02 };
}

function IconWatermark({ k, t }: { k: CardIconKey; t: Theme }) {
  const Icon = ICONS[k] ?? Sparkles;
  return (
    <Icon className="absolute -bottom-[12%] -right-[10%] z-0 pointer-events-none"
      style={{ width: '70cqw', height: '70cqw', color: t.ink, opacity: 0.1 }} strokeWidth={1.6} />
  );
}

function Deco({ t }: { t: Theme }) {
  return (
    <>
      <div className="absolute -top-[10%] -left-[8%] w-[34%] aspect-square rounded-full z-0 pointer-events-none" style={{ background: t.pop }} />
      <div className="absolute top-[3%] right-[4%] w-[26%] h-[16%] z-0 pointer-events-none"
        style={{ backgroundImage: `radial-gradient(${t.ink} 24%, transparent 25%)`, backgroundSize: '4cqw 4cqw', opacity: 0.18 }} />
      <div className="absolute inset-0 z-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: 'multiply',
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
    </>
  );
}

function IconBadge({ k, t, size }: { k: CardIconKey; t: Theme; size: number }) {
  const Icon = ICONS[k] ?? Sparkles;
  return (
    <span className="inline-flex items-center justify-center rounded-full flex-none"
      style={{ width: `${size}cqw`, height: `${size}cqw`, background: t.ink }}>
      <Icon style={{ width: `${size * 0.54}cqw`, height: `${size * 0.54}cqw`, color: t.bg }} strokeWidth={2.6} />
    </span>
  );
}

function Sticker({ children, t }: { children: React.ReactNode; t: Theme }) {
  return (
    <span style={{ fontFamily: DISPLAY, background: t.chipBg, color: t.chipInk, border: `0.5cqw solid ${t.ink}`, transform: 'rotate(-2.2deg)', boxShadow: `0.8cqw 0.8cqw 0 ${t.ink}` }}
      className="inline-block rounded-[1.6cqw] px-[3.4cqw] py-[1.5cqw] leading-none">
      {children}
    </span>
  );
}

function StepDots({ index, total, t }: { index: number; total: number; t: Theme }) {
  return (
    <div className="flex items-center gap-[1.4cqw]">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className="rounded-full" style={{
          width: i === index ? '7cqw' : '2.4cqw', height: '2.4cqw',
          background: t.ink, opacity: i === index ? 1 : 0.32,
        }} />
      ))}
    </div>
  );
}

// Before/After 비교 — 칼럼이 높이만큼 늘어나 카드를 꽉 채움
function CompareBlock({ c, t }: { c: RecruitCompare; t: Theme }) {
  const col = (title: string, items: string[], good: boolean) => (
    <div className="flex-1 rounded-[2.4cqw] p-[3.6cqw] min-w-0 flex flex-col justify-center"
      style={{ background: good ? t.ink : 'transparent', border: `0.5cqw solid ${t.ink}` }}>
      <div style={{ fontFamily: DISPLAY, color: good ? t.bg : t.ink }} className="text-[4.6cqw] leading-none mb-[3cqw]">{title}</div>
      <ul className="space-y-[2.4cqw]">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-[1.8cqw] text-[3.2cqw] font-semibold leading-[1.25]"
            style={{ fontFamily: SANS, color: good ? t.bg : t.ink, opacity: good ? 1 : 0.74 }}>
            <span className="flex-none" style={{ color: good ? t.pop : t.ink }}>{good ? '✓' : '✕'}</span>
            <span className="break-keep">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="flex-1 min-h-0 mt-[4%] flex gap-[2.8cqw] items-stretch">
      {col(c.aTitle, c.aItems, false)}
      {col(c.bTitle, c.bItems, true)}
    </div>
  );
}

// 아이콘 그리드 2x2 — 셀이 높이만큼 늘어나 꽉 채움
function GridBlock({ items, t }: { items: RecruitGridItem[]; t: Theme }) {
  return (
    <div className="flex-1 min-h-0 mt-[4%] grid grid-cols-2 grid-rows-2 gap-[2.8cqw]">
      {items.slice(0, 4).map((g, i) => {
        const Icon = ICONS[g.iconKey] ?? Sparkles;
        return (
          <div key={i} className="rounded-[2.4cqw] p-[3.4cqw] flex flex-col justify-center gap-[2cqw] min-w-0" style={{ background: t.ink }}>
            <Icon style={{ width: '8cqw', height: '8cqw', color: t.pop }} strokeWidth={2.6} className="flex-none" />
            <span style={{ fontFamily: SANS, color: t.bg }} className="text-[3.6cqw] font-extrabold leading-[1.15] break-keep">{g.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function RecruitCardStyle({ slide, index, total }: Props) {
  const t = theme(index);
  const TopRow = (
    <div className="flex items-center justify-between flex-none">
      <span style={{ fontFamily: MONO, color: t.ink, opacity: 0.72 }} className="text-[2.9cqw] tracking-[.16em] uppercase">
        {slide.kind === 'point' ? `POINT ${slide.number}` : slide.kind === 'closing' ? 'LAST · 지금 바로' : (slide.eyebrow || 'RECRUIT')}
      </span>
      <span style={{ fontFamily: MONO, color: t.ink, opacity: 0.72 }} className="text-[2.8cqw] tracking-[.2em]">
        {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
      </span>
    </div>
  );

  if (slide.kind === 'cover') {
    // 일러스트 커버
    if (slide.bgImage) {
      return (
        <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
          <Deco t={t} />
          <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]">
            {TopRow}
            <div className="flex-1 min-h-0 flex items-center justify-center py-[2%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.bgImage} alt="" className="object-contain" style={{ maxHeight: '100%', maxWidth: '88%' }} />
            </div>
            <div className="flex-none">
              <h2 style={titleStyle(slide.title, true)} className="tracking-tight break-keep">{slide.title.replace(/\n/g, ' ')}</h2>
              <div className="mt-[3.5%] flex items-end justify-between gap-[3cqw]">
                <div>
                  <div className="text-[6cqw]"><Sticker t={t}>{slide.bigStat}</Sticker></div>
                  <div style={{ fontFamily: MONO, color: t.sub }} className="mt-[2.6cqw] text-[2.8cqw] tracking-[.1em]">{slide.bigStatLabel}</div>
                </div>
                <div style={{ fontFamily: DISPLAY }} className="text-[4.2cqw] leading-none pb-[1cqw]">SWIPE →</div>
              </div>
              <div className="mt-[3.5%]"><StepDots index={index} total={total} t={t} /></div>
            </div>
          </div>
        </div>
      );
    }
    // 비비드 커버 (일러스트 없음)
    return (
      <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
        <Deco t={t} />
        <IconWatermark k={slide.iconKey} t={t} />
        <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]">
          {TopRow}
          <div className="flex-1 min-h-0 flex flex-col justify-center">
            <div className="mb-[5%]"><IconBadge k={slide.iconKey} t={t} size={17} /></div>
            <h2 style={titleStyle(slide.title, true)} className="tracking-tight break-keep">{slide.title.replace(/\n/g, ' ')}</h2>
            <div className="mt-[6%]">
              <div className="text-[7cqw]"><Sticker t={t}>{slide.bigStat}</Sticker></div>
              <div style={{ fontFamily: MONO, color: t.sub }} className="mt-[3cqw] text-[2.9cqw] tracking-[.1em]">{slide.bigStatLabel}</div>
            </div>
          </div>
          <div className="flex-none flex items-center justify-between">
            <StepDots index={index} total={total} t={t} />
            <div style={{ fontFamily: DISPLAY }} className="text-[4.4cqw] leading-none">SWIPE →</div>
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    const layout = slide.layout ?? 'default';
    const showCompare = layout === 'compare' && !!slide.compare;
    const showGrid = layout === 'grid' && !!slide.gridItems;
    const isInfo = showCompare || showGrid;
    return (
      <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
        <Deco t={t} />
        {!isInfo && (
          <div style={{ fontFamily: DISPLAY, color: t.ink, opacity: 0.13 }}
            className="absolute -bottom-[9%] -right-[2%] text-[52cqw] leading-none z-0 pointer-events-none">
            {slide.number}
          </div>
        )}
        <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]">
          {TopRow}
          {showCompare && slide.compare ? (
            <div className="flex-1 min-h-0 mt-[4%] flex flex-col">
              <h3 style={titleStyle(slide.title)} className="tracking-tight break-keep flex-none">{slide.title.replace(/\n/g, ' ')}</h3>
              <CompareBlock c={slide.compare} t={t} />
            </div>
          ) : showGrid && slide.gridItems ? (
            <div className="flex-1 min-h-0 mt-[4%] flex flex-col">
              <h3 style={titleStyle(slide.title)} className="tracking-tight break-keep flex-none">{slide.title.replace(/\n/g, ' ')}</h3>
              <GridBlock items={slide.gridItems} t={t} />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col justify-center gap-[3.4cqw] overflow-hidden">
              <IconBadge k={slide.iconKey} t={t} size={14} />
              <h3 style={titleStyle(slide.title, true)} className="tracking-tight break-keep">{slide.title.replace(/\n/g, ' ')}</h3>
              {slide.body && <p style={{ fontFamily: SANS, color: t.sub }} className="text-[3.8cqw] font-medium leading-[1.5] max-w-[92%]">{slide.body}</p>}
              <div className="flex items-center gap-[3cqw] overflow-hidden">
                <div className="text-[4.8cqw] flex-none"><Sticker t={t}>{slide.bigStat}</Sticker></div>
                <span style={{ fontFamily: MONO, color: t.sub }} className="text-[2.7cqw] tracking-[.06em] truncate">{slide.bigStatLabel}</span>
              </div>
            </div>
          )}
          <div className="flex-none pt-[3.5%]"><StepDots index={index} total={total} t={t} /></div>
        </div>
      </div>
    );
  }

  // closing — 최종 CTA
  return (
    <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
      <Deco t={t} />
      <IconWatermark k={slide.iconKey} t={t} />
      <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]">
        {TopRow}
        <div className="flex-1 min-h-0 flex flex-col justify-center">
          <h3 style={titleStyle(slide.title, true)} className="tracking-tight break-keep flex-none">{slide.title.replace(/\n/g, ' ')}</h3>
          <ul className="mt-[6%] space-y-[3.2cqw]">
            {slide.items.map((it, i) => (
              <li key={i} className="flex items-center gap-[2.8cqw]">
                <span style={{ fontFamily: DISPLAY, color: t.bg, background: t.ink, width: '7.5cqw', height: '7.5cqw' }}
                  className="inline-flex items-center justify-center rounded-full flex-none text-[3.6cqw] leading-none">{i + 1}</span>
                <span style={{ fontFamily: SANS, color: t.ink }} className="text-[3.9cqw] font-bold leading-[1.25]">{it}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-none">
          <div style={{ fontFamily: MONO, color: t.ink, borderColor: t.ink }} className="pt-[3.5%] border-t text-[2.9cqw] leading-[1.5]">
            <span style={{ background: t.chipBg, color: t.chipInk }} className="px-[1.6cqw] py-[0.6cqw] rounded-[1cqw]">📤 공유</span>
            <span className="ml-[2cqw]">{slide.footer}</span>
          </div>
          <div className="mt-[3.5%]"><StepDots index={index} total={total} t={t} /></div>
        </div>
      </div>
    </div>
  );
}
