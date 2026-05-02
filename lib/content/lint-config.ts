// 콘텐츠 종류별 룰엔진(광고심의 lint) 적용 여부 토글
// 값을 true로 바꾸면 즉시 해당 cron/API에서 lintContent 호출 + DB 기록 + 어드민 표시.
//
// 현재 정책: 카드뉴스만 룰엔진 적용. 보험뉴스는 카페용 텍스트라 적용 X.
// 추후 보험뉴스도 적용하고 싶으면 news를 true로 바꾸기만 하면 됨.

export const LINT_ENABLED = {
  news: false,  // 보험뉴스 (카페 게시용)
  card: true,   // 카드뉴스 (인스타 게시용)
} as const;
