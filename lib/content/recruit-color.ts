// 서버·클라이언트 공용 유틸 (no 'use client') — 카드 세트별 팔레트 색 오프셋.
// RecruitStyle은 'use client'라 거기서 export하면 서버 컴포넌트가 호출 못 함 → 여기로 분리.
export const RECRUIT_PALETTE_LENGTH = 7;

/** 카드 id 등 시드 문자열에서 결정적으로 색 오프셋(0~6) 산출. 세트마다 색 시작점이 달라짐. */
export function recruitColorOffset(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % RECRUIT_PALETTE_LENGTH;
}
