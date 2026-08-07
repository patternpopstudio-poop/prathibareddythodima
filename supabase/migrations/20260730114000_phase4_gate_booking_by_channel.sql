-- Phase 4 Slice 2: gate booking (B2C prepaid holds)
-- Creates pending_payment + fee snapshot; unpaid holds expire after a short TTL.
-- (B2B employer path removed — Phase 4 is B2C-only; see phase4_booking_b2c_only.)

-- ---------------------------------------------------------------------------
-- Hold TTL (minutes). Keep in sync with BOOKING_PAYMENT_HOLD_MINUTES in shared-types.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.booking_payment_hold_minutes()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 15;
$$;

COMMENT ON FUNCTION public.booking_payment_hold_minutes() IS
  'Minutes a B2C pending_payment hold may keep a slot before auto-expiry.';

-- ---------------------------------------------------------------------------
-- Expire stale unpaid holds (callable by cron / service role / book RPC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_unpaid_booking_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold_minutes integer := public.booking_payment_hold_minutes();
  v_row record;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT b.id AS booking_id, b.slot_id, b.patient_id, b.doctor_id
    FROM public.bookings b
    WHERE b.status = 'pending_payment'
      AND b.created_at < now() - make_interval(mins => v_hold_minutes)
    FOR UPDATE OF b SKIP LOCKED
  LOOP
    UPDATE public.bookings
    SET status = 'cancelled',
        cancelled_at = now(),
        cancel_reason = 'Payment hold expired',
        payment_status = 'failed',
        updated_at = now()
    WHERE id = v_row.booking_id
      AND status = 'pending_payment';

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    UPDATE public.appointment_slots
    SET status = 'open',
        updated_at = now()
    WHERE id = v_row.slot_id
      AND status = 'booked';

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      NULL,
      'booking.payment_hold_expired',
      'bookings',
      v_row.booking_id::text,
      jsonb_build_object(
        'slot_id', v_row.slot_id,
        'doctor_id', v_row.doctor_id,
        'patient_id', v_row.patient_id,
        'hold_minutes', v_hold_minutes
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_unpaid_booking_holds() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_unpaid_booking_holds() FROM anon;
REVOKE ALL ON FUNCTION public.expire_unpaid_booking_holds() FROM authenticated;
-- Service role / postgres (cron) can execute; clients cannot.
GRANT EXECUTE ON FUNCTION public.expire_unpaid_booking_holds() TO service_role;

COMMENT ON FUNCTION public.expire_unpaid_booking_holds() IS
  'Cancels stale pending_payment bookings and reopens their slots. Run via cron or service role.';

-- ---------------------------------------------------------------------------
-- Atomic book: channel from patient.account_source
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
  v_patient public.patients%ROWTYPE;
  v_fee_paise integer;
  v_channel public.billing_channel;
  v_status public.booking_status;
  v_payment_status public.booking_payment_status;
BEGIN
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.current_app_role() IS DISTINCT FROM 'patient' THEN
    RAISE EXCEPTION 'Only patients can book slots';
  END IF;

  -- Reclaim slots from abandoned B2C holds before claiming a new one
  PERFORM public.expire_unpaid_booking_holds();

  SELECT *
  INTO v_patient
  FROM public.patients
  WHERE id = v_patient_id;

  IF NOT FOUND THEN
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

  IF v_patient.account_source = 'b2b' THEN
    v_channel := 'b2b_employer';
    v_status := 'confirmed';
    v_payment_status := 'not_required';
  ELSE
    v_channel := 'b2c_prepaid';
    v_status := 'pending_payment';
    v_payment_status := 'unpaid';
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
    billing_channel,
    payment_status,
    amount_paise,
    currency
  )
  VALUES (
    p_slot_id,
    v_patient_id,
    v_slot.doctor_id,
    v_status,
    v_channel,
    v_payment_status,
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
      'billing_channel', v_channel,
      'payment_status', v_payment_status,
      'amount_paise', v_fee_paise,
      'status', v_status
    )
  );

  RETURN v_booking;
END;
$$;

COMMENT ON FUNCTION public.book_appointment_slot(uuid) IS
  'Atomically books an open future slot. B2C creates pending_payment hold; B2B confirms with employer billing.';

