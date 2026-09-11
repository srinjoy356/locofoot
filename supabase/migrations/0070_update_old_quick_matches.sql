-- Update older quick matches to have the correct type
UPDATE public.events 
SET type = 'QUICK_MATCH' 
WHERE description = 'Auto-generated quick match';
