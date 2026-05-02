import { describe, it, expect } from 'vitest';
import { filterAndRank } from './news-filter';
import type { CandidateArticle } from './types';

const mk = (title: string, excerpt: string): CandidateArticle => ({
  source: '한국보험신문',
  title,
  link: `https://x/${encodeURIComponent(title)}`,
  pubDate: '2026-05-02T09:00:00.000Z',
  excerpt,
  contentHash: title,
});

describe('filterAndRank', () => {
  it('excludes MOU/임명/개최 like noise', () => {
    const items = [
      mk('A보험사·B보험사 업무협약 체결', '양사 대표가 MOU에 서명했다'),
      mk('하태경 신임 보험연수원장 취임', '취임식이 진행됐다'),
      mk('어린이 미술전시회 개최', '서울에서 전시회가 열린다'),
      mk('5세대 실손보험 약관 개정 임박', '금감원이 새 약관을 발표'),
    ];
    const r = filterAndRank(items);
    expect(r.passed).toHaveLength(1);
    expect(r.passed[0].title).toBe('5세대 실손보험 약관 개정 임박');
    expect(r.excluded).toHaveLength(3);
    expect(r.excluded[0].reason).toMatch(/MOU|협약/);
  });

  it('ranks by VALUE_KEYWORDS count desc', () => {
    const items = [
      mk('보험 소식 일반', '평범한 보험 관련 정보입니다'),
      mk('5세대 실손 약관 개정 시행 — 보험료 인하 + 보장 확대', '금감원 발표 자료'),
      mk('자동차보험 갱신 안내', '내년부터 약관이 변경됩니다'),
    ];
    const r = filterAndRank(items);
    expect(r.passed).toHaveLength(3);
    // 가장 가치 키워드가 많은 것이 1위
    expect(r.passed[0].title).toContain('5세대');
  });

  it('keeps articles with no exclude/value keywords (score=0, original order preserved)', () => {
    const items = [
      mk('첫 번째 평범한 기사', '내용'),
      mk('두 번째 평범한 기사', '내용'),
    ];
    const r = filterAndRank(items);
    expect(r.passed.map(a => a.title)).toEqual([
      '첫 번째 평범한 기사',
      '두 번째 평범한 기사',
    ]);
  });

  it('exclude wins over value (sponsorship event with policy keyword)', () => {
    // 제외 우선 — 캠페인은 폐기
    const items = [mk('금감원 캠페인 개최, 보험료 인하 안내', '행사 이벤트')];
    const r = filterAndRank(items);
    expect(r.passed).toHaveLength(0);
    expect(r.excluded).toHaveLength(1);
  });
});
