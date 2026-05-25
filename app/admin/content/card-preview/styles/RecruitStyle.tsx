'use client';
// 리쿠르팅 전용 카드 스타일 v3 — "텍스트만 허전" 피드백 + 딥서치 반영.
// 딥서치 핵심: 허전함의 해법은 사진이 아니라 "큰 그래픽 요소 1개 + 구조화 + 색 2~3개".
//  - 거대 아이콘/번호 워터마크를 배경 그래픽으로(빈 공간 채움)
//  - 컬러블록 도형(가장자리서 잘리게 → 스와이프 유도), 하프톤 도트, 스텝 진행 인디케이터
//  - 슬라이드 index별 비비드 컬러 변주(7색), Black Han Sans 포스터 타이포
// 색·그래픽만으로 채우므로 외부 이미지/API 불필요. containerType:size + cqw → 썸네일·미리보기·1080 PNG 동일 스케일.
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
  { bg: '#FFD23D', ink: '#1a1206', sub: 'rgba(26,18,6,.66)',     pop: '#FF3D7F', chipBg: '#1a1206', chipInk: '#FFD23D' }, // 0 노랑
  { bg: '#FF5A4D', ink: '#ffffff', sub: 'rgba(255,255,255,.85)', pop: '#FFE34D', chipBg: '#ffffff', chipInk: '#FF5A4D' }, // 1 코랄
  { bg: '#2D6BFF', ink: '#ffffff', sub: 'rgba(255,255,255,.85)', pop: '#C6F000', chipBg: '#C6F000', chipInk: '#11224d' }, // 2 블루
  { bg: '#C6F000', ink: '#0b0b09', sub: 'rgba(11,11,9,.62)',     pop: '#FF3D7F', chipBg: '#0b0b09', chipInk: '#C6F000' }, // 3 라임
  { bg: '#9B5CFF', ink: '#ffffff', sub: 'rgba(255,255,255,.86)', pop: '#FFD23D', chipBg: '#FFD23D', chipInk: '#2a0a5c' }, // 4 바이올렛
  { bg: '#FF7A1A', ink: '#1a0a02', sub: 'rgba(26,10,2,.62)',     pop: '#ffffff', chipBg: '#1a0a02', chipInk: '#FF7A1A' }, // 5 오렌지
  { bg: '#FF3D7F', ink: '#ffffff', sub: 'rgba(255,255,255,.86)', pop: '#FFE34D', chipBg: '#ffffff', chipInk: '#FF3D7F' }, // 6 핫핑크(CTA)
];
const theme = (i: number): Theme => PALETTE[i % PALETTE.length];
const CARD = 'relative w-full h-full overflow-hidden rounded-2xl';

// 큰 아이콘 워터마크 — 빈 공간을 채우는 핵심 그래픽 (딥서치: 큰 요소 자체를 그래픽으로)
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
      {/* 컬러블록 — 가장자리서 잘리는 굵은 pop 도형 (스와이프 유도) */}
      <div className="absolute -top-[10%] -left-[8%] w-[34%] aspect-square rounded-full z-0 pointer-events-none" style={{ background: t.pop }} />
      {/* 하프톤 도트 */}
      <div className="absolute top-[3%] right-[4%] w-[26%] h-[16%] z-0 pointer-events-none"
        style={{ backgroundImage: `radial-gradient(${t.ink} 24%, transparent 25%)`, backgroundSize: '4cqw 4cqw', opacity: 0.18 }} />
      {/* 그레인 */}
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

// 스텝 진행 인디케이터 — 현재 위치 표시 (캐러셀 맥락 + 그래픽 포인트)
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

