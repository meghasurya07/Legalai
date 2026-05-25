-- Migration: 029_memory_rpcs_and_index_fix.sql
-- Purpose: Add missing RPC functions for memory learning loop and fix competing vector indexes
--
-- Creates:
--   1. increment_reinforcement(memory_id) — atomic counter increment + decay reset
--   2. exec_memory_decay(decay_rate, org_id) — bulk decay for eligible memories
--   3. Drops competing IVFFlat index on memories.embedding (H12 fix), keeps HNSW

-- ============================================
-- 1. INCREMENT_REINFORCEMENT RPC
-- Atomically increments reinforcement_count, resets decay_weight to 1.0,
-- and updates last_accessed_at. Called by learning-loop.ts reinforceMemory().
-- ============================================
CREATE OR REPLACE FUNCTION increment_reinforcement(memory_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE memories
    SET reinforcement_count = reinforcement_count + 1,
        decay_weight = 1.0,
        last_accessed_at = NOW(),
        updated_at = NOW()
    WHERE id = memory_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_reinforcement TO service_role;
GRANT EXECUTE ON FUNCTION increment_reinforcement TO authenticated;

-- ============================================
-- 2. EXEC_MEMORY_DECAY RPC
-- Applies decay to all eligible memories in a single UPDATE.
-- Eligible: is_active=true, is_pinned=false, decay_weight > 0.01,
--           last_accessed_at older than 24 hours (or NULL).
-- Called by learning-loop.ts applyMemoryDecay() via exec_sql fallback.
-- This dedicated RPC replaces the need for exec_sql.
-- ============================================
CREATE OR REPLACE FUNCTION exec_memory_decay(
    decay_rate DOUBLE PRECISION DEFAULT 0.995,
    org_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    UPDATE memories
    SET decay_weight = decay_weight * decay_rate,
        updated_at = NOW()
    WHERE is_active = true
      AND is_pinned = false
      AND decay_weight > 0.01
      AND (last_accessed_at IS NULL OR last_accessed_at < NOW() - INTERVAL '1 day')
      AND (org_id IS NULL OR organization_id = org_id);

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION exec_memory_decay TO service_role;
GRANT EXECUTE ON FUNCTION exec_memory_decay TO authenticated;

-- ============================================
-- 3. H12 FIX — Drop competing IVFFlat index on memories.embedding
-- Migration 018 created an HNSW index (idx_memories_embedding_hnsw).
-- Migration 019 created a competing IVFFlat index (idx_memories_embedding_cosine).
-- Having both degrades write performance and confuses the query planner.
-- Keep HNSW (better recall, no training needed), drop IVFFlat.
-- ============================================
DROP INDEX IF EXISTS idx_memories_embedding_cosine;
