'use client';
// 통계 출처 표시 — bigStat 아래 작은 글씨로 노출
// AI가 만든 source.url은 환각 404가 잦아서 신뢰하지 않고,
// source-registry에서 organization 기반으로 검증된 URL을 강제로 가져온다.
import { ExternalLink } from 'lucide-react';
import type { SlideSource } from '@/lib/content/types';
import { resolveSourceUrl } from '@/lib/content/source-registry';

type Props = {
  source?: SlideSource | null;
  className?: string;
  iconClass?: string;
};

export function SourceLine({ source, className = '', iconClass = 'w-[2.4cqw] h-[2.4cqw]' }: Props) {
  if (!source) return null;
  const text = `출처 · ${source.organization} · ${source.name}`;
  // 자료명까지 넘겨서 Google site:검색으로 실제 자료 위치까지 안내 (메인페이지 단순 이동 X)
  const url = resolveSourceUrl(source.organization, source.name);
  if (url) {
    return (
      <a
        href={url}
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
