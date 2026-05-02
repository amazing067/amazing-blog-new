import { describe, it, expect } from 'vitest';
import { pickFreshTopics } from './topic-picker';
import { TOPIC_POOL } from './topics';

describe('pickFreshTopics', () => {
  it('returns only unused topics when pool has enough', () => {
    const used = new Set([TOPIC_POOL[0].slug, TOPIC_POOL[1].slug]);
    const picked = pickFreshTopics(used, 3, 42);
    expect(picked).toHaveLength(3);
    for (const p of picked) {
      expect(used.has(p.slug)).toBe(false);
    }
  });

  it('falls back to whole pool when fresh exhausted', () => {
    const used = new Set(TOPIC_POOL.map(t => t.slug));
    const picked = pickFreshTopics(used, 2, 42);
    expect(picked).toHaveLength(2);
  });

  it('prefers diverse categories', () => {
    const picked = pickFreshTopics(new Set(), 5, 42);
    const cats = new Set(picked.map(t => t.category));
    // 5개 뽑으면 최소 4개 이상 다른 카테고리에서 와야 (라운드로빈)
    expect(cats.size).toBeGreaterThanOrEqual(4);
  });

  it('is deterministic given same seed', () => {
    const a = pickFreshTopics(new Set(), 3, 100).map(t => t.slug);
    const b = pickFreshTopics(new Set(), 3, 100).map(t => t.slug);
    expect(a).toEqual(b);
  });
});
