-- 카드뉴스/블로그 발행 전 사용자가 입력하는 심의번호
-- footer에 "광고심의필 제2026-XXXX호 (~2027-XX-XX)" 표시
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS compliance_number TEXT,
  ADD COLUMN IF NOT EXISTS compliance_expires DATE;
