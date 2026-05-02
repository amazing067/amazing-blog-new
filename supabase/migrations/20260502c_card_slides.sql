-- 카드뉴스용 슬라이드 데이터 저장
-- type='card' 인 content_items에 5장 시리즈 JSON 저장

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS card_slides JSONB;
-- 형태: [
--   { "kind":"cover", "eyebrow":"...", "title":"...", "bigStat":"...", "bigStatLabel":"...", "iconKey":"sparkles" },
--   { "kind":"point", "number":"01", "bigStat":"...", "bigStatLabel":"...", "title":"...", "body":"...", "iconKey":"trendingDown" },
--   ...
--   { "kind":"closing", "title":"...", "items":["...","...","..."], "footer":"...", "iconKey":"clipboard" }
-- ]
