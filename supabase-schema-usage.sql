-- ⭐ 4단계: 사용량 로그 및 Q&A 저장 테이블 생성
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- ⚠️ 중요: 이 파일은 supabase-schema-profiles.sql 실행 후에 실행해야 합니다!
-- usage_logs와 qa_sets 테이블이 profiles 테이블을 참조합니다.

-- 1) usage_logs: 토큰 사용량 로그
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                -- 'blog' | 'qa' 등
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  meta JSONB,                        -- { topic, qa_id, ... }
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS usage_logs_user_id_idx ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS usage_logs_created_at_idx ON usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS usage_logs_type_idx ON usage_logs(type);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- 정책 생성 (IF NOT EXISTS 미지원 → 존재 여부 체크 후 생성)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own usage logs') THEN
    CREATE POLICY "Users can insert own usage logs"
      ON usage_logs FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own usage logs') THEN
    CREATE POLICY "Users can view own usage logs"
      ON usage_logs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all usage logs') THEN
    CREATE POLICY "Admins can view all usage logs"
      ON usage_logs FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role = 'admin'
        )
      );
  END IF;
END $$;


-- 3) 관리자 통계용 함수 (프로필별 글/QA/토큰 집계)
-- 실행 후 API (/api/admin/stats)에서 rpc('get_user_stats') 호출로 사용 가능
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ,
  blog_count INT,
  qa_count INT,
  token_total BIGINT,
  last_blog TIMESTAMPTZ,
  last_qa TIMESTAMPTZ,
  last_usage TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    p.username,
    p.full_name,
    p.email,
    p.created_at,
    COALESCE(b.blog_count, 0) AS blog_count,
    COALESCE(q.qa_count, 0) AS qa_count,
    COALESCE(u.token_total, 0) AS token_total,
    b.last_blog,
    q.last_qa,
    u.last_usage
  FROM profiles p
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS blog_count, MAX(created_at) AS last_blog
    FROM blog_posts
    GROUP BY user_id
  ) b ON b.user_id = p.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS qa_count, MAX(created_at) AS last_qa
    FROM qa_sets
    GROUP BY user_id
  ) q ON q.user_id = p.id
  LEFT JOIN (
    SELECT user_id, SUM(total_tokens)::BIGINT AS token_total, MAX(created_at) AS last_usage
    FROM usage_logs
    GROUP BY user_id
  ) u ON u.user_id = p.id
  WHERE p.username <> 'amazing'; -- 최고 관리자 계정 제외
$$;

-- 2) qa_sets: Q&A 영구 저장용 (요약/메타)
CREATE TABLE IF NOT EXISTS qa_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  product_name TEXT,
  token_total INT,
  data JSONB,                        -- 질문/답변/스레드 요약 등
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS qa_sets_user_id_idx ON qa_sets(user_id);
CREATE INDEX IF NOT EXISTS qa_sets_created_at_idx ON qa_sets(created_at DESC);

ALTER TABLE qa_sets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own qa_sets') THEN
    CREATE POLICY "Users can insert own qa_sets"
      ON qa_sets FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own qa_sets') THEN
    CREATE POLICY "Users can view own qa_sets"
      ON qa_sets FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all qa_sets') THEN
    CREATE POLICY "Admins can view all qa_sets"
      ON qa_sets FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role = 'admin'
        )
      );
  END IF;
END $$;


