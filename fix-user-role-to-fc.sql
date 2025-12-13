-- ⚠️ role이 'user'인 사용자를 'fc'로 변경
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- 회원가입 시 기본 역할은 'fc'이지만, 기존에 'user'로 저장된 사용자들을 'fc'로 변경합니다.

-- ============================================
-- 1. role이 'user'인 사용자를 'fc'로 변경
-- ============================================

UPDATE profiles
SET role = 'fc'
WHERE role = 'user';

-- ============================================
-- 2. 확인
-- ============================================

-- 변경된 사용자 확인
SELECT 
  id,
  username,
  full_name,
  role,
  is_approved,
  membership_status
FROM 
  profiles
WHERE 
  role = 'fc'
ORDER BY 
  created_at DESC;

-- 'user' 역할이 남아있는지 확인 (없어야 함)
SELECT 
  COUNT(*) as user_role_count
FROM 
  profiles
WHERE 
  role = 'user';

