'use client';
// 마크다운의 blockquote를 5종 콜아웃으로 자동 렌더링.
// 첫 줄이 "💡 [알아두세요]" / "⚠️ [주의]" / "✅ [체크리스트]" / "📌 [핵심 요약]" / "💬 [실제 사례]" 패턴이면 매칭.

import type { ReactNode } from 'react';
import { Lightbulb, AlertTriangle, CheckSquare, Pin, MessageCircle } from 'lucide-react';

const STYLES: Record<string, { bg: string; border: string; text: string; iconColor: string; Icon: typeof Lightbulb; label: string }> = {
  tip:    { bg: 'bg-amber-50',     border: 'border-amber-200',     text: 'text-amber-900',     iconColor: 'text-amber-600',    Icon: Lightbulb,    label: '알아두세요' },
  warn:   { bg: 'bg-red-50',       border: 'border-red-200',       text: 'text-red-900',       iconColor: 'text-red-600',      Icon: AlertTriangle, label: '주의' },
  check:  { bg: 'bg-emerald-50',   border: 'border-emerald-200',   text: 'text-emerald-900',   iconColor: 'text-emerald-600',  Icon: CheckSquare,  label: '체크리스트' },
  summary:{ bg: 'bg-violet-50',    border: 'border-violet-200',    text: 'text-violet-900',    iconColor: 'text-violet-600',   Icon: Pin,          label: '핵심 요약' },
  example:{ bg: 'bg-sky-50',       border: 'border-sky-200',       text: 'text-sky-900',       iconColor: 'text-sky-600',      Icon: MessageCircle,label: '실제 사례' },
};

const PATTERNS: { regex: RegExp; key: keyof typeof STYLES }[] = [
  { regex: /^[\s\n]*💡\s*\[?\s*(알아두세요|TIP|tip)?\s*\]?[:.\s]*/i, key: 'tip' },
  { regex: /^[\s\n]*⚠️\s*\[?\s*(주의|warn|WARN)?\s*\]?[:.\s]*/i, key: 'warn' },
  { regex: /^[\s\n]*✅\s*\[?\s*(체크리스트|체크|check|CHECK)?\s*\]?[:.\s]*/i, key: 'check' },
  { regex: /^[\s\n]*📌\s*\[?\s*(핵심\s*요약|요약|summary|SUMMARY)?\s*\]?[:.\s]*/i, key: 'summary' },
  { regex: /^[\s\n]*💬\s*\[?\s*(실제\s*사례|사례|example|EXAMPLE)?\s*\]?[:.\s]*/i, key: 'example' },
];

function extractRaw(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractRaw).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    const c = (children as { props?: { children?: ReactNode } }).props?.children;
    return extractRaw(c ?? '');
  }
  return '';
}

export function CustomBlockquote({ children }: { children?: ReactNode }) {
  const raw = extractRaw(children).trim();
  const matched = PATTERNS.find(p => p.regex.test(raw));
  if (!matched) {
    // 기본 blockquote 스타일
    return (
      <blockquote className="my-5 border-l-4 border-slate-300 bg-slate-50 px-5 py-3 not-italic text-slate-700">
        {children}
      </blockquote>
    );
  }
  const style = STYLES[matched.key];
  const Icon = style.Icon;
  return (
    <div className={`my-6 rounded-2xl border ${style.border} ${style.bg} px-5 py-4 not-italic`}>
      <div className={`flex items-center gap-2 mb-2 font-semibold ${style.text}`}>
        <Icon className={`w-4 h-4 ${style.iconColor}`} />
        <span className="text-sm">{style.label}</span>
      </div>
      <div className={`text-[15px] leading-7 ${style.text} [&_p]:my-1.5 [&_strong]:font-semibold`}>
        {children}
      </div>
    </div>
  );
}
