// lib/billing/razorpay.ts
import 'server-only';
import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type PaidPlan = 'creator' | 'studio';

/** The Razorpay plan IDs you created in the Razorpay dashboard (they start with "plan_"). */
export function planIdFor(plan: PaidPlan) {
    return plan === 'studio'
        ? process.env.RAZORPAY_PLAN_ID_STUDIO
        : process.env.RAZORPAY_PLAN_ID_CREATOR ?? process.env.RAZORPAY_PLAN_ID;
}

let db: SupabaseClient | null = null;

/** Service-role client. Bypasses row-level security, so it must only run on the server. */
export function billingDb() {
    db ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
    });
    return db;
}

export async function razorpayApi<T>(path: string, body: unknown): Promise<T> {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error('Razorpay keys are not configured on the server.');

    const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
    });
    const data = await response.json().catch(() => null) as { error?: { description?: string } } | null;
    if (!response.ok) throw new Error(data?.error?.description ?? `Razorpay returned ${response.status}.`);
    return data as T;
}

export const hmacHex = (secret: string, payload: string) =>
    crypto.createHmac('sha256', secret).update(payload).digest('hex');

export function safeEqualHex(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}