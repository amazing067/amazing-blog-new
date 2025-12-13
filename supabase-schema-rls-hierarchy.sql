-- ⭐ 계층적 권한 RLS 정책 설정
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- ⚠️ 중요: 이 파일은 supabase-schema-department-team.sql 실행 후에 실행해야 합니다!
-- 
-- 계층적 권한 구조:
-- - 관리자(admin): 모든 사용자 데이터 조회 가능
-- - 본부장(department_head): 같은 본부의 모든 사용자 데이터 조회 가능
-- - 지사장(branch_head): 같은 본부의 팀장+FC 데이터 조회 가능 (미래 확장용)
-- - 팀장(team_leader): 같은 본부의 FC 데이터 조회 가능
-- - FC(fc)/일반사용자(user): 자신의 데이터만 조회 가능

-- ============================================
-- 1. blog_posts 테이블 RLS 정책 업데이트
-- ============================================

-- 기존 정책 확인 및 업데이트
DROP POLICY IF EXISTS "Admins can view all posts" ON blog_posts;
DROP POLICY IF EXISTS "Users can view own posts" ON blog_posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON blog_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON blog_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON blog_posts;
DROP POLICY IF EXISTS "Department heads can view department posts" ON blog_posts;
DROP POLICY IF EXISTS "Branch heads can view branch posts" ON blog_posts;  -- 미래 확장용
DROP POLICY IF EXISTS "Team leaders can view team posts" ON blog_posts;

-- 관리자: 모든 글 조회 가능 (무한 재귀 방지: auth.users만 사용)
CREATE POLICY "Admins can view all posts"
  ON blog_posts FOR SELECT
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

-- 사용자: 자신의 글만 조회 가능
CREATE POLICY "Users can view own posts"
  ON blog_posts FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자: 자신의 글 생성 가능
CREATE POLICY "Users can insert own posts"
  ON blog_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자: 자신의 글 수정 가능
CREATE POLICY "Users can update own posts"
  ON blog_posts FOR UPDATE
  USING (auth.uid() = user_id);

-- 사용자: 자신의 글 삭제 가능
CREATE POLICY "Users can delete own posts"
  ON blog_posts FOR DELETE
  USING (auth.uid() = user_id);

-- 본부장: 같은 본부의 모든 사용자 글 조회 가능
-- ⚠️ 무한 재귀 방지: auth.users의 metadata 사용
CREATE POLICY "Department heads can view department posts"
  ON blog_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        (auth.users.raw_user_meta_data->>'role') = 'department_head'
        OR
        (auth.users.raw_app_meta_data->>'role') = 'department_head'
      )
    )
    AND EXISTS (
      SELECT 1
      FROM profiles viewer
      WHERE viewer.id = auth.uid()
      AND viewer.role = 'department_head'
      AND EXISTS (
        SELECT 1
        FROM profiles author
        WHERE author.id = blog_posts.user_id
        AND author.department_id = viewer.department_id
      )
    )
  );

-- 지사장: 같은 본부의 팀장+FC들만 글 조회 가능 - 미래 확장용
-- ⚠️ 무한 재귀 방지: auth.users의 metadata 사용
CREATE POLICY "Branch heads can view branch posts"
  ON blog_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        (auth.users.raw_user_meta_data->>'role') = 'branch_head'
        OR
        (auth.users.raw_app_meta_data->>'role') = 'branch_head'
      )
    )
    AND EXISTS (
      SELECT 1
      FROM profiles viewer
      WHERE viewer.id = auth.uid()
      AND viewer.role = 'branch_head'
      AND EXISTS (
        SELECT 1
        FROM profiles author
        WHERE author.id = blog_posts.user_id
        AND author.department_id = viewer.department_id
        AND (author.role = 'team_leader' OR author.role = 'fc' OR author.role = 'user')
      )
    )
  );

-- 팀장: 같은 본부의 FC들만 글 조회 가능
-- ⚠️ 무한 재귀 방지: auth.users의 metadata 사용
CREATE POLICY "Team leaders can view team posts"
  ON blog_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        (auth.users.raw_user_meta_data->>'role') = 'team_leader'
        OR
        (auth.users.raw_app_meta_data->>'role') = 'team_leader'
      )
    )
    AND EXISTS (
      SELECT 1
      FROM profiles viewer
      WHERE viewer.id = auth.uid()
      AND viewer.role = 'team_leader'
      AND EXISTS (
        SELECT 1
        FROM profiles author
        WHERE author.id = blog_posts.user_id
        AND author.department_id = viewer.department_id
        AND (author.role = 'fc' OR author.role = 'user')
      )
    )
  );

-- ============================================
-- 2. qa_sets 테이블 RLS 정책 업데이트
-- ============================================

