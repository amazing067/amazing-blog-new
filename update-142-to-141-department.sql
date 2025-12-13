-- ⚠️ 142본부를 141본부로 변경
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- 이 스크립트는 기존에 142본부로 설정된 사용자들을 141본부로 변경합니다.

-- ============================================
-- 1. department_id가 '142'인 사용자를 '141'로 변경
-- ============================================

UPDATE profiles
SET 
  department_id = '141',
  department_name = '141 본부'
WHERE 
  department_id = '142'
  OR department_name = '142 본부'
  OR department_name = '142본부';

-- ============================================
-- 2. 확인
-- ============================================

-- 변경된 사용자 확인
SELECT 
  id,
  username,
  full_name,
  department_id,
  department_name
FROM 
  profiles
WHERE 
  department_id = '141'
  OR department_name LIKE '%141%';

-- 142로 남아있는 사용자 확인 (있으면 문제)
SELECT 
  id,
  username,
  full_name,
  department_id,
  department_name
FROM 
  profiles
WHERE 
  department_id = '142'
  OR department_name LIKE '%142%';

