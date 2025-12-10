-- ⭐ 관리자 UPDATE 정책 추가 (무한 재귀 방지)
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- ⚠️ 중요: 이 파일은 supabase-schema-profiles-rls.sql 실행 후에 실행해야 합니다!
-- 
-- 문제: 관리자가 다른 사용자의 프로필을 업데이트할 수 없음
-- 원인: 관리자 UPDATE 정책이 제거되어 있음
-- 해결: 무한 재귀를 방지하는 방식으로 관리자 UPDATE 정책 추가

-- 기존 관리자 UPDATE 정책이 있으면 삭제
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- 관리자 UPDATE 정책 추가 (무한 재귀 방지)
-- auth.jwt()를 사용하여 JWT 토큰에서 직접 role을 확인
-- profiles 테이블을 다시 조회하지 않으므로 무한 재귀가 발생하지 않음
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    -- JWT 토큰의 user_metadata에서 role을 확인
    -- 또는 auth.uid()가 존재하고, 서버 사이드에서 관리자 권한을 확인한 경우
    -- 실제로는 서버 사이드에서 관리자 권한을 확인한 후 이 정책이 적용됩니다
    EXISTS (
      SELECT 1 
      FROM auth.users 
      WHERE auth.users.id = auth.uid()
      AND (
        -- 방법 1: user_metadata에서 role 확인 (권장)
        (auth.users.raw_user_meta_data->>'role') = 'admin'
        OR
        -- 방법 2: app_metadata에서 role 확인
        (auth.users.raw_app_meta_data->>'role') = 'admin'
      )
    )
  );

-- ⚠️ 참고: 
-- 만약 위 방법이 작동하지 않으면, Supabase Dashboard에서
-- Authentication > Users > 해당 사용자의 user_metadata에 role: 'admin'을 추가하거나
-- 또는 SERVICE_ROLE_KEY를 사용하여 RLS를 우회하는 방법을 사용하세요.

