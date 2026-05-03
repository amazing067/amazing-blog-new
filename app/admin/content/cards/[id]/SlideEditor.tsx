'use client';

import type { CardSlide, CardIconKey, SlideSource } from '@/lib/content/types';

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
  const kindLabel = slide.kind === 'cover' ? '표지' : slide.kind === 'point' ? `포인트 ${slide.number}` : '마무리';

  return (
    <div className="w-full h-full rounded-xl border border-slate-200 bg-white p-5 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <h4 className="text-sm font-bold text-slate-800">슬라이드 {index + 1} · {kindLabel}</h4>
        <IconPicker value={slide.iconKey} onChange={k => onChange({ ...slide, iconKey: k } as CardSlide)} />
      </div>

      <div className="flex-1 space-y-3">
        {slide.kind === 'cover' && (
          <>
            <Field label="카테고리(eyebrow)" value={slide.eyebrow} onChange={v => onChange({ ...slide, eyebrow: v })} />
            <Field label="제목 (15~22자)" value={slide.title} onChange={v => onChange({ ...slide, title: v })} />
            <Field label="거대 통계 (6자 이내)" value={slide.bigStat} onChange={v => onChange({ ...slide, bigStat: v })} />
            <Field label="통계 라벨 (12자 이내)" value={slide.bigStatLabel} onChange={v => onChange({ ...slide, bigStatLabel: v })} />
            <SourceFields source={slide.source} onChange={src => onChange({ ...slide, source: src })} />
          </>
        )}

        {slide.kind === 'point' && (
          <>
            <Field label="번호" value={slide.number} onChange={v => onChange({ ...slide, number: v })} />
            <Field label="제목 (15~24자, 한 줄)" value={slide.title} onChange={v => onChange({ ...slide, title: v })} />
            <Field label="거대 통계 (6자 이내)" value={slide.bigStat} onChange={v => onChange({ ...slide, bigStat: v })} />
            <Field label="통계 라벨 (12자 이내)" value={slide.bigStatLabel} onChange={v => onChange({ ...slide, bigStatLabel: v })} />
            <TextArea
              label="본문 (1~2문장, 45~70자)"
              value={slide.body}
              onChange={v => onChange({ ...slide, body: v })}
              flex
            />
            <SourceFields source={slide.source} onChange={src => onChange({ ...slide, source: src })} />
          </>
        )}

        {slide.kind === 'closing' && (
          <>
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
            <TextArea
              label="footer (면책 한 줄)"
              value={slide.footer}
              onChange={v => onChange({ ...slide, footer: v })}
              flex
            />
          </>
        )}
      </div>
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

function TextArea({ label, value, onChange, flex }: { label: string; value: string; onChange: (v: string) => void; flex?: boolean }) {
  return (
    <div className={flex ? 'flex flex-col flex-1 min-h-[100px]' : ''}>
      <label className={labelCls}>{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        className={inputCls + ' resize-none leading-relaxed ' + (flex ? 'flex-1' : '')}
        rows={flex ? undefined : 3}
        style={flex ? { minHeight: 0 } : undefined}
      />
    </div>
  );
}

function SourceFields({ source, onChange }: { source?: SlideSource; onChange: (s: SlideSource | undefined) => void }) {
  const s = source ?? { organization: '', name: '', url: '' };
  const update = (patch: Partial<SlideSource>) => {
    const next = { ...s, ...patch };
    // 둘 다 비어있으면 source 제거
    if (!next.organization.trim() && !next.name.trim() && !(next.url ?? '').trim()) {
      onChange(undefined);
    } else {
      onChange(next);
    }
  };
  const urlValid = !s.url || /^https?:\/\//.test(s.url);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-amber-900">📋 통계 출처 (광고심의 검증용)</span>
        {source && (
          <button type="button" onClick={() => onChange(undefined)} className="text-[10px] text-amber-700 hover:underline">제거</button>
        )}
      </div>
      <p className="text-[10px] text-amber-800 leading-relaxed">
        통계는 다음 중 하나의 출처여야 심의 통과:<br />
        • <strong>공공기관</strong>: 국립암센터·통계청·심평원·건보공단·금감원·보험연구원<br />
        • <strong>의학 학회</strong>: 대한암학회·대한심장학회·대한당뇨병학회 등<br />
        • <strong>대학병원</strong>: 서울대·세브란스·삼성서울·아산·고려대·가톨릭 등 보도자료·연구실적
      </p>
      <Field label="기관명 (예: 국립암센터, 서울대학교병원)" value={s.organization} onChange={v => update({ organization: v })} />
      <Field label="자료명 (예: 국가암등록통계 2024, 보도자료 2026.03)" value={s.name} onChange={v => update({ name: v })} />
      <div>
        <label className={labelCls}>다운로드/원본 URL (https://...)</label>
        <input
          type="url"
          value={s.url ?? ''}
          onChange={e => update({ url: e.target.value })}
          className={`${inputCls} ${s.url && !urlValid ? 'border-red-400' : ''}`}
          placeholder="https://www.ncc.re.kr/..."
        />
        {s.url && !urlValid && <span className="text-[10px] text-red-600">URL은 http:// 또는 https://로 시작</span>}
      </div>
    </div>
  );
}

function IconPicker({ value, onChange }: { value: CardIconKey; onChange: (k: CardIconKey) => void }) {
  const current = ICON_OPTIONS.find(o => o.key === value);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-base" aria-hidden>{current?.emoji ?? '✨'}</span>
      <select value={value} onChange={e => onChange(e.target.value as CardIconKey)}
        className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 focus:border-violet-400 focus:outline-none max-w-[180px]">
        {ICON_OPTIONS.map(o => (
          <option key={o.key} value={o.key}>
            {o.emoji} {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
