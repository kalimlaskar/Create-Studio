import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { VideosShell } from '@/components/videos/VideosShell';
import { VideoDetail } from '@/components/videos/VideoDetail';
import { isR2Configured } from '@/lib/storage/r2';
import { isEmailConfigured } from '@/lib/videos/access';
import { getPlanSummary } from '@/lib/plans/server';
import { getStudioUser, LINK_COLUMNS, loadAnalytics, playbackUrl, posterUrl, toShareLink, toVideoRecord, VIDEO_COLUMNS, type ShareLinkRow, type VideoRow } from '@/lib/videos/server';

export const metadata = { title: 'Video | Cliprame' };

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) redirect(`/login?next=/studio/videos/${encodeURIComponent(id)}`);

    const { data: row } = /^[0-9a-f-]{36}$/.test(id)
        ? await user.supabase.from('videos').select(VIDEO_COLUMNS).eq('id', id).maybeSingle()
        : { data: null };
    if (!row) notFound();
    const video = row as VideoRow;

    if (video.status !== 'ready' || !isR2Configured()) {
        return (
            <VideosShell title={video.title}>
                <div className="rounded-3xl border border-[#14121F]/8 bg-white px-6 py-12 text-center">
                    <p className="font-semibold">{video.status !== 'ready' ? 'This upload didn’t finish.' : 'Video hosting isn’t set up on this server.'}</p>
                    <p className="mt-1 text-sm text-[#14121F]/60">{video.status !== 'ready' ? 'Delete it from your library and upload the video again.' : 'Add the R2 settings to play and share videos.'}</p>
                    <Link href="/studio/videos" className="mt-4 inline-block text-sm font-semibold text-[#6A4CFF] hover:underline">Back to videos</Link>
                </div>
            </VideosShell>
        );
    }

    const [{ data: links }, analytics, plan] = await Promise.all([
        user.supabase.from('share_links').select(LINK_COLUMNS).eq('video_id', id).order('created_at'),
        loadAnalytics(user.supabase, video),
        getPlanSummary(user.id),
    ]);

    return (
        <VideosShell title="Video">
            <VideoDetail
                initialVideo={toVideoRecord(video)}
                playbackUrl={playbackUrl(video)}
                posterUrl={posterUrl(video, 6 * 3600)}
                initialLinks={((links ?? []) as ShareLinkRow[]).map(toShareLink)}
                initialAnalytics={analytics}
                isPaid={plan.isPaid}
                emailCodesAvailable={isEmailConfigured()}
            />
        </VideosShell>
    );
}
