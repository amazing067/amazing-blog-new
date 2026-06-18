'use client';
// H · Neo-Brutalist — 두꺼운 검정 테두리 + 하드 오프셋 그림자 + 플랫 컬러블록 + 회전 스티커.
// 시그니처: 그림자 블러 0(딱딱한 입체), 검정 박스 라벨, 살짝 기울어진 스티커.
import type { CardSlide } from '@/lib/content/types';
import { ICONS } from './_icons';
import { SourceLine } from './_SourceLine';
import { bigStatFontStyle } from './_bigStat';

type Props = { slide: CardSlide; index: number; total: number };
const containerStyle = { containerType: 'size' } as React.CSSProperties;
const CARD_BASE = 'relative w-full h-full text-black rounded-2xl overflow-hidden';

// 슬라이드마다 플랫 컬러 순환
const BG = ['#ffe600', '#c6f432', '#7dd3fc', '#fda4af', '#fdba74'];
const ACC = ['#ff5e5b', '#1b64da', '#7c3aed', '#16a34a', '#dc2626'];

const hard = (cqw: number) => ({ boxShadow: `${cqw}cqw ${cqw}cqw 0 #000`, border: '0.7cqw solid #000' } as React.CSSProperties);

function Badge({ index, total }: { index: number; total: number }) {
  return (
    <div className="absolute top-[5%] right-[5%] text-[3cqw] font-black bg-black text-white px-[2.5cqw] py-[0.6cqw]" style={{ transform: 'rotate(3deg)' }}>
      {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
    </div>
  );
}

export function NeoBrutalStyle({ slide, index, total }: Props) {
  const bg = BG[index % BG.length];
  const acc = ACC[index % ACC.length];
  const Icon = ICONS[slide.iconKey] ?? ICONS.sparkles;
  const IconBox = (
    <div className="inline-flex items-center justify-center bg-white" style={{ width: '15cqw', height: '15cqw', ...hard(1) }}>
      <Icon style={{ width: '8cqw', height: '8cqw' }} strokeWidth={2.8} />
    </div>
  );

  if (slide.kind === 'cover') {
    return (
      <div style={{ ...containerStyle, background: bg }} className={CARD_BASE}>
        <Badge index={index} total={total} />
        <div className="relative h-full flex flex-col px-[6%] py-[7%]">
          <div className="inline-flex self-start items-center bg-black text-white text-[3.4cqw] font-black uppercase tracking-wider px-[3.5%] py-[1.5%]" style={{ transform: 'rotate(-2deg)' }}>
            #{slide.eyebrow}
          </div>
          <h2 className="mt-[6%] text-[12cqw] font-black leading-[1.0] tracking-tight whitespace-normal break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h2>
          <div className="mt-auto flex items-end justify-between gap-[3cqw]">
            <div className="flex-1 min-w-0">
              <div className="inline-block text-[3.2cqw] font-black mb-[1.5cqw] px-[2cqw] py-[0.4cqw]" style={{ background: acc, color: '#fff' }}>{slide.bigStatLabel}</div>
              <div className="bg-white px-[3cqw] py-[2cqw] inline-block" style={hard(1.2)}>
                <span className="font-black leading-none break-keep" style={bigStatFontStyle(slide.bigStat, { max: 13, divisor: 56 })}>{slide.bigStat}</span>
              </div>
            </div>
            {IconBox}
          </div>
          <SourceLine source={slide.source} className="mt-[2cqw] text-[2.2cqw] font-bold text-black/70" />
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div style={{ ...containerStyle, background: bg }} className={CARD_BASE}>
        <Badge index={index} total={total} />
        <div className="relative h-full flex flex-col px-[6%] py-[7%]">
          <div className="flex items-center gap-[3cqw]">
            {IconBox}
            <div className="text-[4cqw] font-black bg-black text-white px-[3cqw] py-[0.8cqw]" style={{ transform: 'rotate(-2deg)' }}>POINT {slide.number}</div>
          </div>
          <h3 className="mt-[6%] text-[9.5cqw] font-black leading-[1.05] tracking-tight whitespace-normal break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h3>
          <div className="mt-[5%] flex items-center gap-[2.5cqw]">
            <div className="bg-white px-[3cqw] py-[1.5cqw]" style={hard(1)}>
              <span className="font-black leading-none break-keep" style={{ color: acc, ...bigStatFontStyle(slide.bigStat, { max: 11, divisor: 50 }) }}>{slide.bigStat}</span>
            </div>
            <div className="text-[3cqw] font-black break-keep max-w-[42%]">{slide.bigStatLabel}</div>
          </div>
          <p className="mt-auto text-[4.2cqw] font-bold leading-[1.4] bg-white px-[3.5cqw] py-[3cqw]" style={hard(1)}>{slide.body}</p>
          <SourceLine source={slide.source} className="mt-[2cqw] text-[2.2cqw] font-bold text-black/70" />
        </div>
      </div>
    );
  }

  // closing
  return (
    <div style={{ ...containerStyle, background: bg }} className={CARD_BASE}>
      <Badge index={index} total={total} />
      <div className="relative h-full flex flex-col px-[6%] py-[7%]">
        <div className="inline-flex self-start items-center bg-black text-white text-[3.6cqw] font-black uppercase tracking-wider px-[3.5%] py-[1.5%]" style={{ transform: 'rotate(-2deg)' }}>CHECKLIST</div>
        <h3 className="mt-[5%] text-[7.5cqw] font-black leading-[1.08]">{slide.title.replace(/\n/g, ' ')}</h3>
        <ul className="mt-[5%] space-y-[3cqw]">
          {slide.items.map((it, i) => (
            <li key={i} className="flex items-center gap-[3cqw] bg-white px-[3.5cqw] py-[2.8cqw]" style={hard(0.9)}>
              <span className="flex-none inline-flex items-center justify-center text-white font-black text-[4cqw]" style={{ background: acc, width: '9cqw', height: '9cqw', border: '0.5cqw solid #000' }}>{i + 1}</span>
              <span className="flex-1 text-[4.2cqw] font-black leading-tight">{it}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-[3%] text-[2.6cqw] font-bold">{slide.footer}</div>
      </div>
    </div>
  );
}
