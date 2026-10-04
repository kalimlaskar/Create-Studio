'use client';

import { EditorProject } from '@/types/editor';

const DATABASE_NAME = 'creator-studio-drafts';
const STORE_NAME = 'projects';

export interface DraftSummary {
    id: string;
    title: string;
    creatorName: string;
    savedAt: number;
    durationMs: number;
}

interface StoredDraft extends DraftSummary {
    project: EditorProject;
    videoBlob: Blob;
    musicBlobs: Array<{ clipId: string; blob: Blob }>;
}

export interface LoadedDraft {
    summary: DraftSummary;
    project: EditorProject;
}

function openDraftDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function readBlob(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not read a video or audio file for this draft.');
    return response.blob();
}

export async function saveEditorDraft(sourceVideoUrl: string, project: EditorProject, creatorName = 'My creator space'): Promise<DraftSummary> {
    const videoBlob = await readBlob(sourceVideoUrl);
    const musicBlobs = await Promise.all(project.tracks.audio.map(async (track) => ({
        clipId: track.id,
        blob: await readBlob(track.url),
    })));
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const summary = { id, title: project.title || 'Untitled creator project', creatorName, savedAt: Date.now(), durationMs: project.durationMs };
    const stored: StoredDraft = {
        ...summary,
        project: {
            ...project,
            sourceVideoUrl: '',
            tracks: {
                ...project.tracks,
                audio: project.tracks.audio.map((track) => ({ ...track, url: '' })),
            },
        },
        videoBlob,
        musicBlobs,
    };

    const database = await openDraftDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(stored);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    return summary;
}

export async function listEditorDrafts(): Promise<DraftSummary[]> {
    const database = await openDraftDatabase();
    const drafts = await new Promise<StoredDraft[]>((resolve, reject) => {
        const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result as StoredDraft[]);
        request.onerror = () => reject(request.error);
    });
    database.close();
    return drafts.map(({ id, title, creatorName, savedAt, durationMs }) => ({ id, title: title ?? 'Untitled creator project', creatorName: creatorName ?? 'My creator space', savedAt, durationMs }))
        .sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteEditorDraft(id: string): Promise<void> {
    const database = await openDraftDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
    database.close();
}

export async function loadEditorDraft(id: string): Promise<LoadedDraft> {
    const database = await openDraftDatabase();
    const stored = await new Promise<StoredDraft>((resolve, reject) => {
        const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
        request.onsuccess = () => request.result ? resolve(request.result as StoredDraft) : reject(new Error('Draft not found.'));
        request.onerror = () => reject(request.error);
    });
    database.close();

    const audioUrls = new Map(stored.musicBlobs.map(({ clipId, blob }) => [clipId, URL.createObjectURL(blob)]));
    const project: EditorProject = {
        ...stored.project,
        cameraArtEffect: stored.project.cameraArtEffect ?? 'none',
        aspectRatio: stored.project.aspectRatio ?? '9:16',
        captionStyle: stored.project.captionStyle ?? 'classic',
        videoEdit: stored.project.videoEdit ?? { trimStartMs: 0, trimEndMs: stored.project.durationMs, splitPointsMs: [] },
        sourceVideoUrl: URL.createObjectURL(stored.videoBlob),
        tracks: {
            ...stored.project.tracks,
            captions: stored.project.tracks.captions ?? [],
            speed: stored.project.tracks.speed ?? [],
            audio: stored.project.tracks.audio.map((track) => ({ ...track, url: audioUrls.get(track.id) ?? '' })),
        },
    };
    return { summary: { id: stored.id, title: stored.title ?? 'Untitled creator project', creatorName: stored.creatorName ?? 'My creator space', savedAt: stored.savedAt, durationMs: stored.durationMs }, project };
}
