-- Add pinned column to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;

-- Index for efficient pinned queries
CREATE INDEX IF NOT EXISTS idx_conversations_pinned ON conversations(pinned);
