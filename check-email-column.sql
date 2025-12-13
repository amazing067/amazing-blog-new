-- email 컬럼 상태 확인
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN

-- 컬럼 정보 확인 (is_nullable이 YES여야 함)
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

