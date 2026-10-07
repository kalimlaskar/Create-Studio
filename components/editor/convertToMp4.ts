import { FFmpeg } from '@ffmpeg/ffmpeg';

/* -------------------------------------------------------------------------- */
/*  Config                                                                     */
/* -------------------------------------------------------------------------- */

/** Import RECORDING_FRAME_RATE from your recording config if you prefer. */
const OUTPUT_FPS = 30;

/**
 * Where to load ffmpeg-core from, tried in order.
 * Self-host first: copy node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.{js,wasm}
 * into /public/ffmpeg/ so exports don't depend on a CDN.
 */
const CORE_BASE_URLS = [
    '/ffmpeg',
    'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd',
];

/* -------------------------------------------------------------------------- */
/*  Public types                                                               */
/* -------------------------------------------------------------------------- */

export interface ExportJobOptions {
    /** Known recording length in seconds. Gives accurate progress (MediaRecorder WebM has no duration). */
    durationSec?: number;
    /** Abort to cancel the export; the promise rejects with an AbortError. */
    signal?: AbortSignal;
}

export interface ConvertOptions extends ExportJobOptions {
    /**
     * Set true ONLY when the WebM video track is already H.264
     * (e.g. recorded with 'video/webm;codecs=h264,opus').
     * The video is then repackaged without re-encoding: seconds instead of minutes.
     */
    copyVideo?: boolean;
    /** x264 quality when re-encoding. Lower = better/slower. Default 23. */
    crf?: number;
}

export interface AnnotationOverlayFrame {
    /** Seconds into the recording at which this transparent frame appears. */
    t: number;
    blob: Blob;
}

export interface ComposeOptions extends ExportJobOptions {
    /** Which recording supplies the audio. Default 'screen'. */
    audioFrom?: 'screen' | 'camera';
    /** Seconds the camera started AFTER the screen recording (positive delays camera). */
    cameraOffsetSec?: number;
    crf?: number;
}

/* -------------------------------------------------------------------------- */
/*  Core loading (cached blob URLs, fresh FFmpeg instance per job)             */
/* -------------------------------------------------------------------------- */

type CoreUrls = { coreURL: string; wasmURL: string };
let coreUrlsPromise: Promise<CoreUrls> | null = null;

