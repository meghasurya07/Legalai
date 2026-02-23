-- Migration: Add extracted_text column to files table
-- Run this in Supabase SQL Editor to enable AI context

ALTER TABLE files ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Optional: Add status tracking for extraction if not already present (schema.sql has 'status' but usually for upload)
-- We might want 'extraction_status' or just use 'status' with values like 'uploading', 'processing', 'ready', 'error'
-- schema.sql defines status TEXT DEFAULT 'ready'

-- Index for text search (simple websearch-like) - Postgres simple text search
CREATE INDEX IF NOT EXISTS idx_files_extracted_text ON files USING GIN(to_tsvector('english', extracted_text));
