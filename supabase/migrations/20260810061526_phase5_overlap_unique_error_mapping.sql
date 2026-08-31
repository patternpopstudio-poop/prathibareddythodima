-- Map exact-start collisions (unique index) to the same friendly overlap error
-- as GiST exclusion violations when accepting overflow into a busy window.

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
      WHEN exclusion_violation OR unique_violation THEN
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

COMMENT ON FUNCTION public.accept_overflow_booking(uuid, uuid, timestamptz, timestamptz) IS
  'Admin-only: assign an open offline slot (or create one in a free window) to a pending_admin booking.';
