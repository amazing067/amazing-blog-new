-- handle_new_user 함수 및 트리거 삭제
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN

-- ⚠️ 중요: 이 함수를 삭제하면 API에서만 수동으로 profiles를 생성합니다.
-- 우리는 이미 API에서 수동으로 생성하고 있으므로 이 자동 생성 함수는 필요 없습니다.

-- 1. 트리거 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. 함수 삭제
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 3. 확인 (결과가 없어야 함)
SELECT 
  routine_name,
  routine_type
FROM 
  information_schema.routines
WHERE 
  routine_schema = 'public'
  AND routine_name = 'handle_new_user';

-- 트리거 확인 (결과가 없어야 함)
SELECT 
  trigger_name
FROM 
  information_schema.triggers
WHERE 
  event_object_table = 'users'
  AND event_object_schema = 'auth'
  AND trigger_name = 'on_auth_user_created';

