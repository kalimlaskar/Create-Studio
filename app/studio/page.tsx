import { redirect } from 'next/navigation';
import { CreatorStudioDashboard } from '@/components/studio/CreatorStudioDashboard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DEMO_SESSION_COOKIE, getDemoSessionUsername, isDemoAuthEnabled, verifyDemoSessionToken } from '@/lib/auth/demo';
import { isEntitled } from '@/lib/billing/subscription';
import { cookies } from 'next/headers';

export const metadata = { title: 'Your studio | Cliprame' };

export default async function StudioPage() {
    const cookieStore = await cookies();
    const demoToken = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
    if (isDemoAuthEnabled()) {
        if (verifyDemoSessionToken(demoToken)) return <CreatorStudioDashboard userEmail={`${getDemoSessionUsername(demoToken) ?? 'tester'} · test account`} />;
        redirect('/login?setup=1');
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        redirect('/login?setup=1');
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) redirect('/login?setup=1');
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) redirect('/login');
    const userEmail = typeof data.claims.email === 'string' ? data.claims.email : '';
    const { data: profile } = await supabase
        .from('profiles')
        .select('display_name,username,avatar_path')
        .eq('id', data.claims.sub)
        .maybeSingle();
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status,current_period_end')
        .eq('user_id', data.claims.sub)
        .maybeSingle();
    const isPro = isEntitled(subscription);
    const userMetadata = data.claims.user_metadata as Record<string, unknown> | undefined;
    const metadataDisplayName = typeof userMetadata?.display_name === 'string' ? userMetadata.display_name : '';
    const initialDisplayName = typeof profile?.display_name === 'string' && profile.display_name.trim()
        ? profile.display_name
        : metadataDisplayName;
    const initialAvatarUrl = typeof profile?.avatar_path === 'string'
        ? supabase.storage.from('profile-avatars').getPublicUrl(profile.avatar_path).data.publicUrl
        : '';
    return <CreatorStudioDashboard userEmail={userEmail} initialDisplayName={initialDisplayName} initialUsername={profile?.username ?? ''} initialAvatarUrl={initialAvatarUrl} profilePersistenceEnabled isPro={isPro} />;
}