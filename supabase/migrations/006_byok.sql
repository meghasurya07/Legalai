-- ============================================
-- BYOK: Add Bring Your Own Key columns to organizations
-- ============================================
-- Run this migration in Supabase SQL Editor

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS byok_provider TEXT NOT NULL DEFAULT 'none'
        CHECK (byok_provider IN ('none', 'openai', 'azure_openai')),
    ADD COLUMN IF NOT EXISTS encrypted_api_key TEXT,
    ADD COLUMN IF NOT EXISTS byok_key_hint TEXT,
    ADD COLUMN IF NOT EXISTS azure_endpoint TEXT,
    ADD COLUMN IF NOT EXISTS azure_deployment TEXT;

COMMENT ON COLUMN organizations.byok_provider IS 'AI provider: none (Wesley default), openai (own key), azure_openai (own Azure deployment)';
COMMENT ON COLUMN organizations.encrypted_api_key IS 'AES-256-GCM encrypted API key. Never read raw.';
COMMENT ON COLUMN organizations.byok_key_hint IS 'Last 4 chars of key for display (e.g. sk-...a1b2)';
COMMENT ON COLUMN organizations.azure_endpoint IS 'Azure OpenAI endpoint URL (e.g. https://firm.openai.azure.com)';
COMMENT ON COLUMN organizations.azure_deployment IS 'Azure deployment name (e.g. gpt-4o)';
