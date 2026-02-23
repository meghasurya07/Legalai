-- Migration: 016_fix_user_id_type.sql
ALTER TABLE organization_members
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE team_members
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE user_settings
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;