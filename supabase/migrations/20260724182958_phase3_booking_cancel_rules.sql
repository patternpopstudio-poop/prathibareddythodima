-- Phase 3 Slice 3.6: cancel rules
-- Before cutoff → cancel booking + release slot to open
-- After cutoff → do not cancel; flag for hospital (manual workflow) + UI message

-- ---------------------------------------------------------------------------
-- Manual cancel-request flag (after cutoff)
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancel_request_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_request_note text;

COMMENT ON COLUMN public.bookings.cancel_request_at IS
  'Set when patient asks to cancel after the free-cancel cutoff; hospital handles manually.';

COMMENT ON COLUMN public.bookings.cancel_request_note IS
  'Optional note from patient when requesting late cancellation.';

-- ---------------------------------------------------------------------------
-- Cutoff config (hours before slot start)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.booking_cancel_cutoff_hours()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 2;
$$;

COMMENT ON FUNCTION public.booking_cancel_cutoff_hours() IS
  'Patients may self-cancel online only when now < starts_at - this many hours.';

-- ---------------------------------------------------------------------------
-- Atomic cancel / late-request RPC
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

  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Booking is already cancelled';
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

  v_deadline := v_slot.starts_at - make_interval(hours => v_cutoff);

  IF now() < v_deadline THEN
    -- Free cancel: release slot
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
    -- After cutoff: flag for hospital; keep booking + slot
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

REVOKE ALL ON FUNCTION public.cancel_appointment_booking(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_appointment_booking(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_booking(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.cancel_appointment_booking(uuid, text) IS
  'Patient cancel: before cutoff releases slot; after cutoff flags cancel_request for hospital.';

-- Patients must cancel via RPC (not direct UPDATE) so cutoff rules cannot be bypassed
DROP POLICY IF EXISTS bookings_update_own_patient_or_staff ON public.bookings;

CREATE POLICY bookings_update_staff_only
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (doctor_id = auth.uid() OR public.is_admin())
  WITH CHECK (doctor_id = auth.uid() OR public.is_admin());
