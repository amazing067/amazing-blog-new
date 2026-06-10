-- 설계사방(amazing-biz-server) 전송 + 누락된 compliance 컬럼 보강
-- 1) compliance: 20260502e 에서 추가했어야 하나 프로덕션에 미적용 → 저장 버그의 근본원인.
--    (IF NOT EXISTS 라 재실행/중복 안전)
-- 2) sent_to_server_at: 설계사방으로 보낸 시각(전송 여부 표시·재전송 판단용)
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS compliance JSONB;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS sent_to_server_at TIMESTAMPTZ;
