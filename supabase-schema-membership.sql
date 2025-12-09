-- ⭐ 3단계: profiles 테이블에 회원 관리 필드 추가
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- ⚠️ 중요: 이 파일은 supabase-schema-profiles.sql 실행 후에 실행해야 합니다!
-- profiles 테이블에 결제 및 상태 관리 필드를 추가합니다.

-- profiles 테이블에 결제 및 상태 관리 필드 추가
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS membership_status TEXT DEFAULT 'pending' CHECK (membership_status IN ('active', 'pending', 'suspended', 'deleted')),
ADD COLUMN IF NOT EXISTS paid_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS grace_period_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_note TEXT;

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS profiles_membership_status_idx ON profiles(membership_status);
CREATE INDEX IF NOT EXISTS profiles_paid_until_idx ON profiles(paid_until);
CREATE INDEX IF NOT EXISTS profiles_suspended_at_idx ON profiles(suspended_at);

-- 기존 사용자들의 기본 상태 설정
-- is_approved가 true인 경우 active, false인 경우 pending
UPDATE profiles
SET membership_status = CASE
  WHEN is_approved = true THEN 'active'
  ELSE 'pending'
END
WHERE membership_status IS NULL OR membership_status = 'pending';

-- 참고: 자동 상태 업데이트는 사용하지 않습니다.
-- 관리자가 수동으로 회원 상태를 확인하고 관리합니다.

-- 결제 확인 및 상태 활성화 함수
CREATE OR REPLACE FUNCTION activate_membership(
  p_user_id UUID,
  p_paid_until TIMESTAMP WITH TIME ZONE,
  p_payment_note TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET 
    membership_status = 'active',
    paid_until = p_paid_until,
    last_payment_at = TIMEZONE('utc', NOW()),
    grace_period_until = NULL,
    suspended_at = NULL,
    payment_note = p_payment_note
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 회원 상태 변경 함수
CREATE OR REPLACE FUNCTION update_membership_status(
  p_user_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF p_status = 'suspended' THEN
    UPDATE profiles
    SET 
      membership_status = 'suspended',
      suspended_at = TIMEZONE('utc', NOW()),
      payment_note = p_note
    WHERE id = p_user_id;
  ELSIF p_status = 'active' THEN
    UPDATE profiles
    SET 
      membership_status = 'active',
      suspended_at = NULL,
      payment_note = p_note
    WHERE id = p_user_id;
  ELSIF p_status = 'pending' THEN
    UPDATE profiles
    SET 
      membership_status = 'pending',
      grace_period_until = TIMEZONE('utc', NOW()) + INTERVAL '7 days',
      payment_note = p_note
    WHERE id = p_user_id;
  ELSIF p_status = 'deleted' THEN
    UPDATE profiles
    SET 
      membership_status = 'deleted',
      deleted_at = TIMEZONE('utc', NOW()),
      payment_note = p_note
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 주석 추가
COMMENT ON COLUMN profiles.membership_status IS '회원 상태: active(활성), pending(대기/유예), suspended(정지), deleted(삭제)';
COMMENT ON COLUMN profiles.paid_until IS '결제 만료일 (이 날짜까지 사용 가능)';
COMMENT ON COLUMN profiles.suspended_at IS '정지 시작일';
COMMENT ON COLUMN profiles.deleted_at IS '삭제일 (소프트 삭제)';
COMMENT ON COLUMN profiles.last_payment_at IS '마지막 결제일';
COMMENT ON COLUMN profiles.grace_period_until IS '유예 기간 만료일 (결제 만료 후 7일)';
COMMENT ON COLUMN profiles.payment_note IS '결제/상태 변경 메모';

