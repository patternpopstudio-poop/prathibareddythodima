-- Phase 5 Slice 5.4: mark consultation in_progress on first doctor reply.
-- Realtime publication for messages already enabled in Slice 5.1.

CREATE OR REPLACE FUNCTION public.messages_mark_consultation_in_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated public.consultations%ROWTYPE;
BEGIN
  IF NEW.sender_role IS DISTINCT FROM 'doctor' THEN
    RETURN NEW;
  END IF;

  UPDATE public.consultations
  SET status = 'in_progress',
      updated_at = now()
  WHERE id = NEW.consultation_id
    AND status = 'open'
  RETURNING * INTO v_updated;

  IF FOUND THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      NEW.sender_id,
      'consultation.status_updated',
      'consultations',
      v_updated.id::text,
      jsonb_build_object(
        'from', 'open',
        'to', 'in_progress',
        'trigger', 'first_doctor_reply',
        'message_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_mark_consultation_in_progress ON public.messages;
CREATE TRIGGER messages_mark_consultation_in_progress
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_mark_consultation_in_progress();

COMMENT ON FUNCTION public.messages_mark_consultation_in_progress() IS
  'Phase 5 Slice 5.4: first doctor message moves consultation open → in_progress.';

-- Allow clients to hear status changes live (optional companion to message inserts).
ALTER TABLE public.consultations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.consultations';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;
