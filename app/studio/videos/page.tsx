import { redirect } from 'next/navigation';
import { VideosShell } from '@/components/videos/VideosShell';
import { VideoLibrary } from '@/components/videos/VideoLibrary';
import { isR2Configured } from '@/lib/storage/r2';
import { getWorkspaceContext } from '@/lib/workspaces/server';
import { describeDbError, isMissingColumn, isMissingTable, listVideos, MISSING_COLUMNS_MESSAGE, MISSING_TABLES_MESSAGE } from '@/lib/videos/server';

export const metadata = { title: 'Videos | Cliprame' };

export default async function VideosPage() {
    const context = await getWorkspaceContext();
    if (!context) redirect('/login?next=/studio/videos');
    const result = await listVideos(context.user.supabase, context.active?.id)
        .then((videos) => ({ videos, setupMessage: null }))
        .catch((error) => {
            if (!isMissingTable(error) && !isMissingColumn(error)) console.error('Could not list videos:', describeDbError(error));
            return { videos: [], setupMessage: isMissingTable(error) ? MISSING_TABLES_MESSAGE : isMissingColumn(error) ? MISSING_COLUMNS_MESSAGE : null };
        });
    return (
        <VideosShell title="Videos">
            <VideoLibrary initialVideos={result.videos} hostingReady={isR2Configured()} setupMessage={result.setupMessage} />
        </VideosShell>
    );
}
