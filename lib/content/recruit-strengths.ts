// 리쿠르팅 강점 카드(slide 4) — 혜택 중심 고정 팩트뱅크.
// AI 생성 폐기 이유: ①시스템·기능은 사실이라 할루시 금지 ②줄바꿈(exp의 '\n') 100% 통제.
// 다양성은 풀에서 seed(=topic.slug)로 3개 선택해 확보. 전 항목 직업안정법·금소법 가드레일 통과.
// 근거: docs/amazing-division-reference.html (자체개발 시스템 Server/Blog/Brain 등).
import type { RecruitBenefit, RecruitCapstone } from './types';

// exp의 '\n' = 의도적 줄바꿈(구절 경계). RecruitStyle이 pre-line + keep-all로 렌더(단어 중간 줄바꿈 금지).
export const RECRUIT_STRENGTH_POOL: RecruitBenefit[] = [
  { head: '지인영업, 안 해도 됩니다', exp: '검증된 고객을 매일 자동 배정\n콜드콜·지인영업 없이 상담만' },
  { head: '콘텐츠는 AI가 씁니다', exp: '블로그·카페·카드뉴스를\nAI가 자동으로 써줍니다' },
  { head: '초보도 첫날부터 든든하게', exp: '보장분석·세일즈북·검사도구를\n입사 첫 주부터 전부 손에' },
  { head: '검사가 상담을 열어줍니다', exp: '치매·유전자 검사로\n고객이 먼저 상담을 청합니다' },
  { head: '30개사를 1초에 비교', exp: '같은 보장도 회사마다 보험료가\n다르니까, 가장 유리한 걸로' },
  { head: '거절당한 고객도 되살립니다', exp: '예외질환 검색으로\n"가입 불가"를 계약으로' },
  { head: '안 받은 실손, 찾아드립니다', exp: '고객이 놓친 진료비 청구를 찾아\n먼저 돌려주며 신뢰부터' },
  { head: '진료내역, 즉시 조회', exp: '고객 병력을 바로 확인해\n정확한 보장·고지까지 한 번에' },
];

export const RECRUIT_STRENGTH_TITLE = '어메이징이 다른 이유';

// 캡스톤(고정, 항상 노출) — "외부 SaaS가 아니라 전부 직접 만들어 다 연동된다"는 차별점.
export const RECRUIT_STRENGTH_CAPSTONE: RecruitCapstone = {
  chip: '외주 0',
  text: 'DB·진료내역·청구·고객관리까지\n전부 직접 만들어 하나로 연동',
};

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 — seed로 결정적 난수열.
function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * seed(=topic.slug)로 결정적 n개 선택 — 토픽마다 변주, 무작위 아님.
 * seeded Fisher-Yates 셔플 후 앞 n개 → 풀 크기와 무관하게 항상 중복 없음.
 */
export function pickStrengths(seed: string, n = 3): RecruitBenefit[] {
  const arr = RECRUIT_STRENGTH_POOL.slice();
  if (n >= arr.length) return arr;
  const rand = mulberry32(hashSeed(seed));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}
