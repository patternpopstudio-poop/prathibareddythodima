-- Phase 5 Slice 5.1: consultation + messages schema
-- Exit: migrations apply; participants can select/insert messages;
-- messages are immutable (no update/delete); consultation create deferred to Slice 5.2.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.consultation_status AS ENUM ('open', 'in_progress');

CREATE TYPE public.message_sender_role AS ENUM ('patient', 'doctor');

-- ---------------------------------------------------------------------------
-- Consultations (1:1 with a confirmed booking)
-- ---------------------------------------------------------------------------
CREATE TABLE public.consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings (id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors (id) ON DELETE CASCADE,
  status public.consultation_status NOT NULL DEFAULT 'open',
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consultations_booking_unique UNIQUE (booking_id)
);

CREATE INDEX consultations_patient_id_idx
  ON public.consultations (patient_id, created_at DESC);

CREATE INDEX consultations_doctor_id_idx
  ON public.consultations (doctor_id, last_message_at DESC NULLS LAST, created_at DESC);

CREATE INDEX consultations_status_idx
  ON public.consultations (status);

COMMENT ON TABLE public.consultations IS
  'Chat case opened for a confirmed booking (Phase 5). One consultation per booking.';

COMMENT ON COLUMN public.consultations.status IS
  'open = created, awaiting activity; in_progress = conversation started. Closed status ships in Phase 7.';

COMMENT ON COLUMN public.consultations.last_message_at IS
  'Denormalized latest message time for case lists / queues (updated by trigger).';

CREATE TRIGGER consultations_touch_updated_at
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Identity fields are immutable after insert (status / last_message_at may change).
CREATE OR REPLACE FUNCTION public.consultations_lock_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.booking_id := OLD.booking_id;
    NEW.patient_id := OLD.patient_id;
    NEW.doctor_id := OLD.doctor_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER consultations_lock_identity
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW
  EXECUTE FUNCTION public.consultations_lock_identity();

-- ---------------------------------------------------------------------------
-- Messages (append-only chat rows)
-- ---------------------------------------------------------------------------
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.consultations (id) ON DELETE RESTRICT,
  sender_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  sender_role public.message_sender_role NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_body_nonempty CHECK (char_length(trim(body)) > 0),
  CONSTRAINT messages_body_max_length CHECK (char_length(body) <= 8000)
);

CREATE INDEX messages_consultation_created_idx
  ON public.messages (consultation_id, created_at ASC);

CREATE INDEX messages_sender_id_idx
  ON public.messages (sender_id, created_at DESC);

COMMENT ON TABLE public.messages IS
  'Immutable consultation chat messages. No update/delete (RLS + triggers). Attachments in Slice 5.5.';

COMMENT ON COLUMN public.messages.body IS
  'Plain-text message body. Attachments may relax NOT NULL in Slice 5.5.';

-- Keep case list ordering cheap.
CREATE OR REPLACE FUNCTION public.messages_touch_consultation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.consultations
  SET last_message_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.consultation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_touch_consultation
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_touch_consultation();

-- Hard immutability (service role included — chat must not be rewritten).
CREATE OR REPLACE FUNCTION public.messages_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Messages are immutable and cannot be %', lower(TG_OP)
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER messages_no_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_reject_mutation();

CREATE TRIGGER messages_no_delete
  BEFORE DELETE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_reject_mutation();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_consultation_participant(p_consultation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consultations c
    WHERE c.id = p_consultation_id
      AND (
        c.patient_id = auth.uid()
        OR c.doctor_id = auth.uid()
        OR public.is_admin()
      )
  );
$$;

COMMENT ON FUNCTION public.is_consultation_participant(uuid) IS
  'True when the caller is the consultation patient, doctor, or an admin.';

-- ---------------------------------------------------------------------------
-- consultations RLS — clients do not insert (Slice 5.2 / service role)
-- ---------------------------------------------------------------------------
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY consultations_select_participant_or_admin
  ON public.consultations
  FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR doctor_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY consultations_no_client_insert
  ON public.consultations
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Doctors (own cases) and admins may update status; identity locked by trigger.
CREATE POLICY consultations_update_doctor_or_admin
  ON public.consultations
  FOR UPDATE
  TO authenticated
  USING (
    doctor_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    doctor_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY consultations_no_client_delete
  ON public.consultations
  FOR DELETE
  TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- messages RLS — participants insert/select; never update/delete
-- ---------------------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select_participant_or_admin
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.is_consultation_participant(consultation_id));

CREATE POLICY messages_insert_participant
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_consultation_participant(consultation_id)
    AND (
      (
        sender_role = 'patient'
        AND public.is_patient()
        AND EXISTS (
          SELECT 1
          FROM public.consultations c
          WHERE c.id = consultation_id
            AND c.patient_id = auth.uid()
        )
      )
      OR (
        sender_role = 'doctor'
        AND public.is_doctor()
        AND EXISTS (
          SELECT 1
          FROM public.consultations c
          WHERE c.id = consultation_id
            AND c.doctor_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY messages_no_client_update
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY messages_no_client_delete
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- Grants + Realtime (wired in Slice 5.4 UI; publication ready here)
-- ---------------------------------------------------------------------------
GRANT SELECT, UPDATE ON public.consultations TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;

ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- already in publication
END;
$$;
