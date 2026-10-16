import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A small in-memory stand-in for the Supabase tables the webhook touches.
const db = {
    subscriptions: new Map<string, Record<string, unknown>>(),
    payments: new Map<string, Record<string, unknown>>(),
    events: new Set<string>(),
};

function from(table: string) {
    const filters: Record<string, unknown> = {};
    const query = {
        select: () => query,
        eq: (column: string, value: unknown) => { filters[column] = value; return query; },
        async maybeSingle() {
            if (table === 'razorpay_events') return { data: db.events.has(String(filters.event_id)) ? { event_id: filters.event_id } : null };
            const rows = [...db.subscriptions.values()];
            const row = rows.find((item) => Object.entries(filters).every(([key, value]) => item[key] === value));
            return { data: row ?? null };
        },
        async upsert(row: Record<string, unknown>) {
            if (table === 'subscriptions') db.subscriptions.set(String(row.user_id), { ...db.subscriptions.get(String(row.user_id)), ...row });
            if (table === 'payments') db.payments.set(String(row.razorpay_payment_id), row);
            return { error: null };
        },
        async insert(row: Record<string, unknown>) {
            if (table === 'razorpay_events') db.events.add(String(row.event_id));
            return { error: null };
        },
    };
    return query;
}

vi.mock('@/lib/billing/razorpay', async (original) => ({
    ...(await original<typeof import('@/lib/billing/razorpay')>()),
    billingDb: () => ({ from }),
}));

const SECRET = 'whsec_test';
process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
const { handleRazorpayWebhook } = await import('@/lib/billing/webhook');

function webhook(body: object, { eventId = 'evt_1', secret = SECRET } = {}) {
    const raw = JSON.stringify(body);
    const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    return new Request('http://localhost/api/billing/webhook', {
        method: 'POST',
        body: raw,
        headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId },
    });
}

const charged = (status = 'active') => ({
    event: 'subscription.charged',
    payload: {
        subscription: { entity: { id: 'sub_1', plan_id: 'plan_creator', status, customer_id: 'cust_1', current_start: 1_760_000_000, current_end: 1_762_600_000, notes: { user_id: 'user-1' } } },
        payment: { entity: { id: 'pay_1', amount: 129900, currency: 'INR', status: 'captured', created_at: 1_760_000_100 } },
    },
});

describe('Razorpay webhook', () => {
    beforeEach(() => {
        db.subscriptions.clear();
        db.payments.clear();
        db.events.clear();
        db.subscriptions.set('user-1', { user_id: 'user-1', razorpay_subscription_id: 'sub_1', razorpay_plan_id: 'plan_creator', status: 'created' });
    });

    it('rejects a request with a bad signature', async () => {
        const response = await handleRazorpayWebhook(webhook(charged(), { secret: 'wrong' }));
        expect(response.status).toBe(400);
        expect(db.subscriptions.get('user-1')?.status).toBe('created');
    });

    it('activates the subscription and records the payment', async () => {
        const response = await handleRazorpayWebhook(webhook(charged()));
        expect(response.status).toBe(200);
        expect(db.subscriptions.get('user-1')).toMatchObject({ status: 'active', razorpay_customer_id: 'cust_1' });
        expect(db.payments.get('pay_1')).toMatchObject({ user_id: 'user-1', amount: 129900, currency: 'INR' });
    });

    it('processes a retried event only once', async () => {
        await handleRazorpayWebhook(webhook(charged()));
        db.subscriptions.get('user-1')!.status = 'halted';
        const retry = await handleRazorpayWebhook(webhook(charged()));
        expect(await retry.json()).toMatchObject({ duplicate: true });
        expect(db.subscriptions.get('user-1')?.status).toBe('halted');
    });

    it('ignores events for a subscription the user has replaced', async () => {
        db.subscriptions.set('user-1', { user_id: 'user-1', razorpay_subscription_id: 'sub_2', status: 'active' });
        await handleRazorpayWebhook(webhook({ ...charged('cancelled'), event: 'subscription.cancelled' }, { eventId: 'evt_2' }));
        expect(db.subscriptions.get('user-1')).toMatchObject({ razorpay_subscription_id: 'sub_2', status: 'active' });
    });
});
