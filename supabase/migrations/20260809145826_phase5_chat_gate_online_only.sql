-- Phase 5 Slice 5.12: gate chat to online consultations only.
-- Offline cases keep a consultation row (for Phase 6+) but cannot send messages
-- or upload attachments.

-- ---------------------------------------------------------------------------
-- messages INSERT — require consultations.mode = 'online'
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
      )
    )
  );

COMMENT ON POLICY messages_insert_participant ON public.messages IS
  'Participants may insert only on online consultations (Slice 5.12 chat gate).';

-- ---------------------------------------------------------------------------
-- Storage uploads — same online-only gate
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
  );
