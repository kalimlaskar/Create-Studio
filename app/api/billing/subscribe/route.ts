// app/api/billing/subscribe/route.ts
import { getRequestUserId } from '@/lib/plans/server';
import { billingDb, razorpayApi } from '@/lib/billing/razorpay';
import { getCatalog, razorpayIdForPlan } from '@/lib/plans/catalog';
import { isPaidPlan } from '@/components/pricing/planLimits';

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(request: Request) {
    const userId = await getRequestUserId();
    if (!userId) return fail('Sign in to upgrade.', 401);

    const body = await request.json().catch(() => null) as { plan?: unknown } | null;
    // Any paid package an admin has made available (not archived).
    const chosen = (await getCatalog()).find((item) => item.id === body?.plan && isPaidPlan(item) && !item.archived);
    if (!chosen) return fail('Choose a plan to upgrade to.', 400);
    const plan = chosen.id;

    const razorpayPlanId = razorpayIdForPlan(chosen);
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!razorpayPlanId || !keyId) return fail('This plan is not available for purchase yet.', 503);

    const db = billingDb();
    const { data: existing } = await db
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();

    if (existing?.status === 'active') {
        return fail('You already have an active plan. Cancel it first, then choose a new one.', 409);
    }
    if (existing?.status === 'cancelled' && existing.current_period_end && new Date(existing.current_period_end) > new Date()) {
        return fail(`Your current plan runs until ${new Date(existing.current_period_end).toLocaleDateString('en-IN')}. You can subscribe again after that.`, 409);
    }

    try {
        const subscription = await razorpayApi<{ id: string }>('subscriptions', {
            plan_id: razorpayPlanId,
            total_count: 120, // monthly billing for up to 10 years; the user can cancel any time
            quantity: 1,
            customer_notify: 1,
            notes: { user_id: userId, plan },
        });

        const { error } = await db.from('subscriptions').upsert({
            user_id: userId,
            razorpay_subscription_id: subscription.id,
            razorpay_plan_id: razorpayPlanId,
            status: 'created',
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (error) throw error;

        return Response.json({ subscriptionId: subscription.id, keyId });
    } catch (error) {
        console.error('Could not create subscription:', error);
        return fail('Could not start checkout. Please try again.', 502);
    }
}