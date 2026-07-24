-- Phase 3 Slice 3.1: doctor availability, appointment slots, bookings + RLS.
-- Exit: migrations apply; roles can only touch their own data.
-- Slot locking RPC included so 3.4 can book without double-booking.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.slot_status AS ENUM ('open', 'booked', 'blocked', 'cancelled');
CREATE TYPE public.booking_status AS ENUM ('confirmed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Weekly availability rules (used by doctor UI to generate slots)
-- day_of_week: 0 = Sunday … 6 = Saturday (matches JS Date.getDay())
-- ---------------------------------------------------------------------------
CREATE TABLE public.doctor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors (id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_duration_minutes integer NOT NULL DEFAULT 15
    CHECK (slot_duration_minutes >= 15),
  buffer_minutes integer NOT NULL DEFAULT 0
    CHECK (buffer_minutes >= 0),
  -- Quiet hours within the window (optional; enforced in later slice)
  quiet_start time,
  quiet_end time,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT doctor_availability_time_range CHECK (end_time > start_time),
  CONSTRAINT doctor_availability_quiet_range CHECK (
    quiet_start IS NULL
    OR quiet_end IS NULL
    OR quiet_end > quiet_start
  )
);

CREATE INDEX doctor_availability_doctor_id_idx
  ON public.doctor_availability (doctor_id);

CREATE INDEX doctor_availability_doctor_day_idx
  ON public.doctor_availability (doctor_id, day_of_week)
  WHERE is_active = true;

COMMENT ON TABLE public.doctor_availability IS
  'Weekly working-hour rules per doctor. Generates concrete appointment_slots.';

COMMENT ON COLUMN public.doctor_availability.slot_duration_minutes IS
  'Bookable slot length in minutes; minimum 15.';

COMMENT ON COLUMN public.doctor_availability.buffer_minutes IS
  'Gap after each slot before the next can start.';

CREATE TRIGGER doctor_availability_touch_updated_at
  BEFORE UPDATE ON public.doctor_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Concrete bookable slots
-- ---------------------------------------------------------------------------
CREATE TABLE public.appointment_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors (id) ON DELETE CASCADE,
  availability_id uuid REFERENCES public.doctor_availability (id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status public.slot_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_slots_time_range CHECK (ends_at > starts_at)
);

CREATE INDEX appointment_slots_doctor_starts_idx
  ON public.appointment_slots (doctor_id, starts_at);

CREATE INDEX appointment_slots_open_future_idx
  ON public.appointment_slots (doctor_id, starts_at)
  WHERE status = 'open';

-- Prevent duplicate concrete starts for the same doctor (cancelled slots may reuse time)
CREATE UNIQUE INDEX appointment_slots_doctor_starts_unique
  ON public.appointment_slots (doctor_id, starts_at)
  WHERE status <> 'cancelled';

COMMENT ON TABLE public.appointment_slots IS
  'Concrete bookable windows. status=open until booked/blocked/cancelled.';

CREATE TRIGGER appointment_slots_touch_updated_at
  BEFORE UPDATE ON public.appointment_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Bookings (one confirmed booking per slot)
-- ---------------------------------------------------------------------------
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.appointment_slots (id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors (id) ON DELETE CASCADE,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_cancel_fields CHECK (
    (status = 'confirmed' AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
  )
);

-- At most one non-cancelled booking per slot (slot lock foundation)
CREATE UNIQUE INDEX bookings_slot_active_unique
  ON public.bookings (slot_id)
  WHERE status = 'confirmed';

CREATE INDEX bookings_patient_id_idx ON public.bookings (patient_id, created_at DESC);
CREATE INDEX bookings_doctor_id_idx ON public.bookings (doctor_id, created_at DESC);

COMMENT ON TABLE public.bookings IS
  'Patient reservation of an appointment_slot. Confirmed bookings uniquely own a slot.';

CREATE TRIGGER bookings_touch_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Atomic book: claim open slot + insert confirmed booking (race-safe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_appointment_slot(p_slot_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid := auth.uid();
  v_slot public.appointment_slots%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
BEGIN
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.current_app_role() IS DISTINCT FROM 'patient' THEN
    RAISE EXCEPTION 'Only patients can book slots';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = v_patient_id) THEN
    RAISE EXCEPTION 'Patient profile not found';
  END IF;

  SELECT *
  INTO v_slot
  FROM public.appointment_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;

  IF v_slot.status <> 'open' THEN
    RAISE EXCEPTION 'Slot is not available';
  END IF;

  IF v_slot.starts_at <= now() THEN
    RAISE EXCEPTION 'Slot is in the past';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.doctors d
    WHERE d.id = v_slot.doctor_id
      AND d.is_active = true
  ) THEN
    RAISE EXCEPTION 'Doctor is not available for booking';
  END IF;

  UPDATE public.appointment_slots
  SET status = 'booked',
      updated_at = now()
  WHERE id = p_slot_id
    AND status = 'open'
  RETURNING * INTO v_slot;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot is not available';
  END IF;

  INSERT INTO public.bookings (slot_id, patient_id, doctor_id, status)
  VALUES (p_slot_id, v_patient_id, v_slot.doctor_id, 'confirmed')
  RETURNING * INTO v_booking;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_patient_id,
    'booking.created',
    'bookings',
    v_booking.id::text,
    jsonb_build_object(
      'slot_id', p_slot_id,
      'doctor_id', v_slot.doctor_id,
      'starts_at', v_slot.starts_at,
      'ends_at', v_slot.ends_at
    )
  );

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.book_appointment_slot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_appointment_slot(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.book_appointment_slot(uuid) TO authenticated;

COMMENT ON FUNCTION public.book_appointment_slot(uuid) IS
  'Atomically books an open future slot for the calling patient. Prevents double-booking.';

-- ---------------------------------------------------------------------------
-- RLS helpers: keep policies readable
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_patient()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.current_app_role() = 'patient';
$$;

-- ---------------------------------------------------------------------------
-- Doctors: patients may list active doctors (discovery for booking)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS doctors_select_own_or_admin ON public.doctors;

CREATE POLICY doctors_select_own_admin_or_active_for_patients
  ON public.doctors
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.is_admin()
    OR (is_active = true AND public.is_patient())
  );

-- ---------------------------------------------------------------------------
-- doctor_availability RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY doctor_availability_select_own_or_admin
  ON public.doctor_availability
  FOR SELECT
  TO authenticated
  USING (doctor_id = auth.uid() OR public.is_admin());

CREATE POLICY doctor_availability_insert_own_or_admin
  ON public.doctor_availability
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (doctor_id = auth.uid() AND public.is_doctor())
    OR public.is_admin()
  );

