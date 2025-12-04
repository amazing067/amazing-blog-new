-- ⭐ 실행 방법: Supabase SQL Editor에서 + 버튼으로 새로 만들기

-- blog_posts 테이블 생성
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- 입력 정보
  topic TEXT NOT NULL,
  keywords TEXT,
  product TEXT,
  tone TEXT,
  template TEXT,
  
  -- 생성 결과
  html_content TEXT NOT NULL,
  plain_text TEXT,
  
  -- 메타 정보
  title TEXT,
  word_count INT,
  
  -- 상태
  status TEXT DEFAULT 'draft',  -- draft, published, archived
  published_to TEXT[],  -- 발행한 플랫폼 ['naver', 'tistory']
  
  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  published_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS blog_posts_user_id_idx ON blog_posts(user_id);
CREATE INDEX IF NOT EXISTS blog_posts_created_at_idx ON blog_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_status_idx ON blog_posts(status);

-- RLS (Row Level Security) 활성화
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 글만 볼 수 있음
CREATE POLICY "Users can view own posts"
  ON blog_posts FOR SELECT
  USING (auth.uid() = user_id);

-- 정책: 사용자는 자신의 글을 생성할 수 있음
CREATE POLICY "Users can insert own posts"
  ON blog_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 정책: 사용자는 자신의 글을 수정할 수 있음
CREATE POLICY "Users can update own posts"
  ON blog_posts FOR UPDATE
  USING (auth.uid() = user_id);

-- 정책: 사용자는 자신의 글을 삭제할 수 있음
CREATE POLICY "Users can delete own posts"
  ON blog_posts FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 생성
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

