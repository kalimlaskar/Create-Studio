import { DEFAULT_SETTINGS, ReelImage, ReelSettings } from './reelTypes';
import type { ReelAssets } from './reelAssets';

interface StoredAudio {
    fileName: string;
    fileType: string;
    blob: Blob;
}

export interface LoadedFile {
    file: File;
    url: string;
}

const toStoredAudio = (item: LoadedFile | null): StoredAudio | undefined =>
    item ? { fileName: item.file.name, fileType: item.file.type, blob: item.file } : undefined;

/** Flat object that goes into IndexedDB. Setting keys are stored at the top level (same shape as older drafts). */
export const buildDraftData = (
    settings: ReelSettings,
    clips: ReelImage[],
    music: LoadedFile | null,
    voiceover: LoadedFile | null,
    logo: LoadedFile | null,
) => ({
    ...settings,
    clips: clips.map(({ file, url: _url, ...rest }) => ({
        ...rest,
        fileName: file.name,
        fileType: file.type,
        blob: file,
    })),
    music: toStoredAudio(music),
    voiceover: toStoredAudio(voiceover),
    logo: toStoredAudio(logo),
});

export const restoreSettings = (saved: Partial<ReelSettings>): ReelSettings => {
    const next = { ...DEFAULT_SETTINGS };
    (Object.keys(DEFAULT_SETTINGS) as Array<keyof ReelSettings>).forEach((key) => {
        if (saved[key] !== undefined && saved[key] !== null) (next as Record<string, unknown>)[key] = saved[key];
    });
    return next;
};

export const restoreAudio = (item?: StoredAudio | null): LoadedFile | null => {
    if (!item) return null;
    const file = new File([item.blob], item.fileName, { type: item.fileType });
    return { file, url: URL.createObjectURL(file) };
};

export const restoreClips = (savedClips: any[], assets: ReelAssets): ReelImage[] =>
    savedClips.map((saved) => {
        const { fileName, fileType, blob, ...rest } = saved;
        const file = new File([blob], fileName, { type: fileType });
        const url = URL.createObjectURL(file);
        const clip: ReelImage = {
            ...rest,
            file,
            url,
            description: rest.description ?? '',
            textOffset: rest.textOffset ?? { x: 0, y: 0 },
            textSize: rest.textSize ?? 1,
            fontFamily: rest.fontFamily ?? 'sans',
            scale: rest.scale ?? 1,
            motion: rest.motion ?? (rest.type === 'image' ? 'zoom-in' : 'none'),
            transition: rest.transition ?? 'fade',
            rippleScale: rest.rippleScale ?? 0.5,
            cursorScale: rest.cursorScale ?? 1.0,
        };
        if (clip.type === 'video') assets.getVideo(clip);
        return clip;
    });
