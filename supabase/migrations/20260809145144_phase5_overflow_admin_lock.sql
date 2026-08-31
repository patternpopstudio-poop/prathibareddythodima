-- Phase 5 Slice 5.11 follow-up: only admins may transition pending_admin bookings.

CREATE OR REPLACE FUNCTION public.bookings_lock_overflow_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'pending_admin'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND auth.uid() IS NOT NULL
     AND public.current_app_role() IS DISTINCT FROM 'admin'
  THEN
    RAISE EXCEPTION 'Only admins can accept or reject pending overflow bookings';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_lock_overflow_admin ON public.bookings;
CREATE TRIGGER bookings_lock_overflow_admin
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.bookings_lock_overflow_admin();
