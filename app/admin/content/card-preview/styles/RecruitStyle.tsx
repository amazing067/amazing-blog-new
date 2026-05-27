'use client';
// 리쿠르팅 전용 카드 스타일 v6 — 리디자인.
// 변경점(2026-05-26 스펙): ①무지개 폐기 → 세트 1스킴·역할별 쿨톤(블루·틸·크림+옐로)
//  ②가독성: 커버만 Black Han Sans, 본문 Pretendard·고대비·줄간격↑, 노이즈/워터마크 제거
//  ③듀오톤 사진(커버·통념·증거=1·3·5), 없으면 단색 fallback  ④비교·강점 꽉 채움(flex stretch)
//  ⑤1:1(1080) 기준 cqw  ⑥비교 칼럼 헤더 = 가운데 정렬·크게.
import {
  TrendingDown, AlertTriangle, Gift, Shield, Sparkles,
  Stethoscope, Calculator, Baby, ArrowRight, Search, ClipboardCheck, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CardSlide, CardIconKey, RecruitCompare, RecruitGridItem, RecruitImage, RecruitBenefit, RecruitCapstone } from '@/lib/content/types';
import { recruitScheme, roleForIndex, type RecruitToken } from '@/lib/content/recruit-color';

type Props = { slide: CardSlide; index: number; total: number; seed?: string };

const ICONS: Record<CardIconKey, LucideIcon> = {
  sparkles: Sparkles, shield: Shield, trendingDown: TrendingDown, alert: AlertTriangle,
  gift: Gift, stethoscope: Stethoscope, calculator: Calculator, baby: Baby,
  search: Search, clipboard: ClipboardCheck, zap: Zap, arrow: ArrowRight,
};

const DISPLAY = "'Black Han Sans', sans-serif";
const SANS = "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const MONO = 'var(--font-geist-mono), ui-monospace, monospace';
const ACCENT_YELLOW = '#FFD23D'; // 강점(benefits) 카드 전용 — grid 역할 악센트(블루)는 다크 타일 위 대비 약함
const containerStyle = { containerType: 'size' } as React.CSSProperties;
// break-keep = word-break:keep-all (상속) → 카드 전체 텍스트가 단어 중간에서 줄바뀜 안 됨(한글 음절 분리 방지).
const CARD = 'relative w-full h-full overflow-hidden rounded-2xl break-keep';

// 커버 제목 auto-fit (Black Han Sans) — 1:1 기준, 글자수↑ → 작게
function coverTitleStyle(text: string): React.CSSProperties {
  const len = (text || '').replace(/\s/g, '').length;
  const base = len <= 8 ? 13.5 : len <= 14 ? 11 : len <= 20 ? 9 : 7.6;
  return { fontFamily: DISPLAY, fontSize: `${base}cqw`, lineHeight: 1.1 };
}
// 본문 카드 제목 (Pretendard 800)
function bodyTitleStyle(text: string): React.CSSProperties {
  const len = (text || '').replace(/\s/g, '').length;
  const base = len <= 8 ? 10 : len <= 14 ? 9 : len <= 20 ? 8 : 6.9;
  return { fontFamily: SANS, fontWeight: 800, fontSize: `${base}cqw`, lineHeight: 1.18, letterSpacing: '-0.02em' };
}

// 듀오톤 사진 배경 (pre-bake된 듀오톤 JPG) + 하단 그라데이션(흰 텍스트 가독성).
function PhotoBg({ image }: { image: RecruitImage }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt="" className="absolute inset-0 w-full h-full object-cover z-0" />
      <div className="absolute inset-0 z-0" style={{ background: 'linear-gradient(180deg, rgba(6,16,45,0) 34%, rgba(6,16,45,.86) 100%)' }} />
    </>
  );
}

function IconBadge({ k, t, size }: { k: CardIconKey; t: RecruitToken; size: number }) {
  const Icon = ICONS[k] ?? Sparkles;
  return (
    <span className="inline-flex items-center justify-center rounded-full flex-none"
      style={{ width: `${size}cqw`, height: `${size}cqw`, background: t.accent }}>
      <Icon style={{ width: `${size * 0.54}cqw`, height: `${size * 0.54}cqw`, color: t.accentInk }} strokeWidth={2.6} />
    </span>
  );
}

