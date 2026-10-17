import { after } from 'next/server';
import { findShare } from '@/lib/videos/public';
import { ipHash } from '@/lib/videos/tracking';
import { reportReason } from '@/lib/admin/emails';
import { emailAdminsAboutReport } from '@/lib/admin/notify';

// Public: anyone watching a shared video can report it, without an account.
// The person in a harmful video often isn't a Cliprame user.

const REPORTS_PER_IP_PER_HOUR = 5;
const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(request: Request) {
    const body = await request.json().catch(() => null) as { slug?: unknown; reason?: unknown; details?: unknown; email?: unknown; website?: unknown } | null;
    if (!body || typeof body.slug !== 'string') return fail('Bad request.');
    const reason = reportReason(body.reason);
    if (!reason) return fail('Choose a reason.');
    // Bots fill in the invisible field; they get a normal answer and nothing is saved.
    if (typeof body.website === 'string' && body.website.trim()) return Response.json({ ok: true });

    const share = await findShare(body.slug);
    if (!share) return fail('This video isn’t available.', 404);
    const { admin, link, video } = share;

    const hashed = ipHash(request);
    if (hashed) {
        const { count } = await admin.from('content_reports').select('id', { count: 'exact', head: true })
            .eq('ip_hash', hashed).gt('created_at', new Date(Date.now() - 3600_000).toISOString());
        if ((count ?? 0) >= REPORTS_PER_IP_PER_HOUR) return fail('You’ve sent several reports. Please try again later, or email us.', 429);
    }

    const details = typeof body.details === 'string' ? body.details.trim().slice(0, 1000) || null : null;
    const email = typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ? body.email.trim().toLowerCase().slice(0, 254) : null;
    const { error } = await admin.from('content_reports').insert({
        video_id: video.id,
        share_link_id: link.id,
        reason: reason.id,
        details,
        reporter_email: email,
        ip_hash: hashed,
        urgent: reason.urgent,
    });
    if (error) {
        console.error('Could not save a content report:', error);
        return fail('Could not send your report. Please try again, or email us.', 500);
    }

    if (reason.urgent) {
        const adminUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, '')}/admin/reports`;
        after(() => emailAdminsAboutReport({ reason: reason.label, videoTitle: video.title, details, adminUrl }));
    }
    return Response.json({ ok: true });
}
