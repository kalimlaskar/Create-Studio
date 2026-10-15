import { clamp } from './reelTypes';

/** Resolves after `ms` or when `event` fires on `target`, whichever comes first. Never rejects. */
export const waitForEvent = (target: EventTarget, event: string, ms: number) =>
    new Promise<void>((resolve) => {
        const finish = () => {
            window.clearTimeout(timer);
            target.removeEventListener(event, finish);
            resolve();
        };
        const timer = window.setTimeout(finish, ms);
        target.addEventListener(event, finish, { once: true });
    });

export const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Seek and wait until the browser actually has the frame (not just "one rAF later"). */
export const seekVideo = async (video: HTMLVideoElement, seconds: number, timeoutMs = 500) => {
    const target = clamp(seconds, 0, Math.max(0, (video.duration || seconds) - 0.05));
    if (Math.abs(video.currentTime - target) < 0.01) return;
    const seeked = waitForEvent(video, 'seeked', timeoutMs);
    video.currentTime = target;
    await seeked;
};

export const waitForImageDecode = async (image: HTMLImageElement, fileName: string) => {
    if (!image.complete || image.naturalWidth === 0) {
        await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => reject(new Error(`Photo ${fileName} took too long to load.`)), 10000);
            image.addEventListener('load', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
            image.addEventListener('error', () => { window.clearTimeout(timeout); reject(new Error(`Could not decode photo ${fileName}.`)); }, { once: true });
        });
    }
    if (typeof image.decode === 'function') {
        try { await image.decode(); } catch { /* decode() can reject for already-visible images; naturalWidth check below is the truth */ }
    }
    if (image.naturalWidth === 0 || image.naturalHeight === 0) throw new Error(`Could not decode photo ${fileName}.`);
};

export const ensureVideoMetadata = async (video: HTMLVideoElement, fileName: string) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return;
    await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error(`Video ${fileName} took too long to load.`)), 10000);
        video.addEventListener('loadedmetadata', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
        video.load();
    });
};

export const waitForVideoFrame = (video: HTMLVideoElement, fileName: string, timeoutMs = 10000) =>
    new Promise<boolean>((resolve, reject) => {
        const hasFrame = () => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0;
        if (hasFrame()) {
            resolve(true);
            return;
        }
        const events = ['loadeddata', 'canplay', 'seeked', 'playing', 'timeupdate'] as const;
        const cleanup = () => {
            window.clearTimeout(timer);
            events.forEach((name) => video.removeEventListener(name, check));
            video.removeEventListener('error', fail);
        };
        const check = () => { if (hasFrame()) { cleanup(); resolve(true); } };
        const fail = () => { cleanup(); reject(new Error(`Could not decode ${fileName}.`)); };
        const timer = window.setTimeout(() => { cleanup(); resolve(false); }, timeoutMs);
        events.forEach((name) => video.addEventListener(name, check));
        video.addEventListener('error', fail);
        check();
    });
