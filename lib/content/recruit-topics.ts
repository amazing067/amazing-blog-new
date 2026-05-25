import type { RecruitTopic } from './types';

// 리쿠르팅 앵글 풀 — 콘텐츠 기둥 5개 × 톤 × 타깃 매핑 (플레이북 §1, §3.2).
// hook은 "구체수치 + 역설 + 타깃 호명" 공식. beats는 7장 흐름의 뼈대
// (공감/문제 → 통념·전환 → 강점1 → 강점2·증거 → CTA 방향).
// 모든 카피는 가드레일 준수: "고수익 보장/월 ○○ 확정/럭셔리 인증" 금지.
export const RECRUIT_TOPIC_POOL: RecruitTopic[] = [
  // ── P1 공감·자극 (유입) ───────────────────────────────
  {
    slug: 'p1-monday-blues', pillar: 'P1-empathy', tone: 'empathy', target: '2030-newbie',
    title: '월요일마다 죽고 싶던 직장인이었습니다',
    hook: '일요일 밤만 되면 가슴이 답답하던 3년차 직장인, 저였어요.',
    beats: ['직장인 현타 공감', '회사가 내 인생을 책임져주지 않더라', '다른 길이 있다는 실마리', '준비된 환경이 있다', '부담 없이 물어보기'],
  },
  {
    slug: 'p1-salary-stuck', pillar: 'P1-empathy', tone: 'empathy', target: '2030-newbie',
    title: '월급은 그대로인데 물가만 오를 때',
    hook: '열심히 일해도 통장은 그대로. 이게 맞나 싶을 때.',
    beats: ['고정급의 한계 공감', '노력과 보상이 비례하는 구조도 있다', '성과형 구조 소개', '시작 지원 시스템', 'DM으로 한 가지만 물어보기'],
  },
  {
    slug: 'p1-quit-fantasy', pillar: 'P1-empathy', tone: 'empathy', target: 'mix',
    title: '퇴사 상상만 100번 한 당신에게',
    hook: '실행은 못 하고 상상만 반복하고 있다면.',
    beats: ['퇴사 망설임 공감', '무작정 나오면 위험하다', '준비된 전환 경로가 있다', '교육·멘토·DB 지원', '먼저 알아보기'],
  },
  {
    slug: 'p1-housewife-restart', pillar: 'P1-empathy', tone: 'empathy', target: 'side-job',
    title: '아이 키우다 다시 일하고 싶어졌다면',
    hook: '경력 단절 후 다시 시작이 막막했던 분들께.',
    beats: ['경단녀 막막함 공감', '시간 자율적인 일도 있다', '재택·유연 근무 환경', '체계적 신입 교육', '편하게 문의'],
  },

  // ── P2 교육·정착 + DB·리드 (진입장벽 해소) ──────────────
  {
    slug: 'p2-no-cold-selling', pillar: 'P2-system', tone: 'authentic', target: '2030-newbie',
    title: '보험영업=지인 다 잃는 거 아님?',
    hook: '"보험" 하면 가족·친구부터 떠올리죠. 요즘은 시작점이 달라요.',
    beats: ['지인영업 통념', '예전엔 맞았지만 지금은 다르다', '회사가 고객 문의를 제공', '전문 상담으로 시작', 'DM 문의'],
  },
  {
    slug: 'p2-zero-experience', pillar: 'P2-system', tone: 'authentic', target: '2030-newbie',
    title: '보험 1도 모르고 시작한 신입이 적응한 법',
    hook: '업계 용어도 몰랐던 제가 자리 잡은 진짜 이유.',
    beats: ['무경력 불안 공감', '몰라도 시작할 수 있는 이유', '단계별 교육 커리큘럼', '전담 멘토가 옆에서', '궁금하면 물어보기'],
  },
  {
    slug: 'p2-company-gives-leads', pillar: 'P2-system', tone: 'authentic', target: 'mix',
    title: '고객을 어디서 찾냐고요?',
    hook: '맨땅에 헤딩이 제일 무섭죠. 그 부분이 해결됩니다.',
    beats: ['고객 확보 막막함', '혼자 발품 파는 시대 아님', '회사가 문의·DB 제공', '상담에 집중하는 구조', 'DM으로 확인'],
  },
  {
    slug: 'p2-mentor-system', pillar: 'P2-system', tone: 'authentic', target: '2030-newbie',
    title: '혼자 맨땅에 헤딩? 처음부터 멘토가 붙습니다',
    hook: '시작이 막막한 이유는 대부분 "혼자"라서예요.',
    beats: ['혼자라는 두려움', '팀으로 일한다', '밀착 멘토링 시스템', '초기 정착 동행', '부담 없이 상담'],
  },

  // ── P3 소득 (리프레이밍 — 보장·럭셔리 금지) ──────────────
  {
    slug: 'p3-commission-structure', pillar: 'P3-income', tone: 'flex-reframed', target: 'career-changer',
    title: '같은 일 하는데 왜 누군 더 가져갈까',
    hook: '핵심은 실력이 아니라 "수수료 체계"일 수 있어요.',
    beats: ['소득 차이의 진짜 원인', '회사마다 다른 구조', '체계가 다른 이유', '성과에 따라 다른 보상', '구조가 궁금하면 DM'],
  },
  {
    slug: 'p3-performance-based', pillar: 'P3-income', tone: 'flex-reframed', target: 'career-changer',
    title: '정해진 월급은 없어요. 대신 한 만큼 가져갑니다',
    hook: '안정적 고정급이 답일까, 한 만큼의 보상이 답일까.',
    beats: ['고정급 vs 성과급', '성과형의 장단점 솔직하게', '상위 사례는 생각보다 큼(범위로)', '시상·인센티브 구조', '본인에게 맞는지 상담'],
  },
  {
    slug: 'p3-why-move-ga', pillar: 'P3-income', tone: 'flex-reframed', target: 'career-changer',
    title: '원수사 설계사가 GA로 옮기는 진짜 이유',
    hook: '한 회사 상품만 vs 여러 회사 비교 설계의 차이.',
    beats: ['원수사의 한계', 'GA의 구조적 차이', '비교 설계가 주는 경쟁력', '수수료·시상 체계', '이직 고민이면 DM'],
  },

  // ── P4 자유근무 + 디지털 툴 (신뢰 최강) ──────────────────
  {
    slug: 'p4-no-commute', pillar: 'P4-lifestyle', tone: 'authentic', target: 'mix',
    title: '출근 안 하는 평일 오전 루틴',
    hook: '9시 만원 지하철 대신, 제 시간표대로 사는 하루.',
    beats: ['출퇴근 스트레스 공감', '시간을 내가 짠다', '자율 근무의 실제', '디지털 툴로 효율화', '이런 하루 궁금하면 DM'],
  },
  {
    slug: 'p4-digital-tools', pillar: 'P4-lifestyle', tone: 'authentic', target: '2030-newbie',
    title: 'AI가 콘텐츠 만들어주는 보험영업?',
    hook: '아직도 발품·전화 돌리는 영업만 떠올린다면.',
    beats: ['아날로그 영업 이미지', '요즘은 디지털로 일한다', 'AI 콘텐츠·자동화 툴 지원', '온라인으로 고객과 연결', '툴 보고 싶으면 DM'],
  },
  {
    slug: 'p4-side-job-start', pillar: 'P4-lifestyle', tone: 'authentic', target: 'side-job',
    title: '본업 유지하면서 N잡으로 시작했어요',
    hook: '전업 전환이 무섭다면, 부업으로 가볍게 시작하는 길.',
    beats: ['전업 부담 공감', 'N잡으로 시작 가능', '시간 자율 + 디지털 지원', '본업과 병행한 실제', '병행 가능한지 상담'],
  },

  // ── P5 후기·전환 스토리 (전환율 최강) ────────────────────
  {
    slug: 'p5-corp-escape', pillar: 'P5-story', tone: 'authentic', target: 'career-changer',
    title: '대기업 7년 다니다 GA 온 이유',
    hook: '남들이 부러워하던 직장을 왜 그만뒀냐는 질문에.',
    beats: ['안정적 직장의 그림자', '전환 결심의 계기', '여기서 발견한 차이', '성장·자율의 실제', '비슷한 고민이면 DM'],
  },
  {
    slug: 'p5-newbie-6months', pillar: 'P5-story', tone: 'authentic', target: '2030-newbie',
    title: '보험 무경력 신입 6개월 솔직 후기',
    hook: '좋은 얘기만? 힘들었던 것도 같이 적어봤어요.',
    beats: ['시작 전 불안', '진짜 힘들었던 점(솔직)', '버티게 해준 교육·멘토', '6개월 뒤 달라진 것', '솔직히 듣고 싶으면 DM'],
  },
  {
    slug: 'p5-working-mom', pillar: 'P5-story', tone: 'authentic', target: 'side-job',
    title: '30대 워킹맘이 설계사로 전향한 이야기',
    hook: '아이와 일, 둘 다 놓치고 싶지 않았던 선택.',
    beats: ['육아·일 병행 고민', '시간 자율이 필요했다', '유연 근무로 해결', '재택·디지털 환경', '병행 궁금하면 DM'],
  },
  {
    slug: 'p5-why-i-stay', pillar: 'P5-story', tone: 'authentic', target: 'mix',
    title: '이 일 그만두려다 안 그만둔 이유',
    hook: '솔직히 관둘 뻔했어요. 근데 마음을 바꾼 계기가 있었죠.',
    beats: ['초반 흔들림 공감', '관두려던 순간', '바뀐 결정적 계기', '지금 느끼는 보람', '고민 중이면 편하게 DM'],
  },
  {
    slug: 'p5-who-fits', pillar: 'P5-story', tone: 'authentic', target: 'mix',
    title: '이런 사람은 이 일 하지 마세요',
    hook: '아무나 추천 안 해요. 안 맞는 사람도 분명 있거든요.',
    beats: ['안 맞는 유형 솔직하게', '반대로 잘 맞는 유형', '우리 환경과 맞는지', '자기선발 기준 제시', '맞는 것 같으면 DM'],
  },
];

