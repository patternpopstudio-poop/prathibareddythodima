-- Chat belongs only to confirmed online bookings. Using an allow-list prevents
-- inconsistent or future booking states from accidentally gaining write access.

CREATE OR REPLACE FUNCTION public.consultation_booking_is_active(p_consultation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consultations c
    JOIN public.bookings b ON b.id = c.booking_id
    WHERE c.id = p_consultation_id
      AND b.status = 'confirmed'
      AND c.archived_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.consultation_booking_is_active(uuid) IS
  'True only when the consultation booking is confirmed and the case is not archived.';

REVOKE ALL ON FUNCTION public.consultation_booking_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultation_booking_is_active(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.doctor_consultation_chat_open(p_consultation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consultations c
    JOIN public.bookings b ON b.id = c.booking_id
    LEFT JOIN public.appointment_slots s ON s.id = b.slot_id
    WHERE c.id = p_consultation_id
      AND c.archived_at IS NULL
      AND b.status = 'confirmed'
      AND COALESCE(s.starts_at, b.preferred_starts_at) IS NOT NULL
      AND now() >= (COALESCE(s.starts_at, b.preferred_starts_at) - interval '10 minutes')
  );
$$;

COMMENT ON FUNCTION public.doctor_consultation_chat_open(uuid) IS
  'True for confirmed, unarchived consultations at or after 10 minutes before the slot.';

REVOKE ALL ON FUNCTION public.doctor_consultation_chat_open(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.doctor_consultation_chat_open(uuid)
  TO authenticated, service_role;
