import { redirect } from 'next/navigation';
import { CreatorStudioDashboard } from '@/components/studio/CreatorStudioDashboard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DEMO_SESSION_COOKIE, getDemoSessionUsername, isDemoAuthEnabled, verifyDemoSessionToken } from '@/lib/auth/demo';
import { getPlanSummary } from '@/lib/plans/server';
import { cookies } from 'next/headers';

export const metadata = { title: 'Your studio | Cliprame' };

type StudioPageProps = { searchParams: Promise<{ import?: string; recording?: string }> };

export default async function StudioPage({ searchParams }: StudioPageProps) {
    const params = await searchParams;
    // Keep an extension import link through sign-in, so the recording still opens afterwards.
    const importPath = params.import === 'extension' && params.recording && /^[\w-]{1,64}$/.test(params.recording)
        ? `/studio?import=extension&recording=${params.recording}`
        : null;
    const loginUrl = importPath ? `/login?next=${encodeURIComponent(importPath)}` : '/login';
    const cookieStore = await cookies();
    const demoToken = cookieStore.get(DEMO_SESSION_COOKIE)?.value;

    if (isDemoAuthEnabled()) {
        if (verifyDemoSessionToken(demoToken)) {
            const demoEmail = `${getDemoSessionUsername(demoToken) ?? 'tester'} · test account`;
            return <CreatorStudioDashboard userEmail={demoEmail} userPlan="Free" isPro={false} />;
        }
        redirect('/login?setup=1');
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        redirect('/login?setup=1');
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) redirect('/login?setup=1');

    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) redirect(loginUrl);

    const userId = data.claims.sub;
    const userEmail = typeof data.claims.email === 'string' ? data.claims.email : '';

    const { data: profile } = await supabase
        .from('profiles')
        .select('display_name,username,avatar_path')
        .eq('id', userId)
        .maybeSingle();

    // The plan comes only from the subscription record on the server, never from the browser.
    const plan = await getPlanSummary(userId);

    const userMetadata = data.claims.user_metadata as Record<string, unknown> | undefined;
    const metadataDisplayName = typeof userMetadata?.display_name === 'string' ? userMetadata.display_name : '';
    const initialDisplayName = typeof profile?.display_name === 'string' && profile.display_name.trim()
        ? profile.display_name
        : metadataDisplayName;

    const initialAvatarUrl = typeof profile?.avatar_path === 'string'
        ? supabase.storage.from('profile-avatars').getPublicUrl(profile.avatar_path).data.publicUrl
        : '';

    return (
        <CreatorStudioDashboard
            userEmail={userEmail}
            initialDisplayName={initialDisplayName}
            initialUsername={profile?.username ?? ''}
            initialAvatarUrl={initialAvatarUrl}
            profilePersistenceEnabled
            isPro={plan.isPaid}
            userPlan={plan.name}
            planId={plan.plan}
        />
    );
}