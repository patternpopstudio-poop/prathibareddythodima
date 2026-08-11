import type {
  CreatePaymentOrderResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from '@teleconsult/shared-types';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getBackendUrl } from '@/lib/backend';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const backendUrl = getBackendUrl();

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status}).`;
}

/** Create Razorpay order (or dev bypass) for a pending_payment booking. */
export async function createPaymentOrder(
  bookingId: string
): Promise<CreatePaymentOrderResult> {
  const res = await fetch(`${backendUrl}/payments/orders`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ bookingId }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as CreatePaymentOrderResult;
}

/** Verify signature / complete dev bypass → booking confirmed. */
export async function verifyPayment(
  input: VerifyPaymentInput
): Promise<VerifyPaymentResult> {
  const res = await fetch(`${backendUrl}/payments/verify`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as VerifyPaymentResult;
}

export type CheckoutOutcome =
  | { status: 'paid'; result: VerifyPaymentResult }
  | { status: 'cancelled' }
  | { status: 'dismissed' };

/**
 * Full B2C pay flow: create order → WebBrowser Checkout (or dev confirm) → verify.
 */
export async function completeBookingPayment(
  bookingId: string
): Promise<CheckoutOutcome> {
  const order = await createPaymentOrder(bookingId);

  if (order.mode === 'dev_bypass') {
    const result = await verifyPayment({
      bookingId: order.bookingId,
      paymentId: order.paymentId,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: `dev_pay_${order.paymentId.slice(0, 8)}`,
      razorpaySignature: 'dev_bypass',
    });
    return { status: 'paid', result };
  }

  if (!order.checkoutUrl) {
    throw new Error('Checkout URL missing from payment order.');
  }

  const redirectUrl = Linking.createURL('payment-callback');
  const browser = await WebBrowser.openAuthSessionAsync(
    order.checkoutUrl,
    redirectUrl
  );

  if (browser.type !== 'success' || !browser.url) {
    return { status: 'dismissed' };
  }

  const parsed = Linking.parse(browser.url);
  const q = parsed.queryParams ?? {};
  if (q.cancelled === '1' || q.cancelled === 'true') {
    return { status: 'cancelled' };
  }

  const razorpayOrderId = stringParam(q.razorpay_order_id);
  const razorpayPaymentId = stringParam(q.razorpay_payment_id);
  const razorpaySignature = stringParam(q.razorpay_signature);
  const paymentId = stringParam(q.paymentId) ?? order.paymentId;
  const returnedBookingId = stringParam(q.bookingId) ?? order.bookingId;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new Error('Payment returned incomplete details.');
  }

  const result = await verifyPayment({
    bookingId: returnedBookingId,
    paymentId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  return { status: 'paid', result };
}

function stringParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}