// Before/After 비교 인포그래픽
function CompareBlock({ c, t }: { c: RecruitCompare; t: Theme }) {
  const col = (title: string, items: string[], good: boolean) => (
    <div className="flex-1 rounded-[2cqw] p-[3.4cqw] min-w-0"
      style={{ background: good ? t.ink : 'transparent', border: `0.5cqw solid ${t.ink}` }}>
      <div style={{ fontFamily: DISPLAY, color: good ? t.bg : t.ink }} className="text-[4.2cqw] leading-none mb-[2.6cqw]">{title}</div>
      <ul className="space-y-[1.8cqw]">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-[1.6cqw] text-[2.9cqw] font-medium leading-[1.3]"
            style={{ fontFamily: SANS, color: good ? t.bg : t.ink, opacity: good ? 1 : 0.72 }}>
            <span className="flex-none" style={{ color: good ? t.pop : t.ink }}>{good ? '✓' : '✕'}</span>
            <span className="break-keep">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="mt-[5%] flex gap-[2.6cqw] items-stretch">
      {col(c.aTitle, c.aItems, false)}
      {col(c.bTitle, c.bItems, true)}
    </div>
  );
}

// 아이콘 그리드 인포그래픽 (2x2)
function GridBlock({ items, t }: { items: RecruitGridItem[]; t: Theme }) {
  return (
    <div className="mt-[5%] grid grid-cols-2 gap-[2.6cqw]">
      {items.slice(0, 4).map((g, i) => {
        const Icon = ICONS[g.iconKey] ?? Sparkles;
        return (
          <div key={i} className="rounded-[2cqw] p-[3cqw] flex items-center gap-[2.4cqw] min-w-0" style={{ background: t.ink }}>
            <Icon style={{ width: '6.4cqw', height: '6.4cqw', color: t.pop }} strokeWidth={2.6} className="flex-none" />
            <span style={{ fontFamily: SANS, color: t.bg }} className="text-[3.1cqw] font-bold leading-[1.2] break-keep">{g.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function RecruitCardStyle({ slide, index, total }: Props) {
  const t = theme(index);
  const TopRow = (
    <div className="flex items-center justify-between">
      <span style={{ fontFamily: MONO, color: t.ink, opacity: 0.72 }} className="text-[2.9cqw] tracking-[.16em] uppercase">
        {slide.kind === 'point' ? `POINT ${slide.number}` : slide.kind === 'closing' ? 'LAST · 지금 바로' : (slide.eyebrow || 'RECRUIT')}
      </span>
      <span style={{ fontFamily: MONO, color: t.ink, opacity: 0.72 }} className="text-[2.8cqw] tracking-[.2em]">
        {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
      </span>
    </div>
  );

  if (slide.kind === 'cover') {
    if (slide.bgImage) {
      return (
        <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.bgImage} crossOrigin="anonymous" alt="" className="absolute inset-0 w-full h-full object-cover z-0" />
          <div className="absolute inset-0 z-0" style={{ background: `linear-gradient(180deg, rgba(0,0,0,.30) 0%, ${t.bg}00 30%, ${t.bg}E0 66%, ${t.bg} 100%)` }} />
          <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]">
            <div className="flex items-center justify-between" style={{ textShadow: '0 0.3cqw 1cqw rgba(0,0,0,.45)' }}>
              <span style={{ fontFamily: MONO, color: '#fff' }} className="text-[2.9cqw] tracking-[.16em] uppercase">{slide.eyebrow || 'RECRUIT'}</span>
              <span style={{ fontFamily: MONO, color: '#fff', opacity: 0.85 }} className="text-[2.8cqw] tracking-[.2em]">{String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}</span>
            </div>
            <div className="mt-[5%]"><IconBadge k={slide.iconKey} t={t} size={15} /></div>
            <div className="mt-auto">
              <h2 style={{ fontFamily: DISPLAY }} className="text-[11.5cqw] leading-[0.98] tracking-tight break-keep">
                {slide.title.replace(/\n/g, ' ')}
              </h2>
              <div className="mt-[4%] flex items-end justify-between gap-[3cqw]">
                <div>
                  <div className="text-[6.5cqw]"><Sticker t={t}>{slide.bigStat}</Sticker></div>
                  <div style={{ fontFamily: MONO, color: t.sub }} className="mt-[3cqw] text-[2.9cqw] tracking-[.1em]">{slide.bigStatLabel}</div>
                </div>
                <div style={{ fontFamily: DISPLAY }} className="text-[4.4cqw] leading-none pb-[1cqw]">SWIPE →</div>
              </div>
              <div className="mt-[4%]"><StepDots index={index} total={total} t={t} /></div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
        <Deco t={t} />
        <IconWatermark k={slide.iconKey} t={t} />
        <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]">
          {TopRow}
          <div className="mt-[5%]"><IconBadge k={slide.iconKey} t={t} size={17} /></div>
          <h2 style={{ fontFamily: DISPLAY }} className="mt-[5%] text-[11.5cqw] leading-[0.98] tracking-tight break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h2>
          <div className="mt-auto flex items-end justify-between gap-[3cqw]">
            <div>
              <div className="text-[7cqw]"><Sticker t={t}>{slide.bigStat}</Sticker></div>
              <div style={{ fontFamily: MONO, color: t.sub }} className="mt-[3cqw] text-[2.9cqw] tracking-[.1em]">{slide.bigStatLabel}</div>
            </div>
            <div style={{ fontFamily: DISPLAY }} className="text-[4.4cqw] leading-none pb-[1cqw]">SWIPE →</div>
          </div>
          <div className="mt-[4%]"><StepDots index={index} total={total} t={t} /></div>
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
        {/* 인포그래픽이 아닐 때만 거대 번호 워터마크 */}
        {!isInfo && (
          <div style={{ fontFamily: DISPLAY, color: t.ink, opacity: 0.13 }}
            className="absolute -bottom-[9%] -right-[2%] text-[52cqw] leading-none z-0 pointer-events-none">
            {slide.number}
          </div>
        )}
        <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]">
          {TopRow}
          {showCompare && slide.compare ? (
            <>
              <h3 style={{ fontFamily: DISPLAY }} className="mt-[4.5%] text-[7.4cqw] leading-[1.04] tracking-tight break-keep">
                {slide.title.replace(/\n/g, ' ')}
              </h3>
              <CompareBlock c={slide.compare} t={t} />
            </>
          ) : showGrid && slide.gridItems ? (
            <>
              <h3 style={{ fontFamily: DISPLAY }} className="mt-[4.5%] text-[7.4cqw] leading-[1.04] tracking-tight break-keep">
                {slide.title.replace(/\n/g, ' ')}
              </h3>
              <GridBlock items={slide.gridItems} t={t} />
            </>
          ) : (
            <>
              <div className="mt-[5%]"><IconBadge k={slide.iconKey} t={t} size={14} /></div>
              <h3 style={{ fontFamily: DISPLAY }} className="mt-[4.5%] text-[9cqw] leading-[1.04] tracking-tight break-keep">
                {slide.title.replace(/\n/g, ' ')}
              </h3>
              <p style={{ fontFamily: SANS, color: t.sub }} className="mt-[3.5%] text-[3.7cqw] font-medium leading-[1.5] max-w-[90%]">
                {slide.body}
              </p>
              <div className="mt-[5%] flex items-center gap-[3cqw] overflow-hidden">
                <div className="text-[4.8cqw] flex-none"><Sticker t={t}>{slide.bigStat}</Sticker></div>
                <span style={{ fontFamily: MONO, color: t.sub }} className="text-[2.7cqw] tracking-[.06em] truncate">{slide.bigStatLabel}</span>
              </div>
            </>
          )}
          <div className="mt-auto pt-[4%]"><StepDots index={index} total={total} t={t} /></div>
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
        <h3 style={{ fontFamily: DISPLAY }} className="mt-[5%] text-[8.2cqw] leading-[1.05] tracking-tight break-keep">
          {slide.title.replace(/\n/g, ' ')}
        </h3>
        <ul className="mt-[5%] space-y-[2.8cqw]">
          {slide.items.map((it, i) => (
            <li key={i} className="flex items-center gap-[2.8cqw]">
              <span style={{ fontFamily: DISPLAY, color: t.bg, background: t.ink, width: '7.5cqw', height: '7.5cqw' }}
                className="inline-flex items-center justify-center rounded-full flex-none text-[3.6cqw] leading-none">
                {i + 1}
              </span>
              <span style={{ fontFamily: SANS, color: t.ink }} className="text-[3.9cqw] font-bold leading-[1.25]">{it}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto">
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
