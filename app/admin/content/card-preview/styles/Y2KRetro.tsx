'use client';
// F · Y2K Retro — 그라데이션 + 별 + 굵은 폰트 (트렌디 SNS)
import type { CardSlide } from '@/lib/content/types';
import { SourceLine } from './_SourceLine';

type Props = { slide: CardSlide; index: number; total: number };

const containerStyle = { containerType: 'size' } as React.CSSProperties;
const CARD_BASE = 'relative w-full h-full text-white rounded-2xl overflow-hidden shadow-xl';

// 5장 각자 다른 그라데이션
const GRADIENTS = [
  'bg-gradient-to-br from-rose-400 via-fuchsia-500 to-blue-500',
  'bg-gradient-to-br from-yellow-300 via-rose-400 to-purple-500',
  'bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500',
  'bg-gradient-to-br from-orange-400 via-pink-500 to-violet-500',
  'bg-gradient-to-br from-emerald-400 via-cyan-500 to-blue-500',
];

const POINT_STICKERS = ['⚠ 주의', '💸 GG', '🛡️ 필수'];

function Stars() {
  return (
    <>
      <span className="absolute top-[8%] left-[8%] text-[6cqw] -rotate-[15deg] drop-shadow-md">★</span>
      <span className="absolute top-[12%] right-[22%] text-[4.5cqw] drop-shadow-md">✦</span>
      <span className="absolute bottom-[18%] right-[8%] text-[5.5cqw] rotate-[20deg] drop-shadow-md">★</span>
    </>
  );
}

function PageBadge({ index, total }: { index: number; total: number }) {
  return (
    <div className="absolute top-[5%] right-[5%] px-[3%] py-[1.2%] rounded-full bg-black/45 text-[2.8cqw] font-extrabold backdrop-blur-md z-10">
      {index + 1}/{total}
    </div>
  );
}

const TITLE_SHADOW = '3px 3px 0 rgba(0,0,0,.35)';
const STAT_SHADOW = '4px 4px 0 rgba(0,0,0,.35)';

export function Y2KRetroStyle({ slide, index, total }: Props) {
  const grad = GRADIENTS[index % GRADIENTS.length];

  if (slide.kind === 'cover') {
    return (
      <div style={containerStyle} className={`${CARD_BASE} ${grad}`}>
        <Stars /><PageBadge index={index} total={total} />
        <div className="relative h-full flex flex-col px-[7%] py-[7%]">
          <div className="self-start px-[4%] py-[1.5%] bg-yellow-300 text-orange-900 text-[3.4cqw] font-black border-[3px] border-black -rotate-3" style={{ boxShadow: '4px 4px 0 black' }}>
            ⚠ 충격주의
          </div>
          <h2 className="mt-[8%] text-[11cqw] font-black leading-[1.05] tracking-tight whitespace-normal break-keep" style={{ textShadow: TITLE_SHADOW }}>
            {slide.title.replace(/\n/g, ' ')}
          </h2>
          <div className="mt-auto flex items-end justify-between">
            <div>
              <div className="text-[24cqw] font-black leading-none" style={{ textShadow: STAT_SHADOW, WebkitTextStroke: '2px black' }}>
                {slide.bigStat}
              </div>
              <div className="text-[3cqw] font-extrabold pt-[2%]" style={{ textShadow: '1px 1px 0 rgba(0,0,0,.5)' }}>
                {slide.bigStatLabel}
              </div>
              <SourceLine source={slide.source} className="mt-[1cqw] text-[2.2cqw] font-bold text-white/85" />
            </div>
          </div>
          <div className="mt-[4%] self-start bg-black text-yellow-300 px-[4%] py-[1.6%] text-[3.6cqw] font-black -rotate-2">
            → 끝까지 봐!
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    const idx = Math.max(0, Math.min(2, parseInt(slide.number) - 1));
    return (
      <div style={containerStyle} className={`${CARD_BASE} ${grad}`}>
        <Stars /><PageBadge index={index} total={total} />
        <div className="relative h-full flex flex-col px-[7%] py-[7%]">
          <div className="self-start px-[4%] py-[1.5%] bg-yellow-300 text-orange-900 text-[3.4cqw] font-black border-[3px] border-black -rotate-3" style={{ boxShadow: '4px 4px 0 black' }}>
            POINT {slide.number} ★
          </div>
          <h3 className="mt-[6%] text-[9.5cqw] font-black leading-[1.05] whitespace-normal break-keep" style={{ textShadow: TITLE_SHADOW }}>
            {slide.title.replace(/\n/g, ' ')}
          </h3>
          <p className="mt-[4%] text-[3.6cqw] font-bold leading-[1.4]" style={{ textShadow: '1px 1px 0 rgba(0,0,0,.4)' }}>
            {slide.body}
          </p>
          <div className="mt-auto flex items-end justify-between">
            <div>
              <div className="text-[18cqw] font-black leading-none" style={{ textShadow: '3px 3px 0 rgba(0,0,0,.35)', WebkitTextStroke: '1.5px black' }}>
                {slide.bigStat}
              </div>
              <div className="text-[3cqw] font-extrabold pt-[2%]" style={{ textShadow: '1px 1px 0 rgba(0,0,0,.5)' }}>
                {slide.bigStatLabel}
              </div>
              <SourceLine source={slide.source} className="mt-[1cqw] text-[2.2cqw] font-bold text-white/85" />
            </div>
            <div className="bg-yellow-300 text-black px-[2.5%] py-[1%] border-2 border-black font-black text-[3.4cqw] -rotate-2" style={{ boxShadow: '3px 3px 0 black' }}>
              {POINT_STICKERS[idx] ?? '⭐ 핵심'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // closing
  return (
    <div style={containerStyle} className={`${CARD_BASE} ${grad}`}>
      <Stars /><PageBadge index={index} total={total} />
      <div className="relative h-full flex flex-col px-[7%] py-[7%]">
        <div className="self-start px-[4%] py-[1.5%] bg-yellow-300 text-orange-900 text-[3.4cqw] font-black border-[3px] border-black -rotate-3" style={{ boxShadow: '4px 4px 0 black' }}>
          📌 정리
        </div>
        <h3 className="mt-[6%] text-[7.5cqw] font-black leading-[1.1]" style={{ textShadow: '2px 2px 0 rgba(0,0,0,.35)' }}>
          {slide.title.replace(/\n/g, ' ')} ⭐
        </h3>
        <ul className="mt-[5%] space-y-[2.5cqw]">
          {slide.items.map((it, i) => (
            <li key={i} className="flex items-center gap-[2.5cqw] bg-black/50 backdrop-blur rounded-lg px-[3.5%] py-[3%] border-2 border-white">
              <span className="flex-none w-[9cqw] h-[9cqw] rounded-full bg-yellow-300 text-black inline-flex items-center justify-center text-[4.4cqw] font-black border-2 border-black">
                {i + 1}
              </span>
              <span className="flex-1 text-[4cqw] font-extrabold">{it}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-[3%] text-[2.4cqw] opacity-85">{slide.footer}</div>
      </div>
    </div>
  );
}
