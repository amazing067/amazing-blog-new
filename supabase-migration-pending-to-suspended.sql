-- ⚠️ 중요: 이 마이그레이션은 기존 'pending' 상태를 'suspended'로 변경합니다
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- 실행 전 확인사항:
-- 1. 백업을 권장합니다 (필요시)
-- 2. 이 쿼리는 기존 'pending' 상태 사용자를 'suspended'로 변경합니다
-- 3. 실행 후 되돌릴 수 없으니 신중하게 실행하세요

-- 기존 pending 상태를 suspended로 변경
UPDATE profiles
SET 
  membership_status = 'suspended',
  suspended_at = COALESCE(suspended_at, NOW()) -- suspended_at이 없으면 현재 시간으로 설정
WHERE membership_status = 'pending';

-- 변경된 레코드 수 확인 (실행 후 확인용)
-- SELECT COUNT(*) FROM profiles WHERE membership_status = 'suspended';

-- 변경 완료 메시지
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '마이그레이션 완료: %명의 사용자가 pending에서 suspended로 변경되었습니다.', updated_count;
END $$;

