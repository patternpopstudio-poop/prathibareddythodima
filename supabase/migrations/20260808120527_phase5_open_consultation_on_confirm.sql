-- Phase 5 Slice 5.2: open consultation when a booking becomes confirmed
-- Exit: confirmed booking ⇒ consultations row (idempotent); backfill existing confirmed.

-- ---------------------------------------------------------------------------
-- ensure_consultation_for_booking — idempotent create for a confirmed booking
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

  -- Only confirmed bookings open chat. Cancelled / pending_payment → no create.
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
      status
    )
    VALUES (
      v_booking.id,
      v_booking.patient_id,
      v_booking.doctor_id,
      'open'
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
      'status', v_consultation.status
    )
  );

  RETURN v_consultation;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_consultation_for_booking(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_consultation_for_booking(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_consultation_for_booking(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_consultation_for_booking(uuid) TO service_role;

COMMENT ON FUNCTION public.ensure_consultation_for_booking(uuid) IS
  'Idempotently opens a consultation for a confirmed booking. Service-role / trigger only.';

-- ---------------------------------------------------------------------------
-- Trigger: booking → confirmed opens consultation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bookings_open_consultation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed')
  THEN
    PERFORM public.ensure_consultation_for_booking(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_open_consultation ON public.bookings;
CREATE TRIGGER bookings_open_consultation
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.bookings_open_consultation();

COMMENT ON FUNCTION public.bookings_open_consultation() IS
  'When a booking becomes confirmed, ensure a consultation row exists (Phase 5 Slice 5.2).';

-- ---------------------------------------------------------------------------
-- Backfill: existing confirmed bookings missing a consultation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_consultations_for_confirmed_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_booking_id IN
    SELECT b.id
    FROM public.bookings b
    WHERE b.status = 'confirmed'
      AND NOT EXISTS (
        SELECT 1
        FROM public.consultations c
        WHERE c.booking_id = b.id
      )
    ORDER BY b.created_at ASC
  LOOP
    PERFORM public.ensure_consultation_for_booking(v_booking_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_consultations_for_confirmed_bookings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_consultations_for_confirmed_bookings() FROM anon;
REVOKE ALL ON FUNCTION public.backfill_consultations_for_confirmed_bookings() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_consultations_for_confirmed_bookings() TO service_role;

COMMENT ON FUNCTION public.backfill_consultations_for_confirmed_bookings() IS
  'Dev/ops helper: create consultations for confirmed bookings that predate Slice 5.2.';

-- Run once at migrate time for any already-confirmed rows.
SELECT public.backfill_consultations_for_confirmed_bookings();
