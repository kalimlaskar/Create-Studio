import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPlanSummary } from '@/lib/plans/server';

export interface MarketingSession {
    isLoggedIn: boolean;
    displayName: string;
    /** The paid plan's name, or empty on Free. */
    userPlan: string;
}

/** Who's looking at a marketing page, for the header. Never throws. */
export async function getMarketingSession(): Promise<MarketingSession> {
    const session: MarketingSession = { isLoggedIn: false, displayName: 'User', userPlan: '' };
    try {
        const supabase = await createSupabaseServerClient();
        if (!supabase) return session;
        const { data } = await supabase.auth.getClaims();
        const userId = data?.claims?.sub;
        if (!userId) return session;
        session.isLoggedIn = true;
        const [profile, plan] = await Promise.all([
            supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
            // The plan comes only from the subscription record on the server.
            getPlanSummary(userId).catch(() => null),
        ]);
        session.displayName = profile.data?.display_name || (data.claims.email ? String(data.claims.email).split('@')[0] : 'User');
        if (plan?.isPaid) session.userPlan = plan.name;
    } catch (error) {
        // Let Next's own signals through, such as the one that marks this page as rendered per request.
        unstable_rethrow(error);
        console.error('Could not resolve the session for a marketing page:', error);
    }
    return session;
}
