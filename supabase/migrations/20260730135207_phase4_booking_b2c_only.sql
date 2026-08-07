-- Phase 4 cleanup: booking is B2C prepaid only.
-- Always create pending_payment holds; remove account_source / B2B branching.

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
  'Atomically holds an open future slot as pending_payment (B2C prepaid). Payment confirmation is a later step.';
