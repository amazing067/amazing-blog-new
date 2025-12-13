-- profiles 테이블의 email 컬럼을 NULL 허용으로 변경
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN

-- ⚠️ 중요: 이 스크립트를 실행하기 전에 check-profiles-schema.sql로 현재 상태를 확인하세요.

-- 1. email 컬럼이 존재하는지 확인
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    -- email 컬럼이 존재하면 NOT NULL 제약 조건 제거
    ALTER TABLE profiles 
      ALTER COLUMN email DROP NOT NULL;
    
    RAISE NOTICE 'email 컬럼을 NULL 허용으로 변경했습니다.';
  ELSE
    RAISE NOTICE 'email 컬럼이 존재하지 않습니다.';
  END IF;
END $$;

-- 2. 확인
SELECT 
  column_name,
  data_type,
  is_nullable
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'email';

