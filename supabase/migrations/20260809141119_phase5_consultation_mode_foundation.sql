-- Phase 5 Slice 5.7b: consultation mode on availability/slots/bookings/consultations,
-- overlap exclusion, overflow fields, RPC updates.
-- Exit: existing rows backfilled online; book_appointment_slot copies mode;
-- ensure_consultation_for_booking sets consultation.mode from booking.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- doctor_availability.mode
-- ---------------------------------------------------------------------------
ALTER TABLE public.doctor_availability
  ADD COLUMN IF NOT EXISTS mode public.consultation_mode NOT NULL DEFAULT 'online';

COMMENT ON COLUMN public.doctor_availability.mode IS
  'Whether this weekly rule generates online or offline slots.';

CREATE INDEX IF NOT EXISTS doctor_availability_doctor_mode_day_idx
  ON public.doctor_availability (doctor_id, mode, day_of_week)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- appointment_slots.mode + no-overlap across modes
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointment_slots
  ADD COLUMN IF NOT EXISTS mode public.consultation_mode NOT NULL DEFAULT 'online';

COMMENT ON COLUMN public.appointment_slots.mode IS
  'Online vs offline bookable window. Must not overlap any other non-cancelled slot for the doctor.';

CREATE INDEX IF NOT EXISTS appointment_slots_doctor_mode_starts_idx
  ON public.appointment_slots (doctor_id, mode, starts_at);

-- Stronger than unique starts: no partial overlap across online/offline for a doctor.
ALTER TABLE public.appointment_slots
  DROP CONSTRAINT IF EXISTS appointment_slots_no_overlap;

ALTER TABLE public.appointment_slots
  ADD CONSTRAINT appointment_slots_no_overlap
  EXCLUDE USING gist (
    doctor_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status <> 'cancelled');

COMMENT ON CONSTRAINT appointment_slots_no_overlap ON public.appointment_slots IS
  'Non-cancelled slots for a doctor must not overlap in time (any mode).';

-- ---------------------------------------------------------------------------
-- bookings: mode, payment_method, nullable slot for pending_admin, preferences
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS mode public.consultation_mode NOT NULL DEFAULT 'online';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method public.booking_payment_method;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS preferred_starts_at timestamptz;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS preferred_ends_at timestamptz;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS preferred_note text;

-- Overflow requests (pending_admin) have no slot until admin assigns one.
ALTER TABLE public.bookings
  ALTER COLUMN slot_id DROP NOT NULL;

COMMENT ON COLUMN public.bookings.mode IS
  'Copied from the booked slot, or set on offline overflow requests.';

COMMENT ON COLUMN public.bookings.payment_method IS
  'online = Razorpay; clinic = pay at hospital (offline mode only). Null on legacy rows.';

COMMENT ON COLUMN public.bookings.preferred_starts_at IS
  'Patient preferred window start for pending_admin overflow requests.';

COMMENT ON COLUMN public.bookings.preferred_ends_at IS
  'Patient preferred window end for pending_admin overflow requests.';

COMMENT ON COLUMN public.bookings.preferred_note IS
  'Optional patient note on pending_admin overflow requests.';

