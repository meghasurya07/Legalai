-- Migration: 031_job_queue_production.sql
-- Purpose: Add atomic job claiming RPC and backoff scheduling support
--
-- Creates:
--   1. claim_next_job() — atomic job claim using SELECT FOR UPDATE SKIP LOCKED
--   2. next_run_after column for exponential backoff scheduling
--   3. Index for efficient pending job queries

-- ============================================
-- 1. ADD next_run_after column for backoff scheduling
-- ============================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS next_run_after TIMESTAMPTZ;

-- Index for efficient pending job retrieval
CREATE INDEX IF NOT EXISTS idx_jobs_pending_status
    ON jobs (status, created_at ASC)
    WHERE status = 'pending';

-- ============================================
-- 2. CLAIM_NEXT_JOB RPC
-- Atomically claims the next pending job using FOR UPDATE SKIP LOCKED.
-- This prevents concurrent workers from processing the same job.
--
-- Returns: the claimed job row (with status already set to 'running')
-- Returns: empty result set if no jobs are available
-- ============================================
CREATE OR REPLACE FUNCTION claim_next_job()
RETURNS SETOF jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    claimed_job jobs%ROWTYPE;
BEGIN
    -- Atomically select and lock the next eligible job
    SELECT * INTO claimed_job
    FROM jobs
    WHERE status = 'pending'
        AND (next_run_after IS NULL OR next_run_after <= NOW())
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- If no job found, return empty
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Update the job to 'running' status
    UPDATE jobs
    SET status = 'running',
        attempts = attempts + 1,
        started_at = NOW()
    WHERE id = claimed_job.id;

    -- Update the local variable to reflect changes
    claimed_job.status := 'running';
    claimed_job.attempts := claimed_job.attempts + 1;
    claimed_job.started_at := NOW();

    RETURN NEXT claimed_job;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_next_job TO service_role;
GRANT EXECUTE ON FUNCTION claim_next_job TO authenticated;
