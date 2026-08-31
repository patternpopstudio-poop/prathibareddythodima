-- Phase 5 Slice 5.11: offline overflow when slots are full.
-- Exit: patient can request pending_admin; admin accept creates/assigns offline
-- slot → confirmed/pending_payment; reject sets rejected + reason; overlap/active
-- consult blocked.

-- ---------------------------------------------------------------------------
-- reject_reason on bookings
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reject_reason text;

COMMENT ON COLUMN public.bookings.reject_reason IS
  'Admin reason when status = rejected (overflow decline).';

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_reject_reason_when_rejected;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_reject_reason_when_rejected CHECK (
    (status = 'rejected' AND reject_reason IS NOT NULL AND length(trim(reject_reason)) > 0)
    OR (status IS DISTINCT FROM 'rejected' AND reject_reason IS NULL)
  );

-- ---------------------------------------------------------------------------
-- Patient: request offline capacity when no open offline slots
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_offline_overflow_booking(
  p_doctor_id uuid,
  p_preferred_starts_at timestamptz,
  p_preferred_ends_at timestamptz,
  p_preferred_note text DEFAULT NULL,
  p_payment_method public.booking_payment_method DEFAULT 'clinic'
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_fee_paise integer;
  v_payment_method public.booking_payment_method;
  v_note text;
BEGIN
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.current_app_role() IS DISTINCT FROM 'patient' THEN
    RAISE EXCEPTION 'Only patients can request overflow bookings';
  END IF;

  IF p_doctor_id IS NULL THEN
    RAISE EXCEPTION 'doctor id is required';
  END IF;

  IF p_preferred_starts_at IS NULL OR p_preferred_ends_at IS NULL THEN
    RAISE EXCEPTION 'Preferred time window is required';
  END IF;

  IF p_preferred_ends_at <= p_preferred_starts_at THEN
    RAISE EXCEPTION 'Preferred end must be after preferred start';
  END IF;

  IF p_preferred_starts_at <= now() THEN
    RAISE EXCEPTION 'Preferred window must be in the future';
  END IF;

  IF p_preferred_ends_at - p_preferred_starts_at > interval '12 hours' THEN
    RAISE EXCEPTION 'Preferred window cannot exceed 12 hours';
  END IF;

  v_payment_method := COALESCE(p_payment_method, 'clinic');
  IF v_payment_method NOT IN ('online', 'clinic') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  v_note := NULLIF(trim(COALESCE(p_preferred_note, '')), '');
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'Preferred note is too long (max 500 characters)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = v_patient_id) THEN
    RAISE EXCEPTION 'Patient profile not found';
  END IF;

  SELECT d.consultation_fee_paise
  INTO v_fee_paise
  FROM public.doctors d
  WHERE d.id = p_doctor_id
    AND d.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Doctor is not available for booking';
  END IF;

  -- Only when capacity is exhausted for offline.
  IF EXISTS (
    SELECT 1
    FROM public.appointment_slots s
    WHERE s.doctor_id = p_doctor_id
      AND s.mode = 'offline'
      AND s.status = 'open'
      AND s.starts_at > now()
  ) THEN
    RAISE EXCEPTION 'Open offline slots are available; book a slot instead';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.patient_id = v_patient_id
      AND b.doctor_id = p_doctor_id
      AND b.status = 'pending_admin'
  ) THEN
    RAISE EXCEPTION 'You already have a pending request with this doctor';
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
    currency,
    preferred_starts_at,
    preferred_ends_at,
    preferred_note
  )
  VALUES (
    NULL,
    v_patient_id,
    p_doctor_id,
    'pending_admin',
    'offline',
    v_payment_method,
    'b2c_prepaid',
    'unpaid',
    v_fee_paise,
    'INR',
    p_preferred_starts_at,
    p_preferred_ends_at,
    v_note
  )
  RETURNING * INTO v_booking;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_patient_id,
    'booking.pending_admin',
    'bookings',
    v_booking.id::text,
    jsonb_build_object(
      'doctor_id', p_doctor_id,
      'mode', 'offline',
      'payment_method', v_payment_method,
      'preferred_starts_at', p_preferred_starts_at,
      'preferred_ends_at', p_preferred_ends_at,
      'amount_paise', v_fee_paise,
      'status', 'pending_admin'
    )
  );

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.request_offline_overflow_booking(
  uuid, timestamptz, timestamptz, text, public.booking_payment_method
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_offline_overflow_booking(
  uuid, timestamptz, timestamptz, text, public.booking_payment_method
) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_offline_overflow_booking(
  uuid, timestamptz, timestamptz, text, public.booking_payment_method
) TO authenticated;

COMMENT ON FUNCTION public.request_offline_overflow_booking(
  uuid, timestamptz, timestamptz, text, public.booking_payment_method
) IS
  'Patient creates a pending_admin offline overflow request when the doctor has no open offline slots.';

-- ---------------------------------------------------------------------------
-- Admin: accept overflow — create or assign offline slot, then confirm/hold
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_overflow_booking(
  p_booking_id uuid,
  p_slot_id uuid DEFAULT NULL,
  p_starts_at timestamptz DEFAULT NULL,
  p_ends_at timestamptz DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_slot public.appointment_slots%ROWTYPE;
  v_status public.booking_status;
  v_active_overlap boolean;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can accept overflow bookings';
  END IF;

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

  IF v_booking.status IS DISTINCT FROM 'pending_admin' THEN
    RAISE EXCEPTION 'Booking is %; only pending_admin can be accepted', v_booking.status;
  END IF;

  IF v_booking.mode IS DISTINCT FROM 'offline' THEN
    RAISE EXCEPTION 'Only offline overflow bookings can be accepted here';
  END IF;

  IF p_slot_id IS NOT NULL THEN
    SELECT *
    INTO v_slot
    FROM public.appointment_slots
    WHERE id = p_slot_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Slot not found';
    END IF;

    IF v_slot.doctor_id IS DISTINCT FROM v_booking.doctor_id THEN
      RAISE EXCEPTION 'Slot belongs to a different doctor';
    END IF;

    IF v_slot.mode IS DISTINCT FROM 'offline' THEN
      RAISE EXCEPTION 'Overflow accept requires an offline slot';
    END IF;

    IF v_slot.status <> 'open' THEN
      RAISE EXCEPTION 'Slot is not available';
    END IF;

    IF v_slot.starts_at <= now() THEN
      RAISE EXCEPTION 'Slot is in the past';
    END IF;
  ELSE
    IF p_starts_at IS NULL OR p_ends_at IS NULL THEN
      RAISE EXCEPTION 'Provide an open slot id, or starts_at and ends_at to create one';
    END IF;

    IF p_ends_at <= p_starts_at THEN
      RAISE EXCEPTION 'Slot end must be after start';
    END IF;

    IF p_starts_at <= now() THEN
      RAISE EXCEPTION 'Slot must be in the future';
    END IF;

    IF p_ends_at - p_starts_at < interval '15 minutes' THEN
      RAISE EXCEPTION 'Slot must be at least 15 minutes';
    END IF;

    IF p_ends_at - p_starts_at > interval '4 hours' THEN
      RAISE EXCEPTION 'Slot cannot exceed 4 hours';
    END IF;

    -- Block placing into a window that overlaps "now" while a consult is live.
    IF p_starts_at <= now() AND p_ends_at > now() THEN
      RAISE EXCEPTION 'Slot must be in the future';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.consultations c
      JOIN public.bookings b ON b.id = c.booking_id
      JOIN public.appointment_slots s ON s.id = b.slot_id
      WHERE c.doctor_id = v_booking.doctor_id
        AND c.status = 'in_progress'
        AND s.status <> 'cancelled'
        AND tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    )
    INTO v_active_overlap;

    IF v_active_overlap THEN
      RAISE EXCEPTION 'Chosen window overlaps an active consultation; pick a free time';
    END IF;

    BEGIN
      INSERT INTO public.appointment_slots (
        doctor_id,
        availability_id,
        starts_at,
        ends_at,
        status,
        mode
      )
      VALUES (
        v_booking.doctor_id,
        NULL,
        p_starts_at,
        p_ends_at,
        'open',
        'offline'
      )
      RETURNING * INTO v_slot;
    EXCEPTION
      WHEN exclusion_violation THEN
        RAISE EXCEPTION 'Chosen window overlaps an existing slot for this doctor';
    END;
  END IF;

  -- Also block assigning an existing slot that overlaps an active consult window.
  SELECT EXISTS (
    SELECT 1
    FROM public.consultations c
    JOIN public.bookings b ON b.id = c.booking_id
    JOIN public.appointment_slots s ON s.id = b.slot_id
    WHERE c.doctor_id = v_booking.doctor_id
      AND c.status = 'in_progress'
      AND s.id IS DISTINCT FROM v_slot.id
      AND s.status <> 'cancelled'
      AND tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(v_slot.starts_at, v_slot.ends_at, '[)')
  )
  INTO v_active_overlap;

  IF v_active_overlap THEN
    RAISE EXCEPTION 'Chosen window overlaps an active consultation; pick a free time';
  END IF;

  UPDATE public.appointment_slots
  SET status = 'booked',
      updated_at = now()
  WHERE id = v_slot.id
    AND status = 'open'
  RETURNING * INTO v_slot;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot is not available';
  END IF;

  IF v_booking.payment_method = 'clinic' THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_payment';
  END IF;

  UPDATE public.bookings
  SET slot_id = v_slot.id,
      status = v_status,
      preferred_starts_at = NULL,
      preferred_ends_at = NULL,
      preferred_note = NULL,
      updated_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_admin_id,
    'booking.admin_assigned',
    'bookings',
    v_booking.id::text,
    jsonb_build_object(
      'slot_id', v_slot.id,
      'starts_at', v_slot.starts_at,
      'ends_at', v_slot.ends_at,
      'mode', 'offline',
      'payment_method', v_booking.payment_method,
      'status', v_booking.status,
      'patient_id', v_booking.patient_id,
      'doctor_id', v_booking.doctor_id
    )
  );

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_overflow_booking(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_overflow_booking(uuid, uuid, timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_overflow_booking(uuid, uuid, timestamptz, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.accept_overflow_booking(uuid, uuid, timestamptz, timestamptz) IS
  'Admin-only: assign an open offline slot (or create one in a free window) to a pending_admin booking.';

-- ---------------------------------------------------------------------------
-- Admin: reject overflow
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_overflow_booking(
  p_booking_id uuid,
  p_reject_reason text
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_reason text;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can reject overflow bookings';
  END IF;

  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'booking id is required';
  END IF;

  v_reason := NULLIF(trim(COALESCE(p_reject_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Reject reason is required';
  END IF;

  IF length(v_reason) > 500 THEN
    RAISE EXCEPTION 'Reject reason is too long (max 500 characters)';
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status IS DISTINCT FROM 'pending_admin' THEN
    RAISE EXCEPTION 'Booking is %; only pending_admin can be rejected', v_booking.status;
  END IF;

  UPDATE public.bookings
  SET status = 'rejected',
      reject_reason = v_reason,
      updated_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_admin_id,
    'booking.rejected',
    'bookings',
    v_booking.id::text,
    jsonb_build_object(
      'reject_reason', v_reason,
      'mode', v_booking.mode,
      'patient_id', v_booking.patient_id,
      'doctor_id', v_booking.doctor_id,
      'preferred_starts_at', v_booking.preferred_starts_at,
      'preferred_ends_at', v_booking.preferred_ends_at
    )
  );

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_overflow_booking(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_overflow_booking(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_overflow_booking(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.reject_overflow_booking(uuid, text) IS
  'Admin-only: reject a pending_admin overflow request with a patient-visible reason.';
