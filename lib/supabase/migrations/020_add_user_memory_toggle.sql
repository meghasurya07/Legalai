-- Migration: 020_add_user_memory_toggle.sql
-- Adds ai_memory_persistence column to user_settings for user-level memory toggle

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS ai_memory_persistence BOOLEAN DEFAULT true;