CREATE POLICY doctor_availability_update_own_or_admin
  ON public.doctor_availability
  FOR UPDATE
  TO authenticated
  USING (doctor_id = auth.uid() OR public.is_admin())
  WITH CHECK (doctor_id = auth.uid() OR public.is_admin());

CREATE POLICY doctor_availability_delete_own_or_admin
  ON public.doctor_availability
  FOR DELETE
  TO authenticated
  USING (doctor_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------------
-- appointment_slots RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;

-- Patients see future open slots (discovery); doctors/admins see their/all slots
CREATE POLICY appointment_slots_select_visible
  ON public.appointment_slots
  FOR SELECT
  TO authenticated
  USING (
    doctor_id = auth.uid()
    OR public.is_admin()
    OR (
      public.is_patient()
      AND status = 'open'
      AND starts_at > now()
      AND EXISTS (
        SELECT 1
        FROM public.doctors d
        WHERE d.id = appointment_slots.doctor_id
          AND d.is_active = true
      )
    )
    OR (
      -- Patient can also see slots they booked (for home / detail)
      public.is_patient()
      AND EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.slot_id = appointment_slots.id
          AND b.patient_id = auth.uid()
      )
    )
  );

CREATE POLICY appointment_slots_insert_own_or_admin
  ON public.appointment_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (doctor_id = auth.uid() AND public.is_doctor())
    OR public.is_admin()
  );

CREATE POLICY appointment_slots_update_own_or_admin
  ON public.appointment_slots
  FOR UPDATE
  TO authenticated
  USING (doctor_id = auth.uid() OR public.is_admin())
  WITH CHECK (doctor_id = auth.uid() OR public.is_admin());

CREATE POLICY appointment_slots_delete_own_or_admin
  ON public.appointment_slots
  FOR DELETE
  TO authenticated
  USING (
    (doctor_id = auth.uid() OR public.is_admin())
    AND status IN ('open', 'blocked', 'cancelled')
  );

-- ---------------------------------------------------------------------------
-- bookings RLS — clients do not insert directly (use book_appointment_slot)
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookings_select_own_or_admin
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR doctor_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY bookings_no_client_insert
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Patients may cancel their own confirmed booking (cutoff rules in slice 3.6)
CREATE POLICY bookings_update_own_patient_or_staff
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR doctor_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    patient_id = auth.uid()
    OR doctor_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY bookings_no_client_delete
  ON public.bookings
  FOR DELETE
  TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_availability TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_slots TO authenticated;
GRANT SELECT, UPDATE ON public.bookings TO authenticated;
