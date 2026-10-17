// Checks what an admin enters for a package. Pure, so it can be unit-tested.
import type { PlanLimit } from '@/components/pricing/planLimits';

export interface PlanInput {
    name: string;
    description: string;
    priceUsd: number;
    priceInr: number;
    isPublic: boolean;
    razorpayPlanId: string;
    limits: Omit<PlanLimit, 'name' | 'priceUsd' | 'priceInr'>;
}

export type CleanPlan = Omit<PlanInput, 'razorpayPlanId'> & { razorpayPlanId: string | null };

const whole = (value: unknown, min: number, max: number) => {
    const number = Math.round(Number(value));
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
};

/** A URL-safe id from a name: "Pro Annual" -> "pro-annual". */
export const planIdFrom = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'plan';

export function normalizePlanInput(input: unknown, { isFree }: { isFree: boolean }): { ok: true; plan: CleanPlan } | { ok: false; error: string } {
    const raw = (input ?? {}) as Record<string, unknown>;
    const limits = (raw.limits ?? {}) as Record<string, unknown>;

    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 40) : '';
    if (!name) return { ok: false, error: 'Give the package a name.' };
    const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 200) : '';

    const priceInr = whole(raw.priceInr, 0, 1_000_000);
    const priceUsd = Math.round(Number(raw.priceUsd) * 100) / 100;
    if (priceInr === null) return { ok: false, error: 'Enter the price in rupees as a whole number.' };
    if (!Number.isFinite(priceUsd) || priceUsd < 0 || priceUsd > 100_000) return { ok: false, error: 'Enter a valid price in dollars.' };
    if (isFree && (priceInr > 0 || priceUsd > 0)) return { ok: false, error: 'The Free package can’t have a price.' };
    if (!isFree && priceInr === 0) return { ok: false, error: 'A paid package needs a rupee price; Razorpay charges in rupees.' };

    const razorpayPlanId = typeof raw.razorpayPlanId === 'string' ? raw.razorpayPlanId.trim() : '';
    if (razorpayPlanId && !/^plan_[A-Za-z0-9]{6,40}$/.test(razorpayPlanId)) return { ok: false, error: 'A Razorpay plan ID starts with “plan_”.' };
    if (isFree && razorpayPlanId) return { ok: false, error: 'The Free package isn’t sold through Razorpay.' };

    const numbers = {
        exportSeconds: whole(limits.exportSeconds, 10, 4 * 3600),
        hostedVideos: whole(limits.hostedVideos, 0, 1_000_000),
        transcriptionMinutes: whole(limits.transcriptionMinutes, 0, 1_000_000),
        voiceoverMinutes: whole(limits.voiceoverMinutes, 0, 1_000_000),
        aiDailyRequests: whole(limits.aiDailyRequests, 0, 100_000),
        maxIntegrations: whole(limits.maxIntegrations, 0, 20),
        seats: whole(limits.seats, 1, 1000),
    };
    const labels: Record<keyof typeof numbers, string> = {
        exportSeconds: 'Longest video must be between 10 seconds and 4 hours.',
        hostedVideos: 'Enter how many videos can be hosted.',
        transcriptionMinutes: 'Enter transcription minutes per month.',
        voiceoverMinutes: 'Enter AI voiceover minutes per month.',
        aiDailyRequests: 'Enter AI requests per day.',
        maxIntegrations: 'Integrations must be between 0 and 20.',
        seats: 'Team seats must be between 1 and 1000.',
    };
    for (const key of Object.keys(numbers) as Array<keyof typeof numbers>) {
        if (numbers[key] === null) return { ok: false, error: labels[key] };
    }

    return {
        ok: true,
        plan: {
            name,
            description,
            priceInr,
            priceUsd,
            isPublic: raw.isPublic !== false,
            razorpayPlanId: razorpayPlanId || null,
            limits: {
                ...(numbers as Record<keyof typeof numbers, number>),
                watermark: limits.watermark === true,
                embedDomains: limits.embedDomains === true,
                protection: limits.protection === true,
                forms: limits.forms === true,
            },
        },
    };
}

/** Limits that got smaller, in words, so the admin sees what existing subscribers lose. */
export function reducedLimits(before: Omit<PlanLimit, 'name'>, after: CleanPlan['limits']) {
    const changes: string[] = [];
    const less = (key: keyof CleanPlan['limits'], label: string) => {
        const was = before[key as keyof typeof before];
        const now = after[key];
        if (typeof was === 'number' && typeof now === 'number' && now < was) changes.push(`${label}: ${was} → ${now}`);
    };
    less('hostedVideos', 'Videos hosted');
    less('exportSeconds', 'Longest video (seconds)');
    less('transcriptionMinutes', 'Transcription minutes');
    less('voiceoverMinutes', 'Voiceover minutes');
    less('aiDailyRequests', 'AI requests per day');
    less('maxIntegrations', 'Integrations');
    less('seats', 'Team seats');
    if (!before.watermark && after.watermark) changes.push('Watermark turned on');
    for (const [key, label] of [['protection', 'Video locks'], ['forms', 'Lead forms'], ['embedDomains', 'Embed domain limits']] as const) {
        if (before[key] && !after[key]) changes.push(`${label} turned off`);
    }
    return changes;
}
