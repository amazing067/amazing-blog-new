-- 리쿠르팅(설계사 모집) 트랙 — content_items.type에 recruit-card / recruit-blog 추가.
-- 기존 'news'/'blog'/'card'/'naver_blog' 디스크리미네이터 패턴 그대로 확장.
-- (별도 컬럼·테이블 없이 type 값만 추가)

ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_type_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_type_check
  CHECK (type IN ('news','blog','card','naver_blog','recruit-card','recruit-blog'));
