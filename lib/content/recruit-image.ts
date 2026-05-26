// 리쿠르팅 듀오톤 사진 provider. v1: 큐레이션 로컬 스톡 풀에서 pillar+slot으로 선택.
// 추후 AI 생성 provider도 동일 시그니처로 교체 가능. (capture 안정 위해 로컬 경로만.)
import type { RecruitImage, RecruitPillar } from './types';

export type RecruitImageSlot = 'cover' | 'breakthrough' | 'evidence';

// 슬롯별 듀오톤 틴트 — recruit-color의 cool-blue 스킴과 일치.
// pre-bake 스크립트도 이 틴트로 사진을 굽는다.
export const SLOT_TINT: Record<RecruitImageSlot, string> = {
  cover: '#1E5BFF',
  breakthrough: '#0E9AA7',
  evidence: '#14307A',
};

// 큐레이션된 pre-bake 듀오톤 사진 풀: public/recruit-photos/<slot>/<file>.jpg
// 국적-중립 장면(노트북·책상·손·카페·도시·뒷모습) 위주. pillar별로 분류.
// 아직 번들 전이면 빈 배열 → getRecruitImage가 undefined → 렌더는 단색 fallback.
const POOL: Record<RecruitImageSlot, Partial<Record<RecruitPillar, string[]>>> = {
  cover: {},
  breakthrough: {},
  evidence: {},
};

/** 슬롯+pillar로 듀오톤 사진 1장 선택. 풀이 비면 undefined(렌더 단색 fallback). */
export function getRecruitImage(pillar: RecruitPillar, slot: RecruitImageSlot): RecruitImage | undefined {
  const byPillar = POOL[slot];
  const pool = byPillar[pillar] ?? [];
  if (pool.length === 0) return undefined;
  const src = pool[Math.floor(Math.random() * pool.length)];
  return { src: `/recruit-photos/${slot}/${src}`, tint: SLOT_TINT[slot] };
}
