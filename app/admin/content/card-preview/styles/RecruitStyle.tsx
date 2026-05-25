'use client';
// 리쿠르팅 전용 카드 스타일 — 보험 카드(A~F)와 완전히 다른 트렌디 룩.
// 플레이북 HTML 매칭: 근-블랙 배경 + 일렉트릭 라임 액센트 + Black Han Sans 포스터 타이포 + 모노 라벨.
// 기존 스타일과 동일하게 containerType:size + cqw 기반 → 90px 썸네일·미리보기·1080 PNG 모두 정확히 스케일.
import type { CardSlide } from '@/lib/content/types';

type Props = { slide: CardSlide; index: number; total: number };

const containerStyle = { containerType: 'size' } as React.CSSProperties;
const CARD = 'relative w-full h-full overflow-hidden rounded-2xl bg-[#0b0b09] text-[#f4f3ea]';
const DISPLAY = "'Black Han Sans', sans-serif";
const MONO = 'var(--font-geist-mono), ui-monospace, monospace';
const SANS = "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const LIME = '#ccff00';
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function Deco() {
  return (
    <>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(115% 80% at 82% -12%, ${LIME}26, transparent 56%)` }} />
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.06, backgroundImage: GRAIN }} />
      {/* 좌하단 라임 코너 라인 */}
      <div className="absolute left-[6%] bottom-[6%] w-[10%] h-[0.5cqw] pointer-events-none" style={{ background: LIME }} />
    </>
  );
}

function PageBadge({ index, total }: { index: number; total: number }) {
  return (
    <div style={{ fontFamily: MONO }} className="absolute top-[6%] right-[6.5%] text-[2.8cqw] tracking-[.2em] text-[#8f8d80] z-10">
      {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
    </div>
  );
}

export function RecruitCardStyle({ slide, index, total }: Props) {
  if (slide.kind === 'cover') {
    return (
      <div style={containerStyle} className={CARD}>
        <Deco /><PageBadge index={index} total={total} />
        <div className="relative h-full flex flex-col px-[7%] py-[7.5%]">
          <div style={{ fontFamily: MONO }} className="text-[3cqw] tracking-[.2em] uppercase" >
            <span style={{ color: LIME }}>▍</span> <span className="text-[#bdbbb0]">{slide.eyebrow || 'RECRUIT'}</span>
          </div>
          <h2 style={{ fontFamily: DISPLAY }} className="mt-[6%] text-[11.5cqw] leading-[0.98] tracking-tight break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h2>
          <div className="mt-auto">
            <div style={{ fontFamily: DISPLAY, color: '#0b0b09', background: LIME, boxShadow: `0 0 9cqw ${LIME}55` }}
              className="inline-block rounded-[2cqw] px-[4cqw] py-[1.8cqw] text-[6.4cqw] leading-none">
              {slide.bigStat}
            </div>
            <div style={{ fontFamily: MONO }} className="mt-[2.6cqw] text-[2.9cqw] tracking-[.12em] text-[#8f8d80]">
              {slide.bigStatLabel}
            </div>
          </div>
        </div>
        <div style={{ fontFamily: MONO, color: LIME }} className="absolute bottom-[6%] right-[6.5%] text-[2.9cqw] tracking-[.1em]">SWIPE →</div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div style={containerStyle} className={CARD}>
        <Deco /><PageBadge index={index} total={total} />
        <div className="relative h-full flex flex-col px-[7%] py-[7.5%]">
          <div className="flex items-center gap-[3cqw]">
            <span style={{ fontFamily: DISPLAY, color: LIME }} className="text-[13cqw] leading-[0.8]">{slide.number}</span>
            <span style={{ fontFamily: MONO }} className="text-[3cqw] tracking-[.22em] uppercase text-[#8f8d80] pt-[2cqw]">POINT</span>
          </div>
          <h3 style={{ fontFamily: DISPLAY }} className="mt-[5%] text-[9.2cqw] leading-[1.04] tracking-tight break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h3>
          <p style={{ fontFamily: SANS }} className="mt-[4%] text-[3.7cqw] leading-[1.55] text-[#b9b6a8] max-w-[94%]">
            {slide.body}
          </p>
          <div className="mt-auto flex items-center gap-[3cqw] overflow-hidden">
            <span style={{ fontFamily: DISPLAY, color: '#0b0b09', background: LIME }}
              className="inline-block flex-none rounded-[1.5cqw] px-[3.2cqw] py-[1.4cqw] text-[4.4cqw] leading-none">
              {slide.bigStat}
            </span>
            <span style={{ fontFamily: MONO }} className="text-[2.8cqw] tracking-[.1em] text-[#8f8d80] truncate">{slide.bigStatLabel}</span>
          </div>
        </div>
      </div>
    );
  }

  // closing — 최종 CTA
  return (
    <div style={containerStyle} className={CARD}>
      <Deco /><PageBadge index={index} total={total} />
      <div className="relative h-full flex flex-col px-[7%] py-[7.5%]">
        <div style={{ fontFamily: MONO }} className="text-[3cqw] tracking-[.2em] uppercase" >
          <span style={{ color: LIME }}>▍</span> <span className="text-[#bdbbb0]">LAST · 지금 바로</span>
        </div>
        <h3 style={{ fontFamily: DISPLAY }} className="mt-[5%] text-[8.4cqw] leading-[1.05] tracking-tight break-keep">
          {slide.title.replace(/\n/g, ' ')}
        </h3>
        <ul className="mt-[6%] space-y-[3.2cqw]">
          {slide.items.map((it, i) => (
            <li key={i} className="flex items-start gap-[2.5cqw]">
              <span style={{ fontFamily: DISPLAY, color: LIME }} className="text-[4.6cqw] leading-[1.1] flex-none">›</span>
              <span style={{ fontFamily: SANS }} className="text-[3.9cqw] font-bold leading-[1.3]">{it}</span>
            </li>
          ))}
        </ul>
        <div style={{ fontFamily: MONO, color: LIME, borderColor: `${LIME}40` }}
          className="mt-auto pt-[4%] border-t text-[2.9cqw] leading-[1.55]">
          {slide.footer}
        </div>
      </div>
    </div>
  );
}
