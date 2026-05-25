'use client';
// 리쿠르팅 전용 카드 스타일 v2 — 보험 카드(A~F)와 완전히 다른, 밝고 그래픽 강한 트렌디 룩.
// 피드백 반영: ① 너무 어두움 → 카드마다 비비드 컬러 변주 ② 변별력·후킹 약함 → 색 변주 + 그래픽
// ③ 그림 없음 → 아이콘 배지 + 거대 배경 번호 + 하프톤 도트 + 데코 링 + 회전 스티커.
// 색은 슬라이드 index 기반으로 변주(7장이 전부 다른 색). containerType:size + cqw 로 썸네일·미리보기·1080 PNG 모두 정확히 스케일.
import {
  TrendingDown, AlertTriangle, Gift, Shield, Sparkles,
  Stethoscope, Calculator, Baby, ArrowRight, Search, ClipboardCheck, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CardSlide, CardIconKey } from '@/lib/content/types';

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
// 비비드 팔레트 — 슬라이드별 변주 (어둡지 않게, 고채도 포스터 컬러)
const PALETTE: Theme[] = [
  { bg: '#FFD23D', ink: '#1a1206', sub: 'rgba(26,18,6,.66)',  pop: '#FF3D7F', chipBg: '#1a1206', chipInk: '#FFD23D' }, // 0 노랑
  { bg: '#FF5A4D', ink: '#ffffff', sub: 'rgba(255,255,255,.85)', pop: '#FFE34D', chipBg: '#ffffff', chipInk: '#FF5A4D' }, // 1 코랄
  { bg: '#2D6BFF', ink: '#ffffff', sub: 'rgba(255,255,255,.85)', pop: '#C6F000', chipBg: '#C6F000', chipInk: '#11224d' }, // 2 블루
  { bg: '#C6F000', ink: '#0b0b09', sub: 'rgba(11,11,9,.62)',  pop: '#FF3D7F', chipBg: '#0b0b09', chipInk: '#C6F000' }, // 3 라임
  { bg: '#9B5CFF', ink: '#ffffff', sub: 'rgba(255,255,255,.86)', pop: '#FFD23D', chipBg: '#FFD23D', chipInk: '#2a0a5c' }, // 4 바이올렛
  { bg: '#FF7A1A', ink: '#1a0a02', sub: 'rgba(26,10,2,.62)',  pop: '#ffffff', chipBg: '#1a0a02', chipInk: '#FF7A1A' }, // 5 오렌지
  { bg: '#FF3D7F', ink: '#ffffff', sub: 'rgba(255,255,255,.86)', pop: '#FFE34D', chipBg: '#ffffff', chipInk: '#FF3D7F' }, // 6 핫핑크(CTA)
];
const theme = (i: number): Theme => PALETTE[i % PALETTE.length];

const CARD = 'relative w-full h-full overflow-hidden rounded-2xl';

