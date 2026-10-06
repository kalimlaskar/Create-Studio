import { hmacMatches } from '@/lib/billing/razorpay';
import { getCurrentUser } from '@/lib/billing/subscription';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// Instant unlock after checkout. The signed webhook remains the source of truth for renewals and cancellations.
export async function POST(request: Request) {
    const user = await getCurrentUser();
    const admin = createSupabaseAdminClient();
    if (!user || !admin) return Response.json({ error: 'Not authorized.' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const paymentId = typeof body?.razorpay_payment_id === 'string' ? body.razorpay_payment_id : '';
    const subscriptionId = typeof body?.razorpay_subscription_id === 'string' ? body.razorpay_subscription_id : '';
    const signature = typeof body?.razorpay_signature === 'string' ? body.razorpay_signature : '';
    if (!hmacMatches(`${paymentId}|${subscriptionId}`, signature, process.env.RAZORPAY_KEY_SECRET)) {
        return Response.json({ error: 'Payment verification failed.' }, { status: 400 });
    }

    const { data: row } = await admin.from('subscriptions').select('razorpay_subscription_id,status').eq('user_id', user.id).maybeSingle();
    if (!row || row.razorpay_subscription_id !== subscriptionId) return Response.json({ error: 'Subscription mismatch.' }, { status: 400 });

    if (row.status === 'created') {
        // Provisional 3-day window; the webhook replaces it with the real billing period.
        const provisionalEnd = new Date(Date.now() + 3 * 86_400_000).toISOString();
        await admin.from('subscriptions').update({ status: 'pending', current_period_end: provisionalEnd, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    }
    return Response.json({ ok: true });
}
