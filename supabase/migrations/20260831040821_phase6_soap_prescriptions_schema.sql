-- Phase 6 Slice 6.1: SOAP notes + prescriptions schema and RLS
-- Exit: tables, indexes, RLS, shared-types. No UI, PDF, or complete_consultation RPC.
--
-- Access: full SOAP is doctor + admin only. Patients SELECT prescriptions
-- (patient_diagnosis + items), never soap_notes.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_consultation_doctor(p_consultation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consultations c
    WHERE c.id = p_consultation_id
      AND c.doctor_id = auth.uid()
      AND public.is_doctor()
  );
$$;

COMMENT ON FUNCTION public.is_consultation_doctor(uuid) IS
  'True when the caller is the assigned doctor for the consultation.';

REVOKE ALL ON FUNCTION public.is_consultation_doctor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_consultation_doctor(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.soap_amendment_hours()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 24;
$$;

COMMENT ON FUNCTION public.soap_amendment_hours() IS
  'Hours after SOAP sign-off during which the assigned doctor may amend notes (Slice 6.7).';

REVOKE ALL ON FUNCTION public.soap_amendment_hours() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soap_amendment_hours()
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- SOAP notes (one row per consultation; doctor-authored)
-- ---------------------------------------------------------------------------
CREATE TABLE public.soap_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.consultations (id) ON DELETE RESTRICT,
  subjective text,
  objective text,
  assessment text,
  plan text,
  follow_up boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  amendment_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT soap_notes_consultation_unique UNIQUE (consultation_id),
  CONSTRAINT soap_notes_subjective_max CHECK (
    subjective IS NULL OR char_length(subjective) <= 8000
  ),
  CONSTRAINT soap_notes_objective_max CHECK (
    objective IS NULL OR char_length(objective) <= 8000
  ),
  CONSTRAINT soap_notes_assessment_max CHECK (
    assessment IS NULL OR char_length(assessment) <= 8000
  ),
  CONSTRAINT soap_notes_plan_max CHECK (
    plan IS NULL OR char_length(plan) <= 8000
  )
);

CREATE INDEX soap_notes_consultation_id_idx
  ON public.soap_notes (consultation_id);

COMMENT ON TABLE public.soap_notes IS
  'Doctor SOAP for a consultation. Patients must not SELECT this table. Patient-visible diagnosis lives on prescriptions.patient_diagnosis (and SOAP assessment as source of truth).';

COMMENT ON COLUMN public.soap_notes.assessment IS
  'Clinical assessment; copied to prescriptions.patient_diagnosis when an Rx is issued (Slice 6.3).';

COMMENT ON COLUMN public.soap_notes.follow_up IS
  'Doctor follow-up recommended.';

COMMENT ON COLUMN public.soap_notes.completed_at IS
  'Set when the case is clinically completed (Slice 6.7). Null while drafting.';

COMMENT ON COLUMN public.soap_notes.amendment_deadline IS
  'completed_at + soap_amendment_hours(). Null until complete. Updates forbidden after this instant.';

CREATE TRIGGER soap_notes_touch_updated_at
  BEFORE UPDATE ON public.soap_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.soap_notes_lock_identity_and_amendment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.consultation_id := OLD.consultation_id;

    IF OLD.amendment_deadline IS NOT NULL
       AND now() > OLD.amendment_deadline THEN
      RAISE EXCEPTION 'SOAP notes cannot be amended after the 24-hour window'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER soap_notes_lock_identity_and_amendment
  BEFORE UPDATE ON public.soap_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.soap_notes_lock_identity_and_amendment();

REVOKE ALL ON FUNCTION public.soap_notes_lock_identity_and_amendment()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Prescriptions
-- ---------------------------------------------------------------------------
CREATE TYPE public.prescription_status AS ENUM ('issued', 'voided');

CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.consultations (id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1,
  status public.prescription_status NOT NULL DEFAULT 'issued',
  patient_diagnosis text,
  pdf_path text,
  message_id uuid REFERENCES public.messages (id) ON DELETE SET NULL,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prescriptions_version_positive CHECK (version >= 1),
  CONSTRAINT prescriptions_consultation_version_unique UNIQUE (consultation_id, version),
  CONSTRAINT prescriptions_diagnosis_max CHECK (
    patient_diagnosis IS NULL OR char_length(patient_diagnosis) <= 500
  ),
  CONSTRAINT prescriptions_issued_has_diagnosis CHECK (
    status <> 'issued'
    OR (
      patient_diagnosis IS NOT NULL
      AND char_length(trim(patient_diagnosis)) > 0
    )
  ),
  CONSTRAINT prescriptions_void_fields CHECK (
    (
      status = 'issued'
      AND voided_at IS NULL
    )
    OR (
      status = 'voided'
      AND voided_at IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX prescriptions_one_issued_per_consultation
  ON public.prescriptions (consultation_id)
  WHERE status = 'issued';

CREATE INDEX prescriptions_consultation_id_idx
  ON public.prescriptions (consultation_id, created_at DESC);

CREATE INDEX prescriptions_message_id_idx
  ON public.prescriptions (message_id)
  WHERE message_id IS NOT NULL;

COMMENT ON TABLE public.prescriptions IS
  'Issued/voided Rx versions for a consultation. Patient-visible: diagnosis + items (+ PDF in Slice 6.4). Not full SOAP.';

COMMENT ON COLUMN public.prescriptions.patient_diagnosis IS
  'Diagnosis printed on the Rx / shown to the patient. Not Subjective/Objective/Plan.';

COMMENT ON COLUMN public.prescriptions.pdf_path IS
  'Storage object path for the generated PDF (Slice 6.4).';

COMMENT ON COLUMN public.prescriptions.message_id IS
  'Online chat message that delivered the PDF (Slice 6.4). Null for offline.';

CREATE TRIGGER prescriptions_touch_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.prescriptions_lock_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.consultation_id := OLD.consultation_id;
    NEW.version := OLD.version;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prescriptions_lock_identity
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.prescriptions_lock_identity();

REVOKE ALL ON FUNCTION public.prescriptions_lock_identity()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Prescription line items
-- ---------------------------------------------------------------------------
CREATE TABLE public.prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  drug_name text NOT NULL,
  dosage text NOT NULL,
  frequency text NOT NULL,
  duration text NOT NULL,
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prescription_items_sort_order_nonneg CHECK (sort_order >= 0),
  CONSTRAINT prescription_items_sort_unique UNIQUE (prescription_id, sort_order),
  CONSTRAINT prescription_items_drug_name_len CHECK (
    char_length(trim(drug_name)) > 0 AND char_length(drug_name) <= 200
  ),
  CONSTRAINT prescription_items_dosage_len CHECK (
    char_length(trim(dosage)) > 0 AND char_length(dosage) <= 200
  ),
  CONSTRAINT prescription_items_frequency_len CHECK (
    char_length(trim(frequency)) > 0 AND char_length(frequency) <= 200
  ),
  CONSTRAINT prescription_items_duration_len CHECK (
    char_length(trim(duration)) > 0 AND char_length(duration) <= 200
  ),
  CONSTRAINT prescription_items_instructions_len CHECK (
    instructions IS NULL OR char_length(instructions) <= 2000
  )
);

CREATE INDEX prescription_items_prescription_id_idx
  ON public.prescription_items (prescription_id, sort_order);

COMMENT ON TABLE public.prescription_items IS
  'Drugs on a prescription version (name, dose, frequency, duration).';

CREATE TRIGGER prescription_items_touch_updated_at
  BEFORE UPDATE ON public.prescription_items
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — SOAP: doctor write, doctor/admin read, never patient
-- ---------------------------------------------------------------------------
ALTER TABLE public.soap_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY soap_notes_select_doctor_or_admin
  ON public.soap_notes
  FOR SELECT
  TO authenticated
  USING (
    public.is_consultation_doctor(consultation_id)
    OR public.is_admin()
  );

CREATE POLICY soap_notes_insert_doctor
  ON public.soap_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_consultation_doctor(consultation_id));

CREATE POLICY soap_notes_update_doctor
  ON public.soap_notes
  FOR UPDATE
  TO authenticated
  USING (public.is_consultation_doctor(consultation_id))
  WITH CHECK (public.is_consultation_doctor(consultation_id));

CREATE POLICY soap_notes_no_client_delete
  ON public.soap_notes
  FOR DELETE
  TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- RLS — prescriptions: participants read; assigned doctor writes
-- ---------------------------------------------------------------------------
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY prescriptions_select_participant_or_admin
  ON public.prescriptions
  FOR SELECT
  TO authenticated
  USING (public.is_consultation_participant(consultation_id));

CREATE POLICY prescriptions_insert_doctor
  ON public.prescriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_consultation_doctor(consultation_id));

CREATE POLICY prescriptions_update_doctor
  ON public.prescriptions
  FOR UPDATE
  TO authenticated
  USING (public.is_consultation_doctor(consultation_id))
  WITH CHECK (public.is_consultation_doctor(consultation_id));

CREATE POLICY prescriptions_no_client_delete
  ON public.prescriptions
  FOR DELETE
  TO authenticated
  USING (false);

ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY prescription_items_select_participant_or_admin
  ON public.prescription_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.prescriptions p
      WHERE p.id = prescription_id
        AND public.is_consultation_participant(p.consultation_id)
    )
  );

CREATE POLICY prescription_items_insert_doctor
  ON public.prescription_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.prescriptions p
      WHERE p.id = prescription_id
        AND public.is_consultation_doctor(p.consultation_id)
    )
  );

CREATE POLICY prescription_items_update_doctor
  ON public.prescription_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.prescriptions p
      WHERE p.id = prescription_id
        AND public.is_consultation_doctor(p.consultation_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.prescriptions p
      WHERE p.id = prescription_id
        AND public.is_consultation_doctor(p.consultation_id)
    )
  );

CREATE POLICY prescription_items_delete_doctor
  ON public.prescription_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.prescriptions p
      WHERE p.id = prescription_id
        AND public.is_consultation_doctor(p.consultation_id)
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.soap_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prescriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription_items TO authenticated;
