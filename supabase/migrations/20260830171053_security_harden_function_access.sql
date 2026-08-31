-- Lock function name resolution and remove direct API execution from trigger-only
-- functions. Trigger execution does not depend on caller EXECUTE privileges.

ALTER FUNCTION public.protect_doctor_fields() SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.protect_patient_fields() SET search_path = public;
ALTER FUNCTION public.current_app_role() SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.is_doctor() SET search_path = public;
ALTER FUNCTION public.is_staff() SET search_path = public;
ALTER FUNCTION public.custom_access_token_hook(jsonb) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.assign_app_role()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bookings_lock_clinic_mark_paid()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bookings_lock_overflow_admin()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bookings_open_consultation()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.doctors_lock_consultation_fee()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_doctor_user()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_patient_user()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.messages_mark_consultation_in_progress()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.messages_touch_consultation()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notifications_from_booking_audit()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_auth_user_profile()
  FROM PUBLIC, anon, authenticated;

-- These helpers are called by authenticated RLS policies, but never by anon.
REVOKE EXECUTE ON FUNCTION public.consultation_booking_is_active(uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.doctor_consultation_chat_open(uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_consultation_participant(uuid)
  FROM PUBLIC, anon;
