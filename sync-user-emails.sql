-- 기존 사용자들의 이메일 동기화 스크립트
-- Supabase SQL Editor에서 실행하세요
-- 
-- 이 스크립트는 profiles 테이블의 email이 없거나 잘못된 경우,
-- auth.users 테이블의 email로 동기화합니다.

-- 1. profiles.email이 null이거나 '@'가 없는 경우 auth.users.email로 업데이트
UPDATE profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id
  AND (p.email IS NULL OR p.email NOT LIKE '%@%')
  AND au.email IS NOT NULL;

-- 2. 전화번호가 있는데 이메일이 없는 경우, 전화번호 기반 이메일 생성
UPDATE profiles
SET email = REPLACE(phone, '-', '') || '@phone.local'
WHERE (email IS NULL OR email NOT LIKE '%@%')
  AND phone IS NOT NULL
  AND phone != '';

-- 3. 결과 확인
SELECT 
  id,
  username,
  email,
  phone,
  CASE 
    WHEN email IS NULL OR email NOT LIKE '%@%' THEN '이메일 없음'
    ELSE '정상'
  END as email_status
FROM profiles
ORDER BY created_at DESC
LIMIT 50;

