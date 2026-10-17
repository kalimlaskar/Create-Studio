import 'server-only';
import { cookies } from 'next/headers';

// Money on the admin dashboard, in dollars or rupees. Prices and Gemini costs are in
// USD; rupees use today's ECB rate (via Frankfurter), refreshed once a day.

export type Currency = 'usd' | 'inr';
export const CURRENCY_COOKIE = 'cliprame-admin-currency';

/** Used only if the rate service can't be reached. Override with USD_TO_INR. */
const FALLBACK_RATE = Number(process.env.USD_TO_INR) || 95;

export interface Rate { inrPerUsd: number; date: string | null; live: boolean }

export async function usdToInr(): Promise<Rate> {
    try {
        const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR', { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) });
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json() as { date?: string; rates?: { INR?: number } };
        const rate = Number(data.rates?.INR);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error('No INR rate');
        return { inrPerUsd: rate, date: data.date ?? null, live: true };
    } catch {
        return { inrPerUsd: FALLBACK_RATE, date: null, live: false };
    }
}

export function formatMoney(usd: number, currency: Currency, rate: Rate) {
    if (currency === 'inr') {
        const inr = usd * rate.inrPerUsd;
        return `₹${inr.toLocaleString('en-IN', { maximumFractionDigits: inr < 100 ? 2 : 0 })}`;
    }
    return `$${usd.toLocaleString('en-US', { maximumFractionDigits: usd < 100 ? 2 : 0 })}`;
}

/** Formats an amount that has its own price in each currency (like plan revenue): no conversion. */
export function formatPrice(amount: { usd: number; inr: number }, currency: Currency) {
    return currency === 'inr' ? `₹${amount.inr.toLocaleString('en-IN')}` : `$${amount.usd.toLocaleString('en-US')}`;
}

/** The admin's chosen currency and today's rate, with ready formatters. */
export async function adminMoney() {
    const [store, rate] = await Promise.all([cookies(), usdToInr()]);
    const currency: Currency = store.get(CURRENCY_COOKIE)?.value === 'inr' ? 'inr' : 'usd';
    return {
        currency,
        rate,
        /** Converts a USD amount (Gemini costs) at today's rate. */
        money: (usd: number) => formatMoney(usd, currency, rate),
        /** Shows a price that's set in both currencies. */
        price: (amount: { usd: number; inr: number }) => formatPrice(amount, currency),
    };
}
