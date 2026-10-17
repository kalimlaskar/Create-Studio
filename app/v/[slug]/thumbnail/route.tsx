import { ImageResponse } from 'next/og';
import { findShare } from '@/lib/videos/public';
import { posterUrl } from '@/lib/videos/server';
import { formatClock } from '@/lib/videos/types';
import { Thumbnail, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '@/lib/videos/thumbnail';

// A poster with a play button for emails and link previews. Email clients block
// video, so a clickable image is how "watch the video" is shown in an inbox.
// Personal links greet the recipient by name; the sender's face and name sit at the bottom.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const share = await findShare(slug);
    if (!share) return new Response('Not found', { status: 404 });
    const { admin, link, video } = share;
    // A protected video's frame could give its content away in a link preview.
    const poster = video.access_mode === 'public' ? posterUrl(video, 600) : null;

    const { data: profile } = await admin.from('profiles').select('display_name,avatar_path').eq('id', video.owner_id).maybeSingle();
    const sender = profile?.display_name?.trim() || null;
    const avatar = profile?.avatar_path && !/\.webp$/i.test(profile.avatar_path)
        ? admin.storage.from('profile-avatars').getPublicUrl(profile.avatar_path).data.publicUrl
        : null;
    const firstName = link.recipient_name?.trim().split(/\s+/)[0] || null;
    // A personal link without a name (only an email) still reads as personal.
    const personal = Boolean(link.recipient_name || link.recipient_email);
    const greeting = firstName ? `Hi ${firstName.slice(0, 24)}, I made this for you` : personal ? 'I made this for you' : sender ? `A video from ${sender.slice(0, 40)}` : null;

    return new ImageResponse(
        <Thumbnail title={video.title} duration={formatClock(video.duration_ms)} poster={poster} greeting={greeting} sender={sender} avatar={avatar} />,
        { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT, headers: { 'Cache-Control': 'public, max-age=600' } },
    );
}
