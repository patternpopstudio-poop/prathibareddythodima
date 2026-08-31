-- Phase 4 Slice 1b: allow pending_payment on bookings (after enum commit)
-- Extends cancel CHECK + active-slot unique index to treat pending_payment as a hold.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_cancel_fields;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_cancel_fields CHECK (
    (status IN ('confirmed', 'pending_payment') AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
  );

DROP INDEX IF EXISTS public.bookings_slot_active_unique;
CREATE UNIQUE INDEX bookings_slot_active_unique
  ON public.bookings (slot_id)
  WHERE status IN ('confirmed', 'pending_payment');

COMMENT ON CONSTRAINT bookings_cancel_fields ON public.bookings IS
  'Active bookings (confirmed or pending_payment) have no cancelled_at; cancelled rows must.';