async function fetchAsBlobUrl(url: string, mimeType: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`);
    const blob = new Blob([await response.arrayBuffer()], { type: mimeType });
    return URL.createObjectURL(blob);
}

function loadCoreUrls(): Promise<CoreUrls> {
    if (!coreUrlsPromise) {
        coreUrlsPromise = (async () => {
            let lastError: unknown;
            for (const base of CORE_BASE_URLS) {
                try {
                    const [coreURL, wasmURL] = await Promise.all([
                        fetchAsBlobUrl(`${base}/ffmpeg-core.js`, 'text/javascript'),
                        fetchAsBlobUrl(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
                    ]);
                    return { coreURL, wasmURL };
                } catch (error) {
                    lastError = error;
                }
            }
            throw lastError instanceof Error ? lastError : new Error('Could not load the video converter.');
        })().catch((error) => {
            coreUrlsPromise = null; // allow retry
            throw error;
        });
    }
    return coreUrlsPromise;
}

async function createFFmpeg() {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load(await loadCoreUrls());
    return ffmpeg;
}

/* -------------------------------------------------------------------------- */
/*  Job runner: serialized, cancellable, memory-safe                           */
/* -------------------------------------------------------------------------- */

let jobQueue: Promise<unknown> = Promise.resolve();

function runExclusive<T>(job: () => Promise<T>): Promise<T> {
    const run = jobQueue.then(job, job);
    jobQueue = run.catch(() => undefined);
    return run;
}

function abortError() {
    return new DOMException('Export cancelled', 'AbortError');
}

function createProgressHandler(onProgress: (progress: number) => void, durationSec?: number) {
    let last = 0;
    return ({ progress, time }: { progress: number; time: number }) => {
        let percent: number | null = null;
        if (durationSec && durationSec > 0 && time > 0) {
            percent = (time / 1_000_000 / durationSec) * 100; // `time` is in microseconds
        } else if (progress >= 0 && progress <= 1) {
            percent = progress * 100;
        }
        if (percent === null || Number.isNaN(percent)) return;
        last = Math.min(99, Math.max(last, Math.round(percent))); // monotonic, never hits 100 early
        onProgress(last);
    };
}

async function runFFmpegJob<T>(
    options: ExportJobOptions,
    onProgress: (progress: number) => void,
    job: (ffmpeg: FFmpeg) => Promise<T>
): Promise<T> {
    return runExclusive(async () => {
        if (options.signal?.aborted) throw abortError();

        // A fresh instance per job: terminating it afterwards releases all wasm memory,
        // which is the most common reason the 2nd export in a session came out broken.
        const ffmpeg = await createFFmpeg();
        const logs: string[] = [];
        const handleProgress = createProgressHandler(onProgress, options.durationSec);
        const handleLog = ({ message }: { message: string }) => {
            logs.push(message);
            if (logs.length > 40) logs.shift();
        };
        const handleAbort = () => ffmpeg.terminate();

        ffmpeg.on('progress', handleProgress);
        ffmpeg.on('log', handleLog);
        options.signal?.addEventListener('abort', handleAbort, { once: true });

        try {
            const result = await job(ffmpeg);
            if (options.signal?.aborted) throw abortError();
            onProgress(100);
            return result;
        } catch (error) {
            if (options.signal?.aborted) throw abortError();
            const message = error instanceof Error ? error.message : String(error);
            const tail = logs.slice(-12).join('\n');
            throw new Error(tail ? `${message}\n--- ffmpeg log ---\n${tail}` : message);
        } finally {
            options.signal?.removeEventListener('abort', handleAbort);
            ffmpeg.off('progress', handleProgress);
            ffmpeg.off('log', handleLog);
            ffmpeg.terminate();
        }
    });
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);

async function writeBlob(ffmpeg: FFmpeg, name: string, blob: Blob) {
    await ffmpeg.writeFile(name, new Uint8Array(await blob.arrayBuffer()));
}

async function run(ffmpeg: FFmpeg, args: string[]) {
    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) throw new Error(`FFmpeg exited with code ${exitCode}`);
}

async function readMp4(ffmpeg: FFmpeg, name: string) {
    const data = await ffmpeg.readFile(name);
    if (typeof data === 'string' || data.byteLength === 0) {
        throw new Error('FFmpeg produced an empty or invalid MP4 file.');
    }
    return new Blob([data as BlobPart], { type: 'video/mp4' });
}

async function makeBlankPng(width: number, height: number): Promise<Blob> {
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height).convertToBlob({ type: 'image/png' });
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return new Promise((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create blank frame.'))), 'image/png')
    );
}

/** Audio settings shared by both exports. */
const AUDIO_ARGS = [
    '-af', 'aresample=async=1:first_pts=0', // fixes drift from irregular MediaRecorder timestamps
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ac', '2',
];

/* -------------------------------------------------------------------------- */
/*  WebM -> MP4                                                                */
/* -------------------------------------------------------------------------- */

export function convertWebmToMp4(
    webm: Blob,
    onProgress: (progress: number) => void,
    options: ConvertOptions = {}
) {
    return runFFmpegJob(options, onProgress, async (ffmpeg) => {
        const inputName = 'input.webm';
        const outputName = 'output.mp4';
        await writeBlob(ffmpeg, inputName, webm);

        const videoArgs = options.copyVideo
            ? ['-c:v', 'copy']
            : [
                // Constant frame rate + even dimensions: MediaRecorder WebM is variable-frame-rate,
                // which is what causes freezes/jumps/cut-off endings in the MP4.
                '-vf', `fps=${OUTPUT_FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
                '-c:v', 'libx264',
                '-preset', 'veryfast',
                '-crf', String(options.crf ?? 23),
                '-pix_fmt', 'yuv420p',
            ];

        await run(ffmpeg, [
            '-fflags', '+genpts', // rebuild timestamps; the WebM header has no duration/index
            '-i', inputName,
            '-map', '0:v:0',
            '-map', '0:a:0?',
            ...videoArgs,
            ...AUDIO_ARGS,
            '-movflags', '+faststart',
            outputName,
        ]);

        return readMp4(ffmpeg, outputName);
    });
}

