-- Migration: 017_add_user_profile_fields.sql
-- Add user_name and profile_image columns to user_settings table
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS user_name TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS profile_image TEXT DEFAULT NULL;