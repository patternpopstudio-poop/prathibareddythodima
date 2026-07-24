-- Fix: admin.createUser applies app_metadata via INSERT then UPDATE.
-- INSERT triggers therefore often see role=patient (from assign_app_role) before
-- the real role arrives on UPDATE — wrongly creating patients rows for doctors/admins.
--
-- 1) Harden INSERT handlers to trust only app_metadata.role for staff
-- 2) Sync profiles when app_metadata.role changes (AFTER UPDATE)
-- 3) Backfill misclassified staff users

-- ---------------------------------------------------------------------------
-- Shared sync: ensure patients/doctors match authoritative app_metadata.role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  new_role text := coalesce(NEW.raw_app_meta_data ->> 'role', '');
  old_role text := CASE
    WHEN TG_OP = 'UPDATE' THEN coalesce(OLD.raw_app_meta_data ->> 'role', '')
    ELSE ''
  END;
  full_name text := coalesce(nullif(meta ->> 'full_name', ''), nullif(meta ->> 'name', ''), '');
  mobile text := coalesce(nullif(meta ->> 'mobile', ''), nullif(NEW.phone, ''));
  source public.account_source;
  employer uuid;
BEGIN
  -- INSERT path still handled by dedicated triggers; this runs on UPDATE (and
  -- can be called from backfill). Skip no-op role updates.
  IF TG_OP = 'UPDATE' AND old_role = new_role THEN
    RETURN NEW;
  END IF;

  IF new_role = 'doctor' THEN
    DELETE FROM public.patients WHERE id = NEW.id;

    INSERT INTO public.doctors (id, full_name, email, mobile)
    VALUES (NEW.id, full_name, coalesce(NEW.email, ''), mobile)
    ON CONFLICT (id) DO UPDATE
      SET
        full_name = CASE
          WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name
          ELSE public.doctors.full_name
        END,
        email = coalesce(nullif(EXCLUDED.email, ''), public.doctors.email),
        mobile = coalesce(EXCLUDED.mobile, public.doctors.mobile),
        updated_at = now();

  ELSIF new_role = 'admin' THEN
    DELETE FROM public.patients WHERE id = NEW.id;
    DELETE FROM public.doctors WHERE id = NEW.id;

  ELSIF new_role = 'patient' THEN
    DELETE FROM public.doctors WHERE id = NEW.id;

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
      full_name,
      nullif(meta ->> 'date_of_birth', '')::date,
      nullif(meta ->> 'gender', '')::public.gender,
      coalesce(NEW.email, ''),
      mobile,
      source,
      employer
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_auth_user_profile() IS
  'Keeps patients/doctors rows aligned with auth.users.app_metadata.role after createUser UPDATE.';

DROP TRIGGER IF EXISTS on_auth_user_role_sync_profile ON auth.users;
CREATE TRIGGER on_auth_user_role_sync_profile
  AFTER UPDATE OF raw_app_meta_data ON auth.users
  FOR EACH ROW
  WHEN (
    coalesce(OLD.raw_app_meta_data ->> 'role', '')
    IS DISTINCT FROM coalesce(NEW.raw_app_meta_data ->> 'role', '')
  )
  EXECUTE FUNCTION public.sync_auth_user_profile();

-- ---------------------------------------------------------------------------
-- INSERT: only trust app_metadata for staff (never user_metadata alone)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_doctor_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  meta_role text := coalesce(NEW.raw_app_meta_data ->> 'role', '');
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
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_patient_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  app jsonb := coalesce(NEW.raw_app_meta_data, '{}'::jsonb);
  -- Trust app_metadata only (assign_app_role runs BEFORE INSERT).
  -- Staff invites may briefly look like patients until createUser's
  -- app_metadata UPDATE; on_auth_user_role_sync_profile corrects that.
  meta_role text := coalesce(nullif(app ->> 'role', ''), 'patient');
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
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: staff users stuck with patient rows / missing doctor rows
-- ---------------------------------------------------------------------------
DELETE FROM public.patients p
USING auth.users u
WHERE p.id = u.id
  AND coalesce(u.raw_app_meta_data ->> 'role', '') IN ('doctor', 'admin');

INSERT INTO public.doctors (id, full_name, email, mobile)
SELECT
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    ''
  ),
  coalesce(u.email, ''),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'mobile', ''),
    nullif(u.phone, '')
  )
FROM auth.users u
WHERE coalesce(u.raw_app_meta_data ->> 'role', '') = 'doctor'
ON CONFLICT (id) DO NOTHING;
