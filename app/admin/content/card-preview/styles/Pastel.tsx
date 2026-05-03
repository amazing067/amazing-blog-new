'use client';
// C · Soft Pastel — 친근한 메모 (파스텔 + 둥근 + 이모지)
import type { CardSlide } from '@/lib/content/types';
import { SourceLine } from './_SourceLine';

type Props = { slide: CardSlide; index: number; total: number };

const containerStyle = { containerType: 'size' } as React.CSSProperties;
const CARD_BASE = 'relative w-full h-full text-orange-950 rounded-2xl overflow-hidden shadow-xl';

// 5장 각자 다른 파스텔 톤
const TONES = [
  { bg: 'bg-orange-50',  deco1: 'bg-orange-200',  deco2: 'bg-orange-300',  pad: 'text-orange-700' },
  { bg: 'bg-amber-100',  deco1: 'bg-amber-200',   deco2: 'bg-amber-300',   pad: 'text-amber-700' },
  { bg: 'bg-emerald-100',deco1: 'bg-emerald-200', deco2: 'bg-emerald-300', pad: 'text-emerald-700' },
  { bg: 'bg-pink-100',   deco1: 'bg-pink-200',    deco2: 'bg-pink-300',    pad: 'text-pink-700' },
  { bg: 'bg-orange-50',  deco1: 'bg-orange-200',  deco2: 'bg-orange-300',  pad: 'text-orange-700' },
];

const POINT_EYEBROWS = ['🟡 첫 번째 이야기', '🌿 두 번째 이야기', '🌺 세 번째 이야기'];
const POINT_HEARTS = ['⏰', '💸', '🛡️'];

function Deco({ deco1, deco2 }: { deco1: string; deco2: string }) {
  return (
    <>
      <div className={`absolute top-[8%] right-[8%] w-[16%] aspect-square rounded-full ${deco1} opacity-60`} />
      <div className={`absolute bottom-[14%] right-[18%] w-[7%] aspect-square rounded-full ${deco2} opacity-50`} />
    </>
  );
}

function PageBadge({ index, total, pad }: { index: number; total: number; pad: string }) {
  return (
    <div className={`absolute top-[5%] right-[5%] w-[10%] h-[10%] rounded-full bg-white inline-flex items-center justify-center text-[2.8cqw] font-extrabold ${pad} shadow-md z-10`}>
      {index + 1}/{total}
    </div>
  );
}

export function PastelStyle({ slide, index, total }: Props) {
  const t = TONES[index % TONES.length];

  if (slide.kind === 'cover') {
    return (
      <div style={containerStyle} className={`${CARD_BASE} ${t.bg}`}>
        <Deco deco1={t.deco1} deco2={t.deco2} />
        <PageBadge index={index} total={total} pad={t.pad} />
        <div className="relative h-full flex flex-col px-[6%] py-[6%]">
          <div className={`self-start px-[4%] py-[1.5%] rounded-full bg-white ${t.pad} text-[3.2cqw] font-extrabold shadow-sm`}>
            🌸 알고 계셨나요?
          </div>
          <h2 className="mt-[6%] text-[9.5cqw] font-black leading-[1.1] tracking-tight text-orange-900 whitespace-normal break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h2>
          <div className="relative bg-white rounded-2xl px-[5%] py-[4%] mt-[5%] text-[3.8cqw] leading-[1.45] font-semibold shadow-md max-w-[80%]">
            <span className="absolute -top-[8px] left-[16%] w-[14px] h-[14px] bg-white rotate-45" />
            &ldquo;{slide.eyebrow}&rdquo; 🥺
          </div>
          <div className="mt-auto flex items-end justify-between">
            <div>
              <div className={`text-[17cqw] font-black ${t.pad} leading-none`}>{slide.bigStat}</div>
              <div className={`text-[3cqw] font-bold ${t.pad} opacity-85`}>{slide.bigStatLabel}</div>
              <SourceLine source={slide.source} className={`mt-[1cqw] text-[2.2cqw] ${t.pad} opacity-70`} />
            </div>
            <div className="text-[8.5cqw]">💗</div>
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    const idx = Math.max(0, Math.min(2, parseInt(slide.number) - 1));
    return (
      <div style={containerStyle} className={`${CARD_BASE} ${t.bg}`}>
        <Deco deco1={t.deco1} deco2={t.deco2} />
        <PageBadge index={index} total={total} pad={t.pad} />
        <div className="relative h-full flex flex-col px-[6%] py-[6%]">
          <div className={`self-start px-[4%] py-[1.5%] rounded-full bg-white ${t.pad} text-[3.2cqw] font-extrabold shadow-sm`}>
            {POINT_EYEBROWS[idx] ?? `🌟 POINT ${slide.number}`}
          </div>
          <h3 className="mt-[5%] text-[8.5cqw] font-black leading-[1.1] tracking-tight text-orange-900 whitespace-normal break-keep">
            {slide.title.replace(/\n/g, ' ')}
          </h3>
          <div className="relative bg-white rounded-2xl px-[5%] py-[4%] mt-[5%] text-[3.6cqw] leading-[1.4] font-semibold shadow-md max-w-[85%]">
            <span className="absolute -top-[8px] left-[16%] w-[14px] h-[14px] bg-white rotate-45" />
            {slide.body}
          </div>
          <div className="mt-auto flex items-end justify-between">
            <div>
              <div className={`text-[15cqw] font-black ${t.pad} leading-none`}>{slide.bigStat}</div>
              <div className={`text-[3cqw] font-bold ${t.pad} opacity-85`}>{slide.bigStatLabel}</div>
              <SourceLine source={slide.source} className={`mt-[1cqw] text-[2.2cqw] ${t.pad} opacity-70`} />
            </div>
            <div className="text-[7.5cqw]">{POINT_HEARTS[idx] ?? '💗'}</div>
          </div>
        </div>
      </div>
    );
  }

  // closing
  return (
    <div style={containerStyle} className={`${CARD_BASE} ${t.bg}`}>
      <Deco deco1={t.deco1} deco2={t.deco2} />
      <PageBadge index={index} total={total} pad={t.pad} />
      <div className="relative h-full flex flex-col px-[6%] py-[6%]">
        <div className={`self-start px-[4%] py-[1.5%] rounded-full bg-white ${t.pad} text-[3.2cqw] font-extrabold shadow-sm`}>
          📌 마무리
        </div>
        <h3 className="mt-[5%] text-[7cqw] font-black leading-[1.15] text-orange-900 whitespace-normal break-keep">
          {slide.title.replace(/\n/g, ' ')} ✨
        </h3>
        <ul className="mt-[6%] space-y-[2.8cqw]">
          {slide.items.map((it, i) => (
            <li key={i} className="flex items-center gap-[2.8cqw] bg-white rounded-2xl px-[3.5%] py-[3%] shadow-sm">
              <span className={`flex-none w-[9cqw] h-[9cqw] rounded-full ${t.deco1} ${t.pad} inline-flex items-center justify-center text-[4.5cqw] font-black`}>
                ✓
              </span>
              <span className="flex-1 text-[3.8cqw] font-bold text-orange-900 leading-[1.35]">{it}</span>
            </li>
          ))}
        </ul>
        <div className={`mt-auto pt-[3%] text-[2.4cqw] ${t.pad} opacity-70 border-t border-dashed border-orange-300`}>
          {slide.footer}
        </div>
      </div>
    </div>
  );
}
