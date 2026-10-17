/** A package's id, e.g. "free", "creator", "studio", or one an admin created. */
export type PlanId = string;

export interface PlanLimit {
    name: string;
    /** Monthly price in USD. */
    priceUsd: number;
    /** Monthly price in INR (placeholder until final pricing). Used for revenue in rupees. */
    priceInr: number;
    /** Longest export, in seconds. */
    exportSeconds: number;
    watermark: boolean;
    /** Minutes of audio that can be transcribed per month (captions and edit by text). */
    transcriptionMinutes: number;
    /** Minutes of AI voiceover that can be generated per month. */
    voiceoverMinutes: number;
    /** Videos that can be hosted with share links and analytics at once. */
    hostedVideos: number;
    /** AI script and reel-caption requests per day. */
    aiDailyRequests: number;
    /** Can limit embeds to their own websites. */
    embedDomains: boolean;
    /** Can lock videos with a PIN, password or email code. */
    protection: boolean;
    /** Can add forms (lead capture) to videos. */
    forms: boolean;
    /** Slack, HubSpot and webhook connections allowed. */
    maxIntegrations: number;
}

/**
 * Worst-case AI cost per user per month, using $0.04 per transcription minute
 * and $0.018 per voiceover minute (January 2027 Gemini rates):
 *   free    ≈ $0.45   (cost to us)
 *   creator ≈ $4.15   (about $9.60 margin after ~$1.25 payment fees)
 *   studio  ≈ $11.80  (about $22 margin after fees)
 * Re-check these numbers whenever Gemini prices change.
 */
/**
 * The built-in packages. Admins manage packages in the database (public.plans,
 * /admin/plans); these are the starting values and the fallback when that table
 * isn't there yet.
 */
export const PLAN_LIMITS: Record<PlanId, PlanLimit> = {
    free: { name: 'Free', priceUsd: 0, priceInr: 0, exportSeconds: 60, watermark: true, transcriptionMinutes: 10, voiceoverMinutes: 2, hostedVideos: 5, aiDailyRequests: 12, embedDomains: false, protection: true, forms: true, maxIntegrations: 20 },
    creator: { name: 'Creator', priceUsd: 15, priceInr: 1500, exportSeconds: 300, watermark: false, transcriptionMinutes: 90, voiceoverMinutes: 30, hostedVideos: 100, aiDailyRequests: 200, embedDomains: true, protection: true, forms: true, maxIntegrations: 20 },
    studio: { name: 'Studio', priceUsd: 35, priceInr: 3500, exportSeconds: 900, watermark: false, transcriptionMinutes: 250, voiceoverMinutes: 100, hostedVideos: 500, aiDailyRequests: 200, embedDomains: true, protection: true, forms: true, maxIntegrations: 20 },
};

/** A package as the app uses it: limits plus what the admin set around them. */
export interface CatalogPlan extends PlanLimit {
    id: PlanId;
    description: string | null;
    /** Shown on the pricing page. Hidden packages can still be assigned to existing subscribers. */
    isPublic: boolean;
    /** No new subscriptions; existing ones keep working. */
    archived: boolean;
    sortOrder: number;
    /** The Razorpay plan new subscriptions use. */
    razorpayPlanId: string | null;
    /** Earlier Razorpay plans (before a price change) whose subscribers are still on this package. */
    legacyRazorpayPlanIds: string[];
}

export const DEFAULT_CATALOG: CatalogPlan[] = Object.entries(PLAN_LIMITS).map(([id, limits], index) => ({
    ...limits,
    id,
    description: null,
    isPublic: true,
    archived: false,
    sortOrder: index,
    razorpayPlanId: null,
    legacyRazorpayPlanIds: [],
}));

export const isPaidPlan = (plan: Pick<PlanLimit, 'priceUsd' | 'priceInr'>) => plan.priceUsd > 0 || plan.priceInr > 0;

/**
 * Largest upload a plan accepts. Exports are about 8 Mbps (1 MB a second) at 1080p,
 * so this leaves headroom while stopping a long video from passing as a short one.
 */
export const maxUploadBytes = (plan: PlanLimit) => Math.round(plan.exportSeconds * 1.25 * 1024 * 1024 + 8 * 1024 * 1024);

export const PLAN_ORDER: PlanId[] = ['free', 'creator', 'studio'];

export const formatUsd = (amount: number) => `$${amount}`;

export const exportLabel = (plan: PlanLimit) => {
    const minutes = plan.exportSeconds / 60;
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
};

export const watermarkLabel = (plan: PlanLimit) => (plan.watermark ? 'Cliprame watermark' : 'None');