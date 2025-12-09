-- ⭐ 5단계: profiles 테이블 RLS 정책 설정 (보안 강화)
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- ⚠️ 중요: 이 파일은 supabase-schema-profiles.sql 실행 후에 실행해야 합니다!
-- profiles 테이블의 RLS 정책을 설정하여 보안을 강화합니다.
-- 
-- ⚠️ 경고: DROP POLICY 문이 포함되어 있어 경고가 표시될 수 있지만,
-- IF EXISTS로 안전하게 처리되므로 "Run this query" 버튼을 클릭하여 실행하세요.

-- RLS 활성화 (이미 활성화되어 있어도 안전)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있으면 삭제 (중복 방지)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- 정책 1: 사용자는 자신의 프로필만 볼 수 있음
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 정책 2: 회원가입 시 프로필 생성 가능
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 정책 3: 사용자는 자신의 프로필을 수정할 수 있음
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 정책 4: 관리자는 모든 프로필을 볼 수 있음
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- 정책 5: 관리자는 모든 프로필을 수정할 수 있음
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

