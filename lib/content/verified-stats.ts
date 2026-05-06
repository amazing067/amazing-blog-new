// 검증된 통계 카탈로그 — 사람이 직접 검수한 (사실, 출처 deep URL) 쌍.
// AI가 카드뉴스에 통계를 박을 때, 이 카탈로그에 있는 항목만 인용 가능.
// 카탈로그에 없는 토픽은 bigStat을 개념어로 강제 (수치 환각 차단).
//
// 운용 원칙:
//   1. 추가 전 반드시 url을 클릭해서 200·실제 자료 노출 확인.
//   2. organization은 source-registry.ts의 alias와 정확히 일치하게 적을 것.
//   3. stat은 6자 이내, label은 12자 이내 (카드 디자인 제약).
//   4. retrieved_at은 자료를 마지막으로 검증한 날짜 (YYYY-MM-DD).
//   5. 자료가 갱신되면 stat·url을 같이 업데이트.

import type { SlideSource } from './types';

export type VerifiedStat = {
  /** AI가 토픽 매칭에 사용할 키워드 (slug 형태 권장). */
  keywords: string[];
  /** 카드의 bigStat에 박힐 짧은 표현. 예: "2.5명 중 1명". 6자 이내 권장. */
  stat: string;
  /** 카드의 bigStatLabel. 12자 이내 권장. */
  label: string;
  /** 검증된 출처 — name·url은 클릭해서 확인 완료된 것만. */
  source: Required<Pick<SlideSource, 'organization' | 'name' | 'url'>>;
  /** 마지막 검증일 (YYYY-MM-DD). */
  retrieved_at: string;
};

// 초기 카탈로그는 의도적으로 비워둔다.
// 검증된 통계가 필요할 때 한 줄씩 직접 추가:
//
// {
//   keywords: ['연금저축', 'IRP', '세액공제'],
//   stat: '300만 ↑',
//   label: 'IRP 추가 한도',
//   source: {
//     organization: '국세청',
//     name: '연금계좌 세액공제 안내',
//     url: 'https://...실제로 클릭해서 확인한 페이지...',
//   },
//   retrieved_at: '2026-05-06',
// },
export const VERIFIED_STATS: VerifiedStat[] = [];

/**
 * AI가 만든 출처가 카탈로그의 검증된 항목과 일치하는지 검사.
 * 일치하면 그 항목의 `source`를 반환 (검증된 url 포함), 아니면 undefined.
 *
 * 매칭 기준: organization 일치 + (자료명 일부 포함 OR keywords가 자료명/주제에 포함).
 */
export function findVerifiedSource(params: {
  organization?: string | null;
  name?: string | null;
  context?: string | null;
}): VerifiedStat | undefined {
  const org = (params.organization ?? '').trim();
  const name = (params.name ?? '').trim();
  const context = (params.context ?? '').trim();
  if (!org && !name && !context) return undefined;

  const haystack = `${name} ${context}`.toLowerCase();

  for (const entry of VERIFIED_STATS) {
    const orgMatch = !org || normalize(entry.source.organization).includes(normalize(org)) || normalize(org).includes(normalize(entry.source.organization));
    if (!orgMatch) continue;
    const kwMatch = entry.keywords.some(kw => haystack.includes(kw.toLowerCase()));
    if (kwMatch) return entry;
  }
  return undefined;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}
