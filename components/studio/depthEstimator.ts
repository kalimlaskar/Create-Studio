export type DepthMotion = 'depth-dolly' | 'depth-orbit' | 'depth-sway';

export const DEPTH_MOTIONS: DepthMotion[] = ['depth-dolly', 'depth-orbit', 'depth-sway'];
export const isDepthMotion = (motion: string | undefined): motion is DepthMotion => DEPTH_MOTIONS.includes(motion as DepthMotion);

const MODEL_ID = 'Xenova/depth-anything-small-hf';
const DEPTH_SIZE = 384;
const DEPTH_TIMEOUT_MS = 60000;
const DB_NAME = 'cliprame-depth-cache';
const STORE = 'depth';

export type DepthResult = HTMLCanvasElement;

const memoryCache = new Map<string, Promise<DepthResult>>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelinePromise: Promise<any> | null = null;

export const getPhotoCacheKey = (file: File) => `${file.name}|${file.size}|${file.lastModified}`;

export const isDeviceTooSlowForDepth = () => {
    if (typeof navigator === 'undefined') return true;
    const nav = navigator as Navigator & { deviceMemory?: number };
    return (nav.hardwareConcurrency ?? 4) <= 2 || (nav.deviceMemory ?? 4) <= 2;
};

const openDb = () => new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
});

const readStored = async (key: string): Promise<Blob | null> => {
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
        const request = db.transaction(STORE).objectStore(STORE).get(key);
        request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
        request.onerror = () => resolve(null);
    });
};

const writeStored = async (key: string, blob: Blob) => {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(blob, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
};

const blobToCanvas = async (blob: Blob): Promise<HTMLCanvasElement> => {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
};

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

const loadPipeline = () => {
    if (!pipelinePromise) {
        pipelinePromise = (async () => {
            const { pipeline, env } = await import('@huggingface/transformers');
            env.allowLocalModels = false;
            const hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
            if (hasWebGpu) {
                try {
                    return await pipeline('depth-estimation', MODEL_ID, { device: 'webgpu', dtype: 'fp32' });
                } catch {
                    // Fall through to WASM below.
                }
            }
            return pipeline('depth-estimation', MODEL_ID);
        })();
        pipelinePromise.catch(() => { pipelinePromise = null; });
    }
    return pipelinePromise;
};

const withTimeout = <T,>(promise: Promise<T>, ms: number) => new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Depth estimation timed out.')), ms);
    promise.then((value) => { window.clearTimeout(timer); resolve(value); }, (cause) => { window.clearTimeout(timer); reject(cause); });
});

const estimate = async (file: File): Promise<HTMLCanvasElement> => {
    const estimator = await loadPipeline();
    const url = URL.createObjectURL(file);
    try {
        const output = await estimator(url);
        const result = Array.isArray(output) ? output[0] : output;
        const raw = result.depth as { width: number; height: number; channels: number; data: Uint8Array | Uint8ClampedArray };
        const source = document.createElement('canvas');
        source.width = raw.width;
        source.height = raw.height;
        const sourceCtx = source.getContext('2d');
        if (!sourceCtx) throw new Error('Canvas unavailable.');
        const imageData = sourceCtx.createImageData(raw.width, raw.height);
        for (let index = 0; index < raw.width * raw.height; index += 1) {
            const value = raw.data[index * raw.channels];
            imageData.data[index * 4] = value;
            imageData.data[index * 4 + 1] = value;
            imageData.data[index * 4 + 2] = value;
            imageData.data[index * 4 + 3] = 255;
        }
        sourceCtx.putImageData(imageData, 0, 0);
        const scale = Math.min(1, DEPTH_SIZE / Math.max(raw.width, raw.height));
        const output2 = document.createElement('canvas');
        output2.width = Math.max(1, Math.round(raw.width * scale));
        output2.height = Math.max(1, Math.round(raw.height * scale));
        output2.getContext('2d')?.drawImage(source, 0, 0, output2.width, output2.height);
        return output2;
    } finally {
        URL.revokeObjectURL(url);
    }
};

// Resolves to a grayscale depth canvas (bright = near) or rejects, in which case callers fall back to Ken Burns.
export const getDepthMap = (file: File): Promise<DepthResult> => {
    const key = getPhotoCacheKey(file);
    const cached = memoryCache.get(key);
    if (cached) return cached;
    const job = (async () => {
        const stored = await readStored(key).catch(() => null);
        if (stored) {
            try { return await blobToCanvas(stored); } catch { /* recompute */ }
        }
        if (isDeviceTooSlowForDepth()) throw new Error('This device is too slow for 3D depth.');
        const canvas = await withTimeout(estimate(file), DEPTH_TIMEOUT_MS);
        const blob = await canvasToBlob(canvas);
        if (blob) void writeStored(key, blob);
        return canvas;
    })();
    memoryCache.set(key, job);
    job.catch(() => memoryCache.delete(key));
    return job;
};
