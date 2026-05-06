'use client';
// E · Data Report — 통계청/금감원 리포트 무드 (베이지 + 차트 + 표)
import type { CardSlide } from '@/lib/content/types';
import { SourceLine } from './_SourceLine';
import { bigStatFontStyle } from './_bigStat';

type Props = { slide: CardSlide; index: number; total: number };

const containerStyle = { containerType: 'size' } as React.CSSProperties;
const CARD_BASE = 'relative w-full h-full bg-stone-100 text-neutral-900 rounded-2xl overflow-hidden shadow-xl';

// 표지의 막대그래프 — 시계열 누적 느낌으로 4개
const COVER_BARS = [20, 40, 60, 78];

function Header({ left, index, total }: { left: string; index: number; total: number }) {
  return (
    <div className="absolute top-0 left-0 right-0 h-[7%] bg-neutral-900 text-white flex items-center px-[5%] text-[2.4cqw] font-bold tracking-[.2em] uppercase justify-between z-10">
      <span>{left}</span>
      <span>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
    </div>
  );
}

const FooterBar = () => <div className="absolute bottom-0 left-0 right-0 h-[3%] bg-emerald-600" />;

function Bar({ pct, hl, label }: { pct: number; hl?: boolean; label?: string }) {
  return (
    <div
      className={`flex-1 ${hl ? 'bg-emerald-600' : 'bg-neutral-400'} rounded-t-sm flex flex-col items-center justify-end pb-[2%] text-white text-[2.2cqw] font-bold`}
      style={{ height: `${pct}%` }}
    >
      {label}
    </div>
  );
}

export function DataReportStyle({ slide, index, total }: Props) {
  if (slide.kind === 'cover') {
    return (
      <div style={containerStyle} className={CARD_BASE}>
        <Header left="PRIME ASSET REPORT" index={index} total={total} />
        <div className="absolute top-[9%] left-[5%] right-[5%] bottom-[5%] flex flex-col">
          <div className="text-[2.4cqw] font-bold text-emerald-700 tracking-[.2em] uppercase">▎ {slide.eyebrow}</div>
          <h2 className="mt-[3%] text-[7.8cqw] font-black leading-[1.15] tracking-tight whitespace-normal break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h2>
          <div className="mt-[5%] h-[35%] bg-white rounded p-[4%] border border-stone-300 flex items-end gap-[3.5%]">
            {COVER_BARS.map((p, i) => (
              <Bar key={i} pct={p} hl={i === COVER_BARS.length - 1} label={`${p === 78 ? '37%' : `${Math.round(p / 2)}%`}`} />
            ))}
          </div>
          <div className="mt-auto flex items-baseline justify-between gap-[3cqw] pt-[3%] border-t-2 border-neutral-900 overflow-hidden">
            <div className="flex-1 min-w-0">
              <div className="text-[2.4cqw] font-bold uppercase tracking-[.15em] text-neutral-600 break-keep">{slide.bigStatLabel}</div>
              <div
                style={bigStatFontStyle(slide.bigStat, { max: 13, divisor: 52 })}
                className="font-black text-emerald-600 leading-none break-keep"
              >
                {slide.bigStat}
              </div>
            </div>
            <SourceLine source={slide.source} className="text-[2cqw] italic text-neutral-500 self-end max-w-[45%] text-right flex-none" />
          </div>
        </div>
        <FooterBar />
      </div>
    );
  }

  if (slide.kind === 'point') {
    // bigStat이 개념어로 바뀐 정책에 따라 도넛은 시각 데코로만 사용 (절반 채움 고정).
    const angle = 180;
    return (
      <div style={containerStyle} className={CARD_BASE}>
        <Header left={`Figure ${slide.number}`} index={index} total={total} />
        <div className="absolute top-[9%] left-[5%] right-[5%] bottom-[5%] flex flex-col">
          <div className="text-[2.4cqw] font-bold text-emerald-700 tracking-[.2em] uppercase">▎ Key Indicator</div>
          <h3 className="mt-[3%] text-[6.8cqw] font-black leading-[1.2] tracking-tight whitespace-normal break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h3>
          <div className="mt-[5%] flex gap-[5%] items-center bg-white rounded p-[5%] border border-stone-300 overflow-hidden">
            <div
              className="w-[28%] aspect-square rounded-full relative flex-none"
              style={{ background: `conic-gradient(#16a34a 0deg ${angle}deg, #d4d4d8 ${angle}deg 360deg)` }}
            >
              <div className="absolute inset-[18%] bg-white rounded-full" />
              <div
                className="absolute inset-[18%] flex items-center justify-center font-black text-emerald-600 break-keep text-center px-[8%]"
                style={bigStatFontStyle(slide.bigStat, { max: 5, divisor: 22, min: 2.5 })}
              >
                {slide.bigStat}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div
                style={bigStatFontStyle(slide.bigStat, { max: 12, divisor: 50 })}
                className="font-black text-emerald-600 leading-none break-keep"
              >
                {slide.bigStat}
              </div>
              <div className="text-[2.6cqw] font-bold uppercase tracking-[.15em] text-neutral-600 mt-[1cqw] break-keep">{slide.bigStatLabel}</div>
            </div>
          </div>
          <p className="mt-[4%] text-[3.4cqw] leading-[1.55] text-neutral-700">{slide.body}</p>
          <SourceLine source={slide.source} className="mt-auto pt-[2%] text-[2.2cqw] italic text-neutral-500" />
        </div>
        <FooterBar />
      </div>
    );
  }

  // closing — 표 형태
  return (
    <div style={containerStyle} className={CARD_BASE}>
      <Header left="Summary Table" index={index} total={total} />
      <div className="absolute top-[9%] left-[5%] right-[5%] bottom-[5%] flex flex-col">
        <div className="text-[2.4cqw] font-bold text-emerald-700 tracking-[.2em] uppercase">▎ Key Findings</div>
        <h3 className="mt-[3%] text-[6cqw] font-black leading-[1.2]">
          {slide.title.replace(/\n/g, ' ')}
        </h3>
        <div className="mt-[5%] bg-white border border-stone-300 rounded overflow-hidden">
          <div className="grid grid-cols-[8%_1fr_24%] bg-neutral-900 text-white text-[2.4cqw] font-extrabold tracking-[.12em] uppercase">
            <div className="px-[3%] py-[2.4%]">#</div>
            <div className="px-[3%] py-[2.4%]">항목</div>
            <div className="px-[3%] py-[2.4%] text-right">결과</div>
          </div>
          {slide.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[8%_1fr_24%] border-b border-stone-200 last:border-b-0 text-[3.2cqw] font-semibold">
              <div className="px-[3%] py-[2.4%]">{i + 1}</div>
              <div className="px-[3%] py-[2.4%]">{it}</div>
              <div className="px-[3%] py-[2.4%] text-right text-emerald-600 font-extrabold">●</div>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-[2%] text-[2.2cqw] italic text-neutral-500">{slide.footer}</div>
      </div>
      <FooterBar />
    </div>
  );
}