/* -------------------------------------------------------------------------- */
/*  Screen share + camera inset (+ optional annotation overlay)                */
/* -------------------------------------------------------------------------- */

export function composeScreenShareWithCamera(
    screenRecording: Blob,
    cameraRecording: Blob,
    dimensions: { width: number; height: number },
    onProgress: (progress: number) => void,
    annotations: AnnotationOverlayFrame[] | null = null,
    options: ComposeOptions = {}
) {
    return runFFmpegJob(options, onProgress, async (ffmpeg) => {
        const width = even(dimensions.width);
        const height = even(dimensions.height);
        const insetWidth = even(width * 0.25);
        const screenName = 'screen.webm';
        const cameraName = 'camera.webm';
        const listName = 'annotations.txt';
        const outputName = 'output.mp4';

        await writeBlob(ffmpeg, screenName, screenRecording);
        await writeBlob(ffmpeg, cameraName, cameraRecording);

        // ---- Annotation timeline (concat demuxer) --------------------------------
        const sorted = (annotations ?? []).slice().sort((a, b) => a.t - b.t);
        const hasAnnotations = sorted.length > 0;

        if (hasAnnotations) {
            const lines: string[] = [];
            const addFrame = (name: string, seconds: number) =>
                lines.push(`file '${name}'`, `duration ${Math.max(seconds, 0.02).toFixed(3)}`);

            // The list starts at t=0, so if the first snapshot appears later, pad with a
            // transparent frame. Otherwise every annotation would show up too early.
            if (sorted[0].t > 0.01) {
                const blankName = 'annotation-blank.png';
                await writeBlob(ffmpeg, blankName, await makeBlankPng(width, height));
                addFrame(blankName, sorted[0].t);
            }

            let lastName = '';
            for (let i = 0; i < sorted.length; i++) {
                lastName = `annotation-${String(i).padStart(4, '0')}.png`;
                await writeBlob(ffmpeg, lastName, sorted[i].blob);
                const next = sorted[i + 1];
                addFrame(lastName, next ? next.t - sorted[i].t : 0.1);
            }
            // The concat demuxer ignores the last duration unless the final file is repeated.
            lines.push(`file '${lastName}'`);
            await ffmpeg.writeFile(listName, lines.join('\n'));
        }

        // ---- Filter graph --------------------------------------------------------
        const screenChain =
            `[0:v]fps=${OUTPUT_FPS},scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[screen]`;
        const cameraChain = `[1:v]fps=${OUTPUT_FPS},hflip,scale=${insetWidth}:-2,setsar=1[cam]`;
        const overlayCamera = `[screen][cam]overlay=W-w-32:H-h-32:shortest=1${hasAnnotations ? '[withcam]' : '[v]'}`;
        const annotationChain = hasAnnotations
            ? `;[2:v]fps=${OUTPUT_FPS},scale=${width}:${height},format=rgba[ann];[withcam][ann]overlay=0:0:format=auto[v]`
            : '';
        const filterGraph = `${screenChain};${cameraChain};${overlayCamera}${annotationChain}`;

        // ---- Inputs ----------------------------------------------------------------
        const cameraOffset = options.cameraOffsetSec ?? 0;
        const audioMap = options.audioFrom === 'camera' ? '1:a?' : '0:a?';

        await run(ffmpeg, [
            '-fflags', '+genpts',
            '-i', screenName,
            ...(cameraOffset ? ['-itsoffset', cameraOffset.toFixed(3)] : []),
            '-i', cameraName,
            ...(hasAnnotations ? ['-f', 'concat', '-safe', '0', '-i', listName] : []),
            '-filter_complex', filterGraph,
            '-map', '[v]',
            '-map', audioMap,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', String(options.crf ?? 23),
            '-pix_fmt', 'yuv420p',
            ...AUDIO_ARGS,
            '-shortest',
            '-movflags', '+faststart',
            outputName,
        ]);

        return readMp4(ffmpeg, outputName);
    });
}