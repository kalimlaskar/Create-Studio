'use client';

import { useState } from 'react';

interface RazorpayResponse { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }
declare global {
    interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }
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

export function UpgradeButton({ className, children = 'Upgrade to Pro' }: { className?: string; children?: React.ReactNode }) {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const start = async () => {
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch('/api/billing/subscribe', { method: 'POST' });
            if (res.status === 401) { window.location.href = '/login?next=/pricing'; return; }
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Could not start checkout.');
            if (!await loadCheckout() || !window.Razorpay) throw new Error('Could not load the payment window.');
            const checkout = new window.Razorpay({
                key: data.keyId,
                subscription_id: data.subscriptionId,
                name: 'Cliprame',
                description: 'Cliprame Pro',
                prefill: { email: data.email },
                theme: { color: '#6366f1' },
                handler: async (response: RazorpayResponse) => {
                    const verify = await fetch('/api/billing/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(response) });
                    if (verify.ok) { window.location.href = '/studio'; return; }
                    setMessage('Payment received, but we could not confirm it yet. It will unlock shortly.');
                    setBusy(false);
                },
                modal: { ondismiss: () => setBusy(false) },
            });
            checkout.open();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Something went wrong.');
            setBusy(false);
        }
    };

    return (
        <>
            <button type="button" onClick={() => void start()} disabled={busy} className={className}>{busy ? 'Opening checkout…' : children}</button>
            {message && <p role="alert" className="mt-2 text-xs text-amber-300">{message}</p>}
        </>
    );
}
