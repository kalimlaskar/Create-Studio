import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function razorpayConfigured() {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_PLAN_ID);
}

export async function razorpayRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Razorpay ${path} failed with ${response.status}`);
    return await response.json() as T;
}

export function hmacMatches(payload: string, signature: string | null, secret: string | undefined) {
    if (!secret || !signature) return false;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
}
