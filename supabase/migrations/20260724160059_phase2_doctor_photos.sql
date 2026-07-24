-- Phase 2 Slice C: doctor profile photo storage + field ownership.
-- Soft gate: photo_url required for "complete" profile (UX nudge); not a login block.

COMMENT ON TABLE public.doctors IS
  'Doctor profiles created via admin invite (service role). photo_url expected for a complete profile (Phase 2 soft gate).';

COMMENT ON COLUMN public.doctors.photo_url IS
  'Public URL of profile photo in the doctor-photos storage bucket. Required for a complete doctor profile.';

-- ---------------------------------------------------------------------------
-- Ownership: doctors edit name/mobile/photo; lock identity fields (non-admin).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_doctor_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin() THEN
    NEW.id := OLD.id;
    NEW.email := OLD.email;
    NEW.created_at := OLD.created_at;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doctors_protect_fields ON public.doctors;
CREATE TRIGGER doctors_protect_fields
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_doctor_fields();

-- Drop the old touch-only trigger if present (protect_doctor_fields sets updated_at).
DROP TRIGGER IF EXISTS doctors_touch_updated_at ON public.doctors;

-- ---------------------------------------------------------------------------
-- Storage: public doctor-photos bucket (profile images are safe to share).
-- Path convention: {doctor_id}/avatar.{ext}
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'doctor-photos',
  'doctor-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Authenticated staff can read (listing / signed ops); public URL still works for public bucket.
DROP POLICY IF EXISTS doctor_photos_select ON storage.objects;
CREATE POLICY doctor_photos_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'doctor-photos' AND public.is_staff());

DROP POLICY IF EXISTS doctor_photos_insert ON storage.objects;
CREATE POLICY doctor_photos_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'doctor-photos'
    AND public.is_staff()
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS doctor_photos_update ON storage.objects;
CREATE POLICY doctor_photos_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'doctor-photos'
    AND public.is_staff()
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  )
  WITH CHECK (
    bucket_id = 'doctor-photos'
    AND public.is_staff()
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS doctor_photos_delete ON storage.objects;
CREATE POLICY doctor_photos_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'doctor-photos'
    AND public.is_staff()
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
