-- profiles 테이블 스키마 확인
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN

-- 1. profiles 테이블의 컬럼 정보 확인
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
ORDER BY 
  ordinal_position;

-- 2. profiles 테이블의 제약 조건 확인
SELECT
  constraint_name,
  constraint_type
FROM
  information_schema.table_constraints
WHERE
  table_schema = 'public'
  AND table_name = 'profiles';

-- 3. NOT NULL 제약 조건이 있는 컬럼 확인
SELECT
  column_name,
  is_nullable
FROM
  information_schema.columns
WHERE
  table_schema = 'public'
  AND table_name = 'profiles'
  AND is_nullable = 'NO'
ORDER BY
  ordinal_position;