-- Cancel / terminal status shape
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_cancel_fields;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_cancel_fields CHECK (
    (
      status IN ('confirmed', 'pending_payment', 'pending_admin')
      AND cancelled_at IS NULL
    )
    OR (status = 'rejected' AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
  );

COMMENT ON CONSTRAINT bookings_cancel_fields ON public.bookings IS
  'Active/pending/rejected rows have no cancelled_at; cancelled rows must set it.';

-- Slot presence by status
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_slot_for_status;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_slot_for_status CHECK (
    (status IN ('confirmed', 'pending_payment') AND slot_id IS NOT NULL)
    OR (status = 'pending_admin' AND slot_id IS NULL)
    OR (status IN ('rejected', 'cancelled'))
  );

COMMENT ON CONSTRAINT bookings_slot_for_status ON public.bookings IS
  'confirmed/pending_payment require a slot; pending_admin has none until admin assigns.';

-- Clinic payment only for offline mode
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_clinic_payment_offline_only;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_clinic_payment_offline_only CHECK (
    payment_method IS DISTINCT FROM 'clinic' OR mode = 'offline'
  );

-- Preferred window consistency
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_preferred_window;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_preferred_window CHECK (
    preferred_starts_at IS NULL
    OR preferred_ends_at IS NULL
    OR preferred_ends_at > preferred_starts_at
  );

-- Active hold still unique per slot (pending_admin has null slot_id)
DROP INDEX IF EXISTS public.bookings_slot_active_unique;
CREATE UNIQUE INDEX bookings_slot_active_unique
  ON public.bookings (slot_id)
  WHERE status IN ('confirmed', 'pending_payment') AND slot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_mode_idx
  ON public.bookings (doctor_id, mode, created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_pending_admin_idx
  ON public.bookings (doctor_id, created_at ASC)
  WHERE status = 'pending_admin';

-- ---------------------------------------------------------------------------
-- consultations.mode
-- ---------------------------------------------------------------------------
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS mode public.consultation_mode NOT NULL DEFAULT 'online';

COMMENT ON COLUMN public.consultations.mode IS
  'Copied from booking at open. Chat is for online only (enforced in Slice 5.12).';

CREATE INDEX IF NOT EXISTS consultations_doctor_mode_idx
  ON public.consultations (doctor_id, mode, last_message_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- book_appointment_slot — copy slot.mode; default payment_method online
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
  v_fee_paise integer;
BEGIN
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.current_app_role() IS DISTINCT FROM 'patient' THEN
    RAISE EXCEPTION 'Only patients can book slots';
  END IF;

  -- Reclaim slots from abandoned payment holds before claiming a new one
  PERFORM public.expire_unpaid_booking_holds();

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

  SELECT d.consultation_fee_paise
  INTO v_fee_paise
  FROM public.doctors d
  WHERE d.id = v_slot.doctor_id
    AND d.is_active = true;

  IF NOT FOUND THEN
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

  INSERT INTO public.bookings (
    slot_id,
    patient_id,
    doctor_id,
    status,
    mode,
    payment_method,
    billing_channel,
    payment_status,
    amount_paise,
    currency
  )
  VALUES (
    p_slot_id,
    v_patient_id,
    v_slot.doctor_id,
    'pending_payment',
    v_slot.mode,
    'online',
    'b2c_prepaid',
    'unpaid',
    v_fee_paise,
    'INR'
  )
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
      'ends_at', v_slot.ends_at,
      'mode', v_slot.mode,
      'payment_method', 'online',
      'billing_channel', 'b2c_prepaid',
      'payment_status', 'unpaid',
      'amount_paise', v_fee_paise,
      'status', 'pending_payment'
    )
  );

  RETURN v_booking;
END;
$$;

COMMENT ON FUNCTION public.book_appointment_slot(uuid) IS
  'Atomically holds an open future slot as pending_payment (B2C prepaid). Copies slot.mode; payment_method defaults to online (clinic path in later slice).';

-- ---------------------------------------------------------------------------
-- ensure_consultation_for_booking — copy booking.mode
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_consultation_for_booking(p_booking_id uuid)
RETURNS public.consultations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_consultation public.consultations%ROWTYPE;
BEGIN
  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'booking id is required';
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Only confirmed bookings open a consultation. Cancelled / pending_* → no create.
  IF v_booking.status IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION 'Booking is %; consultation opens only when confirmed', v_booking.status
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_consultation
  FROM public.consultations
  WHERE booking_id = p_booking_id;

  IF FOUND THEN
    RETURN v_consultation;
  END IF;

  BEGIN
    INSERT INTO public.consultations (
      booking_id,
      patient_id,
      doctor_id,
      status,
      mode
    )
    VALUES (
      v_booking.id,
      v_booking.patient_id,
      v_booking.doctor_id,
      'open',
      v_booking.mode
    )
    RETURNING * INTO v_consultation;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT *
      INTO v_consultation
      FROM public.consultations
      WHERE booking_id = p_booking_id;

      IF NOT FOUND THEN
        RAISE;
      END IF;

      RETURN v_consultation;
  END;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_booking.patient_id,
    'consultation.created',
    'consultations',
    v_consultation.id::text,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'patient_id', v_booking.patient_id,
      'doctor_id', v_booking.doctor_id,
      'mode', v_consultation.mode,
      'status', v_consultation.status
    )
  );

  RETURN v_consultation;
END;
$$;

COMMENT ON FUNCTION public.ensure_consultation_for_booking(uuid) IS
  'Idempotently opens a consultation for a confirmed booking, copying booking.mode. Service-role / trigger only.';
