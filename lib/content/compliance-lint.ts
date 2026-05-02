import {
  ABSOLUTE_TERMS, COMPARISON_PATTERNS, GUARANTEE_TERMS,
  INSURER_NAMES, PRODUCT_NAME_PATTERNS,
} from './forbidden-terms';
import type { LintResult } from './types';

const W_FORBIDDEN = 20;
const W_COMPARISON = 15;
const W_GUARANTEE = 25;
const W_INSURER = 50;
const W_PRODUCT = 40;
const MUST_FIX_THRESHOLD = 30;

export function lintContent(text: string): LintResult {
  const forbidden_terms_found = ABSOLUTE_TERMS.filter(t => text.includes(t));

  const comparison_phrases: string[] = [];
  for (const { pattern, label } of COMPARISON_PATTERNS) {
    const m = text.match(pattern);
    if (m) for (const x of m) comparison_phrases.push(`${label}: "${x}"`);
  }

  const guarantee_phrases = GUARANTEE_TERMS.filter(t => text.includes(t));

  const insurer_mentions = INSURER_NAMES.filter(n => text.includes(n));

  const product_mentions: string[] = [];
  for (const { pattern, label } of PRODUCT_NAME_PATTERNS) {
    const m = text.match(pattern);
    if (m) for (const x of m) product_mentions.push(`${label}: "${x}"`);
  }

  const raw =
    forbidden_terms_found.length * W_FORBIDDEN +
    comparison_phrases.length * W_COMPARISON +
    guarantee_phrases.length * W_GUARANTEE +
    insurer_mentions.length * W_INSURER +
    product_mentions.length * W_PRODUCT;
  const risk_score = Math.min(100, raw);
  const must_fix = risk_score >= MUST_FIX_THRESHOLD;

  const suggestions: string[] = [];
  for (const t of forbidden_terms_found) suggestions.push(`광고 절대표현 "${t}" 제거 또는 정량 표현으로 대체`);
  for (const c of comparison_phrases) suggestions.push(`비교 표현 ${c} 삭제 — 객관적 사실만 기술`);
  for (const g of guarantee_phrases) suggestions.push(`보장성 단정 "${g}" 제거 — 약관 조건 명시`);
  for (const n of insurer_mentions) suggestions.push(`보험사명 "${n}" 익명화 — "한 생명보험사", "주요 손해보험사" 등으로 대체`);
  for (const p of product_mentions) suggestions.push(`상품명 ${p} 일반명사로 대체 — "실손의료보험", "암보험" 등`);

  return {
    forbidden_terms_found,
    comparison_phrases,
    guarantee_phrases,
    insurer_mentions,
    product_mentions,
    risk_score,
    must_fix,
    suggestions,
  };
}
