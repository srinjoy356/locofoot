-- Migration 0060: Phase 5G Match Metadata

BEGIN;

-- 1. Add metadata column to matches for storing custom match settings like time overrides
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