function Sticker({ children, t }: { children: React.ReactNode; t: RecruitToken }) {
  return (
    <span style={{ fontFamily: DISPLAY, background: t.accent, color: t.accentInk, transform: 'rotate(-2.2deg)' }}
      className="inline-block rounded-[1.6cqw] px-[3.2cqw] py-[1.4cqw] leading-none">
      {children}
    </span>
  );
}

function StepDots({ index, total, ink }: { index: number; total: number; ink: string }) {
  return (
    <div className="flex items-center gap-[1.4cqw]">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className="rounded-full" style={{
          width: i === index ? '7cqw' : '2.4cqw', height: '2.4cqw',
          background: ink, opacity: i === index ? 1 : 0.32,
        }} />
      ))}
    </div>
  );
}

// Before/After 비교 — 두 칼럼 모두 꽉 찬 블록(일관). 헤더+항목을 한 묶음으로 상하 정중앙.
// 왼쪽(현재/직장인)=음소거 쿨그레이, 오른쪽(설계사)=브랜드 잉크. 헤더는 가운데·확대.
const COMPARE_BAD_BG = '#5B6B7A';
function CompareBlock({ c, t }: { c: RecruitCompare; t: RecruitToken }) {
  const col = (title: string, items: string[], good: boolean) => {
    const fg = good ? t.bg : '#ffffff';
    return (
      <div className="flex-1 rounded-[2.8cqw] px-[3.4cqw] py-[3.8cqw] min-w-0 flex flex-col justify-center"
        style={{ background: good ? t.ink : COMPARE_BAD_BG }}>
        <div style={{ fontFamily: DISPLAY, color: fg, borderBottom: `0.4cqw solid ${good ? t.bg : 'rgba(255,255,255,.55)'}` }}
          className="text-center text-[6cqw] leading-none pb-[2.6cqw] mb-[3.6cqw]">{title}</div>
        <ul className="flex flex-col gap-[2.8cqw]">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-[1.8cqw] text-[3.4cqw] font-semibold leading-[1.3]"
              style={{ fontFamily: SANS, color: fg, opacity: good ? 1 : 0.92 }}>
              <span className="flex-none" style={{ color: good ? t.accent : 'rgba(255,255,255,.72)' }}>{good ? '✓' : '✕'}</span>
              <span className="break-keep">{it}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <div className="flex-1 min-h-0 mt-[3.5%] flex gap-[3cqw] items-stretch">
      {col(c.aTitle, c.aItems, false)}
      {col(c.bTitle, c.bItems, true)}
    </div>
  );
}

// 강점 그리드 2x2 — 사물 아이콘 폐기, 번호형(01~04) 에디토리얼. 셀이 높이만큼 stretch(꽉 참).
function GridBlock({ items, t }: { items: RecruitGridItem[]; t: RecruitToken }) {
  return (
    <div className="flex-1 min-h-0 mt-[3%] grid grid-cols-2 grid-rows-2 gap-[2.8cqw]">
      {items.slice(0, 4).map((g, i) => (
        <div key={i} className="rounded-[2.4cqw] p-[3.8cqw] flex flex-col justify-center gap-[2.6cqw] min-w-0" style={{ background: t.ink }}>
          <div className="flex flex-col gap-[1.8cqw] flex-none">
            <span style={{ fontFamily: MONO, color: t.accent, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
              className="text-[10cqw] leading-none">{String(i + 1).padStart(2, '0')}</span>
            <span className="block rounded-full" style={{ width: '7cqw', height: '0.8cqw', background: t.accent }} />
          </div>
          <span style={{ fontFamily: SANS, color: t.bg }} className="text-[4cqw] font-extrabold leading-[1.2] break-keep">{g.label}</span>
        </div>
      ))}
    </div>
  );
}

// 강점 카드(혜택 중심) — 다크 타일 3개(혜택 헤드라인+설명) + 옐로 캡스톤 띠(자체개발·연동).
// exp/capstone.text는 whitespace-pre-line으로 '\n' 수동 줄바꿈 렌더(단어 중간 줄바꿈은 break-keep로 차단).
function BenefitBlock({ benefits, capstone, t }: { benefits: RecruitBenefit[]; capstone?: RecruitCapstone; t: RecruitToken }) {
  return (
    <>
      <div className="flex-1 min-h-0 mt-[3%] flex flex-col gap-[2.4cqw]">
        {benefits.slice(0, 3).map((b, i) => (
          <div key={i} className="flex-1 min-h-0 overflow-hidden rounded-[2.6cqw] px-[4cqw] py-[2.4cqw] flex flex-col justify-center gap-[1.1cqw]" style={{ background: t.ink }}>
            <span style={{ fontFamily: SANS, color: ACCENT_YELLOW }} className="text-[4.6cqw] font-extrabold leading-[1.1] break-keep">{b.head}</span>
            <span style={{ fontFamily: SANS, color: t.bg }} className="text-[3.05cqw] font-semibold leading-[1.28] break-keep whitespace-pre-line opacity-95">{b.exp}</span>
          </div>
        ))}
      </div>
      {capstone && (
        <div className="flex-none mt-[2.6cqw] rounded-[2.6cqw] px-[3.6cqw] py-[2.6cqw] flex items-center gap-[2.6cqw]" style={{ background: ACCENT_YELLOW }}>
          <span style={{ fontFamily: MONO, background: t.ink, color: ACCENT_YELLOW }} className="flex-none text-[3cqw] font-bold rounded-[1.2cqw] px-[2cqw] py-[1cqw] whitespace-nowrap">{capstone.chip}</span>
          <span style={{ fontFamily: SANS, color: t.ink }} className="text-[3.3cqw] font-extrabold leading-[1.22] break-keep whitespace-pre-line">{capstone.text}</span>
        </div>
      )}
    </>
  );
}

export function RecruitCardStyle({ slide, index, total, seed = '' }: Props) {
  const scheme = recruitScheme(seed);
  const role = roleForIndex(index);
  const t = scheme.roles[role];

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

  // ---------- COVER ----------
  if (slide.kind === 'cover') {
    const hasPhoto = t.isPhoto && !!slide.image;
    if (hasPhoto && slide.image) {
      return (
        <div style={{ ...containerStyle, background: t.tint }} className={CARD}>
          <PhotoBg image={slide.image} />
          <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]" style={{ color: t.ink }}>
            {TopRow}
            <div className="flex-1 min-h-0" />
            <div className="flex-none">
              <h2 style={coverTitleStyle(slide.title)} className="tracking-tight break-keep">{slide.title.replace(/\n/g, ' ')}</h2>
              <div className="mt-[4%] flex items-center gap-[3cqw]">
                <div className="text-[6cqw]"><Sticker t={t}>{slide.bigStat}</Sticker></div>
                <span style={{ fontFamily: MONO, color: t.sub }} className="text-[2.8cqw] tracking-[.1em]">{slide.bigStatLabel}</span>
              </div>
              <div className="mt-[4.5%] flex items-center justify-between">
                <StepDots index={index} total={total} ink={t.ink} />
                <div style={{ fontFamily: DISPLAY }} className="text-[4.4cqw] leading-none">SWIPE →</div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    // 단색 fallback 커버 (사진 없음)
    return (
      <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
        <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]">
          {TopRow}
          <div className="flex-1 min-h-0 flex flex-col justify-center">
            <div className="mb-[5%]"><IconBadge k={slide.iconKey} t={t} size={17} /></div>
            <h2 style={coverTitleStyle(slide.title)} className="tracking-tight break-keep">{slide.title.replace(/\n/g, ' ')}</h2>
            <div className="mt-[6%]">
              <div className="text-[7cqw]"><Sticker t={t}>{slide.bigStat}</Sticker></div>
              <div style={{ fontFamily: MONO, color: t.sub }} className="mt-[3cqw] text-[2.9cqw] tracking-[.1em]">{slide.bigStatLabel}</div>
            </div>
          </div>
          <div className="flex-none flex items-center justify-between">
            <StepDots index={index} total={total} ink={t.ink} />
            <div style={{ fontFamily: DISPLAY }} className="text-[4.4cqw] leading-none">SWIPE →</div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- POINT ----------
  if (slide.kind === 'point') {
    const layout = slide.layout ?? 'default';
    const showCompare = layout === 'compare' && !!slide.compare;
    const showGrid = layout === 'grid' && !!slide.gridItems;
    const showBenefits = layout === 'benefits' && !!slide.benefits;

    if (showBenefits && slide.benefits) {
      return (
        <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
          <div className="relative z-10 h-full flex flex-col px-[7%] py-[6.4%]">
            {TopRow}
            <h3 style={{ fontFamily: SANS, fontWeight: 800, fontSize: '6.2cqw', lineHeight: 1.12, letterSpacing: '-0.02em' }}
              className="break-keep flex-none mt-[2.4%]">{slide.title.replace(/\n/g, ' ')}</h3>
            <BenefitBlock benefits={slide.benefits} capstone={slide.capstone} t={t} />
            <div className="flex-none pt-[2.8%]"><StepDots index={index} total={total} ink={t.ink} /></div>
          </div>
        </div>
      );
    }
    if (showCompare && slide.compare) {
      return (
        <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
          <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]">
            {TopRow}
            <h3 style={bodyTitleStyle(slide.title)} className="tracking-tight break-keep flex-none mt-[3%]">{slide.title.replace(/\n/g, ' ')}</h3>
            <CompareBlock c={slide.compare} t={t} />
            <div className="flex-none pt-[3.5%]"><StepDots index={index} total={total} ink={t.ink} /></div>
          </div>
        </div>
      );
    }
    if (showGrid && slide.gridItems) {
      return (
        <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
          <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]">
            {TopRow}
            <h3 style={bodyTitleStyle(slide.title)} className="tracking-tight break-keep flex-none mt-[3%]">{slide.title.replace(/\n/g, ' ')}</h3>
            <GridBlock items={slide.gridItems} t={t} />
            <div className="flex-none pt-[3.5%]"><StepDots index={index} total={total} ink={t.ink} /></div>
          </div>
        </div>
      );
    }

    // default point — 듀오톤 사진(통념·증거) 또는 단색 fallback
    const hasPhoto = t.isPhoto && !!slide.image;
    return (
      <div style={{ ...containerStyle, background: hasPhoto ? t.tint : t.bg, color: t.ink }} className={CARD}>
        {hasPhoto && slide.image && <PhotoBg image={slide.image} />}
        <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]">
          {TopRow}
          <div className="flex-1 min-h-0 flex flex-col justify-end gap-[3cqw]">
            {!hasPhoto && <IconBadge k={slide.iconKey} t={t} size={13} />}
            <h3 style={bodyTitleStyle(slide.title)} className="tracking-tight break-keep">{slide.title.replace(/\n/g, ' ')}</h3>
            {slide.body && <p style={{ fontFamily: SANS, color: t.ink }} className="text-[3.8cqw] font-medium leading-[1.5] max-w-[94%] text-balance">{slide.body}</p>}
            <div><Sticker t={t}>{slide.bigStat}</Sticker></div>
          </div>
          <div className="flex-none pt-[3.5%]"><StepDots index={index} total={total} ink={t.ink} /></div>
        </div>
      </div>
    );
  }

  // ---------- CLOSING ----------
  return (
    <div style={{ ...containerStyle, background: t.bg, color: t.ink }} className={CARD}>
      <div className="relative z-10 h-full flex flex-col px-[7%] py-[7%]">
        {TopRow}
        <div className="flex-1 min-h-0 flex flex-col justify-center">
          <h3 style={{ fontFamily: DISPLAY, fontSize: '9.5cqw', lineHeight: 1.1 }} className="tracking-tight break-keep flex-none">{slide.title.replace(/\n/g, ' ')}</h3>
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
          <div style={{ fontFamily: SANS, color: t.ink, borderColor: t.ink }} className="pt-[3.5%] border-t text-[2.9cqw] leading-[1.5] opacity-90">
            <span style={{ background: t.accent, color: t.accentInk }} className="px-[1.6cqw] py-[0.6cqw] rounded-[1cqw] font-bold">📤 공유</span>
            <span className="ml-[2cqw]">{slide.footer}</span>
          </div>
          <div className="mt-[3.5%]"><StepDots index={index} total={total} ink={t.ink} /></div>
        </div>
      </div>
    </div>
  );
}
