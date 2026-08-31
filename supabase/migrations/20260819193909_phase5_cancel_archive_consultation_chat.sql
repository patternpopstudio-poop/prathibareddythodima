-- After a booking is cancelled: block new chat; doctor may archive (hide) the case.
-- Messages stay immutable. Patients no longer send; doctor dismisses from Cases.

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.consultations.archived_at IS
  'When set by the doctor, the cancelled case is hidden from Cases. History is kept.';

CREATE INDEX IF NOT EXISTS consultations_doctor_archived_idx
  ON public.consultations (doctor_id, archived_at)
  WHERE archived_at IS NULL;

-- ---------------------------------------------------------------------------
-- Active booking = not cancelled (used by message/storage INSERT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consultation_booking_is_active(p_consultation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consultations c
    JOIN public.bookings b ON b.id = c.booking_id
    WHERE c.id = p_consultation_id
      AND b.status <> 'cancelled'
      AND c.archived_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.consultation_booking_is_active(uuid) IS
  'True when the consultation booking is not cancelled and the case is not archived.';

REVOKE ALL ON FUNCTION public.consultation_booking_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultation_booking_is_active(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consultations_archive_only_if_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS DISTINCT FROM NEW.archived_at THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = NEW.booking_id
        AND b.status = 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Chat can only be removed after the appointment is cancelled';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consultations_archive_only_if_cancelled ON public.consultations;
CREATE TRIGGER consultations_archive_only_if_cancelled
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW
  EXECUTE FUNCTION public.consultations_archive_only_if_cancelled();

-- Tighten doctor 10-minute window: cancelled/archived cases stay closed
CREATE OR REPLACE FUNCTION public.doctor_consultation_chat_open(p_consultation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consultations c
    JOIN public.bookings b ON b.id = c.booking_id
    LEFT JOIN public.appointment_slots s ON s.id = b.slot_id
    WHERE c.id = p_consultation_id
      AND c.archived_at IS NULL
      AND b.status <> 'cancelled'
      AND COALESCE(s.starts_at, b.preferred_starts_at) IS NOT NULL
      AND now() >= (COALESCE(s.starts_at, b.preferred_starts_at) - interval '10 minutes')
  );
$$;

-- ---------------------------------------------------------------------------
-- messages INSERT — require an active (non-cancelled, non-archived) booking
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS messages_insert_participant ON public.messages;

CREATE POLICY messages_insert_participant
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_consultation_participant(consultation_id)
    AND public.consultation_booking_is_active(consultation_id)
    AND EXISTS (
      SELECT 1
      FROM public.consultations c
      WHERE c.id = consultation_id
        AND c.mode = 'online'
    )
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
        AND public.doctor_consultation_chat_open(consultation_id)
      )
    )
  );

COMMENT ON POLICY messages_insert_participant ON public.messages IS
  'Online, active booking; doctors also need the 10-minute window.';

DROP POLICY IF EXISTS consultation_attachments_insert ON storage.objects;

CREATE POLICY consultation_attachments_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'consultation-attachments'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_consultation_participant(((storage.foldername(name))[1])::uuid)
    AND public.consultation_booking_is_active(((storage.foldername(name))[1])::uuid)
    AND EXISTS (
      SELECT 1
      FROM public.consultations c
      WHERE c.id = ((storage.foldername(name))[1])::uuid
        AND c.mode = 'online'
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.consultations c
        WHERE c.id = ((storage.foldername(name))[1])::uuid
          AND c.patient_id = auth.uid()
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.consultations c
          WHERE c.id = ((storage.foldername(name))[1])::uuid
            AND c.doctor_id = auth.uid()
        )
        AND public.doctor_consultation_chat_open(((storage.foldername(name))[1])::uuid)
      )
    )
  );
