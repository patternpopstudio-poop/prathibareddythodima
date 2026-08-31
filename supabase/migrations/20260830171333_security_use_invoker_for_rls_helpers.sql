-- These helpers are evaluated only for authenticated participants. Their table
-- lookups are already covered by participant/owner RLS, so definer privileges
-- are unnecessary.

ALTER FUNCTION public.consultation_booking_is_active(uuid) SECURITY INVOKER;
ALTER FUNCTION public.doctor_consultation_chat_open(uuid) SECURITY INVOKER;
ALTER FUNCTION public.is_consultation_participant(uuid) SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.consultation_booking_is_active(uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.doctor_consultation_chat_open(uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_consultation_participant(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.consultation_booking_is_active(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.doctor_consultation_chat_open(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_consultation_participant(uuid)
  TO authenticated, service_role;
