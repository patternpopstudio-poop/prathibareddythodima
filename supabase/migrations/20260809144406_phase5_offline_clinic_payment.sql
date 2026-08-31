-- Phase 5 Slice 5.10: offline pay-at-clinic booking + admin mark-paid.
-- Exit: clinic path confirms unpaid; online payment unchanged; only admin marks clinic paid.

-- ---------------------------------------------------------------------------
-- book_appointment_slot — optional payment method (clinic only for offline)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.book_appointment_slot(uuid, public.consultation_mode);

CREATE FUNCTION public.book_appointment_slot(
  p_slot_id uuid,
  p_mode public.consultation_mode DEFAULT NULL,
  p_payment_method public.booking_payment_method DEFAULT NULL
)
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
  v_payment_method public.booking_payment_method;
  v_status public.booking_status;
BEGIN
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.current_app_role() IS DISTINCT FROM 'patient' THEN
    RAISE EXCEPTION 'Only patients can book slots';
  END IF;

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

  IF p_mode IS NOT NULL AND v_slot.mode IS DISTINCT FROM p_mode THEN
    RAISE EXCEPTION 'Slot mode does not match requested consultation mode';
  END IF;

  v_payment_method := COALESCE(p_payment_method, 'online');

  IF v_payment_method = 'clinic' AND v_slot.mode IS DISTINCT FROM 'offline' THEN
    RAISE EXCEPTION 'Pay at clinic is only available for offline consultations';
  END IF;

  IF v_payment_method = 'clinic' THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_payment';
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
    v_status,
    v_slot.mode,
    v_payment_method,
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
      'requested_mode', p_mode,
      'payment_method', v_payment_method,
      'billing_channel', 'b2c_prepaid',
      'payment_status', 'unpaid',
      'amount_paise', v_fee_paise,
      'status', v_status
    )
  );

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.book_appointment_slot(uuid, public.consultation_mode, public.booking_payment_method) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_appointment_slot(uuid, public.consultation_mode, public.booking_payment_method) FROM anon;
GRANT EXECUTE ON FUNCTION public.book_appointment_slot(uuid, public.consultation_mode, public.booking_payment_method) TO authenticated;

COMMENT ON FUNCTION public.book_appointment_slot(uuid, public.consultation_mode, public.booking_payment_method) IS
  'Books an open slot. Online payment → pending_payment hold. Offline + clinic → confirmed unpaid. Optional p_mode/p_payment_method validated against slot.';

-- ---------------------------------------------------------------------------
-- Prevent doctors from marking clinic payments paid (admin / service role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bookings_lock_clinic_mark_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.payment_status = 'paid'
     AND OLD.payment_status IS DISTINCT FROM 'paid'
     AND OLD.payment_method = 'clinic'
     AND auth.uid() IS NOT NULL
     AND public.current_app_role() IS DISTINCT FROM 'admin'
  THEN
    RAISE EXCEPTION 'Only admins can mark clinic payments as paid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_lock_clinic_mark_paid ON public.bookings;
CREATE TRIGGER bookings_lock_clinic_mark_paid
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.bookings_lock_clinic_mark_paid();

-- ---------------------------------------------------------------------------
-- Admin RPC: mark clinic booking paid
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_clinic_booking_paid(p_booking_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can mark clinic payments as paid';
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

  IF v_booking.payment_method IS DISTINCT FROM 'clinic' THEN
    RAISE EXCEPTION 'Booking is not a clinic payment';
  END IF;

  IF v_booking.status IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION 'Booking is %; only confirmed clinic bookings can be marked paid', v_booking.status;
  END IF;

  IF v_booking.payment_status = 'paid' THEN
    RETURN v_booking;
  END IF;

  IF v_booking.payment_status IS DISTINCT FROM 'unpaid' THEN
    RAISE EXCEPTION 'Booking payment status is %; expected unpaid', v_booking.payment_status;
  END IF;

  UPDATE public.bookings
  SET payment_status = 'paid',
      updated_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_admin_id,
    'booking.clinic_marked_paid',
    'bookings',
    v_booking.id::text,
    jsonb_build_object(
      'payment_method', 'clinic',
      'mode', v_booking.mode,
      'patient_id', v_booking.patient_id,
      'doctor_id', v_booking.doctor_id,
      'amount_paise', v_booking.amount_paise
    )
  );

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_clinic_booking_paid(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_clinic_booking_paid(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_clinic_booking_paid(uuid) TO authenticated;

COMMENT ON FUNCTION public.mark_clinic_booking_paid(uuid) IS
  'Admin-only: mark a confirmed offline clinic-payment booking as paid. Idempotent when already paid.';

CREATE INDEX IF NOT EXISTS bookings_clinic_unpaid_idx
  ON public.bookings (created_at DESC)
  WHERE payment_method = 'clinic'
    AND payment_status = 'unpaid'
    AND status = 'confirmed';
