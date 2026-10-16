// Razorpay webhook. Point the Razorpay dashboard at https://<your-domain>/api/billing/webhook
// with the subscription.* events. This older URL runs the same code, so either works.
import { handleRazorpayWebhook } from '@/lib/billing/webhook';

export const runtime = 'nodejs';

export function POST(request: Request) {
    return handleRazorpayWebhook(request);
}
