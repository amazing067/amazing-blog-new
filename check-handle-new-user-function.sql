-- handle_new_user 함수의 전체 정의 확인
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN

-- 함수 정의 전체 확인
SELECT 
  pg_get_functiondef(oid) as function_definition
FROM 
  pg_proc
WHERE 
  proname = 'handle_new_user';

-- 또는 간단하게
SELECT 
  routine_definition
FROM 
  information_schema.routines
WHERE 
  routine_schema = 'public'
  AND routine_name = 'handle_new_user';

