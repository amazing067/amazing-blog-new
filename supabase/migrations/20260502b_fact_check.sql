-- content_items에 fact-check 결과 컬럼 추가
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS fact_check JSONB,           -- { passed, issues: [...] }
  ADD COLUMN IF NOT EXISTS generated_by TEXT;          -- "claude-haiku-4-5" 등 모델 식별자
