-- Phase 5 Slice 5.13: read receipts for online chat.
-- Exit: peer can set read_at on others' messages; content remains immutable;
-- mark_consultation_messages_read RPC for thread-open bulk mark.

-- ---------------------------------------------------------------------------
-- Column
-- ---------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

COMMENT ON COLUMN public.messages.read_at IS
  'When the peer (non-sender) first read the message. Null until then; never cleared.';

CREATE INDEX IF NOT EXISTS messages_consultation_unread_idx
  ON public.messages (consultation_id, created_at ASC)
  WHERE read_at IS NULL;

COMMENT ON TABLE public.messages IS
  'Consultation chat messages. Content immutable; only read_at may be set by the peer (Slice 5.13).';

-- ---------------------------------------------------------------------------
-- Trigger: allow read_at null → timestamp only; lock all other columns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.messages_lock_except_read_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.consultation_id IS DISTINCT FROM OLD.consultation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.sender_role IS DISTINCT FROM OLD.sender_role
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.attachment_path IS DISTINCT FROM OLD.attachment_path
     OR NEW.attachment_name IS DISTINCT FROM OLD.attachment_name
     OR NEW.attachment_mime IS DISTINCT FROM OLD.attachment_mime
     OR NEW.attachment_size_bytes IS DISTINCT FROM OLD.attachment_size_bytes
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Messages are immutable except read_at'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Once set, read_at is sticky; cannot clear or rewrite.
  IF OLD.read_at IS NOT NULL THEN
    NEW.read_at := OLD.read_at;
  ELSIF NEW.read_at IS NULL THEN
    -- No-op update of null → null is fine
    NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_no_update ON public.messages;

CREATE TRIGGER messages_lock_except_read_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_lock_except_read_at();

COMMENT ON FUNCTION public.messages_lock_except_read_at() IS
  'Allows only peer read_at transitions (null → set). Content columns stay immutable.';

-- Keep hard delete rejection.
DROP TRIGGER IF EXISTS messages_no_delete ON public.messages;
CREATE TRIGGER messages_no_delete
  BEFORE DELETE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_reject_mutation();

-- ---------------------------------------------------------------------------
-- RLS: peer may UPDATE (read_at only enforced by trigger)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS messages_no_client_update ON public.messages;

CREATE POLICY messages_update_read_at_peer
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id IS DISTINCT FROM auth.uid()
    AND public.is_consultation_participant(consultation_id)
    AND EXISTS (
      SELECT 1
      FROM public.consultations c
      WHERE c.id = consultation_id
        AND c.mode = 'online'
        AND (
          c.patient_id = auth.uid()
          OR c.doctor_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    sender_id IS DISTINCT FROM auth.uid()
    AND public.is_consultation_participant(consultation_id)
  );

COMMENT ON POLICY messages_update_read_at_peer ON public.messages IS
  'Peer participant may set read_at on online consultation messages they did not send.';

GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: mark all unread peer messages read for a thread
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_consultation_messages_read(p_consultation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_consultation_id IS NULL THEN
    RAISE EXCEPTION 'consultation_id is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.consultations c
    WHERE c.id = p_consultation_id
      AND c.mode = 'online'
      AND (
        c.patient_id = auth.uid()
        OR c.doctor_id = auth.uid()
      )
  ) THEN
    RAISE EXCEPTION 'Not a participant of an online consultation';
  END IF;

  UPDATE public.messages m
  SET read_at = now()
  WHERE m.consultation_id = p_consultation_id
    AND m.sender_id IS DISTINCT FROM auth.uid()
    AND m.read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_consultation_messages_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_consultation_messages_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_consultation_messages_read(uuid) TO authenticated;

COMMENT ON FUNCTION public.mark_consultation_messages_read(uuid) IS
  'Marks unread messages from the other participant as read. Online consultations only.';
