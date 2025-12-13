-- ⚠️ 외래 키 제약 조건에 ON DELETE CASCADE 추가
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- 이 스크립트는 blog_posts와 qa_sets 테이블의 외래 키 제약 조건을 수정하여
-- profiles 테이블의 사용자를 삭제할 때 관련 데이터도 자동으로 삭제되도록 합니다.

-- ============================================
-- 1. blog_posts 테이블의 외래 키 제약 조건 수정
-- ============================================

-- 기존 제약 조건 삭제
ALTER TABLE blog_posts 
  DROP CONSTRAINT IF EXISTS blog_posts_user_id_fkey;

-- ON DELETE CASCADE가 포함된 새로운 제약 조건 추가
ALTER TABLE blog_posts 
  ADD CONSTRAINT blog_posts_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;

-- ============================================
-- 2. qa_sets 테이블의 외래 키 제약 조건 수정 (있는 경우)
-- ============================================

-- 기존 제약 조건 삭제
ALTER TABLE qa_sets 
  DROP CONSTRAINT IF EXISTS qa_sets_user_id_fkey;

-- ON DELETE CASCADE가 포함된 새로운 제약 조건 추가
ALTER TABLE qa_sets 
  ADD CONSTRAINT qa_sets_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;

-- ============================================
-- 3. usage_logs 테이블의 외래 키 제약 조건 수정 (있는 경우)
-- ============================================

-- 기존 제약 조건 삭제
ALTER TABLE usage_logs 
  DROP CONSTRAINT IF EXISTS usage_logs_user_id_fkey;

-- ON DELETE CASCADE가 포함된 새로운 제약 조건 추가
ALTER TABLE usage_logs 
  ADD CONSTRAINT usage_logs_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;

-- ============================================
-- 4. 확인
-- ============================================

-- 제약 조건 확인
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM 
  information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  LEFT JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.table_schema
WHERE 
  tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'profiles'
ORDER BY 
  tc.table_name, tc.constraint_name;

