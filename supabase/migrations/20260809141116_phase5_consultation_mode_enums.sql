-- Phase 5 Slice 5.7a: enums for online/offline consultation mode foundation.
-- Must commit before foundation migration uses the new enum values.

CREATE TYPE public.consultation_mode AS ENUM ('online', 'offline');

CREATE TYPE public.booking_payment_method AS ENUM ('online', 'clinic');

ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'pending_admin';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'rejected';

COMMENT ON TYPE public.consultation_mode IS
  'Online (teleconsult + chat) vs offline (in-clinic; no chat).';

COMMENT ON TYPE public.booking_payment_method IS
  'How the patient pays: Razorpay online, or pay at clinic (offline mode only).';
