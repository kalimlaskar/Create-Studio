import { razorpayConfigured, razorpayRequest } from '@/lib/billing/razorpay';
import { getCurrentUser } from '@/lib/billing/subscription';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// Cancels at the end of the paid cycle; the webhook updates the status.
export async function POST() {
    const user = await getCurrentUser();
    const admin = createSupabaseAdminClient();
    if (!user || !admin || !razorpayConfigured()) return Response.json({ error: 'Not available.' }, { status: 401 });
    const { data: row } = await admin.from('subscriptions').select('razorpay_subscription_id,status').eq('user_id', user.id).maybeSingle();
    if (!row || row.status !== 'active') return Response.json({ error: 'No active subscription to cancel.' }, { status: 400 });
    try {
        await razorpayRequest(`/subscriptions/${row.razorpay_subscription_id}/cancel`, { cancel_at_cycle_end: 1 });
        return Response.json({ ok: true });
    } catch {
        return Response.json({ error: 'Could not cancel. Please try again.' }, { status: 502 });
    }
}
