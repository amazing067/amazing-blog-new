-- handle_new_user 함수 수정 (email 컬럼 제거)
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN

-- ⚠️ 중요: 먼저 check-handle-new-user-function.sql로 현재 함수 정의를 확인하세요.

-- 1. 기존 함수 삭제
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. 새로운 함수 생성 (email 없이)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    phone,
    is_approved,
    role,
    membership_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    false,
    'fc',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 트리거가 없다면 생성 (보통 이미 있을 수 있음)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. 확인
SELECT 
  routine_name,
  routine_type
FROM 
  information_schema.routines
WHERE 
  routine_schema = 'public'
  AND routine_name = 'handle_new_user';

