-- 광고심의필 전체 정보를 JSONB로 통합
-- BlogGenerator의 ApprovalGenerator 폼 구조와 동일:
-- {
--   company: "프라임에셋",
--   branch: "...",
--   designer: "...",
--   registration: "...",
--   number: "제2026-XXXX호",
--   start_date: "2026-05-02",
--   end_date: "2027-05-01",
--   include_warning: true
-- }
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS compliance JSONB;
