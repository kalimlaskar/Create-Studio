import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { LINK_COLUMNS, VIDEO_COLUMNS, type ShareLinkRow, type VideoRow } from './server';

const SLUG = /^[A-Za-z0-9_-]{10,32}$/;

/** Looks up an active share link and its ready video. Public pages use the service role, so nothing else is exposed. */
export async function findShare(slug: string) {
    if (!SLUG.test(slug)) return null;
    const admin = createSupabaseAdminClient();
    if (!admin) return null;

    const { data: link } = await admin.from('share_links').select(LINK_COLUMNS).eq('slug', slug).is('revoked_at', null).maybeSingle();
    if (!link) return null;
    const { data: video } = await admin.from('videos').select(VIDEO_COLUMNS).eq('id', link.video_id).eq('status', 'ready').is('banned_at', null).maybeSingle();
    if (!video) return null;
    // Nothing from a banned account is served.
    const { data: ban } = await admin.from('account_bans').select('user_id').eq('user_id', video.owner_id).maybeSingle();
    if (ban) return null;
    return { admin, link: link as ShareLinkRow, video: video as VideoRow };
}

export async function ownerDisplayName(ownerId: string) {
    const admin = createSupabaseAdminClient();
    const { data } = admin ? await admin.from('profiles').select('display_name').eq('id', ownerId).maybeSingle() : { data: null };
    return data?.display_name?.trim() || null;
}
