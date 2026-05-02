-- 블로그 글의 SEO 메타 설명 (네이버·구글 검색 결과 요약)
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS meta_description TEXT;