/**
 * 최근 사용된 slug 집합을 받아 안 쓴 앵글 N개 반환.
 * 기둥(pillar) 다양성을 위해 기둥당 1개씩 라운드로빈으로 뽑는다.
 * 풀이 소진되면 전체에서 재사용.
 */
export function pickFreshRecruitTopics(usedSlugs: Set<string>, count: number, seed?: number): RecruitTopic[] {
  const fresh = RECRUIT_TOPIC_POOL.filter(t => !usedSlugs.has(t.slug));
  const candidates = fresh.length >= count ? fresh : RECRUIT_TOPIC_POOL;

  const byPillar = new Map<string, RecruitTopic[]>();
  for (const t of shuffle(candidates, seed)) {
    const arr = byPillar.get(t.pillar) ?? [];
    arr.push(t);
    byPillar.set(t.pillar, arr);
  }

  const picked: RecruitTopic[] = [];
  const pillars = [...byPillar.keys()];
  while (picked.length < count) {
    let progressed = false;
    for (const p of pillars) {
      const next = byPillar.get(p)!.shift();
      if (next) {
        picked.push(next);
        progressed = true;
        if (picked.length >= count) break;
      }
    }
    if (!progressed) break;
  }
  return picked;
}

function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = arr.slice();
  let s = seed ?? Date.now();
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
