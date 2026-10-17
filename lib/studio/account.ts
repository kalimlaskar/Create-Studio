import 'server-only';
import { cookies } from 'next/headers';
import { getPlanSummary } from '@/lib/plans/server';
import { SIDEBAR_COOKIE, type SidebarAccount } from '@/components/videos/StudioSidebar';
import { isAdminEmail } from '@/lib/admin/emails';
import { getWorkspaceContext } from '@/lib/workspaces/server';

/** Who's signed in, their plan and a couple of counts for the studio sidebar. Never throws. */
export async function loadSidebarAccount(): Promise<SidebarAccount | null> {
    try {
        const context = await getWorkspaceContext();
        if (!context) return null;
        const { user, active, workspaces } = context;
        const [{ data: claims }, { data: profile }, plan, videos, integrations] = await Promise.all([
            user.supabase.auth.getClaims(),
            user.supabase.from('profiles').select('display_name,username,avatar_path').eq('id', user.id).maybeSingle(),
            getPlanSummary(user.id),
            // The plan meter: videos this person made, in any workspace.
            user.supabase.from('videos').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
            active
                ? user.supabase.from('integrations').select('id', { count: 'exact', head: true }).eq('enabled', true).eq('workspace_id', active.id)
                : user.supabase.from('integrations').select('id', { count: 'exact', head: true }).eq('enabled', true),
        ]);
        const email = typeof claims?.claims?.email === 'string' ? claims.claims.email : null;
        return {
            name: profile?.display_name?.trim() || email?.split('@')[0] || 'Creator',
            handle: profile?.username ?? null,
            email,
            avatarUrl: profile?.avatar_path ? user.supabase.storage.from('profile-avatars').getPublicUrl(profile.avatar_path).data.publicUrl : null,
            plan: { id: plan.plan, name: plan.name, isPaid: plan.isPaid },
            videos: videos.count ?? 0,
            videoLimit: plan.limits.hostedVideos,
            liveIntegrations: integrations.count ?? 0,
            isAdmin: isAdminEmail(email, true),
            workspace: active ? { name: active.name, count: workspaces.length } : null,
        };
    } catch (error) {
        console.error('Could not load the sidebar account:', error);
        return null;
    }
}

/** Everything the sidebar needs from the server: the account and whether it was left collapsed. */
export async function loadSidebar() {
    const [account, cookieStore] = await Promise.all([loadSidebarAccount(), cookies()]);
    return { account, collapsed: cookieStore.get(SIDEBAR_COOKIE)?.value === 'collapsed' };
}
