-- Add event type to distinguish between regular tournaments and quick matches
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'REGULAR';
