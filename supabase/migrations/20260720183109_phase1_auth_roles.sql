-- Phase 1: roles (app_metadata), doctors, audit logs, JWT claim hook, RLS helpers

CREATE TYPE public.app_role AS ENUM ('patient', 'doctor', 'admin');

-- ---------------------------------------------------------------------------
-- Doctors (admin-managed Auth users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  mobile text,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX doctors_is_active_idx ON public.doctors (is_active);

COMMENT ON TABLE public.doctors IS
  'Doctor profiles created via admin invite (service role). Photo required in Phase 2.';

CREATE TRIGGER doctors_touch_updated_at
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Audit logs (Phase 1 foundation)
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs (actor_id);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);

COMMENT ON TABLE public.audit_logs IS
  'Immutable audit trail. Clients insert via service role / backend only.';

-- ---------------------------------------------------------------------------
-- Assign authoritative role into raw_app_meta_data (never-writable)
-- Public signUp can only set user_metadata; never trust it for authz.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_app_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_role text := coalesce(NEW.raw_app_meta_data ->> 'role', '');
  requested text := coalesce(NEW.raw_user_meta_data ->> 'role', 'patient');
  final_role text;
BEGIN
  IF existing_role IN ('patient', 'doctor', 'admin') THEN
    final_role := existing_role;
  ELSIF requested = 'patient' OR requested = '' THEN
    final_role := 'patient';
  ELSE
    -- Self-signup cannot claim staff roles
    final_role := 'patient';
  END IF;

  NEW.raw_app_meta_data :=
    coalesce(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', final_role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_assign_app_role
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_app_role();

-- Prefer app_metadata.role when creating patient rows; allow phone-only users
CREATE OR REPLACE FUNCTION public.handle_new_patient_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  app jsonb := coalesce(NEW.raw_app_meta_data, '{}'::jsonb);
  meta_role text := coalesce(nullif(app ->> 'role', ''), meta ->> 'role', 'patient');
  source public.account_source;
  employer uuid;
BEGIN
  IF meta_role <> 'patient' THEN
    RETURN NEW;
  END IF;

  source := coalesce(
    nullif(meta ->> 'account_source', '')::public.account_source,
    'b2c'
  );

  employer := nullif(meta ->> 'employer_id', '')::uuid;

  INSERT INTO public.patients (
    id,
    full_name,
    date_of_birth,
    gender,
    email,
    mobile,
    account_source,
    employer_id
  )
  VALUES (
    NEW.id,
    coalesce(nullif(meta ->> 'full_name', ''), nullif(meta ->> 'name', ''), ''),
    nullif(meta ->> 'date_of_birth', '')::date,
    nullif(meta ->> 'gender', '')::public.gender,
    coalesce(NEW.email, ''),
    coalesce(nullif(meta ->> 'mobile', ''), nullif(NEW.phone, '')),
    source,
    employer
  );

  RETURN NEW;
END;
$$;

-- Create doctor row when a doctor Auth user is inserted
CREATE OR REPLACE FUNCTION public.handle_new_doctor_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  app jsonb := coalesce(NEW.raw_app_meta_data, '{}'::jsonb);
  meta_role text := coalesce(nullif(app ->> 'role', ''), meta ->> 'role', '');
BEGIN
  IF meta_role <> 'doctor' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.doctors (id, full_name, email, mobile)
  VALUES (
    NEW.id,
    coalesce(nullif(meta ->> 'full_name', ''), nullif(meta ->> 'name', ''), ''),
    coalesce(NEW.email, ''),
    coalesce(nullif(meta ->> 'mobile', ''), nullif(NEW.phone, ''))
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_doctor
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_doctor_user();

-- ---------------------------------------------------------------------------
-- JWT / RLS helpers — role from app_metadata only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'user_role'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_app_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_doctor()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_app_role() = 'doctor';
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_app_role() IN ('doctor', 'admin');
$$;

-- Custom access token hook: surface user_role claim for RLS convenience
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  claims := event -> 'claims';
  user_role := coalesce(claims -> 'app_metadata' ->> 'role', 'patient');

  claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Doctors: own row; admins all
CREATE POLICY doctors_select_own_or_admin
  ON public.doctors
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY doctors_update_own_or_admin
  ON public.doctors
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY doctors_no_client_insert
  ON public.doctors
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY doctors_no_client_delete
  ON public.doctors
  FOR DELETE
  TO authenticated
  USING (false);

-- Patients: doctors/admins can read (consultation prep); patients keep own update
CREATE POLICY patients_select_staff
  ON public.patients
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- Employers: admins manage; staff can read names
CREATE POLICY employers_select_staff
  ON public.employers
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY employers_admin_insert
  ON public.employers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY employers_admin_update
  ON public.employers
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Audit logs: admins read; no client writes
CREATE POLICY audit_logs_admin_select
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY audit_logs_no_client_write
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

GRANT SELECT, UPDATE ON public.doctors TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT, UPDATE ON public.employers TO authenticated;

-- Backfill app_metadata.role for users created before this migration
UPDATE auth.users
SET raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'role',
    coalesce(
      nullif(raw_app_meta_data ->> 'role', ''),
      CASE
        WHEN nullif(raw_user_meta_data ->> 'role', '') IN ('patient', 'doctor', 'admin')
          THEN raw_user_meta_data ->> 'role'
        ELSE 'patient'
      END
    )
  )
WHERE coalesce(raw_app_meta_data ->> 'role', '') = '';
