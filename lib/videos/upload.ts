'use client';

// Uploads a video straight from the browser to R2 using presigned URLs from /api/videos.
// MediaRecorder WebM has no duration or seek index and doesn't play on iPhone, so WebM
// is converted to MP4 first (in the browser, with the editor's ffmpeg converter).

import type { VideoRecord } from './types';

export type UploadStage = 'preparing' | 'converting' | 'uploading' | 'finishing';

export interface UploadCallbacks {
    onStage?: (stage: UploadStage) => void;
    /** 0–1 within the current stage. */
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
}

interface Probe {
    durationMs: number;
    poster: Blob | null;
}

/** Reads the real duration (WebM reports Infinity until you seek to the end) and grabs a poster frame. */
async function probeVideo(file: Blob): Promise<Probe> {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    video.src = url;
    const once = (event: string) => new Promise<void>((resolve, reject) => {
        video.addEventListener(event, () => resolve(), { once: true });
        video.addEventListener('error', () => reject(new Error('This file isn’t a video the browser can read.')), { once: true });
    });

    try {
        await once('loadedmetadata');
        if (!Number.isFinite(video.duration)) {
            video.currentTime = 1e9;
            await once('durationchange');
        }
        const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0;

        let poster: Blob | null = null;
        try {
            video.currentTime = Math.min(1.5, (durationMs / 1000) * 0.2);
            await once('seeked');
            const width = Math.min(1280, video.videoWidth || 1280);
            const height = Math.round(width * ((video.videoHeight || 720) / (video.videoWidth || 1280)));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d')?.drawImage(video, 0, 0, width, height);
            poster = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
        } catch {
            poster = null; // A poster is nice to have; the upload continues without it.
        }
        return { durationMs, poster };
    } finally {
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(url);
    }
}

function putWithProgress(url: string, body: Blob, contentType: string, onProgress?: (progress: number) => void, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('PUT', url);
        request.setRequestHeader('Content-Type', contentType);
        request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(event.loaded / event.total); };
        request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Upload failed (${request.status}). Check the R2 bucket’s CORS settings.`)));
        request.onerror = () => reject(new Error('Upload failed. Check your connection and the R2 bucket’s CORS settings.'));
        request.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
        signal?.addEventListener('abort', () => request.abort(), { once: true });
        request.send(body);
    });
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${response.status}).`);
    return data as T;
}

/** Converts if needed, uploads and finishes. Resolves with the ready video and its share slug. */
export async function uploadVideo(file: Blob, title: string, callbacks: UploadCallbacks = {}) {
    const { onStage, onProgress, signal } = callbacks;
    onStage?.('preparing');
    let probe = await probeVideo(file);
    let upload = file;
    let contentType = file.type.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';

    if (contentType === 'video/webm') {
        onStage?.('converting');
        const { convertWebmToMp4 } = await import('@/components/editor/convertToMp4');
        upload = await convertWebmToMp4(file, (progress) => onProgress?.(progress), { durationSec: probe.durationMs / 1000 || undefined, signal });
        contentType = 'video/mp4';
        if (!probe.durationMs) probe = { ...probe, durationMs: (await probeVideo(upload)).durationMs };
    }

    onStage?.('uploading');
    const created = await api<{ video: VideoRecord; uploadUrl: string; posterUploadUrl: string | null }>('/api/videos', {
        method: 'POST',
        body: JSON.stringify({ title, contentType, sizeBytes: upload.size, durationMs: probe.durationMs, hasPoster: Boolean(probe.poster) }),
        signal,
    });
    await putWithProgress(created.uploadUrl, upload, contentType, onProgress, signal);
    if (created.posterUploadUrl && probe.poster) {
        await putWithProgress(created.posterUploadUrl, probe.poster, 'image/jpeg', undefined, signal).catch(() => {});
    }

    onStage?.('finishing');
    return api<{ video: VideoRecord; slug: string | null }>(`/api/videos/${created.video.id}/complete`, { method: 'POST', signal });
}

export { api as videoApi };
