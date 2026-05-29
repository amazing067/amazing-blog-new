import type { RecruitTopic } from './types';

// 리쿠르팅 앵글 풀 — 콘텐츠 기둥 5개 × 톤 × 타깃 매핑 (플레이북 §1, §3.2).
// hook은 "구체수치 + 역설 + 타깃 호명" 공식. beats는 7장 흐름의 뼈대
// (공감/문제 → 통념·전환 → 강점1 → 강점2·증거 → CTA 방향).
// 모든 카피는 가드레일 준수: "고수익 보장/월 ○○ 확정/럭셔리 인증" 금지.
// scenes = 슬롯별 이미지 장면(영문 = Imagen 프롬프트 코어). 공통 STYLE은 recruit-image-gen이 덧붙인다.
export const RECRUIT_TOPIC_POOL: RecruitTopic[] = [
  // ── P1 공감·자극 (유입) ───────────────────────────────
  {
    slug: 'p1-monday-blues', pillar: 'P1-empathy', tone: 'empathy', target: '2030-newbie',
    title: '월요일마다 죽고 싶던 직장인이었습니다',
    hook: '일요일 밤만 되면 가슴이 답답하던 3년차 직장인, 저였어요.',
    beats: ['직장인 현타 공감', '회사가 내 인생을 책임져주지 않더라', '다른 길이 있다는 실마리', '준비된 환경이 있다', '부담 없이 물어보기'],
    scenes: {
      cover: 'crowded gloomy monday-morning subway, hanging handles, cold blue light, commuter rush',
      breakthrough: 'an office desk at dusk with a cold coffee and stacked documents, tired mood',
      evidence: 'an open notebook and pen by a window with a city view, a fresh-start feeling',
    },
  },
  {
    slug: 'p1-salary-stuck', pillar: 'P1-empathy', tone: 'empathy', target: '2030-newbie',
    title: '월급은 그대로인데 물가만 오를 때',
    hook: '열심히 일해도 통장은 그대로. 이게 맞나 싶을 때.',
    beats: ['고정급의 한계 공감', '노력과 보상이 비례하는 구조도 있다', '성과형 구조 소개', '시작 지원 시스템', 'DM으로 한 가지만 물어보기'],
    scenes: {
      cover: 'close-up of receipts, a few coins and a thin wallet on a table, tight budget mood',
      breakthrough: 'a household budget book with a calculator and a rising price chart',
      evidence: 'a desk with an upward bar chart on paper, effort being rewarded',
    },
  },
  {
    slug: 'p1-quit-fantasy', pillar: 'P1-empathy', tone: 'empathy', target: 'mix',
    title: '퇴사 상상만 100번 한 당신에게',
    hook: '실행은 못 하고 상상만 반복하고 있다면.',
    beats: ['퇴사 망설임 공감', '무작정 나오면 위험하다', '준비된 전환 경로가 있다', '교육·멘토·DB 지원', '먼저 알아보기'],
    scenes: {
      cover: 'a blank resignation-letter form and a hesitating pen on a desk, dim light',
      breakthrough: 'two open doors in a hallway, one bright one dim, a choice metaphor, no people',
      evidence: 'an organized desk with a textbook, checklist and laptop, well prepared',
    },
  },
  {
    slug: 'p1-housewife-restart', pillar: 'P1-empathy', tone: 'empathy', target: 'side-job',
    title: '아이 키우다 다시 일하고 싶어졌다면',
    hook: '경력 단절 후 다시 시작이 막막했던 분들께.',
    beats: ['경단녀 막막함 공감', '시간 자율적인 일도 있다', '재택·유연 근무 환경', '체계적 신입 교육', '편하게 문의'],
    scenes: {
      cover: "a living-room dining table with a child's toy and an open laptop, warm home light",
      breakthrough: 'a tidy home desk by a sunny window during daytime, flexible work feeling',
      evidence: 'a study textbook and a certificate on a desk, a restart',
    },
  },

  // ── P2 교육·정착 + DB·리드 (진입장벽 해소) ──────────────
  {
    slug: 'p2-no-cold-selling', pillar: 'P2-system', tone: 'authentic', target: '2030-newbie',
    title: '보험영업=지인 다 잃는 거 아님?',
    hook: '"보험" 하면 가족·친구부터 떠올리죠. 요즘은 시작점이 달라요.',
    beats: ['지인영업 통념', '예전엔 맞았지만 지금은 다르다', '회사가 고객 문의를 제공', '전문 상담으로 시작', 'DM 문의'],
    scenes: {
      cover: 'a smartphone face-down on a desk next to coffee, hesitation mood',
      breakthrough: 'a vintage rotary phone beside a modern laptop, old vs new ways',
      evidence: 'a laptop on a clean desk showing an abstract inquiry-list dashboard',
    },
  },
  {
    slug: 'p2-zero-experience', pillar: 'P2-system', tone: 'authentic', target: '2030-newbie',
    title: '보험 1도 모르고 시작한 신입이 적응한 법',
    hook: '업계 용어도 몰랐던 제가 자리 잡은 진짜 이유.',
    beats: ['무경력 불안 공감', '몰라도 시작할 수 있는 이유', '단계별 교육 커리큘럼', '전담 멘토가 옆에서', '궁금하면 물어보기'],
    scenes: {
      cover: 'a brand-new notebook, a pencil and a work bag, first-day fresh start',
      breakthrough: 'a desk with step-by-step textbooks and sticky notes, learning curriculum',
      evidence: 'two coffee mugs side by side on a desk, mentorship, no people',
    },
  },
  {
    slug: 'p2-company-gives-leads', pillar: 'P2-system', tone: 'authentic', target: 'mix',
    title: '고객을 어디서 찾냐고요?',
    hook: '맨땅에 헤딩이 제일 무섭죠. 그 부분이 해결됩니다.',
    beats: ['고객 확보 막막함', '혼자 발품 파는 시대 아님', '회사가 문의·DB 제공', '상담에 집중하는 구조', 'DM으로 확인'],
    scenes: {
      cover: 'a pair of worn shoes on an empty road, cold-prospecting struggle',
      breakthrough: 'a laptop showing an incoming customer-leads dashboard, hands-free',
      evidence: 'a clean consultation table with two chairs and documents, focused',
    },
  },
  {
    slug: 'p2-mentor-system', pillar: 'P2-system', tone: 'authentic', target: '2030-newbie',
    title: '혼자 맨땅에 헤딩? 처음부터 멘토가 붙습니다',
    hook: '시작이 막막한 이유는 대부분 "혼자"라서예요.',
    beats: ['혼자라는 두려움', '팀으로 일한다', '밀착 멘토링 시스템', '초기 정착 동행', '부담 없이 상담'],
    scenes: {
      cover: 'a single lit desk in an empty dark office, an alone feeling',
      breakthrough: 'two chairs at one desk together, side-by-side mentoring',
      evidence: 'an open notebook with handwritten guidance marks, mentoring',
    },
  },

  // ── P3 소득 (리프레이밍 — 보장·럭셔리 금지) ──────────────
  {
    slug: 'p3-commission-structure', pillar: 'P3-income', tone: 'flex-reframed', target: 'career-changer',
    title: '같은 일 하는데 왜 누군 더 가져갈까',
    hook: '핵심은 실력이 아니라 "수수료 체계"일 수 있어요.',
    beats: ['소득 차이의 진짜 원인', '회사마다 다른 구조', '체계가 다른 이유', '성과에 따라 다른 보상', '구조가 궁금하면 DM'],
    scenes: {
      cover: 'two pay envelopes of different thickness on a desk, income gap',
      breakthrough: 'a paper with an abstract commission-structure diagram and a pen',
      evidence: 'an upward commission chart on a desk with a calculator',
    },
  },
  {
    slug: 'p3-performance-based', pillar: 'P3-income', tone: 'flex-reframed', target: 'career-changer',
    title: '정해진 월급은 없어요. 대신 한 만큼 가져갑니다',
    hook: '안정적 고정급이 답일까, 한 만큼의 보상이 답일까.',
    beats: ['고정급 vs 성과급', '성과형의 장단점 솔직하게', '상위 사례는 생각보다 큼(범위로)', '시상·인센티브 구조', '본인에게 맞는지 상담'],
    scenes: {
      cover: 'a flat line versus a rising line chart on paper, fixed vs performance',
      breakthrough: 'a balance scale with documents, weighing pros and cons, no people',
      evidence: 'rising bar graphs and a calculator on a clean desk',
    },
  },
  {
    slug: 'p3-why-move-ga', pillar: 'P3-income', tone: 'flex-reframed', target: 'career-changer',
    title: '원수사 설계사가 GA로 옮기는 진짜 이유',
    hook: '한 회사 상품만 vs 여러 회사 비교 설계의 차이.',
    beats: ['원수사의 한계', 'GA의 구조적 차이', '비교 설계가 주는 경쟁력', '수수료·시상 체계', '이직 고민이면 DM'],
    scenes: {
      cover: 'one folder versus many folders fanned out on a desk, single vs multiple options',
      breakthrough: 'a laptop showing multiple insurer comparison columns, abstract',
      evidence: 'a competitive performance chart with documents on a desk',
    },
  },

  // ── P4 자유근무 + 디지털 툴 (신뢰 최강) ──────────────────
  {
    slug: 'p4-no-commute', pillar: 'P4-lifestyle', tone: 'authentic', target: 'mix',
    title: '출근 안 하는 평일 오전 루틴',
    hook: '9시 만원 지하철 대신, 제 시간표대로 사는 하루.',
    beats: ['출퇴근 스트레스 공감', '시간을 내가 짠다', '자율 근무의 실제', '디지털 툴로 효율화', '이런 하루 궁금하면 DM'],
    scenes: {
      cover: 'a sunny morning cafe window seat with a laptop and warm coffee, an empty subway platform seen outside, freedom',
      breakthrough: 'a wall clock beside a hand-written daily schedule on paper, time autonomy',
      evidence: 'a relaxed home desk on a bright weekday morning with coffee and laptop',
    },
  },
  {
    slug: 'p4-digital-tools', pillar: 'P4-lifestyle', tone: 'authentic', target: '2030-newbie',
    title: 'AI가 콘텐츠 만들어주는 보험영업?',
    hook: '아직도 발품·전화 돌리는 영업만 떠올린다면.',
    beats: ['아날로그 영업 이미지', '요즘은 디지털로 일한다', 'AI 콘텐츠·자동화 툴 지원', '온라인으로 고객과 연결', '툴 보고 싶으면 DM'],
    scenes: {
      cover: 'a stack of paper flyers beside a sleek laptop, analog vs digital sales',
      breakthrough: 'a laptop showing an abstract AI content-generation interface, glowing',
      evidence: 'a minimal digital workspace with laptop, phone and tablet connected',
    },
  },
  {
    slug: 'p4-side-job-start', pillar: 'P4-lifestyle', tone: 'authentic', target: 'side-job',
    title: '본업 유지하면서 N잡으로 시작했어요',
    hook: '전업 전환이 무섭다면, 부업으로 가볍게 시작하는 길.',
    beats: ['전업 부담 공감', 'N잡으로 시작 가능', '시간 자율 + 디지털 지원', '본업과 병행한 실제', '병행 가능한지 상담'],
    scenes: {
      cover: 'a daytime office desk and an evening laptop at home, two work scenes, balance',
      breakthrough: 'a cozy evening home desk with a laptop and a lamp, light side work',
      evidence: 'a calendar and a laptop on a desk showing a balanced weekly schedule',
    },
  },

  // ── P5 후기·전환 스토리 (전환율 최강) ────────────────────
  {
    slug: 'p5-corp-escape', pillar: 'P5-story', tone: 'authentic', target: 'career-changer',
    title: '대기업 7년 다니다 GA 온 이유',
    hook: '남들이 부러워하던 직장을 왜 그만뒀냐는 질문에.',
    beats: ['안정적 직장의 그림자', '전환 결심의 계기', '여기서 발견한 차이', '성장·자율의 실제', '비슷한 고민이면 DM'],
    scenes: {
      cover: 'an employee ID badge and a folded suit on a desk, leaving a corporate job',
      breakthrough: 'tall corporate buildings casting shadows over a narrow path, no people',
      evidence: 'a bright new personal workspace with plants and a laptop, growth',
    },
  },
  {
    slug: 'p5-newbie-6months', pillar: 'P5-story', tone: 'authentic', target: '2030-newbie',
    title: '보험 무경력 신입 6개월 솔직 후기',
    hook: '좋은 얘기만? 힘들었던 것도 같이 적어봤어요.',
    beats: ['시작 전 불안', '진짜 힘들었던 점(솔직)', '버티게 해준 교육·멘토', '6개월 뒤 달라진 것', '솔직히 듣고 싶으면 DM'],
    scenes: {
      cover: 'an empty desk on a first day with a single notebook, a nervous start',
      breakthrough: 'a worn study notebook with coffee stains and sticky notes, perseverance',
      evidence: 'an organized confident desk after six months with a certificate, growth',
    },
  },
  {
    slug: 'p5-working-mom', pillar: 'P5-story', tone: 'authentic', target: 'side-job',
    title: '30대 워킹맘이 설계사로 전향한 이야기',
    hook: '아이와 일, 둘 다 놓치고 싶지 않았던 선택.',
    beats: ['육아·일 병행 고민', '시간 자율이 필요했다', '유연 근무로 해결', '재택·디지털 환경', '병행 궁금하면 DM'],
    scenes: {
      cover: "a child's small backpack next to a laptop bag at a home entrance, a mom's balance",
      breakthrough: 'a clock showing afternoon by a home desk, a flexible school-pickup schedule',
      evidence: 'a warm home-office desk with a laptop by a sunny window, remote work',
    },
  },
  {
    slug: 'p5-why-i-stay', pillar: 'P5-story', tone: 'authentic', target: 'mix',
    title: '이 일 그만두려다 안 그만둔 이유',
    hook: '솔직히 관둘 뻔했어요. 근데 마음을 바꾼 계기가 있었죠.',
    beats: ['초반 흔들림 공감', '관두려던 순간', '바뀐 결정적 계기', '지금 느끼는 보람', '고민 중이면 편하게 DM'],
    scenes: {
      cover: 'a half-packed cardboard box on a desk, about to quit, second thoughts',
      breakthrough: 'a desk lamp turned back on over an open notebook at night, a turning point',
      evidence: 'a warm fulfilling workspace with a thank-you note and coffee, no text',
    },
  },
  {
    slug: 'p5-who-fits', pillar: 'P5-story', tone: 'authentic', target: 'mix',
    title: '이런 사람은 이 일 하지 마세요',
    hook: '아무나 추천 안 해요. 안 맞는 사람도 분명 있거든요.',
    beats: ['안 맞는 유형 솔직하게', '반대로 잘 맞는 유형', '우리 환경과 맞는지', '자기선발 기준 제시', '맞는 것 같으면 DM'],
    scenes: {
      cover: 'two arrows painted on the ground pointing opposite ways, a fit-or-not choice',
      breakthrough: 'a clipboard with an abstract checklist and a pen, self-selection',
      evidence: 'a well-suited tidy desk with a confident setup, the right fit',
    },
  },

  // ── 신규 앵글 (풀 확장 19→27) ─────────────────────────────
  {
    slug: 'p3-commission-news', pillar: 'P3-income', tone: 'flex-reframed', target: 'career-changer',
    title: '요즘 수수료 뉴스, 보셨어요?',
    hook: "설계사 수수료가 화제인 요즘, 핵심은 '어디서 일하냐'예요.",
    beats: ['수수료 뉴스 관심 환기', '수수료는 회사 구조 따라 다르다', 'GA·성과형 구조의 차이', '한 만큼 가져가는 체계', '구조 궁금하면 DM'],
    scenes: {
      cover: 'a newspaper and a laptop showing a finance news screen on a desk, topical, no readable text',
      breakthrough: 'papers comparing different commission structures with a pen',
      evidence: 'an upward earnings chart with a calculator on a clean desk',
    },
  },
  {
    slug: 'p3-no-ceiling', pillar: 'P3-income', tone: 'flex-reframed', target: 'career-changer',
    title: '월급 천장이 없다는 것',
    hook: '아무리 잘해도 정해진 상한이 있다면, 답답하지 않나요.',
    beats: ['고정급 천장 공감', '상한 없는 구조', '성과형의 의미', '한 만큼의 보상', '구조 궁금하면 DM'],
    scenes: {
      cover: 'a bar chart hitting a ceiling line on paper, salary-cap metaphor',
      breakthrough: 'an upward arrow breaking through a ceiling line, no limit',
      evidence: 'an open-ended rising curve chart on a desk with a calculator',
    },
  },
  {
    slug: 'p2-license-support', pillar: 'P2-system', tone: 'authentic', target: '2030-newbie',
    title: '보험 자격증부터 같이 준비해요',
    hook: '뭐부터 해야 할지 모르겠다면, 자격증부터 같이 시작해요.',
    beats: ['시작 막막함', '자격·등록부터 지원', '단계별 준비 동행', '첫 고객까지 로드맵', '편하게 문의'],
    scenes: {
      cover: 'a license study textbook with a pencil and highlighter, exam prep',
      breakthrough: 'a roadmap checklist on paper with check marks, step by step',
      evidence: 'a certificate and a registration document on a desk, achievement',
    },
  },
  {
    slug: 'p2-team-support', pillar: 'P2-system', tone: 'authentic', target: 'mix',
    title: '혼자가 아니라 팀으로',
    hook: '맨땅에 혼자 헤딩? 여긴 팀으로 움직여요.',
    beats: ['혼자라는 두려움', '팀 단위로 일한다', '정보·노하우 공유', '함께 성장', '부담 없이 상담'],
    scenes: {
      cover: 'a meeting table with several chairs and shared documents, teamwork, no people',
      breakthrough: 'a whiteboard with abstract diagrams and sticky notes, collaboration',
      evidence: 'a bright shared coworking space with several desks, team energy',
    },
  },
  {
    slug: 'p4-work-anywhere', pillar: 'P4-lifestyle', tone: 'authentic', target: 'mix',
    title: '오늘 사무실은 이 카페예요',
    hook: '정해진 자리가 없어요. 오늘은 여기, 내일은 거기.',
    beats: ['고정 자리 없는 자유', '어디서나 일하는 환경', '디지털 툴로 가능', '장소 자율의 실제', '이런 근무 궁금하면 DM'],
    scenes: {
      cover: 'a laptop and iced coffee at a bright cafe window seat, work anywhere',
      breakthrough: 'a laptop and a bag on a park bench, outdoor flexible work',
      evidence: 'a laptop and smartphone connected on a small table, mobile work',
    },
  },
  {
    slug: 'p4-family-time', pillar: 'P4-lifestyle', tone: 'authentic', target: 'side-job',
    title: '아이 하원 시간에 맞춰 일해요',
    hook: '9 to 6에 묶이지 않으니, 아이 하원도 제가 가요.',
    beats: ['육아·근무 충돌 공감', '시간 자율로 해결', '유연 근무 환경', '가정·일 병행 실제', '병행 궁금하면 DM'],
    scenes: {
      cover: "small children's shoes at a sunny home entrance in the afternoon, family time",
      breakthrough: 'a calendar with a flexible afternoon schedule and a laptop',
      evidence: 'a warm living-room desk with a laptop, family-life balance, no faces',
    },
  },
  {
    slug: 'p1-30s-anxiety', pillar: 'P1-empathy', tone: 'empathy', target: '2030-newbie',
    title: '서른, 이대로 괜찮을까',
    hook: '남들 다 자리 잡는 것 같은데 나만 제자리인 것 같을 때.',
    beats: ['서른 불안 공감', '지금도 늦지 않았다', '전환 경로가 있다', '준비된 환경', '부담 없이 알아보기'],
    scenes: {
      cover: 'a coffee by a rainy window and an empty chair, thirties anxiety, contemplative',
      breakthrough: 'a fresh diary opened to a blank first page with a pen, a new beginning',
      evidence: 'a calm organized desk for a fresh start with a plant and laptop',
    },
  },
  {
    slug: 'p5-2nd-career', pillar: 'P5-story', tone: 'authentic', target: 'career-changer',
    title: '정년 없이 평생 하는 일',
    hook: '은퇴 나이를 내가 정하는 직업이 있다면.',
    beats: ['정년 압박 공감', '평생직업의 의미', '전문성이 쌓이는 구조', '오래 일하는 실제', '고민이면 DM'],
    scenes: {
      cover: 'a well-used fountain pen and a thick worn diary, a lifelong career',
      breakthrough: 'a stack of yearly diaries on a shelf, accumulated expertise',
      evidence: "a seasoned professional's warm desk with books, no text",
    },
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
