import type { Booking, BookingRow, Payment, PaymentRow } from '@teleconsult/shared-types';
import { mapBookingRow, mapPaymentRow } from '@teleconsult/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ensureConsultationForBooking } from './create-consultation.js';
import { requestManualRefund } from './refund-payment.js';

/** Best-effort: open chat for a confirmed booking (trigger + idempotent RPC). */
async function openConsultationForConfirmedBooking(
  admin: SupabaseClient,
  bookingId: string
): Promise<void> {
  const opened = await ensureConsultationForBooking(admin, bookingId);
  if (!opened.ok) {
    console.error(
      `[confirm-payment] ensure consultation failed for booking ${bookingId}: ${opened.message}`
    );
  }
}

export type ConfirmPaymentInput = {
  paymentId: string;
  bookingId: string;
  patientId?: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature: string | null;
  /** When true, skip HMAC (already verified by caller / webhook / dev). */
  skipSignatureCheck?: boolean;
};

export type ConfirmPaymentResult =
  | { ok: true; booking: Booking; payment: Payment; alreadyPaid: boolean }
  | { ok: false; status: number; message: string };

/**
 * Mark payment paid and promote booking pending_payment → confirmed.
 * Idempotent when already paid. Service-role only.
 */
export async function confirmBookingPayment(
  admin: SupabaseClient,
  input: ConfirmPaymentInput
): Promise<ConfirmPaymentResult> {
  const { data: paymentRow, error: payErr } = await admin
    .from('payments')
    .select('*')
    .eq('id', input.paymentId)
    .maybeSingle();

  if (payErr) {
    return { ok: false, status: 500, message: payErr.message };
  }
  if (!paymentRow) {
    return { ok: false, status: 404, message: 'Payment not found.' };
  }

  const payment = paymentRow as PaymentRow;
  if (payment.booking_id !== input.bookingId) {
    return { ok: false, status: 400, message: 'Payment does not match booking.' };
  }
  if (input.patientId && payment.patient_id !== input.patientId) {
    return { ok: false, status: 403, message: 'Payment does not belong to this patient.' };
  }

  if (payment.status === 'paid') {
    const { data: bookingRow } = await admin
      .from('bookings')
      .select('*')
      .eq('id', input.bookingId)
      .maybeSingle();
    if (!bookingRow) {
      return { ok: false, status: 404, message: 'Booking not found.' };
    }
    const booking = bookingRow as BookingRow;
    if (booking.status === 'confirmed') {
      await openConsultationForConfirmedBooking(admin, booking.id);
    }
    return {
      ok: true,
      alreadyPaid: true,
      booking: mapBookingRow(booking),
      payment: mapPaymentRow(payment),
    };
  }

  if (payment.status === 'refunded') {
    return { ok: false, status: 409, message: 'Payment was refunded.' };
  }

  const { data: bookingRow, error: bookErr } = await admin
    .from('bookings')
    .select('*')
    .eq('id', input.bookingId)
    .maybeSingle();

  if (bookErr) {
    return { ok: false, status: 500, message: bookErr.message };
  }
  if (!bookingRow) {
    return { ok: false, status: 404, message: 'Booking not found.' };
  }

  const booking = bookingRow as BookingRow;

  if (booking.patient_id !== payment.patient_id) {
    return { ok: false, status: 400, message: 'Booking/payment patient mismatch.' };
  }

  if (booking.status === 'cancelled') {
    const paidAt = new Date().toISOString();
    await admin
      .from('payments')
      .update({
        status: 'paid',
        gateway_order_id: input.gatewayOrderId,
        gateway_payment_id: input.gatewayPaymentId,
        gateway_signature: input.gatewaySignature,
        paid_at: paidAt,
        failure_reason: 'Booking cancelled or hold expired before confirmation',
        updated_at: paidAt,
      })
      .eq('id', payment.id);

    const manual = await requestManualRefund(admin, payment.id, {
      reason: 'hold_expired_after_pay',
      notes:
        'Payment captured after booking hold expired or cancel — manual refund required.',
    });

    await admin.from('audit_logs').insert({
      actor_id: payment.patient_id,
      action: 'payment.paid',
      entity_type: 'payments',
      entity_id: payment.id,
      metadata: {
        booking_id: booking.id,
        gateway_payment_id: input.gatewayPaymentId,
        booking_status: 'cancelled',
        note: 'Paid after hold expired — needs manual refund',
        refund_id: manual.ok ? manual.refund.id : null,
      },
    });

    return {
      ok: false,
      status: 409,
      message:
        'Payment succeeded but the booking hold expired. Contact support for a refund.',
    };
  }

  if (booking.status !== 'pending_payment') {
    if (booking.status === 'confirmed' && booking.payment_status === 'paid') {
      await openConsultationForConfirmedBooking(admin, booking.id);
      return {
        ok: true,
        alreadyPaid: true,
        booking: mapBookingRow(booking),
        payment: mapPaymentRow(payment),
      };
    }
    return {
      ok: false,
      status: 409,
      message: `Booking is ${booking.status}; cannot confirm payment.`,
    };
  }

  if (booking.billing_channel !== 'b2c_prepaid') {
    return { ok: false, status: 400, message: 'Booking is not B2C prepaid.' };
  }

  const paidAt = new Date().toISOString();

  const { data: updatedPayment, error: updatePayErr } = await admin
    .from('payments')
    .update({
      status: 'paid',
      gateway_order_id: input.gatewayOrderId,
      gateway_payment_id: input.gatewayPaymentId,
      gateway_signature: input.gatewaySignature,
      paid_at: paidAt,
      failure_reason: null,
      updated_at: paidAt,
    })
    .eq('id', payment.id)
    .neq('status', 'paid')
    .select('*')
    .maybeSingle();

  if (updatePayErr) {
    return { ok: false, status: 500, message: updatePayErr.message };
  }

  const { data: updatedBooking, error: updateBookErr } = await admin
    .from('bookings')
    .update({
      status: 'confirmed',
      payment_status: 'paid',
      updated_at: paidAt,
    })
    .eq('id', booking.id)
    .eq('status', 'pending_payment')
    .select('*')
    .maybeSingle();

  if (updateBookErr) {
    return { ok: false, status: 500, message: updateBookErr.message };
  }

  if (!updatedBooking) {
    // Race: hold expired between reads — payment may already be marked paid.
    await requestManualRefund(admin, payment.id, {
      reason: 'hold_expired_after_pay',
      notes:
        'Payment captured while booking hold expired between verify steps — manual refund required.',
    });
    return {
      ok: false,
      status: 409,
      message:
        'Payment succeeded but the booking hold expired. Contact support for a refund.',
    };
  }

  await admin.from('audit_logs').insert([
    {
      actor_id: payment.patient_id,
      action: 'payment.paid',
      entity_type: 'payments',
      entity_id: payment.id,
      metadata: {
        booking_id: booking.id,
        gateway_order_id: input.gatewayOrderId,
        gateway_payment_id: input.gatewayPaymentId,
        amount_paise: payment.amount_paise,
      },
    },
    {
      actor_id: payment.patient_id,
      action: 'booking.payment_confirmed',
      entity_type: 'bookings',
      entity_id: booking.id,
      metadata: {
        payment_id: payment.id,
        gateway_payment_id: input.gatewayPaymentId,
        amount_paise: payment.amount_paise,
      },
    },
  ]);

  // Trigger on bookings.status → confirmed also opens chat; call again for heal/idempotency.
  await openConsultationForConfirmedBooking(admin, booking.id);

  return {
    ok: true,
    alreadyPaid: false,
    booking: mapBookingRow(updatedBooking as BookingRow),
    payment: mapPaymentRow((updatedPayment as PaymentRow | null) ?? {
      ...payment,
      status: 'paid',
      gateway_order_id: input.gatewayOrderId,
      gateway_payment_id: input.gatewayPaymentId,
      gateway_signature: input.gatewaySignature,
      paid_at: paidAt,
    }),
  };
}