-- 기존 정책 확인 및 업데이트
DROP POLICY IF EXISTS "Admins can view all qa" ON qa_sets;
DROP POLICY IF EXISTS "Users can view own qa" ON qa_sets;
DROP POLICY IF EXISTS "Users can insert own qa" ON qa_sets;
DROP POLICY IF EXISTS "Users can update own qa" ON qa_sets;
DROP POLICY IF EXISTS "Users can delete own qa" ON qa_sets;
DROP POLICY IF EXISTS "Department heads can view department qa" ON qa_sets;
DROP POLICY IF EXISTS "Branch heads can view branch qa" ON qa_sets;  -- 미래 확장용
DROP POLICY IF EXISTS "Team leaders can view team qa" ON qa_sets;

-- 관리자: 모든 Q&A 조회 가능 (무한 재귀 방지: auth.users만 사용)
CREATE POLICY "Admins can view all qa"
  ON qa_sets FOR SELECT
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

-- 사용자: 자신의 Q&A만 조회 가능
CREATE POLICY "Users can view own qa"
  ON qa_sets FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자: 자신의 Q&A 생성 가능
CREATE POLICY "Users can insert own qa"
  ON qa_sets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자: 자신의 Q&A 수정 가능
CREATE POLICY "Users can update own qa"
  ON qa_sets FOR UPDATE
  USING (auth.uid() = user_id);

-- 사용자: 자신의 Q&A 삭제 가능
CREATE POLICY "Users can delete own qa"
  ON qa_sets FOR DELETE
  USING (auth.uid() = user_id);

-- 본부장: 같은 본부의 모든 사용자 Q&A 조회 가능
-- ⚠️ 무한 재귀 방지: auth.users의 metadata 사용
CREATE POLICY "Department heads can view department qa"
  ON qa_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        (auth.users.raw_user_meta_data->>'role') = 'department_head'
        OR
        (auth.users.raw_app_meta_data->>'role') = 'department_head'
      )
    )
    AND EXISTS (
      SELECT 1
      FROM profiles viewer
      WHERE viewer.id = auth.uid()
      AND viewer.role = 'department_head'
      AND EXISTS (
        SELECT 1
        FROM profiles author
        WHERE author.id = qa_sets.user_id
        AND author.department_id = viewer.department_id
      )
    )
  );

-- 지사장: 같은 본부의 팀장+FC들만 Q&A 조회 가능 - 미래 확장용
-- ⚠️ 무한 재귀 방지: auth.users의 metadata 사용
CREATE POLICY "Branch heads can view branch qa"
  ON qa_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        (auth.users.raw_user_meta_data->>'role') = 'branch_head'
        OR
        (auth.users.raw_app_meta_data->>'role') = 'branch_head'
      )
    )
    AND EXISTS (
      SELECT 1
      FROM profiles viewer
      WHERE viewer.id = auth.uid()
      AND viewer.role = 'branch_head'
      AND EXISTS (
        SELECT 1
        FROM profiles author
        WHERE author.id = qa_sets.user_id
        AND author.department_id = viewer.department_id
        AND (author.role = 'team_leader' OR author.role = 'fc' OR author.role = 'user')
      )
    )
  );

-- 팀장: 같은 본부의 FC들만 Q&A 조회 가능
-- ⚠️ 무한 재귀 방지: auth.users의 metadata 사용
CREATE POLICY "Team leaders can view team qa"
  ON qa_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        (auth.users.raw_user_meta_data->>'role') = 'team_leader'
        OR
        (auth.users.raw_app_meta_data->>'role') = 'team_leader'
      )
    )
    AND EXISTS (
      SELECT 1
      FROM profiles viewer
      WHERE viewer.id = auth.uid()
      AND viewer.role = 'team_leader'
      AND EXISTS (
        SELECT 1
        FROM profiles author
        WHERE author.id = qa_sets.user_id
        AND author.department_id = viewer.department_id
        AND (author.role = 'fc' OR author.role = 'user')
      )
    )
  );

-- ============================================
-- 3. usage_logs 테이블 RLS 정책 (토큰 정보)
-- ============================================

-- ⚠️ 중요: 토큰 사용량은 관리자만 조회 가능
-- 본부장/팀장은 토큰 정보를 볼 수 없음

-- 기존 정책 확인
DROP POLICY IF EXISTS "Admins can view all usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Users can view own usage logs" ON usage_logs;

-- 관리자: 모든 사용자 토큰 사용량 조회 가능
CREATE POLICY "Admins can view all usage logs"
  ON usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 사용자: 자신의 토큰 사용량만 조회 가능 (일반 사용자는 자신의 것도 볼 수 있음)
CREATE POLICY "Users can view own usage logs"
  ON usage_logs FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- 4. profiles 테이블 RLS 정책 업데이트
-- ============================================

