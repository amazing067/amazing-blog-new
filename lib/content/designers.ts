// 돌아가며 광고심의받는 설계사 명단 — 카드뉴스·블로그 광고심의필 폼이 공용으로 사용.
// 칩을 누르면 설계사명 + 협회등록번호가 한 번에 채워진다.
export const DESIGNERS = ['김성민', '고준하', '양창대', '윤준민', '이혜인'] as const;
export type DesignerName = typeof DESIGNERS[number];

// 고정 등록번호 — 운영 확정값. 빈 문자열은 아직 미입력 상태 (localStorage 캐시로 대체됨)
export const DESIGNER_REG_DEFAULTS: Record<DesignerName, string> = {
  '김성민': '20201014201039',
  '고준하': '',
  '양창대': '',
  '윤준민': '20230920003295',
  '이혜인': '20251117401088',
};

export const LS_REG_BY_DESIGNER = (name: string) => `compliance_reg_by_designer_${name}`;

// 고정 전화번호 — 운영 확정값. 빈 문자열은 미입력(직접 입력 시 localStorage 캐시로 복원).
export const DESIGNER_PHONE_DEFAULTS: Record<DesignerName, string> = {
  '김성민': '010-5604-0424',
  '고준하': '010-9014-4687',
  '양창대': '010-2335-7922',
  '윤준민': '010-2250-6507',
  '이혜인': '010-9468-3813',
};

export const LS_PHONE_BY_DESIGNER = (name: string) => `compliance_phone_by_designer_${name}`;

export const isKnownDesigner = (s: string | undefined | null): s is DesignerName =>
  !!s && (DESIGNERS as readonly string[]).includes(s);
