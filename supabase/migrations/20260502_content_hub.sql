-- Content Automation Hub — Sprint 1 (반자동)
-- 다음 sprint에서 추가될 테이블: publish_jobs, channel_credentials, compliance_records

CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('news','blog','card','naver_blog')),
  title TEXT NOT NULL,
  body_md TEXT,
  body_html TEXT,
  image_urls TEXT[] DEFAULT '{}',
  source_refs JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'review'
    CHECK (status IN ('draft','review','approved','published','expired','failed')),
  enforcement_mode TEXT NOT NULL DEFAULT 'open'
    CHECK (enforcement_mode IN ('open','strict')),
  publish_url TEXT,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_content_items_type_status ON content_items (type, status);

CREATE TABLE compliance_lints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  forbidden_terms_found TEXT[] DEFAULT '{}',
  comparison_phrases TEXT[] DEFAULT '{}',
  guarantee_phrases TEXT[] DEFAULT '{}',
  insurer_mentions TEXT[] DEFAULT '{}',
  product_mentions TEXT[] DEFAULT '{}',
  risk_score INT NOT NULL,
  must_fix BOOLEAN NOT NULL,
  raw_report JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_compliance_lints_content ON compliance_lints (content_id, created_at DESC);

CREATE TABLE content_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO content_settings (key, value) VALUES ('news.enforcement_mode', '"open"'::jsonb);

-- RLS
ALTER TABLE content_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_lints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_settings  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  );
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['content_items','compliance_lints','content_settings']
  LOOP
    EXECUTE format('CREATE POLICY admin_select_%I ON %I FOR SELECT TO authenticated USING (is_admin());', t, t);
    EXECUTE format('CREATE POLICY admin_insert_%I ON %I FOR INSERT TO authenticated WITH CHECK (is_admin());', t, t);
    EXECUTE format('CREATE POLICY admin_update_%I ON %I FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());', t, t);
    EXECUTE format('CREATE POLICY admin_delete_%I ON %I FOR DELETE TO authenticated USING (is_admin());', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
CREATE TRIGGER trg_content_items_updated_at BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_content_settings_updated_at BEFORE UPDATE ON content_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
