import { getStudioUser, LINK_COLUMNS, newSlug, toShareLink, type ShareLinkRow } from '@/lib/videos/server';

const fail = (error: string, status: number) => Response.json({ error }, { status });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const { data, error } = await user.supabase.from('share_links').select(LINK_COLUMNS).eq('video_id', id).order('created_at');
    if (error) return fail('Could not load links.', 500);
    return Response.json({ links: (data as ShareLinkRow[]).map(toShareLink) });
}

/** Creates a personal link for one recipient, so their views are attributed to them. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);

    const body = await request.json().catch(() => null) as { recipientName?: unknown; recipientEmail?: unknown; recipientCompany?: unknown } | null;
    const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
    const recipientName = clean(body?.recipientName, 120);
    const recipientEmail = clean(body?.recipientEmail, 254).toLowerCase();
    const recipientCompany = clean(body?.recipientCompany, 120);
    if (!recipientName && !recipientEmail) return fail('Add the recipient’s name or email.', 400);
    if (recipientEmail && !EMAIL.test(recipientEmail)) return fail('That email address doesn’t look right.', 400);

    const { data, error } = await user.supabase.from('share_links').insert({
        video_id: id,
        owner_id: user.id,
        slug: newSlug(),
        recipient_name: recipientName || null,
        recipient_email: recipientEmail || null,
        recipient_company: recipientCompany || null,
    }).select(LINK_COLUMNS).single();
    if (error || !data) {
        console.error('Could not create link:', error);
        return fail('Could not create the link.', 500);
    }
    return Response.json({ link: toShareLink(data as ShareLinkRow) });
}
