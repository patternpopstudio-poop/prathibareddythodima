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
