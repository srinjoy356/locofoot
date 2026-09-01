-- 0032_phase6_fix_enum.sql

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'EVENT_REFEREE_ASSIGNED';
