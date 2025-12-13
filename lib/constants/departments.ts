/**
 * 본부 및 팀 정보 상수
 * 
 * 역할 구조:
 * - admin: 관리자 (모든 통계 조회 가능, 토큰 포함)
 * - department_head: 본부장 (같은 본부의 팀장+FC 통계 조회, 토큰 제외)
 * - team_leader: 팀장 (같은 팀의 FC 통계 조회, 토큰 제외)
 * - fc: FC (자신의 통계만 조회)
 * - user: 일반 사용자 (기존 호환성, fc와 동일)
 */

export interface Team {
  id: string
  name: string
}

export interface Department {
  id: string
  name: string
  teams: Team[]
}

export const DEPARTMENTS: Department[] = [
  {
    id: '005',
    name: '005 본부',
    teams: [] // 팀 선택 제거
  },
  {
    id: '062',
    name: '062 본부',
    teams: []
  },
  {
    id: '067',
    name: '067 본부',
    teams: []
  },
  {
    id: '139',
    name: '139 본부',
    teams: []
  },
  {
    id: '141',
    name: '141 본부',
    teams: []
  },
  {
    id: '290',
    name: '290 본부',
    teams: []
  },
  {
    id: '292',
    name: '292 본부',
    teams: []
  },
] as const

export type DepartmentId = typeof DEPARTMENTS[number]['id']
export type TeamId = typeof DEPARTMENTS[number]['teams'][number]['id']

/**
 * 본부 ID로 본부 정보 조회
 */
export function getDepartmentById(departmentId: string): Department | undefined {
  return DEPARTMENTS.find(d => d.id === departmentId)
}

/**
 * 본부 ID로 팀 목록 조회
 */
export function getTeamsByDepartment(departmentId: string): Team[] {
  const dept = getDepartmentById(departmentId)
  return dept?.teams || []
}

/**
 * 팀 ID로 팀 정보 조회
 */
export function getTeamById(teamId: string): { team: Team; department: Department } | undefined {
  for (const dept of DEPARTMENTS) {
    const team = dept.teams.find(t => t.id === teamId)
    if (team) {
      return { team, department: dept }
    }
  }
  return undefined
}

/**
 * 모든 본부 목록 조회
 */
export function getAllDepartments(): Department[] {
  return DEPARTMENTS
}

/**
 * 모든 팀 목록 조회
 */
export function getAllTeams(): Team[] {
  return DEPARTMENTS.flatMap(dept => dept.teams)
}

