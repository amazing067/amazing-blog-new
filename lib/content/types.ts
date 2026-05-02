export type EnforcementMode = 'open' | 'strict';

export type RSSItem = {
  source: string;
  title: string;
  link: string;
  pubDate: string;
  description: string;
};

export type CandidateArticle = {
  source: string;
  title: string;
  link: string;
  pubDate: string;
  excerpt: string;
  contentHash: string;
};

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
