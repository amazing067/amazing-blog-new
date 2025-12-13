-- test2 사용자 확인
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN

-- 1. test2 사용자 프로필 확인
SELECT 
  id,
  username,
  full_name,
  phone,
  role,
  is_approved,
  membership_status,
  deleted_at,
  created_at
FROM 
  profiles
WHERE 
  username = 'test2';

-- 2. test2 사용자가 auth.users에 있는지 확인
SELECT 
  id,
  email,
  created_at
FROM 
  auth.users
WHERE 
  id IN (
    SELECT id 
    FROM profiles 
    WHERE username = 'test2'
  );

-- 3. username이 test2와 유사한 사용자 확인 (대소문자, 공백 등)
SELECT 
  id,
  username,
  full_name,
  role,
  deleted_at
FROM 
  profiles
WHERE 
  LOWER(TRIM(username)) = LOWER(TRIM('test2'))
  OR username LIKE '%test2%';

