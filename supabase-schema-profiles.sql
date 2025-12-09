-- ⭐ 1단계: profiles 테이블 생성 (가장 먼저 실행)
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- ⚠️ 중요: 이 파일은 가장 먼저 실행해야 합니다!
-- 다른 모든 테이블이 profiles 테이블을 참조합니다.

-- profiles 테이블 생성 (회원 기본 정보)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles(username);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);
CREATE INDEX IF NOT EXISTS profiles_is_approved_idx ON profiles(is_approved);

-- RLS (Row Level Security) 활성화
-- ⚠️ 주의: 이 파일에서는 RLS만 활성화하고, 정책은 supabase-schema-profiles-rls.sql에서 설정합니다
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 주석 추가
COMMENT ON TABLE profiles IS '사용자 프로필 테이블 (회원 기본 정보)';
COMMENT ON COLUMN profiles.id IS 'auth.users 테이블의 id와 동일 (외래키)';
COMMENT ON COLUMN profiles.username IS '사용자 아이디 (고유값)';
COMMENT ON COLUMN profiles.full_name IS '사용자 실명';
COMMENT ON COLUMN profiles.email IS '사용자 이메일';
COMMENT ON COLUMN profiles.phone IS '사용자 전화번호';
COMMENT ON COLUMN profiles.is_approved IS '관리자 승인 여부 (true: 승인됨, false: 대기중)';
COMMENT ON COLUMN profiles.role IS '사용자 역할 (user: 일반 사용자, admin: 관리자)';
COMMENT ON COLUMN profiles.created_at IS '계정 생성일시';

