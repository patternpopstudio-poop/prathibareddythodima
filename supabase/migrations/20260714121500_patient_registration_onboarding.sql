-- Patient registration & onboarding schema
-- Supports B2C self-registration and B2B admin-managed accounts.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE public.account_source AS ENUM ('b2c', 'b2b');

CREATE TYPE public.gender AS ENUM (
  'male',
  'female',
  'other',
  'prefer_not_to_say'
);

CREATE TYPE public.blood_group AS ENUM (
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-'
);

-- Minimal employer entity for B2B account linking
CREATE TABLE public.employers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patients (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  date_of_birth date,
  gender public.gender,
  email text NOT NULL,
  mobile text,
  account_source public.account_source NOT NULL DEFAULT 'b2c',
  employer_id uuid REFERENCES public.employers (id) ON DELETE SET NULL,
  -- Registration complete after email verify (Auth); this gates first booking
  profile_completed boolean NOT NULL DEFAULT false,
  -- Profile completion / medical history
  allergies text,
  chronic_ailments text,
  past_surgeries text,
  family_history text,
  current_medications text,
  -- Biometrics
  height_cm numeric(5, 2),
  weight_kg numeric(5, 2),
  blood_group public.blood_group,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patients_b2b_requires_employer CHECK (
    account_source = 'b2c'
    OR employer_id IS NOT NULL
  )
);

CREATE INDEX patients_employer_id_idx ON public.patients (employer_id);
CREATE INDEX patients_profile_completed_idx ON public.patients (profile_completed);

COMMENT ON TABLE public.patients IS
  'Patient profile: registration fields + onboarding (health/biometrics). Required before first booking when profile_completed is false.';

-- Keep updated_at fresh; lock admin-only fields for authenticated patients
CREATE OR REPLACE FUNCTION public.protect_patient_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    NEW.id := OLD.id;
    NEW.employer_id := OLD.employer_id;
    NEW.account_source := OLD.account_source;
    NEW.email := OLD.email;
    NEW.created_at := OLD.created_at;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER patients_protect_and_touch_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_patient_fields();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER employers_touch_updated_at
  BEFORE UPDATE ON public.employers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create patient row on auth signup (B2C metadata or B2B admin createUser)
CREATE OR REPLACE FUNCTION public.handle_new_patient_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  meta_role text := coalesce(meta ->> 'role', 'patient');
  source public.account_source;
  employer uuid;
BEGIN
  -- Doctors/admins get Auth users without a patients row
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
    NEW.email,
    nullif(meta ->> 'mobile', ''),
    source,
    employer
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_patient
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_patient_user();

ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Patients: own row only
CREATE POLICY patients_select_own
  ON public.patients
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY patients_update_own
  ON public.patients
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No direct INSERT/DELETE for patients via client; created by trigger / service role
CREATE POLICY patients_no_client_insert
  ON public.patients
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY patients_no_client_delete
  ON public.patients
  FOR DELETE
  TO authenticated
  USING (false);

-- Employers: patients can read their linked employer name (optional UX)
CREATE POLICY employers_select_linked
  ON public.employers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = auth.uid()
        AND p.employer_id = employers.id
    )
  );

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.patients TO authenticated;
GRANT SELECT ON public.employers TO authenticated;
