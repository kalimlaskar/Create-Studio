// Shared by the account page, the account menu and /api/account.

export interface Meter { used: number; limit: number }

export interface AccountOverview {
    plan: { id: string; name: string; isPaid: boolean; priceUsd: number; priceInr: number };
    /** Only for paid plans with a subscription record. */
    billing: { status: string; periodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
    ai: { transcription: Meter; voiceover: Meter; resetsOn: string };
    /** Hosted videos are what fills up: each plan allows a number of them. */
    videos: Meter;
    storage: { usedBytes: number; maxVideoBytes: number; maxVideoSeconds: number };
    isAdmin: boolean;
}

export const share = (meter: Meter) => (meter.limit > 0 ? Math.min(1, meter.used / meter.limit) : 0);

export function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
