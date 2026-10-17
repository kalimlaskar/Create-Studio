// The email thumbnail's design (rendered by app/v/[slug]/thumbnail with next/og).
// Kept free of server imports so it can be previewed with sample data.

export const THUMBNAIL_WIDTH = 960;
export const THUMBNAIL_HEIGHT = 540;

export interface ThumbnailProps {
    title: string;
    duration: string;
    /** A frame from the video, or null for protected videos and videos without one. */
    poster: string | null;
    /** "Hi Ana, I made this for you" on personal links. */
    greeting: string | null;
    sender: string | null;
    /** PNG or JPEG; the renderer can't read WebP. */
    avatar: string | null;
}

export function Thumbnail({ title, duration, poster, greeting, sender, avatar }: ThumbnailProps) {
    const W = THUMBNAIL_WIDTH;
    const H = THUMBNAIL_HEIGHT;
    return (
        <div style={{ position: 'relative', display: 'flex', width: W, height: H, background: 'linear-gradient(135deg, #1B1730 0%, #3b2d8f 55%, #6A4CFF 100%)', fontFamily: 'sans-serif' }}>
            {poster && (
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                <img src={poster} width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }} />
            )}
            {/* Darker at the top and bottom so the labels read on any frame. */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', background: 'linear-gradient(180deg, rgba(11,10,16,0.55) 0%, rgba(11,10,16,0) 28%, rgba(11,10,16,0) 52%, rgba(11,10,16,0.88) 100%)' }} />

            {greeting && (
                <div style={{ position: 'absolute', top: 32, left: 32, display: 'flex', alignItems: 'center', padding: '12px 22px', borderRadius: 999, background: 'rgba(255,255,255,0.96)', color: '#14121F', fontSize: 26, fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
                    <div style={{ display: 'flex', width: 12, height: 12, marginRight: 12, borderRadius: 6, background: '#22C55E' }} />
                    {greeting}
                </div>
            )}

            {/* Play button with a soft halo. A drawn path, because CSS border triangles don't render here. */}
            <div style={{ position: 'absolute', top: H / 2 - 92, left: W / 2 - 92, width: 184, height: 184, borderRadius: 92, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.22)' }}>
                <div style={{ width: 132, height: 132, borderRadius: 66, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', boxShadow: '0 24px 50px rgba(0,0,0,0.4)' }}>
                    <svg width="56" height="56" viewBox="0 0 24 24" style={{ marginLeft: 8 }}>
                        <path d="M6 4.5v15a1 1 0 0 0 1.52.85l12.2-7.5a1 1 0 0 0 0-1.7L7.52 3.65A1 1 0 0 0 6 4.5Z" fill="#6A4CFF" />
                    </svg>
                </div>
            </div>

            <div style={{ position: 'absolute', left: 32, right: 32, bottom: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', maxWidth: 760 }}>
                    {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                        <img src={avatar} width={72} height={72} style={{ width: 72, height: 72, borderRadius: 36, objectFit: 'cover', border: '3px solid #ffffff' }} />
                    ) : sender ? (
                        <div style={{ width: 72, height: 72, borderRadius: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #6A4CFF, #C04CFF)', border: '3px solid #ffffff', color: '#ffffff', fontSize: 32, fontWeight: 700 }}>
                            {sender.charAt(0).toUpperCase()}
                        </div>
                    ) : null}
                    <div style={{ display: 'flex', flexDirection: 'column', marginLeft: avatar || sender ? 20 : 0 }}>
                        <div style={{ display: 'flex', color: '#ffffff', fontSize: 36, fontWeight: 700, lineHeight: 1.15 }}>{title.slice(0, 60)}</div>
                        {sender && <div style={{ display: 'flex', marginTop: 6, color: 'rgba(255,255,255,0.78)', fontSize: 22 }}>{sender.slice(0, 40)}</div>}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', color: '#ffffff', fontSize: 24, fontWeight: 700, background: 'rgba(11,10,16,0.7)', padding: '8px 16px', borderRadius: 12 }}>
                    {duration}
                </div>
            </div>
        </div>
    );
}
