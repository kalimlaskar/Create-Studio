import { AspectRatioType } from '@/types/studio';
import { TextOverlayStyle } from '@/types/editor';

const DATABASE_NAME = 'creator-studio-photo-reel-drafts';
const STORE_NAME = 'reels';

export interface PhotoReelDraftClip {
    id: string;
    type: 'image' | 'video';
    fileName: string;
    fileType: string;
    blob: Blob;
    durationMs: number;
    sourceDurationMs?: number;
    overlayText: string;
    description?: string;
    textStyle: TextOverlayStyle;
    textPosition: 'top' | 'center' | 'bottom';
    motion?: 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'depth-dolly' | 'depth-orbit' | 'depth-sway';
    transition?: 'cut' | 'fade' | 'slide' | 'zoom';
}

export interface PhotoReelDraftData {
    aspectRatio: AspectRatioType;
    secondsPerImage: number;
    gradient: 'none' | 'sunset' | 'violet' | 'ocean' | 'warm';
    gradientStrength: number;
    brightness: number;
    saturation: number;
    musicVolume: number;
    template?: 'custom' | 'travel' | 'birthday' | 'product' | 'festival';
    narrationText?: string;
    narrationLanguage?: 'en' | 'hi' | 'bn' | 'ta' | 'te';
    narrationVoiceGender?: 'female' | 'male';
    clips: PhotoReelDraftClip[];
    music?: { fileName: string; fileType: string; blob: Blob };
    voiceover?: { fileName: string; fileType: string; blob: Blob };
}

export interface PhotoReelDraftSummary {
    id: string;
    title: string;
    savedAt: number;
    clipCount: number;
    durationMs: number;
}

export interface StoredPhotoReelDraft extends PhotoReelDraftSummary {
    data: PhotoReelDraftData;
}

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function listPhotoReelDrafts(): Promise<PhotoReelDraftSummary[]> {
    const database = await openDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
            request.onsuccess = () => resolve((request.result as StoredPhotoReelDraft[])
                .map(({ id, title, savedAt, clipCount, durationMs }) => ({ id, title, savedAt, clipCount, durationMs }))
                .sort((a, b) => b.savedAt - a.savedAt));
            request.onerror = () => reject(request.error);
        });
    } finally {
        database.close();
    }
}

export async function savePhotoReelDraft(draft: StoredPhotoReelDraft): Promise<void> {
    const database = await openDatabase();
    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            transaction.objectStore(STORE_NAME).put(draft);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        database.close();
    }
}

export async function loadPhotoReelDraft(id: string): Promise<StoredPhotoReelDraft> {
    const database = await openDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
            request.onsuccess = () => request.result ? resolve(request.result as StoredPhotoReelDraft) : reject(new Error('Reel draft not found.'));
            request.onerror = () => reject(request.error);
        });
    } finally {
        database.close();
    }
}

export async function deletePhotoReelDraft(id: string): Promise<void> {
    const database = await openDatabase();
    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            transaction.objectStore(STORE_NAME).delete(id);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        database.close();
    }
}
