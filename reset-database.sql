-- ⚠️ 경고: 이 스크립트는 모든 데이터와 테이블을 삭제합니다!
-- 실행 전에 반드시 백업을 확인하세요!
-- 
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
--
-- 이 스크립트는 다음을 수행합니다:
-- 1. 모든 RLS 정책 삭제
-- 2. 모든 테이블 삭제 (CASCADE로 참조 무결성 유지)
-- 3. 모든 인덱스 삭제
-- 4. auth.users의 모든 사용자 삭제 (선택사항)

-- ============================================
-- 1. RLS 정책 삭제
-- ============================================

-- profiles 테이블 정책 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Allow profile lookup by username for login" ON profiles;
DROP POLICY IF EXISTS "Department heads can view department profiles" ON profiles;
DROP POLICY IF EXISTS "Branch heads can view branch profiles" ON profiles;
DROP POLICY IF EXISTS "Team leaders can view team profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile hierarchy" ON profiles;

-- blog_posts 테이블 정책 삭제
DROP POLICY IF EXISTS "Users can view own posts" ON blog_posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON blog_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON blog_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON blog_posts;
DROP POLICY IF EXISTS "Admins can view all posts" ON blog_posts;
DROP POLICY IF EXISTS "Department heads can view department posts" ON blog_posts;
DROP POLICY IF EXISTS "Branch heads can view branch posts" ON blog_posts;
DROP POLICY IF EXISTS "Team leaders can view team posts" ON blog_posts;

-- qa_sets 테이블 정책 삭제
DROP POLICY IF EXISTS "Users can view own qa sets" ON qa_sets;
DROP POLICY IF EXISTS "Users can insert own qa sets" ON qa_sets;
DROP POLICY IF EXISTS "Users can update own qa sets" ON qa_sets;
DROP POLICY IF EXISTS "Users can delete own qa sets" ON qa_sets;
DROP POLICY IF EXISTS "Admins can view all qa sets" ON qa_sets;
DROP POLICY IF EXISTS "Department heads can view department qa sets" ON qa_sets;
DROP POLICY IF EXISTS "Branch heads can view branch qa sets" ON qa_sets;
DROP POLICY IF EXISTS "Team leaders can view team qa sets" ON qa_sets;

-- ============================================
-- 2. 테이블 삭제 (CASCADE로 모든 참조 제거)
-- ============================================

-- 참조되는 테이블부터 삭제
DROP TABLE IF EXISTS blog_posts CASCADE;
DROP TABLE IF EXISTS qa_sets CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- 3. auth.users의 모든 사용자 삭제 (선택사항)
-- ============================================
-- 주의: 이 부분은 Supabase Dashboard의 Authentication > Users에서
-- 수동으로 삭제하거나, 아래 주석을 해제하여 실행할 수 있습니다.
-- 
-- ⚠️ 주의: 이 쿼리는 모든 인증 사용자를 삭제합니다!
-- 
-- DELETE FROM auth.users;

-- ============================================
-- 4. 확인 쿼리
-- ============================================

-- 남아있는 테이블 확인
SELECT 
  table_name 
FROM 
  information_schema.tables 
WHERE 
  table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY 
  table_name;

-- 남아있는 사용자 수 확인 (auth.users)
SELECT 
  COUNT(*) as remaining_users 
FROM 
  auth.users;

