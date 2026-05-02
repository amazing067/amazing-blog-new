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
