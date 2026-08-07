import type {
  Payment,
  PaymentRow,
  Refund,
  RefundReason,
  RefundRow,
} from '@teleconsult/shared-types';
import {
  BOOKING_CURRENCY,
  mapPaymentRow,
  mapRefundRow,
} from '@teleconsult/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getRazorpayClient, getRazorpayMode } from './razorpay.js';

/**
 * Phase 4 Slice 6 — refund ledger + gateway helper.
 * Wired today: patient_free_cancel, hold_expired_after_pay (pending).
 * Phase 7: call refundPaidPayment(..., { reason: 'reschedule_failed' }) when a
 * paid reschedule fails — do not invent reschedule UI here.
 */

export type RefundPaymentResult =
  | {
      ok: true;
      payment: Payment;
      refund: Refund;
      gatewayRefundId: string;
      alreadyRefunded: boolean;
    }
  | { ok: false; status: number; message: string };

export type RequestManualRefundResult =
  | { ok: true; refund: Refund; alreadyRequested: boolean }
  | { ok: false; status: number; message: string };

/**
 * Full refund of a paid Razorpay payment (or mark refunded in dev_bypass).
 * Writes a `refunds` ledger row (Slice 6) and updates `payments`.
 * Idempotent when already refunded.
 */
export async function refundPaidPayment(
  admin: SupabaseClient,
  paymentId: string,
  options?: {
    reason?: Extract<RefundReason, 'patient_free_cancel' | 'reschedule_failed'>;
    notes?: Record<string, string>;
  }
): Promise<RefundPaymentResult> {
  const reason = options?.reason ?? 'patient_free_cancel';
  const notes = options?.notes;

  const { data: paymentRow, error } = await admin
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (error) return { ok: false, status: 500, message: error.message };
  if (!paymentRow) return { ok: false, status: 404, message: 'Payment not found.' };

  const payment = paymentRow as PaymentRow;

  if (payment.status === 'refunded') {
    const existing = await findActiveRefund(admin, payment.id);
    return {
      ok: true,
      alreadyRefunded: true,
      gatewayRefundId: payment.gateway_refund_id ?? 'already_refunded',
      payment: mapPaymentRow(payment),
      refund:
        existing ??
        (await ensureSucceededRefundStub(admin, payment, reason, notes)),
    };
  }

  if (payment.status !== 'paid') {
    return {
      ok: false,
      status: 409,
      message: `Payment is ${payment.status}; only paid payments can be refunded.`,
    };
  }

  let ledger = await findActiveRefund(admin, payment.id);
  if (ledger?.status === 'succeeded') {
    return {
      ok: true,
      alreadyRefunded: true,
      gatewayRefundId: ledger.gatewayRefundId ?? 'already_refunded',
      payment: mapPaymentRow(payment),
      refund: ledger,
    };
  }

  if (!ledger) {
    ledger = await insertRefundRow(admin, {
      payment,
      reason,
      status: 'pending',
      notes: notesToText(notes),
    });
  }

  if (!ledger) {
    // Unique race — another request created the row
    ledger = await findActiveRefund(admin, payment.id);
    if (ledger?.status === 'succeeded') {
      return {
        ok: true,
        alreadyRefunded: true,
        gatewayRefundId: ledger.gatewayRefundId ?? 'already_refunded',
        payment: mapPaymentRow(payment),
        refund: ledger,
      };
    }
    if (!ledger) {
      return { ok: false, status: 500, message: 'Could not create refund ledger row.' };
    }
  }

  const ledgerId = ledger.id;

  const mode = getRazorpayMode();
  let gatewayRefundId: string;

  if (mode === 'dev_bypass') {
    gatewayRefundId = `dev_rfnd_${payment.id.replace(/-/g, '').slice(0, 16)}`;
  } else {
    const razorpay = getRazorpayClient();
    const gatewayPaymentId = payment.gateway_payment_id;
    if (!razorpay || !gatewayPaymentId) {
      await markRefundFailed(admin, ledgerId, 'Razorpay is not configured for refunds.');
      return {
        ok: false,
        status: 503,
        message: 'Razorpay is not configured for refunds.',
      };
    }

    try {
      const refund = (await razorpay.payments.refund(gatewayPaymentId, {
        amount: payment.amount_paise,
        notes: notes ?? { booking_id: payment.booking_id, reason },
      })) as { id: string };
      gatewayRefundId = refund.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Razorpay refund failed.';
      await markRefundFailed(admin, ledgerId, message);
      await admin.from('audit_logs').insert({
        actor_id: payment.patient_id,
        action: 'refund.failed',
        entity_type: 'refunds',
        entity_id: ledgerId,
        metadata: {
          payment_id: payment.id,
          booking_id: payment.booking_id,
          reason,
          message,
        },
      });
      return { ok: false, status: 502, message };
    }
  }

  const now = new Date().toISOString();
  const { data: updatedPayment, error: updateErr } = await admin
    .from('payments')
    .update({
      status: 'refunded',
      gateway_refund_id: gatewayRefundId,
      failure_reason: null,
      updated_at: now,
    })
    .eq('id', payment.id)
    .eq('status', 'paid')
    .select('*')
    .maybeSingle();

  if (updateErr) return { ok: false, status: 500, message: updateErr.message };
  if (!updatedPayment) {
    const { data: again } = await admin
      .from('payments')
      .select('*')
      .eq('id', payment.id)
      .maybeSingle();
    if (again?.status === 'refunded') {
      const refund =
        (await findActiveRefund(admin, payment.id)) ??
        (await ensureSucceededRefundStub(
          admin,
          again as PaymentRow,
          reason,
          notes
        ));
      return {
        ok: true,
        alreadyRefunded: true,
        gatewayRefundId:
          (again as PaymentRow).gateway_refund_id ?? gatewayRefundId,
        payment: mapPaymentRow(again as PaymentRow),
        refund,
      };
    }
    return { ok: false, status: 409, message: 'Could not mark payment refunded.' };
  }

  const { data: succeededRefund, error: refundUpdErr } = await admin
    .from('refunds')
    .update({
      status: 'succeeded',
      gateway_refund_id: gatewayRefundId,
      failure_reason: null,
      notes: notesToText(notes),
      processed_at: now,
      updated_at: now,
    })
    .eq('id', ledgerId)
    .select('*')
    .maybeSingle();

  if (refundUpdErr || !succeededRefund) {
    return {
      ok: false,
      status: 500,
      message: refundUpdErr?.message ?? 'Could not mark refund succeeded.',
    };
  }

  await admin.from('audit_logs').insert([
    {
      actor_id: payment.patient_id,
      action: 'payment.refunded',
      entity_type: 'payments',
      entity_id: payment.id,
      metadata: {
        booking_id: payment.booking_id,
        gateway_refund_id: gatewayRefundId,
        amount_paise: payment.amount_paise,
        mode,
        refund_id: ledgerId,
        reason,
      },
    },
    {
      actor_id: payment.patient_id,
      action: 'refund.succeeded',
      entity_type: 'refunds',
      entity_id: ledgerId,
      metadata: {
        payment_id: payment.id,
        booking_id: payment.booking_id,
        gateway_refund_id: gatewayRefundId,
        amount_paise: payment.amount_paise,
        reason,
        mode,
      },
    },
  ]);

  return {
    ok: true,
    alreadyRefunded: false,
    gatewayRefundId,
    payment: mapPaymentRow(updatedPayment as PaymentRow),
    refund: mapRefundRow(succeededRefund as RefundRow),
  };
}

