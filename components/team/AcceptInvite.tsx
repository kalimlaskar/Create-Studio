'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { focus } from '@/components/videos/ui';

export function AcceptInvite({ token }: { token: string }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const accept = async () => {
        setBusy(true);
        setError(null);
        const response = await fetch('/api/invites/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => null);
        const result = await response?.json().catch(() => null) as { error?: string } | null;
        if (!response?.ok) {
            setError(result?.error ?? 'Could not accept the invite. Check your connection and try again.');
            setBusy(false);
            return;
        }
        router.push('/studio/team?joined=1');
        router.refresh();
    };

    return (
        <div className="mt-6">
            <button type="button" onClick={accept} disabled={busy} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742] disabled:opacity-50 ${focus}`}>
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Join the workspace
            </button>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        </div>
    );
}
