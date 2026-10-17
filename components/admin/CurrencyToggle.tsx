'use client';

import { useTransition } from 'react';
import { setAdminCurrencyAction } from '@/app/admin/actions';

/** $ / ₹ switch for every money figure on the admin dashboard. */
export function CurrencyToggle({ currency, rateText }: { currency: 'usd' | 'inr'; rateText: string }) {
    const [pending, start] = useTransition();
    const choose = (next: 'usd' | 'inr') => start(async () => { await setAdminCurrencyAction(next); });
    return (
        <div className="flex items-center gap-2">
            <div role="group" aria-label="Currency" className={`flex rounded-lg bg-[#14121F]/[0.06] p-0.5 transition ${pending ? 'opacity-60' : ''}`}>
                {([['usd', '$ USD'], ['inr', '₹ INR']] as const).map(([id, text]) => (
                    <button key={id} type="button" aria-pressed={currency === id} onClick={() => choose(id)} className={`rounded-md px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 ${currency === id ? 'bg-white text-[#14121F] shadow-sm' : 'text-[#14121F]/55 hover:text-[#14121F]'}`}>{text}</button>
                ))}
            </div>
            <span className="hidden text-[11px] text-[#14121F]/45 lg:inline" title="Converted at this rate">{rateText}</span>
        </div>
    );
}
