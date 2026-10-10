export type PlanId = 'free' | 'creator' | 'studio';

export interface PlanLimit {
    name: string;
    /** Monthly price in USD. */
    priceUsd: number;
    /** Longest export, in seconds. */
    exportSeconds: number;
    watermark: boolean;
    /** Minutes of audio that can be transcribed per month (captions and edit by text). */
    transcriptionMinutes: number;
    /** Minutes of AI voiceover that can be generated per month. */
    voiceoverMinutes: number;
}

/**
 * Worst-case AI cost per user per month, using $0.04 per transcription minute
 * and $0.018 per voiceover minute (January 2027 Gemini rates):
 *   free    ≈ $0.45   (cost to us)
 *   creator ≈ $4.15   (about $9.60 margin after ~$1.25 payment fees)
 *   studio  ≈ $11.80  (about $22 margin after fees)
 * Re-check these numbers whenever Gemini prices change.
 */
export const PLAN_LIMITS: Record<PlanId, PlanLimit> = {
    free: { name: 'Free', priceUsd: 0, exportSeconds: 60, watermark: true, transcriptionMinutes: 10, voiceoverMinutes: 2 },
    creator: { name: 'Creator', priceUsd: 15, exportSeconds: 300, watermark: false, transcriptionMinutes: 90, voiceoverMinutes: 30 },
    studio: { name: 'Studio', priceUsd: 35, exportSeconds: 900, watermark: false, transcriptionMinutes: 250, voiceoverMinutes: 100 },
};

export const PLAN_ORDER: PlanId[] = ['free', 'creator', 'studio'];

export const formatUsd = (amount: number) => `$${amount}`;

export const exportLabel = (plan: PlanLimit) => {
    const minutes = plan.exportSeconds / 60;
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
};

export const watermarkLabel = (plan: PlanLimit) => (plan.watermark ? 'Cliprame watermark' : 'None');