function Deco({ t }: { t: Theme }) {
  return (
    <>
      {/* 데코 링 — 큰 외곽선 원 */}
      <div className="absolute -top-[14%] -right-[12%] w-[52%] aspect-square rounded-full pointer-events-none"
        style={{ border: `1.4cqw solid ${t.ink}`, opacity: 0.1 }} />
      {/* 하프톤 도트 — 좌하단 그래픽 */}
      <div className="absolute -bottom-[3%] -left-[3%] w-[40%] h-[26%] pointer-events-none"
        style={{ backgroundImage: `radial-gradient(${t.pop} 26%, transparent 27%)`, backgroundSize: '4.2cqw 4.2cqw', opacity: 0.85 }} />
      {/* 그레인 */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: 'multiply',
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
    </>
  );
}

function IconBadge({ k, t, size = 13 }: { k: CardIconKey; t: Theme; size?: number }) {
  const Icon = ICONS[k] ?? Sparkles;
  return (
    <div className="inline-flex items-center justify-center rounded-full flex-none"
      style={{ width: `${size}cqw`, height: `${size}cqw`, background: t.ink }}>
      <Icon style={{ width: `${size * 0.52}cqw`, height: `${size * 0.52}cqw`, color: t.bg }} strokeWidth={2.6} />
    </div>
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

function PageBadge({ index, total, t }: { index: number; total: number; t: Theme }) {
  return (
    <div style={{ fontFamily: MONO, color: t.ink, opacity: 0.7 }} className="absolute top-[6%] right-[6.5%] text-[2.8cqw] tracking-[.2em] z-20">
      {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
    </div>
  );
}

export function RecruitCardStyle({ slide, index, total }: Props) {
  const t = theme(index);

  if (slide.kind === 'cover') {
    return (
      <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
        <Deco t={t} />
        <PageBadge index={index} total={total} t={t} />
        <div className="relative z-10 h-full flex flex-col px-[7%] py-[7.5%]">
          <div className="flex items-center gap-[3cqw]">
            <IconBadge k={slide.iconKey} t={t} size={13} />
            <span style={{ fontFamily: MONO, color: t.sub }} className="text-[3cqw] tracking-[.16em] uppercase">{slide.eyebrow || 'RECRUIT'}</span>
          </div>
          <h2 style={{ fontFamily: DISPLAY }} className="mt-[6%] text-[11.5cqw] leading-[0.98] tracking-tight break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h2>
          <div className="mt-auto flex items-end justify-between gap-[3cqw]">
            <div>
              <div className="text-[7cqw]"><Sticker t={t}>{slide.bigStat}</Sticker></div>
              <div style={{ fontFamily: MONO, color: t.sub }} className="mt-[3cqw] text-[2.9cqw] tracking-[.1em]">{slide.bigStatLabel}</div>
            </div>
            <div style={{ fontFamily: DISPLAY, color: t.ink }} className="text-[4.6cqw] leading-none pb-[1cqw]">SWIPE →</div>
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
        <Deco t={t} />
        <PageBadge index={index} total={total} t={t} />
        {/* 거대 배경 번호 그래픽 */}
        <div style={{ fontFamily: DISPLAY, color: t.ink, opacity: 0.12 }}
          className="absolute -bottom-[6%] -right-[1%] text-[46cqw] leading-none z-0 pointer-events-none">
          {slide.number}
        </div>
        <div className="relative z-10 h-full flex flex-col px-[7%] py-[7.5%]">
          <div className="flex items-center gap-[3cqw]">
            <IconBadge k={slide.iconKey} t={t} size={11} />
            <span style={{ fontFamily: MONO, color: t.sub }} className="text-[3cqw] tracking-[.2em] uppercase">POINT {slide.number}</span>
          </div>
          <h3 style={{ fontFamily: DISPLAY }} className="mt-[5%] text-[9cqw] leading-[1.04] tracking-tight break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h3>
          <p style={{ fontFamily: SANS, color: t.sub }} className="mt-[4%] text-[3.7cqw] font-medium leading-[1.55] max-w-[92%]">
            {slide.body}
          </p>
          <div className="mt-auto flex items-center gap-[3cqw] overflow-hidden">
            <div className="text-[4.8cqw] flex-none"><Sticker t={t}>{slide.bigStat}</Sticker></div>
            <span style={{ fontFamily: MONO, color: t.sub }} className="text-[2.8cqw] tracking-[.08em] truncate">{slide.bigStatLabel}</span>
          </div>
        </div>
      </div>
    );
  }

  // closing — 최종 CTA
  return (
    <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
      <Deco t={t} />
      <PageBadge index={index} total={total} t={t} />
      <div className="relative z-10 h-full flex flex-col px-[7%] py-[7.5%]">
        <div className="flex items-center gap-[3cqw]">
          <IconBadge k={slide.iconKey} t={t} size={12} />
          <span style={{ fontFamily: MONO, color: t.sub }} className="text-[3cqw] tracking-[.18em] uppercase">LAST · 지금 바로</span>
        </div>
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
        <div style={{ fontFamily: MONO, color: t.ink, borderColor: t.ink }}
          className="mt-auto pt-[4%] border-t text-[2.9cqw] leading-[1.55]" >
          <span style={{ background: t.chipBg, color: t.chipInk }} className="px-[1.5cqw] py-[0.5cqw] rounded-[1cqw]">📤 공유</span>
          <span className="ml-[2cqw]">{slide.footer}</span>
        </div>
      </div>
    </div>
  );
}
