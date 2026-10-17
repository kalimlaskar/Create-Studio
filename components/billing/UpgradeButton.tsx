'use client';

// components/billing/UpgradeButton.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RazorpayResponse {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
}

declare global {
    interface Window {
        Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
    }
}

function loadCheckout() {
    return new Promise<boolean>((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

export function UpgradeButton({ plan, className, children }: {
    plan: string;
    className?: string;
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const start = async () => {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch('/api/billing/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan }),
            });
            if (response.status === 401) {
                router.push('/login?next=/pricing');
                return;
            }
            const data = await response.json().catch(() => null) as { subscriptionId?: string; keyId?: string; error?: string } | null;
            if (!response.ok || !data?.subscriptionId || !data.keyId) throw new Error(data?.error ?? 'Could not start checkout.');

            if (!(await loadCheckout()) || !window.Razorpay) throw new Error('Could not load the payment window. Check your connection and try again.');

            const checkout = new window.Razorpay({
                key: data.keyId,
                subscription_id: data.subscriptionId,
                name: 'Cliprame',
                description: `${plan === 'studio' ? 'Studio' : 'Creator'} plan, billed monthly`,
                theme: { color: '#6A4CFF' },
                handler: async (result: RazorpayResponse) => {
                    const verify = await fetch('/api/billing/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(result),
                    });
                    if (!verify.ok) {
                        setError('Payment received, but we could not confirm it yet. Your plan will switch on within a minute. Refresh if it does not.');
                        setBusy(false);
                        return;
                    }
                    router.push('/studio?upgraded=1');
                    router.refresh();
                },
                modal: { ondismiss: () => setBusy(false) },
            });
            checkout.open();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.');
            setBusy(false);
        }
    };

    return (
        <>
            <button type="button" onClick={() => void start()} disabled={busy} className={className}>
                {busy ? 'Opening checkout…' : children}
            </button>
            {error && <p role="alert" className="mt-2 text-center text-xs font-medium text-red-600">{error}</p>}
        </>
    );
}