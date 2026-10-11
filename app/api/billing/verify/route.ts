// app/api/billing/verify/route.ts
// Confirms the payment popup result really came from Razorpay. The plan itself is only
// switched on by the webhook, never by this browser call.
import { getRequestUserId } from '@/lib/plans/server';
import { billingDb, hmacHex, safeEqualHex } from '@/lib/billing/razorpay';

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(request: Request) {
    const userId = await getRequestUserId();
    if (!userId) return fail('Sign in again.', 401);

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return fail('Payments are not configured.', 503);

    const body = await request.json().catch(() => null) as {
        razorpay_payment_id?: unknown;
        razorpay_subscription_id?: unknown;
        razorpay_signature?: unknown;
    } | null;
    const paymentId = typeof body?.razorpay_payment_id === 'string' ? body.razorpay_payment_id : '';
    const subscriptionId = typeof body?.razorpay_subscription_id === 'string' ? body.razorpay_subscription_id : '';
    const signature = typeof body?.razorpay_signature === 'string' ? body.razorpay_signature : '';
    if (!paymentId || !subscriptionId || !signature) return fail('Missing payment details.', 400);

    const db = billingDb();
    const { data: row } = await db
        .from('subscriptions')
        .select('razorpay_subscription_id, status')
        .eq('user_id', userId)
        .maybeSingle();

    // Use the subscription ID we stored, not the one the browser sent.
    if (!row?.razorpay_subscription_id || row.razorpay_subscription_id !== subscriptionId) {
        return fail('That payment does not match your subscription.', 400);
    }

    const expected = hmacHex(secret, `${paymentId}|${row.razorpay_subscription_id}`);
    if (!safeEqualHex(expected, signature)) return fail('Payment could not be verified.', 400);

    if (row.status === 'created') {
        await db.from('subscriptions')
            .update({ status: 'authenticated', updated_at: new Date().toISOString() })
            .eq('user_id', userId);
    }
    return Response.json({ ok: true });
}