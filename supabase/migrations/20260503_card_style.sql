-- 카드뉴스 디자인 스타일 키 (A=BoldColor 현재, B=Magazine, C=Pastel, D=DarkPremium, E=DataReport, F=Y2KRetro)
-- 요일별 로테이션 (월=A, 화=B, 수=C, 목=D, 금=E, 토=F, 일=쉼)
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS card_style text DEFAULT 'A';

-- 기존 데이터는 모두 'A' (현재 디자인)로 자동 채워짐 (DEFAULT 동작).
-- 명시적으로도 한번 더 채워두기 (NULL 방지).
UPDATE content_items
SET card_style = 'A'
WHERE card_style IS NULL;

-- 안전 제약: 6개 값만 허용
ALTER TABLE content_items
  DROP CONSTRAINT IF EXISTS content_items_card_style_check;
ALTER TABLE content_items
  ADD CONSTRAINT content_items_card_style_check
  CHECK (card_style IN ('A','B','C','D','E','F'));
