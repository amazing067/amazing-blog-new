// 리쿠르팅(설계사 모집) 콘텐츠 전용 가드레일.
// 보험 콘텐츠의 compliance-lint(수치·금액·보험사명 차단)와는 완전히 별개의 규칙셋.
// 리쿠르팅은 협회 광고심의 면제지만, 직업안정법·금소법 업무광고·인스타 섀도우밴·
// 2030 다단계 불신이라는 리스크가 살아있어 아래 4개 카테고리만 차단한다.

export type RecruitLintResult = {
  income_guarantee: string[]; // "고수익 보장 / 월 ○○ 확정 / 무조건" — 직업안정법 제34조 허위·과장 구인광고
  luxury_flex: string[];      // 외제차·명품·트로피·수익 인증 — 2030 다단계 연상(거부 트리거)
  mlm_signal: string[];       // "월급관리 스터디 / 투자 권유 / 유사수신" — 폰지사기 연상
  phone_numbers: string[];    // 전화번호 직접 노출 — 수익 표현과 결합 시 금소법 업무광고 경계
  risk_score: number;
  must_fix: boolean;
  suggestions: string[];
};

// 직업안정법 위험: 소득 보장·과장 표현
const INCOME_GUARANTEE_TERMS = [
  '고수익', '수익 보장', '소득 보장', '월수입 보장', '확정 수익',
  '무조건', '누구나 가능', '떼돈', '쉽게 벌', '쉽게 버는',
];
// "월 500만원 확정/보장/가능" 형태
const GUARANTEED_INCOME_PATTERN = /(월|연|월급|연봉)\s*[\d,]+\s*(만\s*원|억)[^.]{0,10}(보장|확정|가능|벌)/g;

// 다단계 연상: 럭셔리·수익 인증
const LUXURY_FLEX_TERMS = [
  '외제차', '수입차', '벤츠', '포르쉐', '롤렉스', '명품',
  '이달의 왕', '수익 인증', '연봉 인증', '월급 인증', '트로피',
];

// 유사수신·폰지 연상
const MLM_SIGNAL_TERMS = [
  '월급관리 스터디', '재테크 스터디', '투자 권유', '유사수신',
  '원금 보장', '수익률 보장', '하위 모집',
];

const PHONE_PATTERN = /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g;

const W_INCOME = 30; // 직업안정법 — 단독으로 must_fix
const W_LUXURY = 25; // 다단계 연상 — 단독으로 must_fix
const W_MLM = 35;    // 유사수신 연상 — 단독으로 must_fix
const W_PHONE = 12;  // 단독으로는 경고만, 수익 표현과 합쳐지면 임계 초과
const MUST_FIX_THRESHOLD = 25;

export function lintRecruit(text: string): RecruitLintResult {
  const income_guarantee = INCOME_GUARANTEE_TERMS.filter(t => text.includes(t));
  for (const m of text.matchAll(GUARANTEED_INCOME_PATTERN)) {
    income_guarantee.push(m[0].trim());
  }

  const luxury_flex = LUXURY_FLEX_TERMS.filter(t => text.includes(t));
  const mlm_signal = MLM_SIGNAL_TERMS.filter(t => text.includes(t));
  const phone_numbers = [...text.matchAll(PHONE_PATTERN)].map(m => m[0]);

  const raw =
    income_guarantee.length * W_INCOME +
    luxury_flex.length * W_LUXURY +
    mlm_signal.length * W_MLM +
    phone_numbers.length * W_PHONE;
  const risk_score = Math.min(100, raw);
  const must_fix = risk_score >= MUST_FIX_THRESHOLD;

  const suggestions: string[] = [];
  for (const t of income_guarantee)
    suggestions.push(`소득 단정 "${t}" 제거 → "성과에 따라 / 상위 사례 / 범위"로 (직업안정법 제34조)`);
  for (const t of luxury_flex)
    suggestions.push(`플렉스 표현 "${t}" 제거 → 현실적 하루 루틴·성장 스토리로 (2030 다단계 연상 회피)`);
  for (const t of mlm_signal)
    suggestions.push(`유사수신 연상 "${t}" 제거 → 직업을 그대로 솔직하게 소개`);
  for (const p of phone_numbers)
    suggestions.push(`전화번호 "${p}" 노출 회피 → "DM으로 문의"로 (금소법 업무광고 경계)`);

  return { income_guarantee, luxury_flex, mlm_signal, phone_numbers, risk_score, must_fix, suggestions };
}
