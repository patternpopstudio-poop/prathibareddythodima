import type {
  Booking,
  BookingRow,
  CancelBookingResult,
} from '@teleconsult/shared-types';
import {
  BOOKING_CANCEL_CUTOFF_HOURS,
  mapBookingRow,
} from '@teleconsult/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { refundPaidPayment } from './refund-payment.js';

type CancelInput = {
  bookingId: string;
  patientId: string;
  reason?: string | null;
};

/**
 * Patient cancel with payment rules:
 * - pending_payment → release hold, void open payments
 * - confirmed + paid + before cutoff → Razorpay refund, then cancel
 * - confirmed + after cutoff → flag hospital (no refund)
 */
export async function cancelBookingWithPayment(
  admin: SupabaseClient,
  input: CancelInput
): Promise<
  | { ok: true; result: CancelBookingResult & { refunded: boolean } }
  | { ok: false; status: number; message: string }
> {
  const cutoffHours = BOOKING_CANCEL_CUTOFF_HOURS;
  const reason = input.reason?.trim() || null;

  const { data: bookingRow, error: bookErr } = await admin
    .from('bookings')
    .select('*')
    .eq('id', input.bookingId)
    .maybeSingle();

  if (bookErr) return { ok: false, status: 500, message: bookErr.message };
  if (!bookingRow || bookingRow.patient_id !== input.patientId) {
    return { ok: false, status: 404, message: 'Booking not found.' };
  }

  const booking = bookingRow as BookingRow;

  if (booking.status === 'cancelled') {
    return { ok: false, status: 409, message: 'Booking is already cancelled.' };
  }
  if (booking.status !== 'confirmed' && booking.status !== 'pending_payment') {
    return { ok: false, status: 409, message: 'Booking cannot be cancelled.' };
  }

  if (!booking.slot_id) {
    return { ok: false, status: 409, message: 'Booking has no slot to cancel.' };
  }

  const { data: slot, error: slotErr } = await admin
    .from('appointment_slots')
    .select('*')
    .eq('id', booking.slot_id)
    .maybeSingle();

  if (slotErr) return { ok: false, status: 500, message: slotErr.message };
  if (!slot) return { ok: false, status: 404, message: 'Slot not found.' };

  const startsAt = new Date(slot.starts_at).getTime();
  if (!Number.isFinite(startsAt) || startsAt <= Date.now()) {
    return {
      ok: false,
      status: 409,
      message: 'This appointment has already started or passed.',
    };
  }

  const deadline = startsAt - cutoffHours * 60 * 60 * 1000;
  const beforeCutoff = Date.now() < deadline;

  // --- Unpaid hold: always release ---
  if (booking.status === 'pending_payment') {
    const cancelled = await releaseBooking(admin, {
      booking,
      slotId: slot.id,
      patientId: input.patientId,
      cancelReason: reason ?? 'Cancelled by patient before payment',
      paymentStatus: 'failed',
      voidOpenPayments: true,
      auditMeta: { was_pending_payment: true },
    });
    if (!cancelled.ok) return cancelled;

    return {
      ok: true,
      result: {
        outcome: 'cancelled',
        cutoffHours,
        message: 'Your reservation was cancelled and the slot is available again.',
        booking: cancelled.booking,
        refunded: false,
      },
    };
  }

  // --- After cutoff: flag only (no refund) ---
  if (!beforeCutoff) {
    if (booking.cancel_request_at) {
      return {
        ok: true,
        result: {
          outcome: 'contact_hospital',
          cutoffHours,
          message: `A cancellation request is already on file. Please contact the hospital to change this appointment (within ${cutoffHours} hours of the start time, online cancel is unavailable).`,
          booking: mapBookingRow(booking),
          refunded: false,
        },
      };
    }

    const now = new Date().toISOString();
    const { data: updated, error: updErr } = await admin
      .from('bookings')
      .update({
        cancel_request_at: now,
        cancel_request_note: reason,
        updated_at: now,
      })
      .eq('id', booking.id)
      .select('*')
      .single();

    if (updErr || !updated) {
      return { ok: false, status: 500, message: updErr?.message ?? 'Could not flag cancel.' };
    }

    await admin.from('audit_logs').insert({
      actor_id: input.patientId,
      action: 'booking.cancel_requested',
      entity_type: 'bookings',
      entity_id: booking.id,
      metadata: {
        slot_id: slot.id,
        doctor_id: booking.doctor_id,
        starts_at: slot.starts_at,
        cutoff_hours: cutoffHours,
        note: reason,
      },
    });

    return {
      ok: true,
      result: {
        outcome: 'contact_hospital',
        cutoffHours,
        message: `Online cancellation is closed within ${cutoffHours} hours of the appointment. Please contact the hospital to cancel or reschedule. Your request has been flagged for the care team.`,
        booking: mapBookingRow(updated as BookingRow),
        refunded: false,
      },
    };
  }

  // --- Free cancel before cutoff ---
  let refunded = false;

  if (booking.payment_status === 'paid') {
    const { data: paidRows } = await admin
      .from('payments')
      .select('*')
      .eq('booking_id', booking.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1);

    const paidPayment = paidRows?.[0];
    if (!paidPayment) {
      return {
        ok: false,
        status: 409,
        message: 'Paid booking has no payment record to refund.',
      };
    }

    const refund = await refundPaidPayment(admin, paidPayment.id, {
      reason: 'patient_free_cancel',
      notes: { booking_id: booking.id, reason: 'patient_free_cancel' },
    });
    if (!refund.ok) {
      return { ok: false, status: refund.status, message: refund.message };
    }
    refunded = true;
  }

  const cancelled = await releaseBooking(admin, {
    booking,
    slotId: slot.id,
    patientId: input.patientId,
    cancelReason: reason ?? 'Cancelled by patient',
    paymentStatus: refunded ? 'refunded' : booking.payment_status,
    voidOpenPayments: false,
    auditMeta: {
      cutoff_hours: cutoffHours,
      refunded,
    },
  });
  if (!cancelled.ok) return cancelled;

  return {
    ok: true,
    result: {
      outcome: 'cancelled',
      cutoffHours,
      message: refunded
        ? 'Your booking was cancelled. The consultation fee will be refunded to your original payment method.'
        : 'Your booking was cancelled and the slot is available again.',
      booking: cancelled.booking,
      refunded,
    },
  };
}

