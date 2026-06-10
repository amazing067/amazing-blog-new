-- 반송(returned) 상태 + 반송 사유 — '거절(expired)'과 구분되는 별도 상태.
-- 반송: 수정해서 다시 받을 카드. 사유·배지·탭은 관리자(admin)만 노출.

-- 1) status CHECK 제약에 'returned' 추가 (제약 이름이 환경마다 다를 수 있어 동적으로 찾아 교체)
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
    FROM pg_constraint
   WHERE conrelid = 'content_items'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF c IS NOT NULL THEN
    EXECUTE 'ALTER TABLE content_items DROP CONSTRAINT ' || quote_ident(c);
  END IF;
END $$;

ALTER TABLE content_items
  ADD CONSTRAINT content_items_status_check
  CHECK (status IN ('draft','review','approved','returned','published','expired','failed'));

-- 2) 반송 사유·시각
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS return_reason TEXT;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
