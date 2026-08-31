-- Phase 5 Slice 5.14: in-app notifications for overflow ops awareness.
-- Exit: pending_admin / accept / reject / assign produce notifications;
-- optional unpaid-clinic nudge for admins on clinic confirm.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_type_nonempty CHECK (length(trim(type)) > 0),
  CONSTRAINT notifications_title_nonempty CHECK (length(trim(title)) > 0),
  CONSTRAINT notifications_body_nonempty CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

COMMENT ON TABLE public.notifications IS
  'In-app notifications. Inserted by SECURITY DEFINER helpers; recipients mark read.';

COMMENT ON COLUMN public.notifications.type IS
  'Stable kind: overflow.pending_admin | overflow.accepted | overflow.rejected | overflow.assigned | clinic.unpaid.';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update_own_read
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_no_client_insert
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY notifications_no_client_delete
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (false);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;

-- ---------------------------------------------------------------------------
-- Lock: only read_at may change on UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notifications_lock_except_read_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.entity_type IS DISTINCT FROM OLD.entity_type
     OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'notifications rows are immutable except read_at';
  END IF;

  IF OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at THEN
    RAISE EXCEPTION 'notifications.read_at cannot be cleared or changed once set';
  END IF;

  IF NEW.read_at IS NOT NULL AND OLD.read_at IS NULL AND NEW.read_at > now() + interval '1 minute' THEN
    RAISE EXCEPTION 'notifications.read_at cannot be in the future';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_lock_except_read_at ON public.notifications;
CREATE TRIGGER notifications_lock_except_read_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notifications_lock_except_read_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    p_user_id,
    trim(p_type),
    trim(p_title),
    trim(p_body),
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, text, text, jsonb) FROM authenticated;

COMMENT ON FUNCTION public.notify_user(uuid, text, text, text, text, text, jsonb) IS
  'Internal: insert one in-app notification for a user (SECURITY DEFINER).';

