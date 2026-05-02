import { describe, it, expect } from 'vitest';
import { mdToCafeText } from './cafe-formatter';

describe('mdToCafeText', () => {
  it('strips heading markers', () => {
    expect(mdToCafeText('# 제목\n\n본문')).toContain('제목');
    expect(mdToCafeText('# 제목\n\n본문')).not.toContain('#');
  });
  it('preserves link as "텍스트 (URL)"', () => {
    const out = mdToCafeText('[출처: A](https://x/1)');
    expect(out).toContain('출처: A');
    expect(out).toContain('https://x/1');
  });
  it('drops bold/italic/code markers', () => {
    expect(mdToCafeText('**굵게** *기울* `코드`')).toBe('굵게 기울 코드');
  });
  it('keeps paragraph breaks', () => {
    const out = mdToCafeText('첫 단락\n\n둘째 단락');
    expect(out).toMatch(/첫 단락\n\n둘째 단락/);
  });
});
