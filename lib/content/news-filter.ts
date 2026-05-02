// 보험뉴스 RSS 노이즈 제거 필터
//
// 1단계: EXCLUDE_KEYWORDS — 제목 또는 본문 첫 200자에 등장하면 자동 폐기 (Gemini 호출 비용 차단)
//   대상: 업계 내부 행사·홍보·인사·만평 등 고객/설계사에게 가치 0인 콘텐츠
//
// 2단계: VALUE_KEYWORDS — 등장 횟수만큼 점수 가산 → 상위 점수 기사 우선 선택
//   대상: 약관·제도·보장 변경, 실손/세제/청구 등 실생활 영향 콘텐츠

import type { CandidateArticle } from './types';

export const EXCLUDE_KEYWORDS = [
  // 업계 내부 행사·MOU
  'MOU', '협약', '업무협약', '체결', '간담회', '발대식', '출범식',
  '개최', '성료', '성황', '기념식', '기념 행사', '기념행사', '캠페인', '이벤트',
  '전시회', '박람회', '공모전', '시상식', '시상', '수상',
  // 인사·동정
  '임명', '위촉', '선임', '취임', '인사', '동정', '부고', '별세',
  '수료', '양성', '개강', '졸업', '연수', '교육생',
  // 후원·기증·홍보
  '후원', '기증', '봉사', '봉사활동', '쾌척', '전달식', '기탁',
  '광고', '신규 광고', '광고 공개', '브랜드 광고',
  // 사진·만평·칼럼
  '사진뉴스', '포토', '만평', '카툰', '독자투고',
  // 사내·기관 행사
  '한마음', '체육대회', '워크숍', '워크샵', '송년회', '신년회',
];

export const VALUE_KEYWORDS = [
  // 제도·약관 변경
  '개정', '개편', '시행', '적용', '도입', '신설', '폐지', '변경',
  '약관', '표준약관', '제도 개선', '제도개선', '규제',
  // 보험료·보장
  '보험료 인하', '보험료 인상', '보험료 할인', '보험료',
  '보장 확대', '보장확대', '보장 강화', '한도 상향', '한도확대',
  '자기부담금', '본인부담', '면책', '면제', '환급', '환불',
  // 실손·5세대
  '실손', '5세대', '4세대', '비급여', '갱신', '갈아타기', '전환',
  // 세제·청구
  '세제', '세액공제', '소득공제', '공제', '감면', '면세', '세금',
  '청구', '보험금 청구', '손해사정', '지급',
  // 신상품·소비자 가이드
  '출시', '신상품', '비교', '추천', '꿀팁', '가이드', '주의',
  '갱신', '해지', '환급률', '실수령', '꼭 알아야',
  // 정책 발표
  '금감원', '금융위', '금융감독원', '금융위원회', '발표', '권고',
];

export type FilterResult = {
  passed: CandidateArticle[];        // 노이즈 제거 후 살아남은 것
  excluded: { article: CandidateArticle; reason: string }[];  // 폐기된 것 + 이유
};

function findFirstMatch(text: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    if (text.includes(kw)) return kw;
  }
  return null;
}

function countMatches(text: string, keywords: string[]): number {
  let n = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) n++;
  }
  return n;
}

/**
 * EXCLUDE_KEYWORDS에 걸리면 폐기, 아니면 VALUE_KEYWORDS 점수로 정렬해 반환.
 * 점수 동률 시 원래 순서 유지 (안정 정렬).
 */
export function filterAndRank(articles: CandidateArticle[]): FilterResult {
  const passed: { article: CandidateArticle; score: number }[] = [];
  const excluded: { article: CandidateArticle; reason: string }[] = [];

  for (const a of articles) {
    const haystack = a.title + ' ' + a.excerpt;
    const hit = findFirstMatch(haystack, EXCLUDE_KEYWORDS);
    if (hit) {
      excluded.push({ article: a, reason: `제외 키워드 "${hit}"` });
      continue;
    }
    const score = countMatches(haystack, VALUE_KEYWORDS);
    passed.push({ article: a, score });
  }

  // 점수 내림차순 + 안정 정렬 (Array.prototype.sort는 안정 정렬 보장 - ES2019+)
  passed.sort((x, y) => y.score - x.score);

  return {
    passed: passed.map(p => p.article),
    excluded,
  };
}
