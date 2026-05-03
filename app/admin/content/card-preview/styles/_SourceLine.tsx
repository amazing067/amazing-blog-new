'use client';
// 통계 출처 표시 — bigStat 아래 작은 글씨로 노출
// 어드민 검수자는 url 클릭으로 자료 확인, PNG에는 텍스트만 박힘
import { ExternalLink } from 'lucide-react';
import type { SlideSource } from '@/lib/content/types';

type Props = {
  source?: SlideSource | null;
  className?: string;
  iconClass?: string;
};

export function SourceLine({ source, className = '', iconClass = 'w-[2.4cqw] h-[2.4cqw]' }: Props) {
  if (!source) return null;
  const text = `출처 · ${source.organization} · ${source.name}`;
  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-[0.8cqw] hover:underline ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate max-w-full">{text}</span>
        <ExternalLink className={`${iconClass} flex-none opacity-70`} />
      </a>
    );
  }
  return <span className={`block truncate ${className}`}>{text}</span>;
}
