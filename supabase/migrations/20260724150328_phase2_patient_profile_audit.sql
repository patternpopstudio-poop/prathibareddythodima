-- Phase 2 Slice B: patient data ownership hardening + audit trail on profile changes.
-- Patient app updates rows via Supabase client, so auditing is done in-DB (not Node).

COMMENT ON TABLE public.patients IS
  'Patient profile: registration + optional health/biometrics. profile_completed is a nudge flag, not a booking gate.';

COMMENT ON COLUMN public.patients.profile_completed IS
  'True after height/weight health profile is saved. Used for UX nudges only.';

-- ---------------------------------------------------------------------------
-- Ownership: patients may edit own clinical/profile fields; lock identity fields.
-- Email: once set, locked (phone users may set contact email once).
-- profile_completed: may become true, but cannot be cleared by the client.
-- ---------------------------------------------------------------------------
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

    -- Once completed, clients cannot unset the nudge flag
    IF OLD.profile_completed IS TRUE THEN
      NEW.profile_completed := TRUE;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Audit: record changed patient fields into audit_logs (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_patient_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
  action_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_name := 'patient.created';
    changes := jsonb_build_object(
      'full_name', NEW.full_name,
      'email', NEW.email,
      'mobile', NEW.mobile,
      'account_source', NEW.account_source
    );
  ELSE
    action_name := 'patient.profile_updated';

    IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
      changes := changes || jsonb_build_object(
        'full_name', jsonb_build_object('from', to_jsonb(OLD.full_name), 'to', to_jsonb(NEW.full_name))
      );
    END IF;
    IF OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth THEN
      changes := changes || jsonb_build_object(
        'date_of_birth', jsonb_build_object('from', to_jsonb(OLD.date_of_birth), 'to', to_jsonb(NEW.date_of_birth))
      );
    END IF;
    IF OLD.gender IS DISTINCT FROM NEW.gender THEN
      changes := changes || jsonb_build_object(
        'gender', jsonb_build_object('from', to_jsonb(OLD.gender), 'to', to_jsonb(NEW.gender))
      );
    END IF;
    IF OLD.email IS DISTINCT FROM NEW.email THEN
      changes := changes || jsonb_build_object(
        'email', jsonb_build_object('from', to_jsonb(OLD.email), 'to', to_jsonb(NEW.email))
      );
    END IF;
    IF OLD.mobile IS DISTINCT FROM NEW.mobile THEN
      changes := changes || jsonb_build_object(
        'mobile', jsonb_build_object('from', to_jsonb(OLD.mobile), 'to', to_jsonb(NEW.mobile))
      );
    END IF;
    IF OLD.city IS DISTINCT FROM NEW.city THEN
      changes := changes || jsonb_build_object(
        'city', jsonb_build_object('from', to_jsonb(OLD.city), 'to', to_jsonb(NEW.city))
      );
    END IF;
    IF OLD.allergies IS DISTINCT FROM NEW.allergies THEN
      changes := changes || jsonb_build_object(
        'allergies', jsonb_build_object('from', to_jsonb(OLD.allergies), 'to', to_jsonb(NEW.allergies))
      );
    END IF;
    IF OLD.chronic_ailments IS DISTINCT FROM NEW.chronic_ailments THEN
      changes := changes || jsonb_build_object(
        'chronic_ailments', jsonb_build_object('from', to_jsonb(OLD.chronic_ailments), 'to', to_jsonb(NEW.chronic_ailments))
      );
    END IF;
    IF OLD.past_surgeries IS DISTINCT FROM NEW.past_surgeries THEN
      changes := changes || jsonb_build_object(
        'past_surgeries', jsonb_build_object('from', to_jsonb(OLD.past_surgeries), 'to', to_jsonb(NEW.past_surgeries))
      );
    END IF;
    IF OLD.family_history IS DISTINCT FROM NEW.family_history THEN
      changes := changes || jsonb_build_object(
        'family_history', jsonb_build_object('from', to_jsonb(OLD.family_history), 'to', to_jsonb(NEW.family_history))
      );
    END IF;
    IF OLD.current_medications IS DISTINCT FROM NEW.current_medications THEN
      changes := changes || jsonb_build_object(
        'current_medications', jsonb_build_object('from', to_jsonb(OLD.current_medications), 'to', to_jsonb(NEW.current_medications))
      );
    END IF;
    IF OLD.height_cm IS DISTINCT FROM NEW.height_cm THEN
      changes := changes || jsonb_build_object(
        'height_cm', jsonb_build_object('from', to_jsonb(OLD.height_cm), 'to', to_jsonb(NEW.height_cm))
      );
    END IF;
    IF OLD.weight_kg IS DISTINCT FROM NEW.weight_kg THEN
      changes := changes || jsonb_build_object(
        'weight_kg', jsonb_build_object('from', to_jsonb(OLD.weight_kg), 'to', to_jsonb(NEW.weight_kg))
      );
    END IF;
    IF OLD.blood_group IS DISTINCT FROM NEW.blood_group THEN
      changes := changes || jsonb_build_object(
        'blood_group', jsonb_build_object('from', to_jsonb(OLD.blood_group), 'to', to_jsonb(NEW.blood_group))
      );
    END IF;
    IF OLD.profile_completed IS DISTINCT FROM NEW.profile_completed THEN
      changes := changes || jsonb_build_object(
        'profile_completed', jsonb_build_object('from', to_jsonb(OLD.profile_completed), 'to', to_jsonb(NEW.profile_completed))
      );
    END IF;

    IF changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    action_name,
    'patient',
    NEW.id::text,
    jsonb_build_object('changes', changes, 'op', TG_OP)
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_patient_profile_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS patients_audit_profile_changes ON public.patients;
CREATE TRIGGER patients_audit_profile_changes
  AFTER INSERT OR UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_patient_profile_changes();

-- Staff may read patients (consultation prep) but must not update via client.
-- (No patients_update_staff policy — intentional. Service role / future consult flow only.)
COMMENT ON POLICY patients_update_own ON public.patients IS
  'Patients edit their own profile fields only. Staff have SELECT via patients_select_staff; no client UPDATE for staff.';

COMMENT ON POLICY audit_logs_no_client_write ON public.audit_logs IS
  'Clients cannot write audit rows. Inserts come from SECURITY DEFINER triggers / service role.';