/**
 * Queue a manual refund when payment succeeded after the booking hold expired.
 * Does not call Razorpay — leaves `refunds.status = pending` for ops.
 */
export async function requestManualRefund(
  admin: SupabaseClient,
  paymentId: string,
  options?: {
    reason?: Extract<RefundReason, 'hold_expired_after_pay'>;
    notes?: string | null;
  }
): Promise<RequestManualRefundResult> {
  const reason = options?.reason ?? 'hold_expired_after_pay';

  const { data: paymentRow, error } = await admin
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (error) return { ok: false, status: 500, message: error.message };
  if (!paymentRow) return { ok: false, status: 404, message: 'Payment not found.' };

  const payment = paymentRow as PaymentRow;
  if (payment.status !== 'paid' && payment.status !== 'refunded') {
    return {
      ok: false,
      status: 409,
      message: `Payment is ${payment.status}; cannot request a refund.`,
    };
  }

  const existing = await findActiveRefund(admin, payment.id);
  if (existing) {
    return { ok: true, alreadyRequested: true, refund: existing };
  }

  const inserted = await insertRefundRow(admin, {
    payment,
    reason,
    status: 'pending',
    notes:
      options?.notes ??
      'Payment captured after booking hold expired — manual refund required.',
  });

  if (!inserted) {
    const raced = await findActiveRefund(admin, payment.id);
    if (raced) return { ok: true, alreadyRequested: true, refund: raced };
    return { ok: false, status: 500, message: 'Could not create pending refund.' };
  }

  await admin.from('audit_logs').insert({
    actor_id: payment.patient_id,
    action: 'refund.requested',
    entity_type: 'refunds',
    entity_id: inserted.id,
    metadata: {
      payment_id: payment.id,
      booking_id: payment.booking_id,
      amount_paise: payment.amount_paise,
      reason,
    },
  });

  return { ok: true, alreadyRequested: false, refund: inserted };
}

