export type EnforcementMode = 'open' | 'strict';

// 카드뉴스 디자인 스타일 — 요일별 로테이션 (월=A 화=B 수=C 목=D 금=E 토=F, 일=쉼)
// A=BoldColor(현재), B=Magazine, C=Pastel, D=DarkPremium, E=DataReport, F=Y2KRetro
export type CardStyleKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type Topic = {
  slug: string;              // 안정적 식별자 (중복 차단용)
  category: TopicCategory;
  title: string;             // 후킹 제목 (질문형 권장)
  hook: string;              // 도입부에서 어그로 끌 한 문장
  outline: string[];         // 본문에서 다뤄야 할 핵심 포인트
};

export type TopicCategory =
  | '실손'
  | '자동차'
  | '암·진단'
  | '치매·간병'
  | '연금·저축'
  | '청구·분쟁'
  | '세제·환급'
  | '가입전략';

export type LintResult = {
  forbidden_terms_found: string[];
  comparison_phrases: string[];
  guarantee_phrases: string[];
  insurer_mentions: string[];
  product_mentions: string[];
  risk_score: number;
  must_fix: boolean;
  suggestions: string[];
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
};

export type GeneratedSummary = {
  title: string;
  body_md: string;
  usage?: Usage;
};

// 카드뉴스 5장 슬라이드 — cover + point×3 + closing
export type CardIconKey =
  | 'sparkles' | 'shield'
  | 'trendingDown' | 'alert'
  | 'gift' | 'stethoscope'
  | 'calculator' | 'baby'
  | 'search' | 'clipboard'
  | 'zap' | 'arrow';

// 리쿠르팅 인포그래픽 데이터
export type RecruitCompare = {
  aTitle: string;    // 예: "직장인" / "예전엔"
  aItems: string[];  // 2~3개
  bTitle: string;    // 예: "설계사" / "지금은"
  bItems: string[];  // 2~3개
};
export type RecruitGridItem = { iconKey: CardIconKey; label: string };

// 강점 카드(혜택 중심) — 다크 타일 1개. exp의 '\n'은 의도적 줄바꿈(구절 경계, 단어 중간 금지).
export type RecruitBenefit = { head: string; exp: string };
// 강점 카드 하단 캡스톤 띠 — "전부 직접 만들어 하나로 연동" 펀치라인(고정).
export type RecruitCapstone = { chip: string; text: string };

// 리쿠르팅 듀오톤 사진 — 커버·통념·증거 카드(1·3·5)에 들어감.
// src는 로컬 경로(캡처 안정), tint는 듀오톤 브랜드색(pre-bake 시 이미 적용된 경우 표시용).
export type RecruitImage = { src: string; tint: string };

// 광고심의 통과를 위한 통계 출처 — bigStat 옆에 표시되고 검수자가 검증
export type SlideSource = {
  organization: string;   // 권위 있는 공식 기관 (예: "국립암센터", "금감원", "통계청")
  name: string;           // 자료 제목 (예: "암통계 연례보고서 2024")
  url?: string;           // 다운로드/원본 페이지 URL (https://) — 검수자가 클릭해서 검증
  retrieved_at?: string;  // 조회 일자 (YYYY-MM-DD)
};

