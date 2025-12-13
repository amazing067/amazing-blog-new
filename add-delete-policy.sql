-- ⚠️ profiles 테이블에 DELETE 정책 추가
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- 이 스크립트는 관리자가 profiles를 삭제할 수 있도록 정책을 추가합니다.

-- 기존 DELETE 정책이 있으면 삭제
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- 관리자: 모든 프로필 삭제 가능 (무한 재귀 방지: auth.users만 사용)
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        (auth.users.raw_user_meta_data->>'role') = 'admin'
        OR
        (auth.users.raw_app_meta_data->>'role') = 'admin'
      )
    )
  );

-- 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM 
  pg_policies
WHERE 
  tablename = 'profiles'
  AND cmd = 'DELETE';

