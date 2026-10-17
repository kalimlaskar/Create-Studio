'use client';

import { useRef, useState } from 'react';
import { Check, ImageUp, LoaderCircle, ScanLine } from 'lucide-react';
import { videoApi } from '@/lib/videos/upload';
import type { VideoRecord } from '@/lib/videos/types';

// Pick the thumbnail shown on share pages, embeds, link previews and the email snippet:
// either the frame the player is on, or an image the user uploads.

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
const button = `inline-flex items-center gap-1.5 rounded-full border border-[#14121F]/12 bg-white px-3 py-1.5 text-xs font-semibold transition hover:border-[#14121F]/30 disabled:opacity-50 ${focus}`;
const MAX_WIDTH = 1280;

/** Draws the source to fill the given shape (cropping the edges, like object-fit: cover) and returns a JPEG. */
function toJpeg(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, aspect: number) {
    const width = Math.min(MAX_WIDTH, sourceWidth >= sourceHeight * aspect ? Math.round(sourceHeight * aspect) : sourceWidth);
    const height = Math.round(width / aspect);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser couldn’t make the thumbnail.');
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Your browser couldn’t make the thumbnail.'))), 'image/jpeg', 0.86));
}

/**
 * The frame at `seconds`, read from a separate copy of the video loaded with CORS, so the
 * picture can be saved (the visible player isn't, and stays untouched if this fails).
 */
async function captureFrame(src: string, seconds: number) {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    const once = (event: string) => new Promise<void>((resolve, reject) => {
        video.addEventListener(event, () => resolve(), { once: true });
        video.addEventListener('error', () => reject(new Error('Couldn’t read the video to take a frame. Upload an image instead.')), { once: true });
    });
    try {
        video.src = src;
        await once('loadedmetadata');
        video.currentTime = Math.min(Math.max(seconds, 0.05), Math.max(video.duration - 0.05, 0));
        await once('seeked');
        return await toJpeg(video, video.videoWidth, video.videoHeight, video.videoWidth / video.videoHeight);
    } catch (error) {
        if (error instanceof DOMException && error.name === 'SecurityError') throw new Error('Couldn’t take a frame: the storage bucket doesn’t allow it (check its CORS settings). Upload an image instead.');
        throw error;
    } finally {
        video.removeAttribute('src');
        video.load();
    }
}

export function ThumbnailEditor({ videoId, playbackUrl, posterUrl, player, onChange }: {
    videoId: string;
    playbackUrl: string;
    posterUrl: string | null;
    player: React.RefObject<HTMLVideoElement | null>;
    onChange: (change: { video: VideoRecord; posterUrl: string | null }) => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState<'frame' | 'upload' | null>(null);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    const upload = async (image: Blob) => {
        const { key, uploadUrl } = await videoApi<{ key: string; uploadUrl: string }>(`/api/videos/${videoId}/poster`, { method: 'POST' });
        const put = await fetch(uploadUrl, { method: 'PUT', body: image, headers: { 'Content-Type': 'image/jpeg' } }).catch(() => null);
        if (!put?.ok) throw new Error('The thumbnail didn’t upload. Check your connection and try again.');
        onChange(await videoApi<{ video: VideoRecord; posterUrl: string | null }>(`/api/videos/${videoId}/poster`, { method: 'PUT', body: JSON.stringify({ key }) }));
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const run = async (kind: 'frame' | 'upload', make: () => Promise<Blob>) => {
        setBusy(kind);
        setError('');
        setSaved(false);
        try {
            await upload(await make());
        } catch (problem) {
            setError((problem as Error).message);
        } finally {
            setBusy(null);
        }
    };

    const takeFrame = () => {
        const current = player.current;
        current?.pause();
        void run('frame', () => captureFrame(playbackUrl, current?.currentTime ?? 0));
    };

    const pickImage = (file: File | undefined) => {
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError('Choose a JPG, PNG or WebP image.'); return; }
        if (file.size > 15 * 1024 * 1024) { setError('That image is over 15 MB. Choose a smaller one.'); return; }
        const current = player.current;
        // Cropped to the video's shape so it fills the player without black bars.
        const aspect = current?.videoWidth && current.videoHeight ? current.videoWidth / current.videoHeight : 16 / 9;
        void run('upload', async () => {
            const bitmap = await createImageBitmap(file).catch(() => { throw new Error('That image couldn’t be opened. Try a different file.'); });
            try {
                return await toJpeg(bitmap, bitmap.width, bitmap.height, aspect);
            } finally {
                bitmap.close();
            }
        });
    };

    return (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#14121F]/8 bg-white p-2.5 pr-3">
            <div className="h-12 w-[5.25rem] shrink-0 overflow-hidden rounded-lg bg-[#14121F]/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {posterUrl && <img src={posterUrl} alt="Current thumbnail" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Thumbnail</p>
                <p className="text-xs text-[#14121F]/55">Shown before the video plays, in link previews and in emails. Pause on a moment, or upload an image.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={takeFrame} disabled={busy !== null} className={button}>
                    {busy === 'frame' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />} Use this frame
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className={button}>
                    {busy === 'upload' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />} Upload image
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => { pickImage(event.target.files?.[0]); event.target.value = ''; }} />
            </div>
            {saved && <p role="status" className="flex w-full items-center gap-1.5 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Thumbnail updated</p>}
            {error && <p role="alert" className="w-full text-xs font-medium text-red-600">{error}</p>}
        </div>
    );
}
