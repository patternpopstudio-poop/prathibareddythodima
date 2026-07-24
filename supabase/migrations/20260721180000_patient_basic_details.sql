-- Phase 2: basic profile fields collected after phone OTP (name, DOB, gender, city, optional email).

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS city text;

COMMENT ON COLUMN public.patients.city IS
  'Patient city / location collected during basic-details onboarding.';

-- Phone users start with empty email; allow them to set a contact email once.
-- Identity email from Auth signup remains locked once set.
CREATE OR REPLACE FUNCTION public.protect_patient_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    NEW.id := OLD.id;
    NEW.employer_id := OLD.employer_id;
    NEW.account_source := OLD.account_source;
    NEW.created_at := OLD.created_at;

    IF coalesce(OLD.email, '') <> '' THEN
      NEW.email := OLD.email;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