async function findActiveRefund(
  admin: SupabaseClient,
  paymentId: string
): Promise<Refund | null> {
  const { data } = await admin
    .from('refunds')
    .select('*')
    .eq('payment_id', paymentId)
    .in('status', ['pending', 'succeeded'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapRefundRow(data as RefundRow) : null;
}

async function insertRefundRow(
  admin: SupabaseClient,
  args: {
    payment: PaymentRow;
    reason: RefundReason;
    status: 'pending' | 'succeeded' | 'failed';
    notes: string | null;
    gatewayRefundId?: string | null;
    processedAt?: string | null;
  }
): Promise<Refund | null> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('refunds')
    .insert({
      payment_id: args.payment.id,
      booking_id: args.payment.booking_id,
      patient_id: args.payment.patient_id,
      amount_paise: args.payment.amount_paise,
      currency: args.payment.currency,
      status: args.status,
      reason: args.reason,
      gateway_refund_id: args.gatewayRefundId ?? null,
      failure_reason: null,
      notes: args.notes,
      processed_at: args.processedAt ?? null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .maybeSingle();

  if (error || !data) return null;
  return mapRefundRow(data as RefundRow);
}

async function markRefundFailed(
  admin: SupabaseClient,
  refundId: string,
  message: string
): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from('refunds')
    .update({
      status: 'failed',
      failure_reason: message,
      updated_at: now,
    })
    .eq('id', refundId)
    .eq('status', 'pending');
}

/** Backfill ledger when payment is already refunded but refunds row is missing. */
async function ensureSucceededRefundStub(
  admin: SupabaseClient,
  payment: PaymentRow,
  reason: RefundReason,
  notes?: Record<string, string>
): Promise<Refund> {
  const existing = await findActiveRefund(admin, payment.id);
  if (existing) return existing;

  const created = await insertRefundRow(admin, {
    payment,
    reason,
    status: 'succeeded',
    notes: notesToText(notes),
    gatewayRefundId: payment.gateway_refund_id,
    processedAt: new Date().toISOString(),
  });

  if (created) return created;

  // Last resort synthetic (should be rare — unique race)
  return {
    id: payment.id,
    paymentId: payment.id,
    bookingId: payment.booking_id,
    patientId: payment.patient_id,
    amountPaise: payment.amount_paise,
    currency: BOOKING_CURRENCY,
    status: 'succeeded',
    reason,
    gatewayRefundId: payment.gateway_refund_id ?? null,
    failureReason: null,
    notes: notesToText(notes),
    processedAt: new Date().toISOString(),
    createdAt: payment.updated_at,
    updatedAt: payment.updated_at,
  };
}

function notesToText(notes?: Record<string, string> | null): string | null {
  if (!notes || Object.keys(notes).length === 0) return null;
  return Object.entries(notes)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}