-- ---------------------------------------------------------------------------
-- Cancel: allow releasing unpaid holds anytime; confirmed keeps cutoff rules
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_appointment_booking(
  p_booking_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_slot public.appointment_slots%ROWTYPE;
  v_cutoff integer := public.booking_cancel_cutoff_hours();
  v_deadline timestamptz;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_outcome text;
  v_message text;
BEGIN
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.current_app_role() IS DISTINCT FROM 'patient' THEN
    RAISE EXCEPTION 'Only patients can cancel bookings';
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.patient_id <> v_patient_id THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RAISE EXCEPTION 'Booking is already cancelled';
  END IF;

  IF v_booking.status NOT IN ('confirmed', 'pending_payment') THEN
    RAISE EXCEPTION 'Booking cannot be cancelled';
  END IF;

  SELECT *
  INTO v_slot
  FROM public.appointment_slots
  WHERE id = v_booking.slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;

  IF v_slot.starts_at <= now() THEN
    RAISE EXCEPTION 'This appointment has already started or passed';
  END IF;

  -- Unpaid B2C hold: always release (no cutoff)
  IF v_booking.status = 'pending_payment' THEN
    UPDATE public.bookings
    SET status = 'cancelled',
        cancelled_at = now(),
        cancel_reason = coalesce(v_reason, 'Cancelled by patient before payment'),
        payment_status = 'failed',
        updated_at = now()
    WHERE id = v_booking.id
    RETURNING * INTO v_booking;

    UPDATE public.appointment_slots
    SET status = 'open',
        updated_at = now()
    WHERE id = v_slot.id
      AND status = 'booked';

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_patient_id,
      'booking.cancelled',
      'bookings',
      v_booking.id::text,
      jsonb_build_object(
        'slot_id', v_slot.id,
        'doctor_id', v_booking.doctor_id,
        'starts_at', v_slot.starts_at,
        'billing_channel', v_booking.billing_channel,
        'reason', v_booking.cancel_reason,
        'was_pending_payment', true
      )
    );

    RETURN jsonb_build_object(
      'outcome', 'cancelled',
      'cutoffHours', v_cutoff,
      'message', 'Your reservation was cancelled and the slot is available again.',
      'booking', to_jsonb(v_booking)
    );
  END IF;

  v_deadline := v_slot.starts_at - make_interval(hours => v_cutoff);

  IF now() < v_deadline THEN
    UPDATE public.bookings
    SET status = 'cancelled',
        cancelled_at = now(),
        cancel_reason = coalesce(v_reason, 'Cancelled by patient'),
        updated_at = now()
    WHERE id = v_booking.id
    RETURNING * INTO v_booking;

    UPDATE public.appointment_slots
    SET status = 'open',
        updated_at = now()
    WHERE id = v_slot.id
      AND status = 'booked';

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_patient_id,
      'booking.cancelled',
      'bookings',
      v_booking.id::text,
      jsonb_build_object(
        'slot_id', v_slot.id,
        'doctor_id', v_booking.doctor_id,
        'starts_at', v_slot.starts_at,
        'cutoff_hours', v_cutoff,
        'reason', v_booking.cancel_reason
      )
    );

    v_outcome := 'cancelled';
    v_message := 'Your booking was cancelled and the slot is available again.';
  ELSE
    IF v_booking.cancel_request_at IS NOT NULL THEN
      v_outcome := 'contact_hospital';
      v_message := format(
        'A cancellation request is already on file. Please contact the hospital to change this appointment (within %s hours of the start time, online cancel is unavailable).',
        v_cutoff
      );
    ELSE
      UPDATE public.bookings
      SET cancel_request_at = now(),
          cancel_request_note = v_reason,
          updated_at = now()
      WHERE id = v_booking.id
      RETURNING * INTO v_booking;

      INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
      VALUES (
        v_patient_id,
        'booking.cancel_requested',
        'bookings',
        v_booking.id::text,
        jsonb_build_object(
          'slot_id', v_slot.id,
          'doctor_id', v_booking.doctor_id,
          'starts_at', v_slot.starts_at,
          'cutoff_hours', v_cutoff,
          'note', v_reason
        )
      );

      v_outcome := 'contact_hospital';
      v_message := format(
        'Online cancellation is closed within %s hours of the appointment. Please contact the hospital to cancel or reschedule. Your request has been flagged for the care team.',
        v_cutoff
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'cutoffHours', v_cutoff,
    'message', v_message,
    'booking', to_jsonb(v_booking)
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_appointment_booking(uuid, text) IS
  'Patient cancel: unpaid holds always release; confirmed before cutoff releases slot; after cutoff flags hospital.';

-- Periodic cleanup (optional; book RPC also expires on demand).
-- Requires pg_cron; safe to skip if extension unavailable.
DO $cron_setup$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'expire-unpaid-booking-holds';

  PERFORM cron.schedule(
    'expire-unpaid-booking-holds',
    '*/5 * * * *',
    'SELECT public.expire_unpaid_booking_holds()'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available; unpaid holds still expire on next book: %', SQLERRM;
END;
$cron_setup$;
