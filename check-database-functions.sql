-- Supabase Database Functions 확인
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN

-- 1. profiles 테이블과 관련된 모든 함수 확인
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM 
  information_schema.routines
WHERE 
  routine_schema = 'public'
  AND (
    routine_definition LIKE '%profiles%'
    OR routine_definition LIKE '%handle_new_user%'
    OR routine_definition LIKE '%on_auth_user_created%'
  )
ORDER BY 
  routine_name;

-- 2. auth 스키마의 함수 확인 (Supabase Auth 관련)
SELECT 
  routine_name,
  routine_type
FROM 
  information_schema.routines
WHERE 
  routine_schema = 'auth'
  AND routine_name LIKE '%user%'
ORDER BY 
  routine_name;

