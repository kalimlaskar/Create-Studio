import { hmacMatches } from '@/lib/billing/razorpay';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const STATUS_BY_EVENT: Record<string, string> = {
    'subscription.authenticated': 'authenticated',
    'subscription.activated': 'active',
    'subscription.charged': 'active',
    'subscription.pending': 'pending',
    'subscription.halted': 'halted',
    'subscription.cancelled': 'cancelled',
    'subscription.completed': 'completed',
    'subscription.paused': 'paused',
    'subscription.resumed': 'active',
};

export async function POST(request: Request) {
    const raw = await request.text();
    if (!hmacMatches(raw, request.headers.get('x-razorpay-signature'), process.env.RAZORPAY_WEBHOOK_SECRET)) {
        return Response.json({ error: 'Invalid signature.' }, { status: 400 });
    }
    const admin = createSupabaseAdminClient();
    if (!admin) return Response.json({ error: 'Not configured.' }, { status: 503 });

    let event: { event?: string; payload?: { subscription?: { entity?: { id?: string; status?: string; current_end?: number | null; notes?: Record<string, string> } } } };
    try { event = JSON.parse(raw); } catch { return Response.json({ error: 'Bad payload.' }, { status: 400 }); }

    const entity = event.payload?.subscription?.entity;
    const status = event.event ? STATUS_BY_EVENT[event.event] : undefined;
    if (!entity?.id || !status) return Response.json({ ok: true });

    // Only write when the subscription id matches one we created for a user (prevents spoofed notes.user_id).
    const { data: row } = await admin.from('subscriptions').select('user_id').eq('razorpay_subscription_id', entity.id).maybeSingle();
    if (!row) return Response.json({ ok: true });

    const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (entity.current_end) update.current_period_end = new Date(entity.current_end * 1000).toISOString();
    const { error } = await admin.from('subscriptions').update(update).eq('razorpay_subscription_id', entity.id);
    if (error) return Response.json({ error: 'Write failed.' }, { status: 500 });
    return Response.json({ ok: true });
}
