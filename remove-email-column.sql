-- ⚠️ profiles 테이블에서 email 컬럼 완전 제거
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- 이 스크립트는 email 컬럼을 완전히 제거합니다.
-- ⚠️ 주의: 이 작업은 되돌릴 수 없습니다. 백업을 권장합니다.

-- ============================================
-- 1. email 컬럼 제거
-- ============================================

-- 외래 키 제약 조건이 있다면 먼저 제거 (일반적으로 없지만 안전을 위해)
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_email_fkey;

-- 인덱스 제거 (있다면)
DROP INDEX IF EXISTS profiles_email_idx;

-- email 컬럼 제거
ALTER TABLE profiles 
  DROP COLUMN IF EXISTS email;

-- ============================================
-- 2. 확인
-- ============================================

-- 컬럼 목록 확인 (email이 없어야 함)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY 
  ordinal_position;

