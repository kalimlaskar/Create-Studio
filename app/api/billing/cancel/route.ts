// app/api/billing/cancel/route.ts
// Cancels at the end of the billing period, so the user keeps what they already paid for.
import { getRequestUserId } from '@/lib/plans/server';
import { billingDb, razorpayApi } from '@/lib/billing/razorpay';

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST() {
    const userId = await getRequestUserId();
    if (!userId) return fail('Sign in again.', 401);

    const db = billingDb();
    const { data: row } = await db
        .from('subscriptions')
        .select('razorpay_subscription_id, status')
        .eq('user_id', userId)
        .maybeSingle();

    if (!row?.razorpay_subscription_id || row.status !== 'active') {
        return fail('You do not have an active subscription to cancel.', 400);
    }

    try {
        await razorpayApi(`subscriptions/${row.razorpay_subscription_id}/cancel`, { cancel_at_cycle_end: 1 });
        await db.from('subscriptions')
            .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
            .eq('user_id', userId);
        return Response.json({ ok: true });
    } catch (error) {
        console.error('Could not cancel subscription:', error);
        return fail('Could not cancel right now. Please try again or contact support.', 502);
    }
}