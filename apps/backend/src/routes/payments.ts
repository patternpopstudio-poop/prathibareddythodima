import type {
  CreatePaymentOrderResult,
  VerifyPaymentResult,
} from '@teleconsult/shared-types';
import { BOOKING_CURRENCY, BOOKING_PAYMENT_HOLD_MINUTES } from '@teleconsult/shared-types';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { cancelBookingWithPayment } from '../lib/cancel-booking.js';
import { confirmBookingPayment } from '../lib/confirm-payment.js';
import {
  getRazorpayClient,
  getRazorpayKeyId,
  getRazorpayMode,
  publicBackendBaseUrl,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from '../lib/razorpay.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

export const paymentsRouter = Router();

const createOrderSchema = z.object({
  bookingId: z.string().uuid('Invalid booking id.'),
});

const verifySchema = z.object({
  bookingId: z.string().uuid('Invalid booking id.'),
  paymentId: z.string().uuid('Invalid payment id.'),
  razorpayOrderId: z.string().min(1).optional().nullable(),
  razorpayPaymentId: z.string().min(1).optional().nullable(),
  razorpaySignature: z.string().min(1).optional().nullable(),
});

const cancelBookingSchema = z.object({
  bookingId: z.string().uuid('Invalid booking id.'),
  reason: z.string().max(500).optional().nullable(),
});

/**
 * Patient: create Razorpay order (or dev bypass) for a pending_payment booking.
 * POST /payments/orders
 */
paymentsRouter.post('/orders', async (req, res) => {
  const auth = await requireAuth(req as AuthedRequest, ['patient']);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }

  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join('; ');
    res.status(400).json({ error: message || 'Invalid payload.' });
    return;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    res.status(503).json({ error: 'Supabase admin client not configured.' });
    return;
  }

  const patientId = (req as AuthedRequest).userId!;
  const { bookingId } = parsed.data;

  // Reclaim expired holds before starting checkout
  await admin.rpc('expire_unpaid_booking_holds');

  const { data: booking, error: bookErr } = await admin
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookErr) {
    res.status(500).json({ error: bookErr.message });
    return;
  }
  if (!booking || booking.patient_id !== patientId) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }
  if (booking.status !== 'pending_payment') {
    res.status(409).json({
      error:
        booking.status === 'confirmed'
          ? 'Booking is already confirmed.'
          : 'Booking is not awaiting payment.',
    });
    return;
  }
  if (booking.billing_channel !== 'b2c_prepaid') {
    res.status(400).json({ error: 'Only B2C prepaid bookings require checkout.' });
    return;
  }
  if (!booking.amount_paise || booking.amount_paise <= 0) {
    res.status(400).json({ error: 'Booking has no fee amount.' });
    return;
  }

  const holdMs = BOOKING_PAYMENT_HOLD_MINUTES * 60 * 1000;
  const createdAt = new Date(booking.created_at).getTime();
  if (Number.isFinite(createdAt) && Date.now() - createdAt > holdMs) {
    await admin.rpc('expire_unpaid_booking_holds');
    res.status(409).json({ error: 'Payment hold expired. Please book again.' });
    return;
  }

  // Reuse an open Razorpay order if one already exists for this booking
  const { data: existingRows } = await admin
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .in('status', ['created', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1);

  const existing = existingRows?.[0] ?? null;
  const mode = getRazorpayMode();
  const baseUrl = publicBackendBaseUrl(req.get('host'));

  if (existing?.gateway_order_id && mode === 'razorpay') {
    const result: CreatePaymentOrderResult = {
      mode: 'razorpay',
      paymentId: existing.id,
      bookingId,
      amountPaise: existing.amount_paise,
      currency: BOOKING_CURRENCY,
      razorpayKeyId: getRazorpayKeyId(),
      razorpayOrderId: existing.gateway_order_id,
      checkoutUrl: `${baseUrl}/payments/checkout?paymentId=${existing.id}`,
    };
    res.json(result);
    return;
  }

  if (existing && mode === 'dev_bypass') {
    const result: CreatePaymentOrderResult = {
      mode: 'dev_bypass',
      paymentId: existing.id,
      bookingId,
      amountPaise: existing.amount_paise,
      currency: BOOKING_CURRENCY,
      razorpayKeyId: null,
      razorpayOrderId: existing.gateway_order_id,
      checkoutUrl: null,
    };
    res.json(result);
    return;
  }

  if (mode === 'dev_bypass') {
    const { data: payment, error: insertErr } = await admin
      .from('payments')
      .insert({
        booking_id: bookingId,
        patient_id: patientId,
        amount_paise: booking.amount_paise,
        currency: BOOKING_CURRENCY,
        status: 'pending',
        gateway: 'razorpay',
        gateway_order_id: `dev_order_${bookingId.replace(/-/g, '').slice(0, 20)}`,
      })
      .select('*')
      .single();

    if (insertErr || !payment) {
      res.status(500).json({ error: insertErr?.message ?? 'Could not create payment.' });
      return;
    }

    await admin.from('audit_logs').insert({
      actor_id: patientId,
      action: 'payment.created',
      entity_type: 'payments',
      entity_id: payment.id,
      metadata: {
        booking_id: bookingId,
        mode: 'dev_bypass',
        amount_paise: booking.amount_paise,
      },
    });

    await admin
      .from('bookings')
      .update({ payment_status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('status', 'pending_payment');

    const result: CreatePaymentOrderResult = {
      mode: 'dev_bypass',
      paymentId: payment.id,
      bookingId,
      amountPaise: booking.amount_paise,
      currency: BOOKING_CURRENCY,
      razorpayKeyId: null,
      razorpayOrderId: payment.gateway_order_id,
      checkoutUrl: null,
    };
    res.json(result);
    return;
  }

  const razorpay = getRazorpayClient();
  const keyId = getRazorpayKeyId();
  if (!razorpay || !keyId) {
    res.status(503).json({ error: 'Razorpay is not configured.' });
    return;
  }

  let order: { id: string; amount: number; currency: string };
  try {
    order = (await razorpay.orders.create({
      amount: booking.amount_paise,
      currency: BOOKING_CURRENCY,
      receipt: `bk_${bookingId.replace(/-/g, '').slice(0, 32)}`,
      notes: {
        booking_id: bookingId,
        patient_id: patientId,
      },
    })) as { id: string; amount: number; currency: string };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Razorpay order failed.';
    res.status(502).json({ error: message });
    return;
  }

  const { data: payment, error: insertErr } = await admin
    .from('payments')
    .insert({
      booking_id: bookingId,
      patient_id: patientId,
      amount_paise: booking.amount_paise,
      currency: BOOKING_CURRENCY,
      status: 'pending',
      gateway: 'razorpay',
      gateway_order_id: order.id,
    })
    .select('*')
    .single();

  if (insertErr || !payment) {
    res.status(500).json({ error: insertErr?.message ?? 'Could not create payment.' });
    return;
  }

  await admin.from('audit_logs').insert({
    actor_id: patientId,
    action: 'payment.created',
    entity_type: 'payments',
    entity_id: payment.id,
    metadata: {
      booking_id: bookingId,
      gateway_order_id: order.id,
      amount_paise: booking.amount_paise,
    },
  });

  await admin
    .from('bookings')
    .update({ payment_status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('status', 'pending_payment');

  const result: CreatePaymentOrderResult = {
    mode: 'razorpay',
    paymentId: payment.id,
    bookingId,
    amountPaise: booking.amount_paise,
    currency: BOOKING_CURRENCY,
    razorpayKeyId: keyId,
    razorpayOrderId: order.id,
    checkoutUrl: `${baseUrl}/payments/checkout?paymentId=${payment.id}`,
  };
  res.json(result);
});

/**
 * Hosted Checkout.js page — open from Expo via WebBrowser (no native SDK).
 * GET /payments/checkout?paymentId=
 */
paymentsRouter.get('/checkout', async (req, res) => {
  const paymentId = typeof req.query.paymentId === 'string' ? req.query.paymentId : '';
  if (!z.string().uuid().safeParse(paymentId).success) {
    res.status(400).type('html').send('<p>Invalid payment.</p>');
    return;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    res.status(503).type('html').send('<p>Payments unavailable.</p>');
    return;
  }

  const { data: payment } = await admin
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment?.gateway_order_id) {
    res.status(404).type('html').send('<p>Payment not found.</p>');
    return;
  }

  const keyId = getRazorpayKeyId();
  if (!keyId || getRazorpayMode() !== 'razorpay') {
    res
      .status(503)
      .type('html')
      .send('<p>Razorpay is not configured. Use the app’s dev confirm flow.</p>');
    return;
  }

  const { data: bookingMeta } = await admin
    .from('bookings')
    .select('doctor_id, doctors(full_name)')
    .eq('id', payment.booking_id)
    .maybeSingle();

  const doctorRelation = bookingMeta?.doctors as
    | { full_name?: string }
    | { full_name?: string }[]
    | null
    | undefined;
  const doctorName = Array.isArray(doctorRelation)
    ? (doctorRelation[0]?.full_name ?? 'Consultation')
    : (doctorRelation?.full_name ?? 'Consultation');
  const amount = payment.amount_paise;
  const orderId = payment.gateway_order_id;
  const callbackScheme = process.env.PAYMENT_CALLBACK_SCHEME?.trim() || 'teleconsultapp';
  const successRedirect = `${callbackScheme}://payment-callback`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pay for consultation</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; background: #f5f6f8; color: #1f2937;
      display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
    .card { background: #fff; border-radius: 16px; padding: 28px; max-width: 360px; width: 90%;
      box-shadow: 0 8px 24px rgba(0,0,0,.06); text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    p { color: #6b7280; margin: 0 0 20px; line-height: 1.4; }
    button { background: #6bae3d; color: #fff; border: 0; border-radius: 14px;
      padding: 14px 20px; font-size: 1rem; font-weight: 600; width: 100%; cursor: pointer; }
    button:disabled { opacity: .6; }
    .err { color: #a6021a; margin-top: 12px; font-size: .9rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(doctorName)}</h1>
    <p>Consultation fee · ₹${(amount / 100).toLocaleString('en-IN')}</p>
    <button id="pay" type="button">Pay securely</button>
    <p class="err" id="err" hidden></p>
  </div>
  <script>
    var options = {
      key: ${JSON.stringify(keyId)},
      amount: ${JSON.stringify(String(amount))},
      currency: 'INR',
      name: 'TeleConsult',
      description: 'Consultation booking',
      order_id: ${JSON.stringify(orderId)},
      theme: { color: '#6bae3d' },
      handler: function (response) {
        var q = new URLSearchParams({
          paymentId: ${JSON.stringify(paymentId)},
          bookingId: ${JSON.stringify(payment.booking_id)},
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        });
        window.location = ${JSON.stringify(successRedirect)} + '?' + q.toString();
      },
      modal: {
        ondismiss: function () {
          var q = new URLSearchParams({ cancelled: '1', paymentId: ${JSON.stringify(paymentId)} });
          window.location = ${JSON.stringify(successRedirect)} + '?' + q.toString();
        }
      }
    };
    document.getElementById('pay').onclick = function () {
      try {
        new Razorpay(options).open();
      } catch (e) {
        var el = document.getElementById('err');
        el.hidden = false;
        el.textContent = (e && e.message) || 'Could not open checkout.';
      }
    };
    // Auto-open once
    setTimeout(function () { document.getElementById('pay').click(); }, 400);
  </script>
</body>
</html>`;

  res.type('html').send(html);
});

/**
 * Patient cancel with payment rules (void unpaid / refund paid before cutoff).
 * POST /payments/cancel-booking
 */
paymentsRouter.post('/cancel-booking', async (req, res) => {
  const auth = await requireAuth(req as AuthedRequest, ['patient']);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }

  const parsed = cancelBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join('; ');
    res.status(400).json({ error: message || 'Invalid payload.' });
    return;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    res.status(503).json({ error: 'Supabase admin client not configured.' });
    return;
  }

  const cancelled = await cancelBookingWithPayment(admin, {
    bookingId: parsed.data.bookingId,
    patientId: (req as AuthedRequest).userId!,
    reason: parsed.data.reason,
  });

  if (!cancelled.ok) {
    res.status(cancelled.status).json({ error: cancelled.message });
    return;
  }

  res.json(cancelled.result);
});

/**
 * Verify Checkout signature (or complete dev bypass) and confirm booking.
 * POST /payments/verify
 */
paymentsRouter.post('/verify', async (req, res) => {
  const auth = await requireAuth(req as AuthedRequest, ['patient']);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }

  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join('; ');
    res.status(400).json({ error: message || 'Invalid payload.' });
    return;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    res.status(503).json({ error: 'Supabase admin client not configured.' });
    return;
  }

  const patientId = (req as AuthedRequest).userId!;
  const mode = getRazorpayMode();
  const body = parsed.data;

  if (mode === 'dev_bypass') {
    const confirmed = await confirmBookingPayment(admin, {
      paymentId: body.paymentId,
      bookingId: body.bookingId,
      patientId,
      gatewayOrderId: body.razorpayOrderId ?? `dev_order_${body.bookingId.slice(0, 8)}`,
      gatewayPaymentId: body.razorpayPaymentId ?? `dev_pay_${body.paymentId.slice(0, 8)}`,
      gatewaySignature: body.razorpaySignature ?? 'dev_bypass',
    });
    if (!confirmed.ok) {
      res.status(confirmed.status).json({ error: confirmed.message });
      return;
    }
    const result: VerifyPaymentResult = {
      booking: confirmed.booking,
      payment: confirmed.payment,
    };
    res.json(result);
    return;
  }

  const orderId = body.razorpayOrderId?.trim();
  const paymentId = body.razorpayPaymentId?.trim();
  const signature = body.razorpaySignature?.trim();
  if (!orderId || !paymentId || !signature) {
    res.status(400).json({ error: 'Missing Razorpay payment fields.' });
    return;
  }

  if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
    res.status(400).json({ error: 'Invalid payment signature.' });
    return;
  }

  const confirmed = await confirmBookingPayment(admin, {
    paymentId: body.paymentId,
    bookingId: body.bookingId,
    patientId,
    gatewayOrderId: orderId,
    gatewayPaymentId: paymentId,
    gatewaySignature: signature,
  });

  if (!confirmed.ok) {
    res.status(confirmed.status).json({ error: confirmed.message });
    return;
  }

  const result: VerifyPaymentResult = {
    booking: confirmed.booking,
    payment: confirmed.payment,
  };
  res.json(result);
});

/**
 * Razorpay webhook (payment.captured). Mount with raw body parser in index.ts.
 * POST /payments/webhook
 */
export async function handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-razorpay-signature'];
  if (typeof signature !== 'string' || !signature) {
    res.status(400).json({ error: 'Missing signature.' });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));

  if (!verifyWebhookSignature(rawBody, signature)) {
    res.status(400).json({ error: 'Invalid webhook signature.' });
    return;
  }

  let payload: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          status?: string;
          notes?: Record<string, string>;
        };
      };
    };
  };

  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'Invalid JSON.' });
    return;
  }

  if (payload.event !== 'payment.captured' && payload.event !== 'payment.authorized') {
    res.json({ received: true, ignored: true });
    return;
  }

  const entity = payload.payload?.payment?.entity;
  const gatewayPaymentId = entity?.id;
  const gatewayOrderId = entity?.order_id;
  if (!gatewayPaymentId || !gatewayOrderId) {
    res.json({ received: true, ignored: true });
    return;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    res.status(503).json({ error: 'Supabase admin client not configured.' });
    return;
  }

  const { data: payment } = await admin
    .from('payments')
    .select('*')
    .eq('gateway_order_id', gatewayOrderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment) {
    res.json({ received: true, unmatched: true });
    return;
  }

  const confirmed = await confirmBookingPayment(admin, {
    paymentId: payment.id,
    bookingId: payment.booking_id,
    gatewayOrderId,
    gatewayPaymentId,
    gatewaySignature: signature,
  });

  if (!confirmed.ok && confirmed.status !== 409) {
    res.status(confirmed.status).json({ error: confirmed.message });
    return;
  }

  res.json({ received: true, ok: confirmed.ok });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
