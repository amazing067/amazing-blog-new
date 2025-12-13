-- ⚠️ profiles 테이블의 email 컬럼을 NULL 허용으로 변경
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- 이 스크립트는 email 컬럼을 선택적으로 만듭니다.
-- 이제 이메일 없이도 회원가입/로그인이 가능합니다.

-- ============================================
-- 1. email 컬럼을 NULL 허용으로 변경
-- ============================================

-- NOT NULL 제약 조건 제거
ALTER TABLE profiles 
  ALTER COLUMN email DROP NOT NULL;

-- ============================================
-- 2. 기존 데이터의 email을 NULL로 업데이트 (선택사항)
-- ============================================
-- 주의: 이 부분은 주석 처리되어 있습니다.
-- 기존 사용자들의 email을 지우고 싶으면 주석을 해제하세요.
-- 
-- UPDATE profiles 
-- SET email = NULL
-- WHERE email IS NOT NULL;

-- ============================================
-- 3. 확인
-- ============================================

-- 컬럼 정보 확인
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'email';

-- NULL인 email 개수 확인
SELECT 
  COUNT(*) as total_profiles,
  COUNT(email) as profiles_with_email,
  COUNT(*) - COUNT(email) as profiles_without_email
FROM 
  profiles;

