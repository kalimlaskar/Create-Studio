import 'server-only';
import { createSupabaseServerClient } from './server';

function readLimit(name: string, fallback: number) {
    const configured = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(configured) && configured >= 0 ? configured : fallback;
}

/** Spends one daily AI credit. Returns a 429 Response when the limit is reached, otherwise null. */
export async function consumeAiCredit(): Promise<Response | null> {
    const supabase = await createSupabaseServerClient();
    // Demo auth (no Supabase configured) has no per-user storage, so it is not limited.
    if (!supabase) return null;

    const freeLimit = readLimit('AI_DAILY_LIMIT', 12);
    const proLimit = readLimit('AI_PRO_DAILY_LIMIT', 200);
    const { data, error } = await supabase.rpc('consume_ai_credit', { free_limit: freeLimit, pro_limit: proLimit });
    if (error) {
        return Response.json({ error: 'Could not check your AI usage. Please try again.' }, { status: 503 });
    }
    if (data === -1) {
        return Response.json(
            { error: `You've used today's AI requests. They reset at midnight UTC. Upgrade to Pro for much higher limits.`, code: 'AI_LIMIT_REACHED' },
            { status: 429 },
        );
    }
    return null;
}

export async function refundAiCredit() {
    const supabase = await createSupabaseServerClient();
    await supabase?.rpc('refund_ai_credit');
}
