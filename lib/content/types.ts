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
