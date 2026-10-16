// Razorpay webhook. Point the Razorpay dashboard at https://<your-domain>/api/billing/webhook
// with the subscription.* events. /api/razorpay/webhook runs the same code.
import { handleRazorpayWebhook } from '@/lib/billing/webhook';

export const runtime = 'nodejs';

export function POST(request: Request) {
    return handleRazorpayWebhook(request);
}
