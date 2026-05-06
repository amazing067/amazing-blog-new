'use client';
// B · Magazine — 매거진 에디토리얼 (흰 배경 + 시리프 헤딩 + 빨강 액센트)
import type { CardSlide } from '@/lib/content/types';
import { SourceLine } from './_SourceLine';
import { bigStatFontStyle } from './_bigStat';

type Props = { slide: CardSlide; index: number; total: number };

const containerStyle = { containerType: 'size' } as React.CSSProperties;
const CARD_BASE = 'relative w-full h-full bg-stone-50 text-neutral-950 rounded-2xl overflow-hidden shadow-xl';
const SERIF = "'Times New Roman', 'Noto Serif KR', serif";

function PageBadge({ index, total }: { index: number; total: number }) {
  return (
    <div className="absolute top-[4.5%] right-[5%] text-[2.6cqw] font-extrabold tracking-[.15em] text-neutral-500">
      No. {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
    </div>
  );
}

const TopBar = () => <div className="absolute top-0 left-[5%] right-[5%] h-[3px] bg-neutral-950" />;

export function MagazineStyle({ slide, index, total }: Props) {
  if (slide.kind === 'cover') {
    return (
      <div style={containerStyle} className={CARD_BASE}>
        <TopBar /><PageBadge index={index} total={total} />
        <div className="relative h-full flex flex-col px-[5%] py-[5%] pt-[9%]">
          <div style={{ fontFamily: SERIF }} className="italic text-[3.6cqw] text-red-600 tracking-wide">— Insurance Report</div>
          <h2 style={{ fontFamily: SERIF }} className="mt-[4%] text-[10cqw] font-black leading-[1.0] tracking-tight whitespace-normal break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h2>
          <div className="w-[18%] h-[3px] bg-red-600 my-[5%]" />
          <p className="text-[3.4cqw] leading-[1.5] text-neutral-700 max-w-[85%]">{slide.eyebrow}</p>
          <div className="mt-auto flex items-baseline gap-[2cqw] overflow-hidden">
            <div
              style={{ fontFamily: SERIF, ...bigStatFontStyle(slide.bigStat, { max: 16, divisor: 60 }) }}
              className="text-red-600 font-black leading-none break-keep flex-1 min-w-0"
            >
              {slide.bigStat}
            </div>
            <div className="text-[2.8cqw] font-bold text-neutral-500 uppercase tracking-[.15em] flex flex-col gap-[.4cqw] flex-none max-w-[40%] break-keep">
              <div>Recurrence</div>
              <div className="text-neutral-950">{slide.bigStatLabel}</div>
            </div>
          </div>
          <SourceLine source={slide.source} className="mt-[1.5cqw] text-[2.2cqw] italic text-neutral-500" />
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div style={containerStyle} className={CARD_BASE}>
        <TopBar /><PageBadge index={index} total={total} />
        <div className="relative h-full flex flex-col px-[5%] py-[5%] pt-[9%]">
          <div style={{ fontFamily: SERIF }} className="italic text-[3.6cqw] text-red-600 tracking-wide">Chapter {slide.number}.</div>
          <h3 style={{ fontFamily: SERIF }} className="mt-[4%] text-[8.5cqw] font-black leading-[1.05] tracking-tight whitespace-normal break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h3>
          <div className="w-[18%] h-[3px] bg-red-600 my-[5%]" />
          <p style={{ fontFamily: SERIF }} className="italic text-[4.2cqw] leading-[1.4] text-neutral-700 pl-[4%] border-l-[3px] border-red-600 max-w-[90%]">
            &ldquo;{slide.body}&rdquo;
          </p>
          <div className="mt-auto flex items-baseline gap-[2cqw] overflow-hidden">
            <div
              style={{ fontFamily: SERIF, ...bigStatFontStyle(slide.bigStat, { max: 14, divisor: 56 }) }}
              className="text-red-600 font-black leading-none break-keep flex-1 min-w-0"
            >
              {slide.bigStat}
            </div>
            <div className="text-[2.7cqw] font-bold text-neutral-500 uppercase tracking-[.15em] flex-none max-w-[45%] break-keep">{slide.bigStatLabel}</div>
          </div>
          <SourceLine source={slide.source} className="mt-[1.5cqw] text-[2.2cqw] italic text-neutral-500" />
        </div>
      </div>
    );
  }

  // closing
  return (
    <div style={containerStyle} className={CARD_BASE}>
      <TopBar /><PageBadge index={index} total={total} />
      <div className="relative h-full flex flex-col px-[5%] py-[5%] pt-[9%]">
        <div style={{ fontFamily: SERIF }} className="italic text-[3.6cqw] text-red-600 tracking-wide">— Summary</div>
        <h3 style={{ fontFamily: SERIF }} className="mt-[4%] text-[7cqw] font-black leading-[1.1] tracking-tight">
          {slide.title.replace(/\n/g, ' ')}
        </h3>
        <div className="w-[18%] h-[3px] bg-red-600 my-[5%]" />
        <ul className="space-y-0">
          {slide.items.map((it, i) => (
            <li key={i} className="flex gap-[3cqw] py-[3%] border-b border-stone-200 last:border-b-0">
              <span style={{ fontFamily: SERIF }} className="italic text-[5.5cqw] text-red-600 leading-none flex-none min-w-[8%]">
                {['i.', 'ii.', 'iii.'][i] ?? `${i + 1}.`}
              </span>
              <span className="text-[3.6cqw] font-semibold leading-[1.35]">{it}</span>
            </li>
          ))}
        </ul>
        <div style={{ fontFamily: SERIF }} className="mt-auto pt-[3%] text-[2.4cqw] italic text-neutral-500 border-t border-stone-200">
          {slide.footer}
        </div>
      </div>
    </div>
  );
}
