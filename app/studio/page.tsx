import { redirect } from 'next/navigation';
import { CreatorStudioDashboard } from '@/components/studio/CreatorStudioDashboard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DEMO_SESSION_COOKIE, isDemoAuthEnabled, verifyDemoSessionToken } from '@/lib/auth/demo';
import { cookies } from 'next/headers';

export const metadata = { title: 'Your studio | CreatorStudio' };

export default async function StudioPage() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        const cookieStore = await cookies();
        const demoToken = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
        if (isDemoAuthEnabled() && verifyDemoSessionToken(demoToken)) return <CreatorStudioDashboard userEmail="teacher · local demo" />;
        redirect('/login?setup=1');
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) redirect('/login?setup=1');
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) redirect('/login');
    const userEmail = typeof data.claims.email === 'string' ? data.claims.email : '';
    return <CreatorStudioDashboard userEmail={userEmail} />;
}
