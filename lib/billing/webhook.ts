import 'server-only';
import { billingDb, hmacHex, safeEqualHex } from '@/lib/billing/razorpay';

// Razorpay webhook handling: the source of truth for who has paid.
// Razorpay calls this when a subscription changes. Events are verified with the
// webhook secret, recorded once by event ID (Razorpay retries), and applied to the
// user's subscription row. Successful charges are also stored in payments.

interface SubscriptionEntity {
    id: string;
    plan_id?: string;
    customer_id?: string | null;
    status?: string;
    current_start?: number | null;
    current_end?: number | null;
    notes?: { user_id?: string } | unknown[];
}
interface PaymentEntity {
    id: string;
    amount?: number;
    currency?: string;
    status?: string;
    created_at?: number;
}
interface RazorpayEvent {
    event?: string;
    payload?: {
        subscription?: { entity?: SubscriptionEntity };
        payment?: { entity?: PaymentEntity };
    };
}

const toIso = (seconds?: number | null) => (typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null);

async function handleEvent(event: RazorpayEvent) {
    const sub = event.payload?.subscription?.entity;
    if (!event.event?.startsWith('subscription.') || !sub?.id) return;

    const db = billingDb();
    const notes = sub.notes && !Array.isArray(sub.notes) ? sub.notes : undefined;
    let userId = notes?.user_id ?? null;

    if (!userId) {
        const { data } = await db.from('subscriptions').select('user_id').eq('razorpay_subscription_id', sub.id).maybeSingle();
        userId = data?.user_id ?? null;
    }
    if (!userId) {
        console.warn('[razorpay] Event for a subscription with no known user:', sub.id);
        return;
    }

    // Ignore events for an older subscription the user has since replaced.
    const { data: current } = await db.from('subscriptions').select('razorpay_subscription_id').eq('user_id', userId).maybeSingle();
    if (current?.razorpay_subscription_id && current.razorpay_subscription_id !== sub.id) return;

    // Only overwrite fields the event actually carries, so a sparse event can't blank them.
    const row: Record<string, unknown> = {
        user_id: userId,
        razorpay_subscription_id: sub.id,
        status: sub.status ?? 'created',
        updated_at: new Date().toISOString(),
    };
    if (sub.plan_id) row.razorpay_plan_id = sub.plan_id;
    if (sub.customer_id) row.razorpay_customer_id = sub.customer_id;
    if (sub.current_start) row.current_period_start = toIso(sub.current_start);
    if (sub.current_end) row.current_period_end = toIso(sub.current_end);
    if (sub.status === 'cancelled' || sub.status === 'completed') row.cancel_at_period_end = false;
    const { error } = await db.from('subscriptions').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;

    // Every successful charge becomes a row in the billing history.
    const payment = event.payload?.payment?.entity;
    if (event.event === 'subscription.charged' && payment?.id) {
        const { error: paymentError } = await db.from('payments').upsert({
            user_id: userId,
            razorpay_payment_id: payment.id,
            razorpay_subscription_id: sub.id,
            amount: payment.amount ?? null,
            currency: payment.currency ?? null,
            status: payment.status ?? null,
            paid_at: toIso(payment.created_at),
        }, { onConflict: 'razorpay_payment_id' });
        if (paymentError) throw paymentError;
    }
}

/** Verifies and applies one Razorpay webhook. Used by both webhook URLs. */
export async function handleRazorpayWebhook(request: Request) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return Response.json({ error: 'Webhook is not configured.' }, { status: 503 });

    // The signature is calculated on the exact raw text, so read it before parsing.
    const raw = await request.text();
    const signature = request.headers.get('x-razorpay-signature') ?? '';
    if (!signature || !safeEqualHex(hmacHex(secret, raw), signature)) {
        return Response.json({ error: 'Invalid signature.' }, { status: 400 });
    }

    let event: RazorpayEvent;
    try {
        event = JSON.parse(raw) as RazorpayEvent;
    } catch {
        return Response.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    const db = billingDb();
    const eventId = request.headers.get('x-razorpay-event-id');

    // Razorpay retries, so skip anything we have already processed.
    if (eventId) {
        const { data } = await db.from('razorpay_events').select('event_id').eq('event_id', eventId).maybeSingle();
        if (data) return Response.json({ ok: true, duplicate: true });
    }

    try {
        await handleEvent(event);
    } catch (error) {
        console.error('[razorpay] Webhook processing failed:', error);
        return Response.json({ error: 'Processing failed.' }, { status: 500 }); // Razorpay will retry
    }

    if (eventId) await db.from('razorpay_events').insert({ event_id: eventId, event: event.event ?? null });
    return Response.json({ ok: true });
}