'use client';

import type { CardSlide, CardIconKey } from '@/lib/content/types';

// 아이콘 키 + 한글 라벨 + 미리보기 이모지
const ICON_OPTIONS: { key: CardIconKey; label: string; emoji: string }[] = [
  { key: 'sparkles',     label: '반짝 (표지·신상품)',      emoji: '✨' },
  { key: 'shield',       label: '방패 (보장·안전)',         emoji: '🛡️' },
  { key: 'trendingDown', label: '하락 (인하·축소)',         emoji: '📉' },
  { key: 'alert',        label: '경고 (주의·함정)',         emoji: '⚠️' },
  { key: 'gift',         label: '선물 (혜택·환급)',         emoji: '🎁' },
  { key: 'stethoscope',  label: '청진기 (의료·진단)',       emoji: '🩺' },
  { key: 'calculator',   label: '계산기 (계산·세제)',       emoji: '🧮' },
  { key: 'baby',         label: '아기 (출산·자녀)',         emoji: '👶' },
  { key: 'search',       label: '돋보기 (검색·확인)',       emoji: '🔍' },
  { key: 'clipboard',    label: '체크리스트 (마무리)',      emoji: '📋' },
  { key: 'zap',          label: '번개 (빠른 결정)',         emoji: '⚡' },
  { key: 'arrow',        label: '화살표 (변환·갈아타기)',   emoji: '➡️' },
];

type Props = {
  slide: CardSlide;
  index: number;
  onChange: (next: CardSlide) => void;
};

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-violet-400 focus:outline-none';
const labelCls = 'block text-[11px] font-semibold text-slate-600 mb-1';

export default function SlideEditor({ slide, index, onChange }: Props) {
  if (slide.kind === 'cover') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold text-slate-800">슬라이드 {index + 1} · 표지</h4>
          <IconPicker value={slide.iconKey} onChange={k => onChange({ ...slide, iconKey: k })} />
        </div>
        <Field label="카테고리(eyebrow)" value={slide.eyebrow} onChange={v => onChange({ ...slide, eyebrow: v })} />
        <Field label="제목 (15~22자)" value={slide.title} onChange={v => onChange({ ...slide, title: v })} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="거대 통계 (6자 이내)" value={slide.bigStat} onChange={v => onChange({ ...slide, bigStat: v })} />
          <Field label="통계 라벨 (12자 이내)" value={slide.bigStatLabel} onChange={v => onChange({ ...slide, bigStatLabel: v })} />
        </div>
      </div>
    );
  }

  if (slide.kind === 'point') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold text-slate-800">슬라이드 {index + 1} · 포인트 {slide.number}</h4>
          <IconPicker value={slide.iconKey} onChange={k => onChange({ ...slide, iconKey: k })} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="번호" value={slide.number} onChange={v => onChange({ ...slide, number: v })} />
          <Field label="거대 통계" value={slide.bigStat} onChange={v => onChange({ ...slide, bigStat: v })} />
          <Field label="통계 라벨" value={slide.bigStatLabel} onChange={v => onChange({ ...slide, bigStatLabel: v })} />
        </div>
        <Field label="제목 (15~24자)" value={slide.title} onChange={v => onChange({ ...slide, title: v })} />
        <TextArea label="본문 (1~2문장, 45~70자)" rows={2} value={slide.body} onChange={v => onChange({ ...slide, body: v })} />
      </div>
    );
  }

  // closing
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-bold text-slate-800">슬라이드 {index + 1} · 마무리</h4>
        <IconPicker value={slide.iconKey} onChange={k => onChange({ ...slide, iconKey: k })} />
      </div>
      <Field label="제목" value={slide.title} onChange={v => onChange({ ...slide, title: v })} />
      <div className="space-y-1.5">
        <span className={labelCls}>체크리스트 항목 3개 (각 12~18자)</span>
        {slide.items.map((it, i) => (
          <input key={i} type="text" value={it} onChange={e => {
            const next = [...slide.items];
            next[i] = e.target.value;
            onChange({ ...slide, items: next });
          }} placeholder={`항목 ${i + 1}`} className={inputCls} />
        ))}
      </div>
      <Field label="footer (면책 한 줄)" value={slide.footer} onChange={v => onChange({ ...slide, footer: v })} />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} className={inputCls} />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} className={inputCls + ' resize-y leading-relaxed'} />
    </div>
  );
}

function IconPicker({ value, onChange }: { value: CardIconKey; onChange: (k: CardIconKey) => void }) {
  const current = ICON_OPTIONS.find(o => o.key === value);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-base" aria-hidden>{current?.emoji ?? '✨'}</span>
      <select value={value} onChange={e => onChange(e.target.value as CardIconKey)}
        className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 focus:border-violet-400 focus:outline-none">
        {ICON_OPTIONS.map(o => (
          <option key={o.key} value={o.key}>
            {o.emoji} {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