async function releaseBooking(
  admin: SupabaseClient,
  args: {
    booking: BookingRow;
    slotId: string;
    patientId: string;
    cancelReason: string;
    paymentStatus: BookingRow['payment_status'];
    voidOpenPayments: boolean;
    auditMeta: Record<string, unknown>;
  }
): Promise<{ ok: true; booking: Booking } | { ok: false; status: number; message: string }> {
  const now = new Date().toISOString();

  const { data: updated, error } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancel_reason: args.cancelReason,
      payment_status: args.paymentStatus,
      updated_at: now,
    })
    .eq('id', args.booking.id)
    .in('status', ['confirmed', 'pending_payment'])
    .select('*')
    .maybeSingle();

  if (error) return { ok: false, status: 500, message: error.message };
  if (!updated) {
    return { ok: false, status: 409, message: 'Booking could not be cancelled.' };
  }

  await admin
    .from('appointment_slots')
    .update({ status: 'open', updated_at: now })
    .eq('id', args.slotId)
    .eq('status', 'booked');

  if (args.voidOpenPayments) {
    await admin
      .from('payments')
      .update({
        status: 'failed',
        failure_reason: 'Cancelled before payment',
        updated_at: now,
      })
      .eq('booking_id', args.booking.id)
      .in('status', ['created', 'pending']);
  }

  await admin.from('audit_logs').insert({
    actor_id: args.patientId,
    action: 'booking.cancelled',
    entity_type: 'bookings',
    entity_id: args.booking.id,
    metadata: {
      slot_id: args.slotId,
      doctor_id: args.booking.doctor_id,
      reason: args.cancelReason,
      ...args.auditMeta,
    },
  });

  return { ok: true, booking: mapBookingRow(updated as BookingRow) };
}
