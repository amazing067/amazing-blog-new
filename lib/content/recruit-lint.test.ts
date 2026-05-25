import { describe, it, expect } from 'vitest';
import { lintRecruit } from './recruit-lint';

describe('lintRecruit', () => {
  it('clean recruiting text passes', () => {
    const r = lintRecruit('성과에 따라 수수료 체계가 다릅니다. 궁금하면 DM으로 문의 주세요. 교육과 멘토가 처음부터 함께합니다.');
    expect(r.risk_score).toBe(0);
    expect(r.must_fix).toBe(false);
  });

  it('detects income-guarantee terms (직업안정법)', () => {
    const r = lintRecruit('누구나 가능, 무조건 고수익!');
    expect(r.income_guarantee.length).toBeGreaterThanOrEqual(1);
    expect(r.must_fix).toBe(true);
  });

  it('detects guaranteed monthly amount pattern', () => {
    const r = lintRecruit('월 500만원 확정 보장됩니다.');
    expect(r.income_guarantee.length).toBeGreaterThanOrEqual(1);
    expect(r.must_fix).toBe(true);
  });

  it('detects luxury flex (다단계 연상)', () => {
    const r = lintRecruit('이번 달 수익 인증, 외제차 뽑았습니다.');
    expect(r.luxury_flex.length).toBeGreaterThanOrEqual(1);
    expect(r.must_fix).toBe(true);
  });

  it('detects MLM / 유사수신 signal', () => {
    const r = lintRecruit('월급관리 스터디 모집합니다. 투자 권유 드려요.');
    expect(r.mlm_signal.length).toBeGreaterThanOrEqual(1);
    expect(r.must_fix).toBe(true);
  });

  it('flags a phone number but does not must_fix on its own', () => {
    const r = lintRecruit('편하게 010-1234-5678 로 연락 주세요.');
    expect(r.phone_numbers.length).toBe(1);
    expect(r.must_fix).toBe(false);
  });

  it('escalates phone + income guarantee to must_fix (금소법 업무광고)', () => {
    const r = lintRecruit('고수익 보장! 010-1234-5678 로 연락 주세요.');
    expect(r.must_fix).toBe(true);
  });

  it('caps risk_score at 100', () => {
    const r = lintRecruit('무조건 고수익 누구나 가능 떼돈, 외제차 롤렉스 명품 수익 인증, 투자 권유 유사수신 월급관리 스터디');
    expect(r.risk_score).toBe(100);
  });

  it('produces suggestions for each detection', () => {
    const r = lintRecruit('고수익 보장, 외제차 인증');
    expect(r.suggestions.length).toBeGreaterThanOrEqual(2);
  });

  it('allows reframed income language', () => {
    const r = lintRecruit('정해진 월급은 아니에요. 성과에 따라 다르고, 상위 사례는 생각보다 큽니다.');
    expect(r.must_fix).toBe(false);
    expect(r.risk_score).toBe(0);
  });
});
