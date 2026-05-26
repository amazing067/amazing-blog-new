// 서버·클라 공용 (no 'use client') — 리쿠르팅 카드 색 시스템.
// v6: 기존 무지개(theme(index+colorOffset)) 폐기. 한 세트 = 한 쿨톤 스킴,
//     카드 "역할(role)"로 색 토큰이 결정된다(블루·틸·크림 + 옐로 악센트).
//     변주는 세트 단위(seed로 쿨톤 스킴 선택) — 무지개 아님.

export type RecruitRole = 'cover' | 'compare' | 'breakthrough' | 'grid' | 'evidence' | 'closing';

export type RecruitToken = {
  bg: string;          // 카드 배경 (사진 카드는 사진 없을 때 fallback 단색)
  ink: string;         // 주 텍스트
  sub: string;         // 보조 라벨(저강조)
  accent: string;      // 악센트(칩 등)
  accentInk: string;   // 악센트 위 텍스트
  isPhoto: boolean;    // 듀오톤 사진 카드 여부 (cover·breakthrough·evidence)
  tint?: string;       // 듀오톤 틴트 / 사진 없을 때 fallback 배경색
};

export type RecruitScheme = { name: string; roles: Record<RecruitRole, RecruitToken> };

// 카드 index(0~5) → 역할 매핑 고정.
const ROLE_BY_INDEX: RecruitRole[] = ['cover', 'compare', 'breakthrough', 'grid', 'evidence', 'closing'];
export function roleForIndex(i: number): RecruitRole {
  return ROLE_BY_INDEX[i] ?? 'breakthrough';
}

// 어느 역할이 듀오톤 사진을 받는가 (1·3·5).
export const PHOTO_ROLES: RecruitRole[] = ['cover', 'breakthrough', 'evidence'];

const ACCENT = '#FFD23D'; // 옐로 — 전 카드 고정 악센트

// v1 쿨톤 스킴 1종(블루·틸·크림 + 옐로). 세트 내 변화는 역할 색이 담당.
// (세트 간 색 변주는 듀오톤 pre-bake 틴트 변형까지 갖춘 뒤 SCHEMES에 추가 — 지금 늘리면
//  사진에 박힌 틴트와 스킴 틴트가 어긋남.)
const SCHEMES: RecruitScheme[] = [
  {
    name: 'cool-blue',
    roles: {
      cover:        { bg: '#1E5BFF', ink: '#ffffff', sub: 'rgba(255,255,255,.85)', accent: ACCENT, accentInk: '#11224d', isPhoto: true,  tint: '#1E5BFF' },
      compare:      { bg: '#F1ECE0', ink: '#123A4A', sub: 'rgba(18,58,74,.66)',    accent: '#0E9AA7', accentInk: '#ffffff', isPhoto: false },
      breakthrough: { bg: '#0E9AA7', ink: '#ffffff', sub: 'rgba(255,255,255,.9)',  accent: ACCENT, accentInk: '#063a40', isPhoto: true,  tint: '#0E9AA7' },
      grid:         { bg: '#F1ECE0', ink: '#123A4A', sub: 'rgba(18,58,74,.66)',    accent: '#1E5BFF', accentInk: '#ffffff', isPhoto: false },
      evidence:     { bg: '#14307A', ink: '#ffffff', sub: 'rgba(255,255,255,.9)',  accent: ACCENT, accentInk: '#11224d', isPhoto: true,  tint: '#14307A' },
      closing:      { bg: '#08AEBD', ink: '#ffffff', sub: 'rgba(255,255,255,.9)',  accent: ACCENT, accentInk: '#063a40', isPhoto: false },
    },
  },
];

/** 카드 id 등 시드 문자열에서 결정적으로 세트 스킴 선택. (v1은 1종이라 항상 cool-blue.) */
export function recruitScheme(seed: string): RecruitScheme {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SCHEMES[h % SCHEMES.length];
}

/** 역할별 듀오톤 틴트(이미지 provider가 pre-bake 시 사용). */
export function tintForRole(scheme: RecruitScheme, role: RecruitRole): string | undefined {
  return scheme.roles[role].tint;
}
