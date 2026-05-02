'use client';
// 마크다운의 blockquote를 5종 콜아웃으로 자동 렌더링.
// 카카오페이 머니콘텐츠 톤에 맞춰 부드러운 색상·여백.

import type { ReactNode } from 'react';
import { Lightbulb, AlertTriangle, CheckSquare, Pin, MessageCircle } from 'lucide-react';

const STYLES: Record<string, { bg: string; ring: string; text: string; iconBg: string; iconColor: string; Icon: typeof Lightbulb; label: string }> = {
  tip:    { bg: 'bg-amber-50/80',     ring: 'ring-amber-100',     text: 'text-amber-950',     iconBg: 'bg-amber-100',    iconColor: 'text-amber-700',    Icon: Lightbulb,    label: '알아두세요' },
  warn:   { bg: 'bg-rose-50/80',      ring: 'ring-rose-100',      text: 'text-rose-950',      iconBg: 'bg-rose-100',     iconColor: 'text-rose-700',     Icon: AlertTriangle, label: '주의' },
  check:  { bg: 'bg-emerald-50/80',   ring: 'ring-emerald-100',   text: 'text-emerald-950',   iconBg: 'bg-emerald-100',  iconColor: 'text-emerald-700',  Icon: CheckSquare,  label: '체크리스트' },
  summary:{ bg: 'bg-indigo-50/80',    ring: 'ring-indigo-100',    text: 'text-indigo-950',    iconBg: 'bg-indigo-100',   iconColor: 'text-indigo-700',   Icon: Pin,          label: '핵심 요약' },
  example:{ bg: 'bg-sky-50/80',       ring: 'ring-sky-100',       text: 'text-sky-950',       iconBg: 'bg-sky-100',      iconColor: 'text-sky-700',      Icon: MessageCircle,label: '실제 사례' },
};

const PATTERNS: { regex: RegExp; key: keyof typeof STYLES }[] = [
  { regex: /^[\s\n]*💡\s*\[?\s*(알아두세요|TIP|tip)?\s*\]?[:.\s]*/i, key: 'tip' },
  { regex: /^[\s\n]*⚠️\s*\[?\s*(주의|warn|WARN)?\s*\]?[:.\s]*/i, key: 'warn' },
  { regex: /^[\s\n]*✅\s*\[?\s*(체크리스트|체크|check|CHECK)?\s*\]?[:.\s]*/i, key: 'check' },
  { regex: /^[\s\n]*📌\s*\[?\s*(핵심\s*요약|요약|summary|SUMMARY|핵심\s*포인트)?\s*\]?[:.\s]*/i, key: 'summary' },
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
    return (
      <blockquote className="my-6 border-l-4 border-slate-300 bg-slate-50 px-5 py-3 not-italic text-slate-700 rounded-r-lg">
        {children}
      </blockquote>
    );
  }
  const style = STYLES[matched.key];
  const Icon = style.Icon;
  return (
    <div className={`my-7 rounded-2xl ring-1 ${style.ring} ${style.bg} px-6 py-5 not-italic`}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${style.iconBg}`}>
          <Icon className={`w-4 h-4 ${style.iconColor}`} />
        </span>
        <span className={`text-sm font-bold ${style.text}`}>{style.label}</span>
      </div>
      <div className={`text-[15px] leading-[1.85] ${style.text}
                      [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0
                      [&_strong]:font-bold [&_strong]:text-slate-900
                      [&_ul]:my-2 [&_ol]:my-2
                      [&_li]:my-1`}>
        {children}
      </div>
    </div>
  );
}
