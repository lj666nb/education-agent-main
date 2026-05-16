-- Migration 004: Add model_version column to api_settings table
-- 为 text-embedding 模型版本选择功能添加 model_version 字段

ALTER TABLE api_settings ADD COLUMN IF NOT EXISTS model_version VARCHAR(20);

COMMENT ON COLUMN api_settings.model_version IS 'text-embedding模型版本（v1/v2/v3）';
