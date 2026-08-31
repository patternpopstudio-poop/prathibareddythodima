-- Phase 5 Slice 5.5: consultation chat attachments (PDF, JPG, PNG)
-- Exit: participants can upload files to a private bucket and send messages
-- with attachment metadata; chat remains immutable (no update/delete).

-- ---------------------------------------------------------------------------
-- messages: optional body + attachment metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.messages
  ALTER COLUMN body DROP NOT NULL;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_body_nonempty;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_body_max_length;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime text,
  ADD COLUMN IF NOT EXISTS attachment_size_bytes bigint;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_body_max_length
    CHECK (body IS NULL OR char_length(body) <= 8000);

ALTER TABLE public.messages
  ADD CONSTRAINT messages_has_content
    CHECK (
      (body IS NOT NULL AND char_length(trim(body)) > 0)
      OR attachment_path IS NOT NULL
    );

ALTER TABLE public.messages
  ADD CONSTRAINT messages_attachment_complete
    CHECK (
      (
        attachment_path IS NULL
        AND attachment_name IS NULL
        AND attachment_mime IS NULL
        AND attachment_size_bytes IS NULL
      )
      OR (
        attachment_path IS NOT NULL
        AND attachment_name IS NOT NULL
        AND char_length(trim(attachment_name)) > 0
        AND char_length(attachment_name) <= 255
        AND attachment_mime IN ('application/pdf', 'image/jpeg', 'image/png')
        AND attachment_size_bytes IS NOT NULL
        AND attachment_size_bytes > 0
        AND attachment_size_bytes <= 10485760
        AND attachment_path LIKE (consultation_id::text || '/%')
      )
    );

COMMENT ON TABLE public.messages IS
  'Immutable consultation chat messages (text and/or file attachment). No update/delete.';

COMMENT ON COLUMN public.messages.body IS
  'Optional plain-text body / caption. Required when there is no attachment.';

COMMENT ON COLUMN public.messages.attachment_path IS
  'Object path in consultation-attachments bucket: {consultation_id}/{uuid}.{ext}';

COMMENT ON COLUMN public.messages.attachment_name IS
  'Original file name shown in chat.';

COMMENT ON COLUMN public.messages.attachment_mime IS
  'Allowed: application/pdf, image/jpeg, image/png.';

COMMENT ON COLUMN public.messages.attachment_size_bytes IS
  'File size in bytes (max 10 MiB).';

-- ---------------------------------------------------------------------------
-- Storage: private consultation-attachments bucket
-- Path convention: {consultation_id}/{object_id}.{ext}
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consultation-attachments',
  'consultation-attachments',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS consultation_attachments_select ON storage.objects;
CREATE POLICY consultation_attachments_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consultation-attachments'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_consultation_participant(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS consultation_attachments_insert ON storage.objects;
CREATE POLICY consultation_attachments_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'consultation-attachments'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_consultation_participant(((storage.foldername(name))[1])::uuid)
  );

-- Immutable: no overwrite / delete via client (matches messages policy).
DROP POLICY IF EXISTS consultation_attachments_update ON storage.objects;
CREATE POLICY consultation_attachments_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS consultation_attachments_delete ON storage.objects;
CREATE POLICY consultation_attachments_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (false);
