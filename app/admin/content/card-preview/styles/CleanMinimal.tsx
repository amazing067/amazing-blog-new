'use client';
// G · Clean Minimal — 토스/뱅크샐러드풍 미니멀. 화이트 배경 + 단일 블루 액센트 + 넉넉한 여백.
// 시그니처: 거대한 한 줄 헤딩 + 얇은 액센트 언더라인 + 부드러운 원형 아이콘 칩.
import type { CardSlide } from '@/lib/content/types';
import { ICONS } from './_icons';
import { SourceLine } from './_SourceLine';
import { bigStatFontStyle } from './_bigStat';

type Props = { slide: CardSlide; index: number; total: number };
const containerStyle = { containerType: 'size' } as React.CSSProperties;
const CARD_BASE = 'relative w-full h-full bg-white text-neutral-900 rounded-2xl overflow-hidden shadow-xl';
const ACCENT = '#2563eb';
const TINT = '#eff6ff';

function Badge({ index, total }: { index: number; total: number }) {
  return (
    <div className="absolute top-[5.5%] right-[5.5%] text-[2.8cqw] font-bold tracking-wide text-neutral-300">
      {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
    </div>
  );
}

export function CleanMinimalStyle({ slide, index, total }: Props) {
  const Icon = ICONS[slide.iconKey] ?? ICONS.sparkles;
  const IconChip = (
    <div className="inline-flex items-center justify-center rounded-2xl" style={{ background: TINT, width: '14cqw', height: '14cqw' }}>
      <Icon style={{ width: '7cqw', height: '7cqw', color: ACCENT }} strokeWidth={2.4} />
    </div>
  );

  if (slide.kind === 'cover') {
    return (
      <div style={containerStyle} className={CARD_BASE}>
        <Badge index={index} total={total} />
        <div className="relative h-full flex flex-col px-[7%] py-[8%]">
          {IconChip}
          <div className="mt-[6%] inline-flex self-start items-center rounded-full px-[3.5%] py-[1.6%] text-[3.2cqw] font-bold" style={{ background: TINT, color: ACCENT }}>
            {slide.eyebrow}
          </div>
          <h2 className="mt-[5%] text-[11cqw] font-extrabold leading-[1.1] tracking-tight whitespace-normal break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h2>
          <div className="mt-[4%] rounded-full" style={{ width: '16%', height: '0.8cqw', background: ACCENT }} />
          <div className="mt-auto">
            <div className="text-[3.2cqw] font-semibold text-neutral-400 mb-[1cqw]">{slide.bigStatLabel}</div>
            <div className="font-extrabold leading-none break-keep" style={{ color: ACCENT, ...bigStatFontStyle(slide.bigStat, { max: 16, divisor: 64 }) }}>
              {slide.bigStat}
            </div>
            <SourceLine source={slide.source} className="mt-[1.8cqw] text-[2.2cqw] text-neutral-400" />
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div style={containerStyle} className={CARD_BASE}>
        <Badge index={index} total={total} />
        <div className="relative h-full flex flex-col px-[7%] py-[8%]">
          <div className="flex items-center gap-[3cqw]">
            {IconChip}
            <div className="text-[3.4cqw] font-bold tracking-wide text-neutral-400">POINT {slide.number}</div>
          </div>
          <h3 className="mt-[6%] text-[9cqw] font-extrabold leading-[1.12] tracking-tight whitespace-normal break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h3>
          <div className="mt-[5%] flex items-baseline gap-[2.5cqw] overflow-hidden">
            <div className="font-extrabold leading-none break-keep flex-1 min-w-0" style={{ color: ACCENT, ...bigStatFontStyle(slide.bigStat, { max: 13, divisor: 56 }) }}>
              {slide.bigStat}
            </div>
            <div className="text-[3cqw] font-semibold text-neutral-400 flex-none max-w-[46%] break-keep pb-[1.5cqw]">{slide.bigStatLabel}</div>
          </div>
          <p className="mt-auto text-[4.2cqw] leading-[1.5] text-neutral-600">{slide.body}</p>
          <SourceLine source={slide.source} className="mt-[1.8cqw] text-[2.2cqw] text-neutral-400" />
        </div>
      </div>
    );
  }

  // closing
  return (
    <div style={containerStyle} className={CARD_BASE}>
      <Badge index={index} total={total} />
      <div className="relative h-full flex flex-col px-[7%] py-[8%]">
        <div className="flex items-center gap-[3cqw]">
          {IconChip}
          <div className="text-[3.4cqw] font-bold tracking-wide text-neutral-400">CHECK</div>
        </div>
        <h3 className="mt-[6%] text-[7.5cqw] font-extrabold leading-[1.15] tracking-tight">{slide.title.replace(/\n/g, ' ')}</h3>
        <ul className="mt-[6%] space-y-[3cqw]">
          {slide.items.map((it, i) => (
            <li key={i} className="flex items-center gap-[3cqw]">
              <span className="flex-none inline-flex items-center justify-center rounded-full text-white font-extrabold text-[3.6cqw]" style={{ background: ACCENT, width: '8cqw', height: '8cqw' }}>{i + 1}</span>
              <span className="flex-1 text-[4.4cqw] font-semibold leading-tight">{it}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-[3%] text-[2.6cqw] text-neutral-400 border-t border-neutral-100">{slide.footer}</div>
      </div>
    </div>
  );
}
