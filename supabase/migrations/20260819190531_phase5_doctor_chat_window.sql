-- Phase 5: doctors may send chat (text + attachments) only from 10 minutes
-- before the appointment start. Patients are unchanged (online-only gate).

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
      AND COALESCE(s.starts_at, b.preferred_starts_at) IS NOT NULL
      AND now() >= (COALESCE(s.starts_at, b.preferred_starts_at) - interval '10 minutes')
  );
$$;

COMMENT ON FUNCTION public.doctor_consultation_chat_open(uuid) IS
  'True when the consultation slot has started or is within 10 minutes.';

REVOKE ALL ON FUNCTION public.doctor_consultation_chat_open(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.doctor_consultation_chat_open(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- messages INSERT — doctor branch also requires the 10-minute window
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS messages_insert_participant ON public.messages;

CREATE POLICY messages_insert_participant
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_consultation_participant(consultation_id)
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
  'Online consultations only; doctors insert from 10 minutes before slot start.';

-- ---------------------------------------------------------------------------
-- Storage uploads — doctor uploads use the same window; patients do not
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS consultation_attachments_insert ON storage.objects;

CREATE POLICY consultation_attachments_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'consultation-attachments'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_consultation_participant(((storage.foldername(name))[1])::uuid)
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
