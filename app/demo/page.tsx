import { createSupabaseServerClient } from '@/lib/supabase/server';
import DemoShowcaseClient from './DemoShowcaseClient';

export const metadata = { title: 'Product Demos & Showcase | Cliprame' };

export default async function DemoPage() {
    let userPlan = '';
    let isLoggedIn = false;
    let displayName = 'User';

    try {
        const supabase = await createSupabaseServerClient();
        if (supabase) {
            const { data: authData } = await supabase.auth.getClaims();
            if (authData?.claims?.sub) {
                isLoggedIn = true;
                const userId = authData.claims.sub;

                const [profileRes, subRes] = await Promise.all([
                    supabase.from('profiles').select('display_name,username').eq('id', userId).maybeSingle(),
                    supabase.from('subscriptions').select('status,current_period_end,plan_name').eq('user_id', userId).maybeSingle()
                ]);

                if (profileRes.data?.display_name) {
                    displayName = profileRes.data.display_name;
                } else if (authData.claims.email) {
                    displayName = String(authData.claims.email).split('@')[0];
                }

                if (subRes.data?.plan_name) {
                    userPlan = subRes.data.plan_name;
                }
            }
        }
    } catch (err) {
        console.error('Failed to resolve session on demo page:', err);
    }

    return (
        <DemoShowcaseClient
            isLoggedIn={isLoggedIn}
            userPlan={userPlan}
            displayName={displayName}
        />
    );
}