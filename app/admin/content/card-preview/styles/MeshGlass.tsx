'use client';
// I · Mesh Glass — 컬러 메시 그라디언트 배경 + 프로스트 글래스 패널(반투명·블러).
// 시그니처: 떠 있는 유리 패널, 부드러운 빛 번짐, 밝은 화이트 타이포.
import type { CardSlide } from '@/lib/content/types';
import { ICONS } from './_icons';
import { SourceLine } from './_SourceLine';
import { bigStatFontStyle } from './_bigStat';

type Props = { slide: CardSlide; index: number; total: number };
const containerStyle = { containerType: 'size' } as React.CSSProperties;
const CARD_BASE = 'relative w-full h-full text-white rounded-2xl overflow-hidden shadow-xl';

// 슬라이드마다 다른 메시(여러 radial-gradient 합성)
const MESH = [
  'radial-gradient(at 20% 20%, #6366f1 0px, transparent 50%), radial-gradient(at 80% 0%, #ec4899 0px, transparent 50%), radial-gradient(at 80% 90%, #06b6d4 0px, transparent 50%), radial-gradient(at 10% 90%, #8b5cf6 0px, transparent 50%), #1e1b4b',
  'radial-gradient(at 10% 10%, #f59e0b 0px, transparent 50%), radial-gradient(at 90% 20%, #ef4444 0px, transparent 50%), radial-gradient(at 70% 100%, #8b5cf6 0px, transparent 50%), #2a0a3a',
  'radial-gradient(at 20% 10%, #22d3ee 0px, transparent 50%), radial-gradient(at 90% 40%, #3b82f6 0px, transparent 50%), radial-gradient(at 40% 100%, #6366f1 0px, transparent 50%), #052e4a',
  'radial-gradient(at 15% 20%, #34d399 0px, transparent 50%), radial-gradient(at 85% 10%, #06b6d4 0px, transparent 50%), radial-gradient(at 70% 95%, #6366f1 0px, transparent 50%), #06302b',
  'radial-gradient(at 25% 15%, #fb7185 0px, transparent 50%), radial-gradient(at 80% 30%, #c026d3 0px, transparent 50%), radial-gradient(at 50% 100%, #6d28d9 0px, transparent 50%), #2a0a3a',
];
const GLASS = 'backdrop-blur-md bg-white/10 border border-white/25';

function Badge({ index, total }: { index: number; total: number }) {
  return (
    <div className="absolute top-[5.5%] right-[5.5%] text-[2.8cqw] font-bold text-white/70">
      {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
    </div>
  );
}

export function MeshGlassStyle({ slide, index, total }: Props) {
  const bg = MESH[index % MESH.length];
  const Icon = ICONS[slide.iconKey] ?? ICONS.sparkles;
  const IconChip = (
    <div className={`inline-flex items-center justify-center rounded-2xl ${GLASS}`} style={{ width: '14cqw', height: '14cqw' }}>
      <Icon style={{ width: '7cqw', height: '7cqw' }} strokeWidth={2.2} className="text-white" />
    </div>
  );

  if (slide.kind === 'cover') {
    return (
      <div style={{ ...containerStyle, background: bg }} className={CARD_BASE}>
        <Badge index={index} total={total} />
        <div className="relative h-full flex flex-col px-[7%] py-[8%]">
          <div className={`inline-flex self-start items-center rounded-full px-[3.5%] py-[1.6%] text-[3.2cqw] font-bold ${GLASS}`}>{slide.eyebrow}</div>
          <h2 className="mt-[6%] text-[11cqw] font-black leading-[1.08] tracking-tight whitespace-normal break-keep drop-shadow">
            {slide.title.replace(/\n/g, ' ')}
          </h2>
          <div className={`mt-auto rounded-3xl px-[5%] py-[4.5%] ${GLASS}`}>
            <div className="text-[3.2cqw] font-semibold text-white/75 mb-[1cqw]">{slide.bigStatLabel}</div>
            <div className="flex items-end justify-between gap-[3cqw]">
              <div className="font-black leading-none break-keep flex-1 min-w-0" style={bigStatFontStyle(slide.bigStat, { max: 15, divisor: 60 })}>{slide.bigStat}</div>
              {IconChip}
            </div>
          </div>
          <SourceLine source={slide.source} className="mt-[1.8cqw] text-[2.2cqw] text-white/70" />
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div style={{ ...containerStyle, background: bg }} className={CARD_BASE}>
        <Badge index={index} total={total} />
        <div className="relative h-full flex flex-col px-[7%] py-[8%]">
          <div className="flex items-center gap-[3cqw]">
            {IconChip}
            <div className="text-[3.4cqw] font-bold tracking-wide text-white/75">POINT {slide.number}</div>
          </div>
          <h3 className="mt-[6%] text-[9cqw] font-black leading-[1.1] tracking-tight whitespace-normal break-keep drop-shadow">
            {slide.title.replace(/\n/g, ' ')}
          </h3>
          <div className={`mt-auto rounded-2xl px-[4.5%] py-[4%] ${GLASS}`}>
            <div className="flex items-baseline justify-between gap-[2.5cqw] overflow-hidden">
              <div className="font-black leading-none break-keep min-w-0 flex-1" style={bigStatFontStyle(slide.bigStat, { max: 11, divisor: 52 })}>{slide.bigStat}</div>
              <div className="text-[2.8cqw] font-semibold text-white/75 flex-none max-w-[42%] text-right break-keep">{slide.bigStatLabel}</div>
            </div>
            <p className="mt-[2.5cqw] border-t border-white/15 pt-[2.5cqw] text-[3.6cqw] leading-[1.5] text-white/90">{slide.body}</p>
          </div>
          <SourceLine source={slide.source} className="mt-[1.8cqw] text-[2.2cqw] text-white/70" />
        </div>
      </div>
    );
  }

  // closing
  return (
    <div style={{ ...containerStyle, background: bg }} className={CARD_BASE}>
      <Badge index={index} total={total} />
      <div className="relative h-full flex flex-col px-[7%] py-[8%]">
        <div className="flex items-center gap-[3cqw]">
          {IconChip}
          <div className="text-[3.4cqw] font-bold tracking-wide text-white/75">SUMMARY</div>
        </div>
        <h3 className="mt-[6%] text-[7.5cqw] font-black leading-[1.12] drop-shadow">{slide.title.replace(/\n/g, ' ')}</h3>
        <ul className="mt-[6%] space-y-[3cqw]">
          {slide.items.map((it, i) => (
            <li key={i} className={`flex items-center gap-[3cqw] rounded-2xl px-[4%] py-[3%] ${GLASS}`}>
              <span className="flex-none inline-flex items-center justify-center rounded-full bg-white text-indigo-900 font-black text-[3.6cqw]" style={{ width: '8cqw', height: '8cqw' }}>{i + 1}</span>
              <span className="flex-1 text-[4.2cqw] font-bold leading-tight">{it}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-[3%] text-[2.6cqw] text-white/70">{slide.footer}</div>
      </div>
    </div>
  );
}
