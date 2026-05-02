-- 콘텐츠 생성 비용 추적
-- Claude(생성)/Gemini(fact-check)의 token usage + USD 비용을 content_items에 저장
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS gen_input_tokens INT,
  ADD COLUMN IF NOT EXISTS gen_output_tokens INT,
  ADD COLUMN IF NOT EXISTS gen_cost_usd NUMERIC(10, 6),     -- 생성 비용 (Claude)
  ADD COLUMN IF NOT EXISTS fc_input_tokens INT,
  ADD COLUMN IF NOT EXISTS fc_output_tokens INT,
  ADD COLUMN IF NOT EXISTS fc_cost_usd NUMERIC(10, 6),       -- fact-check 비용 (Gemini)
  ADD COLUMN IF NOT EXISTS total_cost_usd NUMERIC(10, 6);    -- 합계

CREATE INDEX IF NOT EXISTS idx_content_items_created_cost
  ON content_items (created_at DESC) WHERE total_cost_usd IS NOT NULL;
