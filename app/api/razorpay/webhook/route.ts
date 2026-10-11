// app/api/razorpay/webhook/route.ts
// The source of truth for who has paid. Razorpay calls this URL when a subscription changes.
import { billingDb, hmacHex, safeEqualHex } from '@/lib/billing/razorpay';

export const runtime = 'nodejs';

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

    const { error } = await db.from('subscriptions').upsert({
        user_id: userId,
        razorpay_subscription_id: sub.id,
        razorpay_customer_id: sub.customer_id ?? null,
        razorpay_plan_id: sub.plan_id ?? null,
        status: sub.status ?? 'created',
        current_period_start: toIso(sub.current_start),
        current_period_end: toIso(sub.current_end),
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
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

export async function POST(request: Request) {
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