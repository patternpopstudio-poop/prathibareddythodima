-- Phase 4 Slice 6: thin refund ledger
-- - Dedicated refunds table for money hygiene / audit
-- - Wired today: patient free-cancel + hold-expired-after-pay (pending manual)
-- - Deferred: reschedule_failed (Phase 7 — see ROADMAP)

CREATE TYPE public.refund_status AS ENUM (
  'pending',
  'succeeded',
  'failed'
);

CREATE TYPE public.refund_reason AS ENUM (
  'patient_free_cancel',
  'hold_expired_after_pay',
  -- Phase 7: when doctor-propose / patient-confirm reschedule fails after a fee move.
  'reschedule_failed'
);

CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments (id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES public.bookings (id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  amount_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status public.refund_status NOT NULL DEFAULT 'pending',
  reason public.refund_reason NOT NULL,
  gateway_refund_id text,
  failure_reason text,
  notes text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refunds_amount_paise_positive CHECK (amount_paise > 0),
  CONSTRAINT refunds_currency_inr CHECK (currency = 'INR')
);

CREATE UNIQUE INDEX IF NOT EXISTS refunds_gateway_refund_id_unique
  ON public.refunds (gateway_refund_id)
  WHERE gateway_refund_id IS NOT NULL;

-- One open/completed full refund per payment (failed rows may retry).
CREATE UNIQUE INDEX IF NOT EXISTS refunds_one_active_per_payment
  ON public.refunds (payment_id)
  WHERE status IN ('pending', 'succeeded');

CREATE INDEX IF NOT EXISTS refunds_booking_id_idx
  ON public.refunds (booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS refunds_patient_id_idx
  ON public.refunds (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS refunds_status_idx
  ON public.refunds (status)
  WHERE status = 'pending';

COMMENT ON TABLE public.refunds IS
  'Refund ledger for B2C payments. Written by backend (service role). Phase 4: free-cancel + hold-expired pending; Phase 7: reschedule_failed.';

COMMENT ON COLUMN public.refunds.reason IS
  'Why the refund exists. reschedule_failed is reserved for Phase 7 — do not invent reschedule UI in Phase 4.';

COMMENT ON COLUMN public.refunds.status IS
  'pending = needs gateway/manual processing; succeeded = money returned; failed = attempt failed (may retry).';

CREATE TRIGGER refunds_touch_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — clients read own/staff; no client writes (backend / service role)
-- ---------------------------------------------------------------------------
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY refunds_select_own_or_staff
  ON public.refunds
  FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_staff()
  );

CREATE POLICY refunds_no_client_insert
  ON public.refunds
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY refunds_no_client_update
  ON public.refunds
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY refunds_no_client_delete
  ON public.refunds
  FOR DELETE
  TO authenticated
  USING (false);

GRANT SELECT ON public.refunds TO authenticated;
