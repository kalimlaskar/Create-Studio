import { ImageResponse } from 'next/og';
import { findShare } from '@/lib/videos/public';
import { posterUrl } from '@/lib/videos/server';
import { formatClock } from '@/lib/videos/types';

// A poster with a play button for emails and link previews. Email clients block
// video, so a clickable image is how "watch the video" is shown in an inbox.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const share = await findShare(slug);
    if (!share) return new Response('Not found', { status: 404 });
    const { video } = share;
    // A protected video's frame could give its content away in a link preview.
    const poster = video.access_mode === 'public' ? posterUrl(video, 600) : null;

    return new ImageResponse(
        (
            <div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%', background: 'linear-gradient(135deg, #1B1730, #3b2d8f)' }}>
                {poster && (
                    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                    <img src={poster} width={960} height={540} style={{ position: 'absolute', top: 0, left: 0, width: 960, height: 540, objectFit: 'cover' }} />
                )}
                <div style={{ position: 'absolute', top: 0, left: 0, width: 960, height: 540, display: 'flex', background: 'linear-gradient(to top, rgba(11,10,16,0.75), rgba(11,10,16,0.05) 55%)' }} />
                <div style={{ position: 'absolute', top: 210, left: 420, width: 120, height: 120, borderRadius: 60, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.35)' }}>
                    <div style={{ width: 0, height: 0, marginLeft: 10, borderTop: '22px solid transparent', borderBottom: '22px solid transparent', borderLeft: '36px solid #6A4CFF' }} />
                </div>
                <div style={{ position: 'absolute', left: 36, right: 36, bottom: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', color: '#fff', fontSize: 34, fontWeight: 700, maxWidth: 760 }}>{video.title.slice(0, 70)}</div>
                    <div style={{ display: 'flex', color: '#fff', fontSize: 24, fontWeight: 700, background: 'rgba(0,0,0,0.6)', padding: '6px 14px', borderRadius: 10 }}>{formatClock(video.duration_ms)}</div>
                </div>
            </div>
        ),
        { width: 960, height: 540, headers: { 'Cache-Control': 'public, max-age=600' } },
    );
}
