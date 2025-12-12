-- ⭐ 관리자 UPDATE 정책 추가 (메인 서버용)
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- ⚠️ 중요: 이 파일은 supabase-schema-profiles-rls.sql 실행 후에 실행해야 합니다!
-- 
-- 문제: 관리자가 다른 사용자의 프로필을 업데이트할 수 없음
-- 원인: 관리자 UPDATE 정책이 제거되어 있음 (무한 재귀 방지)
-- 해결: profiles 테이블을 조회하지 않고 auth.users만 조회하는 방식으로 정책 추가
--
-- ⚠️ 이 정책은 SERVICE_ROLE_KEY가 없는 경우를 위한 대안입니다.
-- 가능하면 SERVICE_ROLE_KEY를 사용하는 것을 권장합니다.

-- 기존 관리자 UPDATE 정책이 있으면 삭제
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- 관리자 UPDATE 정책 추가 (무한 재귀 방지)
-- auth.users 테이블만 조회하므로 무한 재귀가 발생하지 않음
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    -- auth.users에서 직접 role 확인 (profiles 테이블 조회 없음)
    EXISTS (
      SELECT 1 
      FROM auth.users 
      WHERE auth.users.id = auth.uid()
      AND (
        -- 방법 1: raw_user_meta_data에서 role 확인
        (auth.users.raw_user_meta_data->>'role') = 'admin'
        OR
        -- 방법 2: raw_app_meta_data에서 role 확인
        (auth.users.raw_app_meta_data->>'role') = 'admin'
      )
    )
  );

-- ⚠️ 참고: 
-- 1. 이 정책이 작동하려면 Supabase Dashboard에서
--    Authentication > Users > 해당 사용자의 user_metadata에 role: 'admin'을 추가해야 합니다.
-- 2. 또는 더 안전한 방법으로 SERVICE_ROLE_KEY를 사용하여 RLS를 우회하는 것을 권장합니다.
-- 3. SERVICE_ROLE_KEY를 사용하면 이 정책이 필요 없습니다.

