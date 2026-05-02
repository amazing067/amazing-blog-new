export type EnforcementMode = 'open' | 'strict';

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

export type CardSlide =
  | {
      kind: 'cover';
      eyebrow: string;
      title: string;
      bigStat: string;
      bigStatLabel: string;
      iconKey: CardIconKey;
    }
  | {
      kind: 'point';
      number: string;
      bigStat: string;
      bigStatLabel: string;
      title: string;
      body: string;
      iconKey: CardIconKey;
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
