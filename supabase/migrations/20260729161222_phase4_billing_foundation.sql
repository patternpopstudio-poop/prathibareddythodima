-- Phase 4 Slice 1: billing foundation
-- Per-doctor consultation fee (INR paise, ₹400–₹700), booking billing fields,
-- payments table + RLS. Gateway wiring deferred to later slices.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.billing_channel AS ENUM ('b2c_prepaid', 'b2b_employer');

CREATE TYPE public.booking_payment_status AS ENUM (
  'unpaid',
  'pending',
  'paid',
  'failed',
  'refunded',
  'not_required'
);

CREATE TYPE public.payment_record_status AS ENUM (
  'created',
  'pending',
  'paid',
  'failed',
  'refunded'
);

-- Hold slot until B2C payment succeeds (wired in Slice 2).
-- Value is used in the follow-up migration (cannot reference new enum in same txn).
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'pending_payment';

-- ---------------------------------------------------------------------------
-- Doctor consultation fee (paise; Razorpay amounts are integer paise)
-- ---------------------------------------------------------------------------
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS consultation_fee_paise integer NOT NULL DEFAULT 50000;

ALTER TABLE public.doctors
  DROP CONSTRAINT IF EXISTS doctors_consultation_fee_paise_range;

ALTER TABLE public.doctors
  ADD CONSTRAINT doctors_consultation_fee_paise_range
  CHECK (
    consultation_fee_paise >= 40000
    AND consultation_fee_paise <= 70000
  );

COMMENT ON COLUMN public.doctors.consultation_fee_paise IS
  'Consultation fee in INR paise (₹400–₹700). Admin-managed; Razorpay order amount.';

-- Only admins may change the fee (doctors may still update name/photo/mobile)
CREATE OR REPLACE FUNCTION public.doctors_lock_consultation_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service-role / backend (no JWT). Block doctor self-edits; admins OK.
  IF TG_OP = 'UPDATE'
     AND NEW.consultation_fee_paise IS DISTINCT FROM OLD.consultation_fee_paise
     AND auth.uid() IS NOT NULL
     AND public.current_app_role() IS DISTINCT FROM 'admin'
  THEN
    RAISE EXCEPTION 'Only admins can change consultation fee';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doctors_lock_consultation_fee ON public.doctors;
CREATE TRIGGER doctors_lock_consultation_fee
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW
  EXECUTE FUNCTION public.doctors_lock_consultation_fee();

-- ---------------------------------------------------------------------------
-- Bookings: billing channel + payment status + fee snapshot
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS billing_channel public.billing_channel,
  ADD COLUMN IF NOT EXISTS payment_status public.booking_payment_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS amount_paise integer,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_amount_paise_positive;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_amount_paise_positive
  CHECK (amount_paise IS NULL OR amount_paise > 0);

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_currency_inr;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_currency_inr
  CHECK (currency = 'INR');

-- pending_payment CHECK + unique index: see phase4_booking_pending_payment migration

CREATE INDEX IF NOT EXISTS bookings_payment_status_idx
  ON public.bookings (payment_status)
  WHERE payment_status IN ('unpaid', 'pending');

CREATE INDEX IF NOT EXISTS bookings_billing_channel_idx
  ON public.bookings (billing_channel)
  WHERE billing_channel IS NOT NULL;

COMMENT ON COLUMN public.bookings.billing_channel IS
  'How this booking is billed: prepaid Razorpay (B2C) or employer invoice (B2B).';

COMMENT ON COLUMN public.bookings.payment_status IS
  'Payment lifecycle for the booking. not_required = B2B or pre-Phase-4 legacy.';

COMMENT ON COLUMN public.bookings.amount_paise IS
  'Fee snapshot at booking time (INR paise). Null for legacy rows.';

COMMENT ON COLUMN public.bookings.currency IS
  'ISO currency; Phase 4 is INR only.';

-- ---------------------------------------------------------------------------
-- Payments (Razorpay orders / captures)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings (id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  amount_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status public.payment_record_status NOT NULL DEFAULT 'created',
  gateway text NOT NULL DEFAULT 'razorpay',
  gateway_order_id text,
  gateway_payment_id text,
  gateway_signature text,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_paise_positive CHECK (amount_paise > 0),
  CONSTRAINT payments_currency_inr CHECK (currency = 'INR'),
  CONSTRAINT payments_gateway_razorpay CHECK (gateway = 'razorpay')
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_gateway_order_id_unique
  ON public.payments (gateway_order_id)
  WHERE gateway_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_gateway_payment_id_unique
  ON public.payments (gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_booking_id_idx
  ON public.payments (booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_patient_id_idx
  ON public.payments (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_status_idx
  ON public.payments (status);

COMMENT ON TABLE public.payments IS
  'Razorpay payment attempts tied to a booking. Written by backend (service role) + webhooks.';

CREATE TRIGGER payments_touch_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — clients read own/staff; no client writes (backend / webhooks)
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_select_own_or_staff
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_staff()
  );

CREATE POLICY payments_no_client_insert
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY payments_no_client_update
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY payments_no_client_delete
  ON public.payments
  FOR DELETE
  TO authenticated
  USING (false);

GRANT SELECT ON public.payments TO authenticated;
