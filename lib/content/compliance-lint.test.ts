import { describe, it, expect } from 'vitest';
import { lintContent } from './compliance-lint';

describe('lintContent', () => {
  it('clean text passes', () => {
    const r = lintContent('이번 달 자동차보험 갱신 안내입니다. 신규 약관이 반영되었습니다.');
    expect(r.risk_score).toBe(0);
    expect(r.must_fix).toBe(false);
  });

  it('detects absolute terms', () => {
    const r = lintContent('업계 최고의 상품, 100% 만족');
    expect(r.forbidden_terms_found).toContain('최고');
    expect(r.forbidden_terms_found).toContain('100%');
    expect(r.must_fix).toBe(true);
  });

  it('detects comparison phrases', () => {
    const r = lintContent('다른 보험사보다 저렴하고 타사 대비 우수합니다.');
    expect(r.comparison_phrases.length).toBeGreaterThanOrEqual(2);
    expect(r.must_fix).toBe(true);
  });

  it('detects guarantee phrases', () => {
    const r = lintContent('이 상품은 평생 보장 됩니다. 손해 없습니다.');
    expect(r.guarantee_phrases.length).toBeGreaterThanOrEqual(2);
    expect(r.must_fix).toBe(true);
  });

  it('detects insurer name even in neutral context', () => {
    const r = lintContent('삼성생명이 신상품을 출시했다고 발표했다.');
    expect(r.insurer_mentions).toContain('삼성생명');
    expect(r.must_fix).toBe(true);
    expect(r.risk_score).toBeGreaterThanOrEqual(50);
  });

  it('detects multiple insurer names', () => {
    const r = lintContent('현대해상과 DB손해보험이 협의 중이다.');
    expect(r.insurer_mentions).toEqual(expect.arrayContaining(['현대해상', 'DB손해보험']));
    expect(r.must_fix).toBe(true);
  });

  it('detects product name in quotes', () => {
    const r = lintContent('"행복한 노후 연금보험"이 출시되었다.');
    expect(r.product_mentions.length).toBeGreaterThanOrEqual(1);
    expect(r.must_fix).toBe(true);
  });

  it('caps risk_score at 100', () => {
    const text = '삼성생명 한화생명 교보생명 최고 100% 다른 보험사보다 좋고 보장됩니다.';
    expect(lintContent(text).risk_score).toBe(100);
  });

  it('produces suggestions for each detection', () => {
    const r = lintContent('100% 보장됩니다. 삼성화재 분석.');
    expect(r.suggestions.some(s => s.includes('100%'))).toBe(true);
    expect(r.suggestions.some(s => s.includes('삼성화재'))).toBe(true);
  });

  it('keeps must_fix false for benign single mention', () => {
    expect(lintContent('해당 상품은 가입 조건이 있습니다.').must_fix).toBe(false);
  });
});
