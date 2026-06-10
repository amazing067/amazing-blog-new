import {
  ABSOLUTE_TERMS, NEGATIVE_TERMS, COMPARISON_PATTERNS, MISLEADING_PATTERNS,
  GUARANTEE_TERMS, INSURER_NAMES, PRODUCT_NAME_PATTERNS,
} from './forbidden-terms';
import type { LintResult } from './types';

const W_FORBIDDEN = 20;
const W_COMPARISON = 15;
const W_GUARANTEE = 25;
const W_INSURER = 50;
const W_PRODUCT = 40;
const W_STAT = 15;
const MUST_FIX_THRESHOLD = 30;

// 출처 없는 수치(%·배·점·수치) — 협회는 통계에 발표기관·자료명·발표일자 요구.
// 카드 본문에 남은 숫자형 표현을 적발(원화 금액은 별도 처리되므로 제외).
const STAT_PATTERN = /\d+(?:\.\d+)?\s*[%％]|\d+(?:\.\d+)?\s*배|\d+\s*점|\d+\s*(?:배|곱)|[1-9]\d*\s*(?:년|개월|주|일|회|건|명|단계|등급)(?!\s*간)/g;

export function lintContent(text: string): LintResult {
  // 절대표현 + 부정·공포 금지어(함정 등)
  const forbidden_terms_found = [...ABSOLUTE_TERMS, ...NEGATIVE_TERMS].filter(t => text.includes(t));

  const comparison_phrases: string[] = [];
  for (const { pattern, label } of COMPARISON_PATTERNS) {
    const m = text.match(pattern);
    if (m) for (const x of m) comparison_phrases.push(`${label}: "${x}"`);
  }
  // 상품 목적 오인(보험을 저축/투자로) — 비교 버킷에 합산
  for (const { pattern, label } of MISLEADING_PATTERNS) {
    const m = text.match(pattern);
    if (m) for (const x of m) comparison_phrases.push(`${label}: "${x}"`);
  }
  // 출처 없는 수치 표현
  const stat_phrases = Array.from(new Set(text.match(STAT_PATTERN) ?? []));

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
    product_mentions.length * W_PRODUCT +
    stat_phrases.length * W_STAT;
  const risk_score = Math.min(100, raw);
  const must_fix = risk_score >= MUST_FIX_THRESHOLD;

  const suggestions: string[] = [];
  for (const t of forbidden_terms_found) suggestions.push(`금지표현 "${t}" 제거 (절대표현·부정/공포 자극어)`);
  for (const c of comparison_phrases) suggestions.push(`표현 ${c} 삭제 — 객관적 사실만, 보험 목적 오인 금지`);
  for (const st of stat_phrases) suggestions.push(`수치 "${st}" — 출처(발표기관·자료명·발표일자) 명시 또는 개념어로 대체`);
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