export type CardSlide =
  | {
      kind: 'cover';
      eyebrow: string;
      title: string;
      bigStat: string;
      bigStatLabel: string;
      iconKey: CardIconKey;
      source?: SlideSource;     // 표지의 거대 통계 출처
      bgImage?: string;         // (구) 커버 일러스트 경로. image 도입 후 폴백용.
      image?: RecruitImage;     // 리쿠르팅 전용 — 커버 듀오톤 사진(로컬). 없으면 비비드 단색 커버.
    }
  | {
      kind: 'point';
      number: string;
      bigStat: string;
      bigStatLabel: string;
      title: string;
      body: string;
      iconKey: CardIconKey;
      source?: SlideSource;     // 각 포인트의 통계 출처
      // ↓ 리쿠르팅 전용 인포그래픽 레이아웃 (보험 카드는 미사용 — optional이라 영향 없음)
      layout?: 'default' | 'compare' | 'grid' | 'benefits';
      compare?: RecruitCompare;        // layout='compare' 일 때
      gridItems?: RecruitGridItem[];   // layout='grid' 일 때 (3~4개, 구버전 카드 하위호환)
      benefits?: RecruitBenefit[];     // layout='benefits' 일 때 (강점 카드, 정확히 3개) — route가 팩트뱅크에서 주입
      capstone?: RecruitCapstone;      // layout='benefits' 일 때 하단 캡스톤 띠 (고정)
      image?: RecruitImage;            // 리쿠르팅 전용 — 통념·증거 카드 듀오톤 사진(로컬). 없으면 단색 fallback.
    }
  | {
      kind: 'closing';
      title: string;
      items: string[];
      footer: string;
      iconKey: CardIconKey;
    };

export type GeneratedCardSet = {
  title: string;          // 콘텐츠 제목 (slide[0].title 사용 가능)
  slides: CardSlide[];    // 정확히 5장
  usage?: Usage;
};

// 광고심의필 정보 — BlogGenerator의 ApprovalGenerator와 동일 구조
export type ComplianceInfo = {
  company: string;          // 회사명 (default "프라임에셋")
  branch?: string;          // 지점명
  designer?: string;        // 설계사명
  registration?: string;    // 협회등록번호
  number?: string;          // 심의번호 (예: "제2026-1234호")
  start_date?: string;      // 심의 시작일 (YYYY-MM-DD)
  end_date?: string;        // 심의 종료일 (YYYY-MM-DD)
  include_warning?: boolean;// 경고 문구 포함 여부
};

// ============================================
// 리쿠르팅(설계사 모집) 트랙 — 보험 콘텐츠와 별개
// DB에선 content_items.type = 'recruit-card' / 'recruit-blog'로 분리.
// 슬라이드는 기존 CardSlide(cover/point/closing) 재사용 → 렌더러 공용.
// ============================================

// 콘텐츠 기둥 5개 (플레이북 §3.2)
export type RecruitPillar =
  | 'P1-empathy'    // "왜 안 떠나?" 공감·자극 (유입)
  | 'P2-system'     // "맨땅 영업 안 해도 됨" 교육·정착 + DB·리드
  | 'P3-income'     // "여기선 이렇게 번다" 소득 (리프레이밍)
  | 'P4-lifestyle'  // "이렇게 일한다" 자유근무 + 디지털 툴
  | 'P5-story';     // "진짜 사람들" 후기·전환

export type RecruitTone = 'empathy' | 'flex-reframed' | 'authentic';
export type RecruitTarget = '2030-newbie' | 'career-changer' | 'side-job' | 'mix';

// 토픽별 이미지 장면 — 슬롯(커버·통념전환·증거)마다 내용에 맞는 장면을 직접 기술.
// 실시간 생성 시 이 영문 프롬프트 + 공통 STYLE로 Imagen을 호출한다. (얼굴·글자 없음 전제)
export type RecruitScenes = {
  cover: string;          // 1장: 타깃의 고통/욕구 장면
  breakthrough: string;   // 3장: 통념 깨기/전환점 장면
  evidence: string;       // 5장: 강점·증거 장면
};

export type RecruitTopic = {
  slug: string;            // 안정적 식별자 (30일 중복 차단)
  pillar: RecruitPillar;
  tone: RecruitTone;
  target: RecruitTarget;
  title: string;           // 앵글 제목
  hook: string;            // 커버 후킹 한 문장
  beats: string[];         // 7장 흐름을 위한 핵심 비트 (공감→전환→강점→증거→CTA)
  scenes: RecruitScenes;   // 내용 맞춤 이미지 장면(슬롯별) — 실시간 생성 프롬프트 코어
};
