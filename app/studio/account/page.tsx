import { redirect } from 'next/navigation';
import { VideosShell } from '@/components/videos/VideosShell';
import { AccountSettings } from '@/components/account/AccountSettings';
import { getStudioUser } from '@/lib/videos/server';
import { loadAccountOverview } from '@/lib/studio/overview';

export const metadata = { title: 'Account | Cliprame' };

export default async function AccountPage() {
    const user = await getStudioUser();
    if (!user) redirect('/login?next=/studio/account');

    const [{ data: claims }, { data: profile }, overview] = await Promise.all([
        user.supabase.auth.getClaims(),
        user.supabase.from('profiles').select('display_name,username,avatar_path').eq('id', user.id).maybeSingle(),
        loadAccountOverview(user.supabase, user.id),
    ]);
    const email = typeof claims?.claims?.email === 'string' ? claims.claims.email : '';

    return (
        <VideosShell title="Account">
            <AccountSettings
                profile={{
                    name: profile?.display_name?.trim() || email.split('@')[0] || '',
                    username: profile?.username ?? '',
                    email,
                    avatarUrl: profile?.avatar_path ? user.supabase.storage.from('profile-avatars').getPublicUrl(profile.avatar_path).data.publicUrl : null,
                }}
                overview={overview}
            />
        </VideosShell>
    );
}
