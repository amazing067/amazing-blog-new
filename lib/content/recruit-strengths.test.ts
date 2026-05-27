import { describe, it, expect } from 'vitest';
import { lintRecruit } from './recruit-lint';
import {
  RECRUIT_STRENGTH_POOL,
  RECRUIT_STRENGTH_CAPSTONE,
  pickStrengths,
} from './recruit-strengths';

describe('recruit strength fact-bank', () => {
  it('모든 혜택 카피 + 캡스톤이 가드레일 통과 (직업안정법·금소법)', () => {
    const all = [
      ...RECRUIT_STRENGTH_POOL.map((b) => `${b.head} ${b.exp}`),
      `${RECRUIT_STRENGTH_CAPSTONE.chip} ${RECRUIT_STRENGTH_CAPSTONE.text}`,
    ].join('\n');
    const r = lintRecruit(all);
    expect(r.must_fix).toBe(false);
    expect(r.risk_score).toBe(0);
  });

  it('각 exp는 정확히 한 번 줄바꿈(\\n) — 2줄 통제', () => {
    for (const b of RECRUIT_STRENGTH_POOL) {
      expect(b.exp.split('\n').length).toBe(2);
      expect(b.head.includes('\n')).toBe(false);
    }
  });
});

describe('pickStrengths', () => {
  it('같은 seed → 항상 같은 결과 (결정적)', () => {
    expect(pickStrengths('topic-a')).toEqual(pickStrengths('topic-a'));
  });

  it('기본 3개, 세트 안에서 중복 없음', () => {
    const picked = pickStrengths('topic-a');
    expect(picked).toHaveLength(3);
    const heads = new Set(picked.map((b) => b.head));
    expect(heads.size).toBe(3);
  });

  it('seed가 다르면 조합이 변주된다 (전부 동일하지 않음)', () => {
    const seeds = ['p1-empathy', 'p3-income', 'career-changer', 'side-job', 'p5-story'];
    const combos = new Set(seeds.map((s) => pickStrengths(s).map((b) => b.head).join('|')));
    expect(combos.size).toBeGreaterThan(1);
  });

  it('n이 풀 크기 이상이면 전체 반환', () => {
    expect(pickStrengths('x', 99)).toHaveLength(RECRUIT_STRENGTH_POOL.length);
  });
});