CREATE OR REPLACE FUNCTION public.notify_admins(
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_admin_id IN
    SELECT u.id
    FROM auth.users u
    WHERE coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
  LOOP
    PERFORM public.notify_user(
      v_admin_id,
      p_type,
      p_title,
      p_body,
      p_entity_type,
      p_entity_id,
      p_metadata
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admins(text, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admins(text, text, text, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.notify_admins(text, text, text, text, text, jsonb) FROM authenticated;

COMMENT ON FUNCTION public.notify_admins(text, text, text, text, text, jsonb) IS
  'Internal: notify every admin user (app_metadata.role = admin).';

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.notifications n
  SET read_at = now()
  WHERE n.user_id = v_uid
    AND n.read_at IS NULL
    AND (p_ids IS NULL OR n.id = ANY (p_ids));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notifications_read(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.mark_notifications_read(uuid[]) IS
  'Mark the caller''s unread notifications as read. Null p_ids marks all.';

-- ---------------------------------------------------------------------------
-- Fan-out from audit_logs (keeps overflow RPCs untouched)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notifications_from_booking_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_doctor_id uuid;
  v_patient_name text;
  v_doctor_name text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_same_day boolean := false;
  v_when text;
  v_reason text;
  v_payment_method text;
  v_status text;
BEGIN
  IF NEW.entity_type IS DISTINCT FROM 'bookings' THEN
    RETURN NEW;
  END IF;

  v_patient_id := NULLIF(NEW.metadata ->> 'patient_id', '')::uuid;
  v_doctor_id := NULLIF(NEW.metadata ->> 'doctor_id', '')::uuid;
  v_starts_at := NULLIF(NEW.metadata ->> 'starts_at', '')::timestamptz;
  v_ends_at := NULLIF(NEW.metadata ->> 'ends_at', '')::timestamptz;
  v_payment_method := NEW.metadata ->> 'payment_method';
  v_status := NEW.metadata ->> 'status';
  v_reason := NULLIF(trim(COALESCE(NEW.metadata ->> 'reject_reason', '')), '');

  IF v_patient_id IS NOT NULL THEN
    SELECT nullif(trim(p.full_name), '') INTO v_patient_name
    FROM public.patients p
    WHERE p.id = v_patient_id;
  END IF;

  IF v_doctor_id IS NOT NULL THEN
    SELECT nullif(trim(d.full_name), '') INTO v_doctor_name
    FROM public.doctors d
    WHERE d.id = v_doctor_id;
  END IF;

  v_patient_name := COALESCE(v_patient_name, 'A patient');
  v_doctor_name := COALESCE(v_doctor_name, 'the doctor');

  IF v_starts_at IS NOT NULL THEN
    v_same_day := (v_starts_at AT TIME ZONE 'Asia/Kolkata')::date
      = (now() AT TIME ZONE 'Asia/Kolkata')::date;
    v_when := to_char(v_starts_at AT TIME ZONE 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM');
  END IF;

  IF NEW.action = 'booking.pending_admin' THEN
    -- request_offline_overflow_booking audits actor as patient; metadata has no patient_id.
    IF v_patient_id IS NULL AND NEW.actor_id IS NOT NULL THEN
      v_patient_id := NEW.actor_id;
      SELECT nullif(trim(p.full_name), '') INTO v_patient_name
      FROM public.patients p
      WHERE p.id = v_patient_id;
      v_patient_name := COALESCE(v_patient_name, 'A patient');
    END IF;

    -- Preferred window lives on preferred_* for pending requests.
    IF v_starts_at IS NULL THEN
      v_starts_at := NULLIF(NEW.metadata ->> 'preferred_starts_at', '')::timestamptz;
      v_ends_at := NULLIF(NEW.metadata ->> 'preferred_ends_at', '')::timestamptz;
      IF v_starts_at IS NOT NULL THEN
        v_when := to_char(v_starts_at AT TIME ZONE 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM');
      END IF;
    END IF;

    PERFORM public.notify_admins(
      'overflow.pending_admin',
      'New offline overflow request',
      v_patient_name || ' requested an offline visit with ' || v_doctor_name
        || CASE WHEN v_when IS NOT NULL THEN ' (' || v_when || ')' ELSE '' END
        || '. Review the overflow queue.',
      'bookings',
      NEW.entity_id,
      jsonb_build_object(
        'audit_action', NEW.action,
        'patient_id', v_patient_id,
        'doctor_id', v_doctor_id,
        'preferred_starts_at', NEW.metadata ->> 'preferred_starts_at',
        'preferred_ends_at', NEW.metadata ->> 'preferred_ends_at',
        'payment_method', v_payment_method
      )
    );

  ELSIF NEW.action = 'booking.admin_assigned' THEN
    IF v_patient_id IS NOT NULL THEN
      PERFORM public.notify_user(
        v_patient_id,
        'overflow.accepted',
        'Offline visit scheduled',
        'The hospital assigned your offline visit with ' || v_doctor_name
          || CASE WHEN v_when IS NOT NULL THEN ' for ' || v_when ELSE '' END
          || CASE
               WHEN v_status = 'pending_payment' THEN '. Complete payment to confirm.'
               WHEN v_payment_method = 'clinic' THEN '. Pay at the clinic when you arrive.'
               ELSE '.'
             END,
        'bookings',
        NEW.entity_id,
        jsonb_build_object(
          'audit_action', NEW.action,
          'doctor_id', v_doctor_id,
          'starts_at', v_starts_at,
          'ends_at', v_ends_at,
          'status', v_status,
          'payment_method', v_payment_method,
          'same_day', v_same_day
        )
      );
    END IF;

    IF v_doctor_id IS NOT NULL THEN
      PERFORM public.notify_user(
        v_doctor_id,
        'overflow.assigned',
        CASE WHEN v_same_day THEN 'Same-day offline booking assigned' ELSE 'Offline booking assigned' END,
        v_patient_name || ' was assigned an offline visit'
          || CASE WHEN v_when IS NOT NULL THEN ' at ' || v_when ELSE '' END
          || CASE WHEN v_same_day THEN ' (today).' ELSE '.' END,
        'bookings',
        NEW.entity_id,
        jsonb_build_object(
          'audit_action', NEW.action,
          'patient_id', v_patient_id,
          'starts_at', v_starts_at,
          'ends_at', v_ends_at,
          'status', v_status,
          'payment_method', v_payment_method,
          'same_day', v_same_day
        )
      );
    END IF;

    -- Optional unpaid-clinic nudge when overflow accept confirms clinic unpaid.
    IF v_payment_method = 'clinic' AND v_status = 'confirmed' THEN
      PERFORM public.notify_admins(
        'clinic.unpaid',
        'Clinic payment pending',
        v_patient_name || ' · ' || v_doctor_name
          || CASE WHEN v_when IS NOT NULL THEN ' · ' || v_when ELSE '' END
          || ' — mark paid when the hospital receives payment.',
        'bookings',
        NEW.entity_id,
        jsonb_build_object(
          'audit_action', NEW.action,
          'patient_id', v_patient_id,
          'doctor_id', v_doctor_id,
          'starts_at', v_starts_at,
          'payment_method', 'clinic',
          'payment_status', 'unpaid'
        )
      );
    END IF;

  ELSIF NEW.action = 'booking.rejected' THEN
    IF v_patient_id IS NOT NULL THEN
      PERFORM public.notify_user(
        v_patient_id,
        'overflow.rejected',
        'Offline request declined',
        COALESCE(
          v_reason,
          'The hospital could not assign an offline appointment. You can submit a new request later.'
        ),
        'bookings',
        NEW.entity_id,
        jsonb_build_object(
          'audit_action', NEW.action,
          'doctor_id', v_doctor_id,
          'reject_reason', v_reason
        )
      );
    END IF;

  ELSIF NEW.action = 'booking.created'
        AND v_payment_method = 'clinic'
        AND v_status = 'confirmed' THEN
    -- Direct offline + pay-at-clinic booking (no overflow).
    IF v_patient_id IS NULL AND NEW.actor_id IS NOT NULL THEN
      v_patient_id := NEW.actor_id;
      SELECT nullif(trim(p.full_name), '') INTO v_patient_name
      FROM public.patients p
      WHERE p.id = v_patient_id;
      v_patient_name := COALESCE(v_patient_name, 'A patient');
    END IF;

    IF v_starts_at IS NULL THEN
      v_starts_at := NULLIF(NEW.metadata ->> 'starts_at', '')::timestamptz;
      IF v_starts_at IS NOT NULL THEN
        v_when := to_char(v_starts_at AT TIME ZONE 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM');
      END IF;
    END IF;

    PERFORM public.notify_admins(
      'clinic.unpaid',
      'Clinic payment pending',
      v_patient_name || ' · ' || v_doctor_name
        || CASE WHEN v_when IS NOT NULL THEN ' · ' || v_when ELSE '' END
        || ' — mark paid when the hospital receives payment.',
      'bookings',
      NEW.entity_id,
      jsonb_build_object(
        'audit_action', NEW.action,
        'patient_id', v_patient_id,
        'doctor_id', v_doctor_id,
        'starts_at', v_starts_at,
        'payment_method', 'clinic',
        'payment_status', 'unpaid'
      )
    );

    IF v_doctor_id IS NOT NULL THEN
      PERFORM public.notify_user(
        v_doctor_id,
        'booking.offline_confirmed',
        'Offline booking confirmed',
        v_patient_name || ' booked an offline visit'
          || CASE WHEN v_when IS NOT NULL THEN ' at ' || v_when ELSE '' END
          || ' (pay at clinic).',
        'bookings',
        NEW.entity_id,
        jsonb_build_object(
          'audit_action', NEW.action,
          'patient_id', v_patient_id,
          'starts_at', v_starts_at,
          'payment_method', 'clinic',
          'status', 'confirmed'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_from_booking_audit ON public.audit_logs;
CREATE TRIGGER notifications_from_booking_audit
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.notifications_from_booking_audit();

COMMENT ON FUNCTION public.notifications_from_booking_audit() IS
  'Phase 5 Slice 5.14: fan-out in-app notifications from booking audit actions.';

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END;
$$;
