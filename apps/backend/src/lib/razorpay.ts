import crypto from 'node:crypto';

import Razorpay from 'razorpay';

export type RazorpayMode = 'razorpay' | 'dev_bypass';

export function getRazorpayMode(): RazorpayMode {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (process.env.PAYMENTS_DEV_BYPASS === 'true') return 'dev_bypass';
  if (!keyId || !keySecret) return 'dev_bypass';
  return 'razorpay';
}

export function getRazorpayKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID?.trim() || null;
}

export function getRazorpayClient(): Razorpay | null {
  if (getRazorpayMode() !== 'razorpay') return null;
  const key_id = process.env.RAZORPAY_KEY_ID!.trim();
  const key_secret = process.env.RAZORPAY_KEY_SECRET!.trim();
  return new Razorpay({ key_id, key_secret });
}

export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(input.signature, 'utf8')
    );
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}

export function publicBackendBaseUrl(reqHost?: string | null): string {
  const configured = process.env.PUBLIC_BACKEND_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (reqHost) return `http://${reqHost}`;
  const port = process.env.PORT ?? '4000';
  return `http://localhost:${port}`;
}
