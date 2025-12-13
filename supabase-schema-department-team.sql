-- ⭐ 본부/팀 계층 구조 추가 (계층적 권한 시스템)
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- ⚠️ 중요: 이 파일은 supabase-schema-profiles.sql 실행 후에 실행해야 합니다!
-- profiles 테이블에 본부/팀 정보와 계층적 권한을 위한 필드를 추가합니다.
--
-- 역할 구조:
-- - admin: 관리자 (모든 통계 조회 가능, 토큰 포함)
-- - department_head: 본부장 (같은 본부의 팀장+FC 통계 조회, 토큰 제외)
-- - team_leader: 팀장 (같은 팀의 FC 통계 조회, 토큰 제외)
-- - fc: FC (자신의 통계만 조회)
-- - user: 일반 사용자 (기존 호환성, fc와 동일)

-- ============================================
-- 1. profiles 테이블에 본부/팀 필드 추가
-- ============================================

-- 본부/팀 관련 필드 추가
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS department_id TEXT,        -- 본부 ID (예: 'seoul', 'busan', 'daegu')
ADD COLUMN IF NOT EXISTS department_name TEXT,      -- 본부명 (예: '서울본부', '부산본부', '대구본부')
ADD COLUMN IF NOT EXISTS team_id TEXT,               -- 팀 ID (예: 'seoul-team1', 'seoul-team2')
ADD COLUMN IF NOT EXISTS team_name TEXT;             -- 팀명 (예: '서울본부 1팀', '서울본부 2팀')

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS profiles_department_id_idx ON profiles(department_id);
CREATE INDEX IF NOT EXISTS profiles_team_id_idx ON profiles(team_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

-- 기존 role 인덱스가 없으면 생성 (이미 있으면 무시)
-- CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

-- ============================================
-- 2. 주석 추가 (문서화)
-- ============================================

COMMENT ON COLUMN profiles.department_id IS '본부 ID (예: seoul, busan, daegu)';
COMMENT ON COLUMN profiles.department_name IS '본부명 (예: 서울본부, 부산본부, 대구본부)';
COMMENT ON COLUMN profiles.team_id IS '팀 ID (예: seoul-team1, seoul-team2)';
COMMENT ON COLUMN profiles.team_name IS '팀명 (예: 서울본부 1팀, 서울본부 2팀)';
COMMENT ON COLUMN profiles.role IS '사용자 역할: admin(관리자), department_head(본부장), team_leader(팀장), fc(FC), user(일반사용자)';

-- ============================================
-- 3. 기존 사용자 마이그레이션 (선택사항)
-- ============================================

-- 기존 사용자들의 기본값 설정 (필요시 수동으로 업데이트)
-- 본부장/팀장/FC는 관리자가 수동으로 설정해야 합니다.
-- UPDATE profiles 
-- SET department_id = 'seoul', department_name = '서울본부'
-- WHERE department_id IS NULL AND role = 'user';

-- ============================================
-- 4. 데이터 무결성 체크 함수 (선택사항)
-- ============================================

-- 팀장은 반드시 team_id가 있어야 함
-- CREATE OR REPLACE FUNCTION check_team_leader_team()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF NEW.role = 'team_leader' AND (NEW.team_id IS NULL OR NEW.team_id = '') THEN
--     RAISE EXCEPTION '팀장은 반드시 팀이 지정되어야 합니다.';
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER check_team_leader_team_trigger
--   BEFORE INSERT OR UPDATE ON profiles
--   FOR EACH ROW
--   EXECUTE FUNCTION check_team_leader_team();

-- ============================================
-- 5. 본부장은 team_id가 없어도 됨 (본부 전체 관리)
-- ============================================

-- 본부장은 team_id가 NULL이어도 됨 (본부 전체를 관리하므로)
-- 팀장은 반드시 team_id가 있어야 함
-- FC는 team_id가 있어야 함

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ 본부/팀 계층 구조 필드가 추가되었습니다.';
  RAISE NOTICE '📝 다음 단계:';
  RAISE NOTICE '   1. 기존 사용자들의 본부/팀 정보를 수동으로 설정하세요.';
  RAISE NOTICE '   2. 본부장/팀장 역할을 지정하세요.';
  RAISE NOTICE '   3. RLS 정책을 업데이트하세요 (supabase-schema-rls-hierarchy.sql).';
END $$;

