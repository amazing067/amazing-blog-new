'use client';
// D · Dark Premium — 검정 + 골드 + 시리프 (자산관리 고급감)
import type { CardSlide } from '@/lib/content/types';
import { SourceLine } from './_SourceLine';
import { bigStatFontStyle } from './_bigStat';

type Props = { slide: CardSlide; index: number; total: number };

const containerStyle = { containerType: 'size' } as React.CSSProperties;
const CARD_BASE = 'relative w-full h-full bg-gradient-to-br from-neutral-950 to-stone-900 text-stone-50 rounded-2xl overflow-hidden shadow-xl';
const SERIF = "'Times New Roman', 'Noto Serif KR', serif";
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function Frame() {
  return <div className="absolute inset-[5%] border border-amber-300/40 pointer-events-none" />;
}

function PageBadge({ index }: { index: number }) {
  return (
    <div style={{ fontFamily: SERIF }} className="absolute top-[7%] right-[8%] text-[2.6cqw] font-bold tracking-[.25em] text-amber-300 z-10">
      — {ROMAN[index] ?? index + 1} —
    </div>
  );
}

function Signature() {
  return (
    <div style={{ fontFamily: SERIF }} className="absolute bottom-[6%] right-[8%] italic text-[2.6cqw] text-amber-300/80">
      — PRIME ASSET
    </div>
  );
}

export function DarkPremiumStyle({ slide, index }: Props) {
  if (slide.kind === 'cover') {
    return (
      <div style={containerStyle} className={CARD_BASE}>
        <Frame /><PageBadge index={index} />
        <div className="relative h-full flex flex-col px-[9%] py-[9%]">
          <div style={{ fontFamily: SERIF }} className="italic text-[3.4cqw] text-amber-300 tracking-[.1em]">{slide.eyebrow}</div>
          <div className="w-[14%] h-[1px] bg-amber-300 my-[4%]" />
          <h2 style={{ fontFamily: SERIF }} className="text-[9.5cqw] font-bold leading-[1.1] tracking-tight whitespace-normal break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h2>
          <div className="mt-auto pt-[5%] border-t border-amber-300/30 overflow-hidden">
            <div
              style={{ fontFamily: SERIF, ...bigStatFontStyle(slide.bigStat, { max: 16, divisor: 60 }) }}
              className="text-amber-300 font-bold leading-none break-keep"
            >
              {slide.bigStat}
            </div>
            <div className="text-[2.6cqw] tracking-[.15em] uppercase opacity-70 mt-[1.5cqw] break-keep">{slide.bigStatLabel}</div>
            <SourceLine source={slide.source} className="mt-[1.5cqw] text-[2.2cqw] italic text-amber-300/70" />
          </div>
        </div>
        <Signature />
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div style={containerStyle} className={CARD_BASE}>
        <Frame /><PageBadge index={index} />
        <div className="relative h-full flex flex-col px-[9%] py-[9%]">
          <div style={{ fontFamily: SERIF }} className="italic text-[3.4cqw] text-amber-300 tracking-[.1em]">Chapter {slide.number}</div>
          <div className="w-[14%] h-[1px] bg-amber-300 my-[4%]" />
          <h3 style={{ fontFamily: SERIF }} className="text-[8cqw] font-bold leading-[1.15] tracking-tight whitespace-normal break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h3>
          <p className="mt-[4%] text-[3.4cqw] leading-[1.55] opacity-80 max-w-[85%]">{slide.body}</p>
          <div className="mt-auto pt-[5%] border-t border-amber-300/30 overflow-hidden">
            <div
              style={{ fontFamily: SERIF, ...bigStatFontStyle(slide.bigStat, { max: 13, divisor: 52 }) }}
              className="text-amber-300 font-bold leading-none break-keep"
            >
              {slide.bigStat}
            </div>
            <div className="text-[2.6cqw] tracking-[.15em] uppercase opacity-70 mt-[1.5cqw] break-keep">{slide.bigStatLabel}</div>
            <SourceLine source={slide.source} className="mt-[1.5cqw] text-[2.2cqw] italic text-amber-300/70" />
          </div>
        </div>
      </div>
    );
  }

  // closing
  return (
    <div style={containerStyle} className={CARD_BASE}>
      <Frame /><PageBadge index={index} />
      <div className="relative h-full flex flex-col px-[9%] py-[9%]">
        <div style={{ fontFamily: SERIF }} className="italic text-[3.4cqw] text-amber-300 tracking-[.1em]">— Conclusion —</div>
        <div className="w-[14%] h-[1px] bg-amber-300 my-[4%]" />
        <h3 style={{ fontFamily: SERIF }} className="text-[6.5cqw] font-bold leading-[1.2] whitespace-normal break-keep">
          {slide.title.replace(/\n/g, ' ')}
        </h3>
        <ul className="mt-[5%] space-y-0">
          {slide.items.map((it, i) => (
            <li key={i} className="flex gap-[3cqw] py-[3.2%] border-b border-amber-300/20 last:border-b-0">
              <span style={{ fontFamily: SERIF }} className="italic text-[4.5cqw] text-amber-300 leading-none flex-none min-w-[8%]">
                {ROMAN[i] ?? `${i + 1}`}.
              </span>
              <span style={{ fontFamily: SERIF }} className="text-[3.4cqw] font-medium leading-[1.4]">{it}</span>
            </li>
          ))}
        </ul>
      </div>
      <Signature />
    </div>
  );
}
