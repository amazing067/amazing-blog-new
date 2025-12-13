/**
 * 계층적 권한 체크 유틸리티
 * 
 * 권한 구조:
 * - 관리자(admin): 모든 사용자 데이터 조회 가능 (토큰 포함)
 * - 본부장(department_head): 같은 본부의 모든 사용자 데이터 조회 가능 (토큰 제외)
 * - 지사장(branch_head): 같은 본부의 팀장+FC 데이터 조회 가능 (토큰 제외) - 미래 확장용
 * - 팀장(team_leader): 같은 본부의 FC들만 조회 가능 (자신 포함, 토큰 제외)
 * - FC(fc)/일반사용자(user): 자신의 데이터만 조회 가능
 */

export interface UserProfile {
  id: string
  role: string | null
  department_id: string | null
  team_id: string | null // 팀 선택 제거되었지만 호환성을 위해 유지
}

/**
 * 사용자가 특정 사용자의 통계를 볼 수 있는지 확인
 */
export function canViewUserStats(
  viewer: UserProfile,
  targetUser: UserProfile
): boolean {
  // 관리자는 모든 사용자 통계 조회 가능
  if (viewer.role === 'admin') return true

  // 자신의 통계는 항상 조회 가능
  if (viewer.id === targetUser.id) return true

  // 본부장: 같은 본부의 모든 사용자 통계 조회 가능
  if (viewer.role === 'department_head') {
    // 본부장 자신은 항상 조회 가능
    if (viewer.id === targetUser.id) return true
    // 본부 정보가 없으면 조회 불가
    if (!viewer.department_id || !targetUser.department_id) return false
    return viewer.department_id === targetUser.department_id
  }

      // 지사장: 같은 본부의 팀장+FC 통계 조회 가능 (자신 포함)
      if (viewer.role === 'branch_head') {
        // 지사장 자신은 항상 조회 가능
        if (viewer.id === targetUser.id) return true
        // 본부 정보가 없으면 조회 불가
        if (!viewer.department_id || !targetUser.department_id) return false
        return (
          viewer.department_id === targetUser.department_id &&
          (targetUser.role === 'team_leader' || targetUser.role === 'fc')
        )
      }

      // 팀장: 같은 본부의 FC들만 조회 가능 (자신 포함)
      if (viewer.role === 'team_leader') {
        // 팀장 자신은 항상 조회 가능
        if (viewer.id === targetUser.id) return true
        // 본부 정보가 없으면 조회 불가
        if (!viewer.department_id || !targetUser.department_id) return false
        return (
          viewer.department_id === targetUser.department_id &&
          targetUser.role === 'fc'
        )
      }

  // FC/일반 사용자: 자신의 통계만 조회 가능
  return false
}

/**
 * 토큰 사용량 조회 권한 (관리자만)
 */
export function canViewTokenUsage(userRole: string | null | undefined): boolean {
  return userRole === 'admin'
}

/**
 * 사용자가 볼 수 있는 사용자 ID 목록 조회
 */
export function getViewableUserIds(
  viewer: UserProfile,
  allUsers: UserProfile[]
): string[] {
  if (viewer.role === 'admin') {
    // 관리자는 모든 사용자
    return allUsers.map(u => u.id)
  }

  if (viewer.role === 'department_head') {
    // 본부장: 같은 본부의 모든 사용자
    return allUsers
      .filter(u => u.department_id === viewer.department_id)
      .map(u => u.id)
  }

  if (viewer.role === 'branch_head') {
    // 지사장: 같은 본부의 팀장+FC들만 조회 가능 (자신 포함)
    return allUsers
      .filter(u => 
        u.department_id === viewer.department_id &&
        (u.role === 'team_leader' || u.role === 'fc' || u.id === viewer.id)
      )
      .map(u => u.id)
  }

  if (viewer.role === 'team_leader') {
    // 팀장: 같은 본부의 FC들만 조회 가능 (자신 포함)
    return allUsers
      .filter(u => 
        u.department_id === viewer.department_id &&
        (u.role === 'fc' || u.id === viewer.id)
      )
      .map(u => u.id)
  }

  // FC/일반 사용자: 자신만
  return [viewer.id]
}

/**
 * 사용자가 특정 사용자의 프로필을 볼 수 있는지 확인
 */
export function canViewUserProfile(
  viewer: UserProfile,
  targetUser: UserProfile
): boolean {
  return canViewUserStats(viewer, targetUser)
}

/**
 * 사용자가 특정 사용자의 글을 볼 수 있는지 확인
 */
export function canViewUserBlog(
  viewer: UserProfile,
  targetUser: UserProfile
): boolean {
  return canViewUserStats(viewer, targetUser)
}

/**
 * 사용자가 특정 사용자의 Q&A를 볼 수 있는지 확인
 */
export function canViewUserQA(
  viewer: UserProfile,
  targetUser: UserProfile
): boolean {
  return canViewUserStats(viewer, targetUser)
}

/**
 * 역할별 통계 조회 권한 확인
 */
export function canViewStats(userRole: string | null | undefined): boolean {
  return ['admin', 'department_head', 'branch_head', 'team_leader'].includes(userRole || '')
}

/**
 * 역할별 통계 페이지 경로 반환
 */
export function getStatsPagePath(userRole: string | null | undefined): string {
  switch (userRole) {
    case 'admin':
      return '/admin/stats'
    case 'department_head':
      return '/department/stats'
    case 'branch_head':
      return '/branch/stats'  // 미래 확장용
    case 'team_leader':
      return '/team/stats'
    default:
      return '/dashboard/stats'
  }
}

