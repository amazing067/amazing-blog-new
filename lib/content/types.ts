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

export type GeneratedSummary = {
  title: string;
  body_md: string;
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
};
