-- ⭐ 성능 최적화: 추가 인덱스 생성
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- ⚠️ 중요: 이 파일은 다른 스키마 파일들을 실행한 후에 실행하세요!
-- 쿼리 성능을 향상시키기 위한 추가 인덱스를 생성합니다.

-- profiles 테이블 성능 최적화 인덱스
-- is_approved와 created_at 복합 인덱스 (관리자 대시보드 쿼리 최적화)
CREATE INDEX IF NOT EXISTS profiles_is_approved_created_at_idx 
  ON profiles(is_approved, created_at DESC);

-- membership_status 인덱스 (이미 있지만 확인용)
CREATE INDEX IF NOT EXISTS profiles_membership_status_idx 
  ON profiles(membership_status);

-- blog_posts 테이블 성능 최적화 인덱스
-- user_id와 status 복합 인덱스 (사용자별 글 조회 최적화)
CREATE INDEX IF NOT EXISTS blog_posts_user_id_status_idx 
  ON blog_posts(user_id, status);

-- usage_logs 테이블 성능 최적화 인덱스
-- user_id와 type, created_at 복합 인덱스 (사용자별 사용량 조회 최적화)
CREATE INDEX IF NOT EXISTS usage_logs_user_id_type_created_at_idx 
  ON usage_logs(user_id, type, created_at DESC);

-- qa_sets 테이블 성능 최적화 인덱스
-- user_id와 created_at 복합 인덱스 (사용자별 Q&A 조회 최적화)
CREATE INDEX IF NOT EXISTS qa_sets_user_id_created_at_idx 
  ON qa_sets(user_id, created_at DESC);

-- 주석 추가
COMMENT ON INDEX profiles_is_approved_created_at_idx IS '관리자 대시보드 쿼리 성능 최적화 (승인 상태별 정렬)';
COMMENT ON INDEX blog_posts_user_id_status_idx IS '사용자별 글 조회 성능 최적화';
COMMENT ON INDEX usage_logs_user_id_type_created_at_idx IS '사용자별 사용량 조회 성능 최적화';
COMMENT ON INDEX qa_sets_user_id_created_at_idx IS '사용자별 Q&A 조회 성능 최적화';

