import { razorpayConfigured, razorpayRequest } from '@/lib/billing/razorpay';
import { getCurrentUser, isEntitled } from '@/lib/billing/subscription';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST() {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: 'Sign in to upgrade.' }, { status: 401 });
    const admin = createSupabaseAdminClient();
    if (!razorpayConfigured() || !admin) return Response.json({ error: 'Payments are not configured yet.' }, { status: 503 });

    const { data: existing } = await admin.from('subscriptions').select('status,current_period_end').eq('user_id', user.id).maybeSingle();
    if (isEntitled(existing)) return Response.json({ error: 'You already have an active Pro subscription.' }, { status: 409 });

    const planId = process.env.RAZORPAY_PLAN_ID as string;
    try {
        const subscription = await razorpayRequest<{ id: string }>('/subscriptions', {
            plan_id: planId,
            total_count: 120,
            customer_notify: 1,
            notes: { user_id: user.id },
        });
        const { error } = await admin.from('subscriptions').upsert({
            user_id: user.id,
            razorpay_subscription_id: subscription.id,
            razorpay_plan_id: planId,
            status: 'created',
            current_period_end: null,
            updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        return Response.json({ subscriptionId: subscription.id, keyId: process.env.RAZORPAY_KEY_ID, email: user.email });
    } catch {
        return Response.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 });
    }
}
