'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, Eye, Film, LoaderCircle, Trash2, Upload, X } from 'lucide-react';
import { uploadVideo, videoApi, type UploadStage } from '@/lib/videos/upload';
import { formatClock, MAX_UPLOAD_BYTES, type VideoListItem } from '@/lib/videos/types';
import { track } from '@/lib/analytics';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6FB]';
const D = 'font-[family-name:var(--font-display)]';

const STAGE_LABEL: Record<UploadStage, string> = {
    preparing: 'Reading the video…',
    converting: 'Converting to MP4 so it plays everywhere…',
    uploading: 'Uploading…',
    finishing: 'Finishing up…',
};

function timeAgo(iso: string) {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return days < 30 ? `${days} d ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function VideoLibrary({ initialVideos, hostingReady, setupMessage = null }: { initialVideos: VideoListItem[]; hostingReady: boolean; setupMessage?: string | null }) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const [videos, setVideos] = useState(initialVideos);
    const [upload, setUpload] = useState<{ name: string; stage: UploadStage; progress: number } | null>(null);
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const start = async (file: File) => {
        setError('');
        if (!file.type.startsWith('video/')) return setError('Choose a video file (MP4 or WebM).');
        if (file.size > MAX_UPLOAD_BYTES) return setError('Videos can be up to 2 GB.');
        const name = file.name.replace(/\.[^.]+$/, '') || 'Untitled video';
        const controller = new AbortController();
        abortRef.current = controller;
        setUpload({ name, stage: 'preparing', progress: 0 });
        try {
            const { video } = await uploadVideo(file, name, {
                signal: controller.signal,
                onStage: (stage) => setUpload((current) => current && { ...current, stage, progress: 0 }),
                onProgress: (progress) => setUpload((current) => current && { ...current, progress }),
            });
            track('video_uploaded');
            router.push(`/studio/videos/${video.id}`);
        } catch (uploadError) {
            setUpload(null);
            if ((uploadError as Error).name !== 'AbortError') setError((uploadError as Error).message);
            router.refresh();
        }
    };

    const copyLink = async (video: VideoListItem) => {
        if (!video.defaultSlug) return;
        await navigator.clipboard.writeText(`${window.location.origin}/v/${video.defaultSlug}`);
        setCopied(video.id);
        setTimeout(() => setCopied(null), 1800);
    };

    const remove = async (video: VideoListItem) => {
        if (!window.confirm(`Delete "${video.title}"? Its share links and analytics are deleted too.`)) return;
        try {
            await videoApi(`/api/videos/${video.id}`, { method: 'DELETE' });
            setVideos((list) => list.filter((item) => item.id !== video.id));
        } catch (deleteError) {
            setError((deleteError as Error).message);
        }
    };

    return (
        <div className="space-y-8">
            <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" aria-label="Choose a video to upload" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void start(file); }} />

            {setupMessage && (
                <div role="status" className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">{setupMessage}</div>
            )}
            {!hostingReady && (
                <div role="status" className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Video hosting isn’t set up on this server yet. Add the <code className="font-mono text-xs">R2_*</code> settings to <code className="font-mono text-xs">.env.local</code> to upload and share videos.
                </div>
            )}

            {upload ? (
                <section aria-live="polite" className="rounded-3xl border border-[#14121F]/8 bg-white p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="truncate font-semibold">{upload.name}</p>
                            <p className="mt-1 flex items-center gap-2 text-sm text-[#14121F]/60"><LoaderCircle className="h-4 w-4 animate-spin" /> {STAGE_LABEL[upload.stage]}</p>
                        </div>
                        <button type="button" onClick={() => abortRef.current?.abort()} className={`inline-flex items-center gap-1.5 rounded-full border border-[#14121F]/15 px-3 py-1.5 text-xs font-semibold hover:bg-[#F7F6FB] ${focus}`}><X className="h-3.5 w-3.5" /> Cancel</button>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#6A4CFF]/10" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(upload.progress * 100)}>
                        <div className="h-full rounded-full bg-[#6A4CFF] transition-[width] duration-300" style={{ width: `${Math.round(upload.progress * 100)}%` }} />
                    </div>
                </section>
            ) : (
                <button
                    type="button"
                    disabled={!hostingReady || Boolean(setupMessage)}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void start(file); }}
                    className={`flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition disabled:cursor-not-allowed disabled:opacity-50 ${dragging ? 'border-[#6A4CFF] bg-[#6A4CFF]/5' : 'border-[#14121F]/12 bg-white hover:border-[#6A4CFF]/50'} ${focus}`}>
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6A4CFF]/10 text-[#6A4CFF]"><Upload className="h-5 w-5" /></span>
                    <span className={`${D} text-lg font-bold`}>Upload a video to share</span>
                    <span className="max-w-md text-sm text-[#14121F]/60">Drop an MP4 or WebM here, or click to choose. Recordings are converted to MP4 so they play on every device. Up to 2 GB.</span>
                </button>
            )}
            {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}

            <section aria-labelledby="library-title">
                <h2 id="library-title" className={`${D} text-xl font-bold tracking-tight`}>Your videos</h2>
                {videos.length === 0 ? (
                    <div className="mt-4 rounded-3xl border border-dashed border-[#14121F]/15 bg-white px-6 py-12 text-center">
                        <Film className="mx-auto h-6 w-6 text-[#14121F]/35" />
                        <p className="mt-3 text-sm font-semibold">No videos yet</p>
                        <p className="mt-1 text-sm text-[#14121F]/55">Upload one to get a share link with chapters and viewer analytics.</p>
                    </div>
                ) : (
                    <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {videos.map((video) => (
                            <li key={video.id} className="group overflow-hidden rounded-3xl border border-[#14121F]/8 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(20,18,31,0.4)]">
                                <Link href={`/studio/videos/${video.id}`} className={`block ${focus}`}>
                                    <div className="relative aspect-video bg-[linear-gradient(135deg,#1B1730,#3b2d8f)]">
                                        {video.posterUrl && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={video.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                                        )}
                                        {video.status === 'ready' ? (
                                            <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white">{formatClock(video.durationMs)}</span>
                                        ) : (
                                            <span className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-semibold text-white">Upload didn’t finish</span>
                                        )}
                                    </div>
                                    <div className="px-4 pb-1 pt-3.5">
                                        <p className="truncate font-semibold">{video.title}</p>
                                        <p className="mt-1 flex items-center gap-1.5 text-xs text-[#14121F]/55">
                                            <Eye className="h-3.5 w-3.5" />
                                            {video.views} {video.views === 1 ? 'view' : 'views'} · {video.uniqueViewers} {video.uniqueViewers === 1 ? 'viewer' : 'viewers'} · {timeAgo(video.createdAt)}
                                        </p>
                                    </div>
                                </Link>
                                <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
                                    {video.defaultSlug && video.status === 'ready' ? (
                                        <button type="button" onClick={() => void copyLink(video)} className={`inline-flex items-center gap-1.5 rounded-full bg-[#F7F6FB] px-3 py-1.5 text-xs font-semibold transition hover:bg-[#6A4CFF]/10 hover:text-[#6A4CFF] ${focus}`}>
                                            {copied === video.id ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
                                        </button>
                                    ) : <span />}
                                    <button type="button" onClick={() => void remove(video)} aria-label={`Delete ${video.title}`} className={`rounded-lg p-2 text-[#14121F]/35 transition hover:bg-red-50 hover:text-red-600 ${focus}`}><Trash2 className="h-4 w-4" /></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