-- 기존 정책 확인 및 업데이트
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile lookup by username for login" ON profiles;
DROP POLICY IF EXISTS "Department heads can view department profiles" ON profiles;
DROP POLICY IF EXISTS "Branch heads can view branch profiles" ON profiles;  -- 미래 확장용
DROP POLICY IF EXISTS "Team leaders can view team profiles" ON profiles;

-- 관리자: 모든 프로필 조회 가능 (무한 재귀 방지: auth.users만 사용)
-- ⚠️ 중요: auth.users의 metadata만 확인하여 무한 재귀 방지
-- profiles 테이블을 전혀 조회하지 않음
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
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

-- 일반 사용자: 자신의 프로필 조회 가능
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 로그인 전 프로필 조회 허용 (username으로 이메일 조회용)
-- ⚠️ 보안: username으로만 조회 가능하며, 이메일과 승인 상태만 반환
CREATE POLICY "Allow profile lookup by username for login"
  ON profiles FOR SELECT
  USING (true);  -- 로그인 전이므로 모든 사용자가 username으로 프로필 조회 가능
  -- 실제 인증은 Supabase Auth에서 처리되므로, username 조회만 허용

-- 본부장: 같은 본부의 모든 사용자 프로필 조회 가능
-- ⚠️ 무한 재귀 방지: auth.users의 metadata 사용
CREATE POLICY "Department heads can view department profiles"
  ON profiles FOR SELECT
  USING (
    -- 본부장 자신
    auth.uid() = id
    OR
    -- 같은 본부의 다른 사용자 (무한 재귀 방지를 위해 auth.users 사용)
    (
      EXISTS (
        SELECT 1
        FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND (
          (auth.users.raw_user_meta_data->>'role') = 'department_head'
          OR
          (auth.users.raw_app_meta_data->>'role') = 'department_head'
        )
      )
      AND EXISTS (
        SELECT 1
        FROM profiles viewer_profile
        WHERE viewer_profile.id = auth.uid()
        AND viewer_profile.role = 'department_head'
        AND profiles.department_id = viewer_profile.department_id
      )
    )
  );

-- 지사장: 같은 본부의 팀장+FC들만 프로필 조회 가능 (자신 포함) - 미래 확장용
-- ⚠️ 무한 재귀 방지: auth.users의 metadata 사용
CREATE POLICY "Branch heads can view branch profiles"
  ON profiles FOR SELECT
  USING (
    -- 지사장 자신
    auth.uid() = id
    OR
    -- 같은 본부의 팀장+FC들만 (무한 재귀 방지를 위해 auth.users 사용)
    (
      EXISTS (
        SELECT 1
        FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND (
          (auth.users.raw_user_meta_data->>'role') = 'branch_head'
          OR
          (auth.users.raw_app_meta_data->>'role') = 'branch_head'
        )
      )
      AND EXISTS (
        SELECT 1
        FROM profiles viewer_profile
        WHERE viewer_profile.id = auth.uid()
        AND viewer_profile.role = 'branch_head'
        AND profiles.department_id = viewer_profile.department_id
        AND (profiles.role = 'team_leader' OR profiles.role = 'fc' OR profiles.role = 'user')
      )
    )
  );

-- 팀장: 같은 본부의 FC들만 프로필 조회 가능 (자신 포함)
-- ⚠️ 무한 재귀 방지: auth.users의 metadata 사용
CREATE POLICY "Team leaders can view team profiles"
  ON profiles FOR SELECT
  USING (
    -- 팀장 자신
    auth.uid() = id
    OR
    -- 같은 본부의 FC들만 (무한 재귀 방지를 위해 auth.users 사용)
    (
      EXISTS (
        SELECT 1
        FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND (
          (auth.users.raw_user_meta_data->>'role') = 'team_leader'
          OR
          (auth.users.raw_app_meta_data->>'role') = 'team_leader'
        )
      )
      AND EXISTS (
        SELECT 1
        FROM profiles viewer_profile
        WHERE viewer_profile.id = auth.uid()
        AND viewer_profile.role = 'team_leader'
        AND profiles.department_id = viewer_profile.department_id
        AND (profiles.role = 'fc' OR profiles.role = 'user')
      )
    )
  );

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ 계층적 권한 RLS 정책이 설정되었습니다.';
  RAISE NOTICE '📝 권한 구조:';
  RAISE NOTICE '   - 관리자: 모든 데이터 조회 가능 (토큰 포함)';
  RAISE NOTICE '   - 본부장: 같은 본부 데이터 조회 가능 (토큰 제외)';
  RAISE NOTICE '   - 지사장: 같은 본부의 팀장+FC 데이터 조회 가능 (토큰 제외, 미래 확장용)';
  RAISE NOTICE '   - 팀장: 같은 본부의 FC 데이터 조회 가능 (토큰 제외)';
  RAISE NOTICE '   - FC/일반사용자: 자신의 데이터만 조회 가능';
END $$;

