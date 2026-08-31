-- Phase 6 Slice 6.1a: consultation_status += completed
-- Must commit before 6.1b / 6.7 use the new enum value.

ALTER TYPE public.consultation_status ADD VALUE IF NOT EXISTS 'completed';

COMMENT ON TYPE public.consultation_status IS
  'open = awaiting doctor; in_progress = conversation started; completed = SOAP signed off (Phase 6). Chat lock + ratings remain Phase 6.7 / 7.';
