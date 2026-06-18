-- 카드뉴스 디자인 스타일 확장: 기존 A~F + 신규 G(CleanMinimal)/H(NeoBrutal)/I(MeshGlass)
-- 적용 전에는 card_style='G'/'H'/'I' 삽입이 CHECK 제약에 막히므로, 신규 스타일 운영 편입 전 반드시 적용.

ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_card_style_check;
ALTER TABLE content_items
  ADD CONSTRAINT content_items_card_style_check
  CHECK (card_style IN ('A','B','C','D','E','F','G','H','I'));
