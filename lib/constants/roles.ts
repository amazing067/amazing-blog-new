/**
 * 사용자 역할 상수
 * 
 * 역할 계층 구조:
 * - admin: 관리자 (최고 권한, 모든 통계 조회 가능, 토큰 포함)
 * - department_head: 본부장 (같은 본부의 모든 사용자 통계 조회, 토큰 제외)
 * - branch_head: 지사장 (같은 본부의 팀장+FC 통계 조회, 토큰 제외)
 * - team_leader: 팀장 (같은 본부의 FC 통계 조회, 토큰 제외)
 * - fc: FC (자신의 통계만 조회) - 기본 역할, 회원가입 시 자동 부여
 */

export const ROLES = {
  ADMIN: 'admin',                    // 관리자
  CONTENT_EDITOR: 'content_editor',  // 콘텐츠 운영자 (콘텐츠 4종 보기/생성/수정/반송, 회원·통계·품질 제외)
  DEPARTMENT_HEAD: 'department_head', // 본부장
  BRANCH_HEAD: 'branch_head',        // 지사장
  TEAM_LEADER: 'team_leader',        // 팀장
  FC: 'fc',                          // FC (Field Consultant) - 기본 역할
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

/**
 * 역할 표시명
 */
export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.ADMIN]: '관리자',
  [ROLES.CONTENT_EDITOR]: '콘텐츠 운영자',
  [ROLES.DEPARTMENT_HEAD]: '본부장',
  [ROLES.BRANCH_HEAD]: '지사장',
  [ROLES.TEAM_LEADER]: '팀장',
  [ROLES.FC]: 'FC',
}

/**
 * 역할 목록 (관리자가 설정 가능한 역할)
 */
export const ASSIGNABLE_ROLES: Role[] = [
  ROLES.CONTENT_EDITOR,
  ROLES.DEPARTMENT_HEAD,
  ROLES.BRANCH_HEAD,
  ROLES.TEAM_LEADER,
  ROLES.FC,
]

/**
 * 본부 선택이 필수인 역할 (본부장·지사장·팀장)
 * content_editor / fc 는 본부 없이 지정 가능
 */
export const ROLES_REQUIRING_DEPARTMENT: Role[] = [
  ROLES.DEPARTMENT_HEAD,
  ROLES.BRANCH_HEAD,
  ROLES.TEAM_LEADER,
]

/**
 * 역할이 관리자 권한인지 확인
 */
export function isAdmin(role: string | null | undefined): boolean {
  return role === ROLES.ADMIN
}

/**
 * 역할이 콘텐츠 운영자인지 확인
 */
export function isContentEditor(role: string | null | undefined): boolean {
  return role === ROLES.CONTENT_EDITOR
}

/**
 * 콘텐츠 허브(보험뉴스·카드뉴스·블로그·리쿠르팅) 접근 권한 여부
 * 관리자 또는 콘텐츠 운영자
 */
export function canAccessContent(role: string | null | undefined): boolean {
  return role === ROLES.ADMIN || role === ROLES.CONTENT_EDITOR
}

/**
 * 역할이 본부장인지 확인
 */
export function isDepartmentHead(role: string | null | undefined): boolean {
  return role === ROLES.DEPARTMENT_HEAD
}

/**
 * 역할이 지사장인지 확인
 */
export function isBranchHead(role: string | null | undefined): boolean {
  return role === ROLES.BRANCH_HEAD
}

/**
 * 역할이 팀장인지 확인
 */
export function isTeamLeader(role: string | null | undefined): boolean {
  return role === ROLES.TEAM_LEADER
}

/**
 * 역할이 FC인지 확인 (기본 역할)
 */
export function isFC(role: string | null | undefined): boolean {
  return role === ROLES.FC || !role
}

/**
 * 역할 표시명 조회
 */
export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return ROLE_LABELS[ROLES.FC]
  return ROLE_LABELS[role as Role] || role
}

