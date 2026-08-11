-- Phase 5 Slice 5.6: denormalized last-message sender for doctor case queues.
-- Queues (doctor-admin):
--   Unreplied        = status = 'open' (no doctor reply yet)
--   Response Awaited = status = 'in_progress' AND last_message_sender_role = 'patient'

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS last_message_sender_role public.message_sender_role;

COMMENT ON COLUMN public.consultations.last_message_sender_role IS
  'Sender role of the latest message (denormalized for doctor queue filters). Null until first message.';

CREATE INDEX IF NOT EXISTS consultations_doctor_queue_idx
  ON public.consultations (doctor_id, status, last_message_sender_role, last_message_at DESC NULLS LAST);

-- Keep denormalized activity fields in sync on every message insert.
CREATE OR REPLACE FUNCTION public.messages_touch_consultation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.consultations
  SET last_message_at = NEW.created_at,
      last_message_sender_role = NEW.sender_role,
      updated_at = now()
  WHERE id = NEW.consultation_id;
  RETURN NEW;
END;
$$;

-- Backfill from the latest message per consultation.
UPDATE public.consultations c
SET last_message_sender_role = m.sender_role,
    last_message_at = COALESCE(c.last_message_at, m.created_at),
    updated_at = now()
FROM (
  SELECT DISTINCT ON (consultation_id)
    consultation_id,
    sender_role,
    created_at
  FROM public.messages
  ORDER BY consultation_id, created_at DESC
) m
WHERE c.id = m.consultation_id
  AND (
    c.last_message_sender_role IS DISTINCT FROM m.sender_role
    OR c.last_message_at IS DISTINCT FROM m.created_at
  );
