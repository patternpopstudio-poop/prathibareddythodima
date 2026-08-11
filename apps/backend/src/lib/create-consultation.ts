import type { Consultation, ConsultationRow } from '@teleconsult/shared-types';
import { mapConsultationRow } from '@teleconsult/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type EnsureConsultationResult =
  | { ok: true; consultation: Consultation; created: boolean }
  | { ok: false; status: number; message: string };

/**
 * Idempotently open a consultation for a confirmed booking (Phase 5 Slice 5.2).
 * Prefers the DB RPC (also fired by the bookings → confirmed trigger).
 * Service-role only.
 */
export async function ensureConsultationForBooking(
  admin: SupabaseClient,
  bookingId: string
): Promise<EnsureConsultationResult> {
  const { data: before } = await admin
    .from('consultations')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle();

  const { data, error } = await admin.rpc('ensure_consultation_for_booking', {
    p_booking_id: bookingId,
  });

  if (error) {
    const message = error.message || 'Could not open consultation.';
    let status = 500;
    if (/not found/i.test(message)) status = 404;
    else if (/only when confirmed/i.test(message)) status = 409;
    return { ok: false, status, message };
  }

  if (!data) {
    return { ok: false, status: 500, message: 'Consultation RPC returned no row.' };
  }

  // PostgREST may return a single object or a one-element array depending on setup.
  const row = (Array.isArray(data) ? data[0] : data) as ConsultationRow | undefined;
  if (!row?.id) {
    return { ok: false, status: 500, message: 'Consultation RPC returned an invalid row.' };
  }

  return {
    ok: true,
    consultation: mapConsultationRow(row),
    created: !before?.id,
  };
}
