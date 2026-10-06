import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(onProgress: (progress: number) => void) {
    if (!ffmpegInstance) ffmpegInstance = new FFmpeg();
    const ffmpeg = ffmpegInstance;
    const handleProgress = ({ progress }: { progress: number }) => onProgress(Math.min(99, Math.max(0, Math.round(progress * 100))));
    ffmpeg.on('progress', handleProgress);

    if (!ffmpeg.loaded) {
        if (!ffmpegLoadPromise) {
            ffmpegLoadPromise = (async () => {
                const baseUrl = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
                await ffmpeg.load({
                    coreURL: await toBlobURL(`${baseUrl}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${baseUrl}/ffmpeg-core.wasm`, 'application/wasm'),
                });
                return ffmpeg;
            })().catch((error) => {
                ffmpegLoadPromise = null;
                throw error;
            });
        }
        await ffmpegLoadPromise;
    }

    return { ffmpeg, handleProgress };
}

export async function convertWebmToMp4(webm: Blob, onProgress: (progress: number) => void) {
    const { ffmpeg, handleProgress } = await getFFmpeg(onProgress);
    const inputName = 'creator-studio-export.webm';
    const outputName = 'creator-studio-export.mp4';

    try {
        const inputData = new Uint8Array(await webm.arrayBuffer());
        await ffmpeg.writeFile(inputName, inputData);
        const exitCode = await ffmpeg.exec([
            '-i', inputName,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '18',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            outputName,
        ]);
        if (exitCode !== 0) throw new Error(`FFmpeg exited with code ${exitCode}`);

        const outputData = await ffmpeg.readFile(outputName);
        if (typeof outputData === 'string') throw new Error('FFmpeg returned an invalid MP4 file.');
        onProgress(100);
        return new Blob([outputData as BlobPart], { type: 'video/mp4' });
    } finally {
        ffmpeg.off('progress', handleProgress);
        await ffmpeg.deleteFile(inputName).catch(() => undefined);
        await ffmpeg.deleteFile(outputName).catch(() => undefined);
    }
}

export interface AnnotationOverlayFrame {
    /** Seconds into the recording at which this transparent frame appears. */
    t: number;
    blob: Blob;
}

export async function composeScreenShareWithCamera(
    screenRecording: Blob,
    cameraRecording: Blob,
    dimensions: { width: number; height: number },
    onProgress: (progress: number) => void,
    annotations: AnnotationOverlayFrame[] | null = null
) {
    const { ffmpeg, handleProgress } = await getFFmpeg(onProgress);
    const screenName = 'creator-studio-screen.webm';
    const cameraName = 'creator-studio-camera.webm';
    const outputName = 'creator-studio-screen-camera.mp4';
    const insetWidth = Math.round(dimensions.width * 0.25);
    const insetHeight = -2;
    const annotationListName = 'creator-studio-annotations.txt';
    const annotationFiles: string[] = [];

    try {
        await ffmpeg.writeFile(screenName, new Uint8Array(await screenRecording.arrayBuffer()));
        await ffmpeg.writeFile(cameraName, new Uint8Array(await cameraRecording.arrayBuffer()));

        // Annotation snapshots are full-frame transparent PNGs shown for [t, nextT); overlaying them last
        // keeps them above the camera inset, matching the live preview.
        if (annotations && annotations.length > 0) {
            const lines: string[] = [];
            for (let i = 0; i < annotations.length; i++) {
                const name = `creator-studio-annotation-${String(i).padStart(4, '0')}.png`;
                await ffmpeg.writeFile(name, new Uint8Array(await annotations[i].blob.arrayBuffer()));
                annotationFiles.push(name);
                const next = annotations[i + 1];
                lines.push(`file '${name}'`, `duration ${next ? Math.max(next.t - annotations[i].t, 0.02).toFixed(3) : '0.100'}`);
            }
            // The concat demuxer ignores the last duration unless the final file is repeated.
            lines.push(`file '${annotationFiles[annotationFiles.length - 1]}'`);
            await ffmpeg.writeFile(annotationListName, lines.join('\n'));
        }
        const hasAnnotations = annotationFiles.length > 0;
        const cameraGraph = `[0:v]scale=${dimensions.width}:${dimensions.height}:force_original_aspect_ratio=decrease,pad=${dimensions.width}:${dimensions.height}:(ow-iw)/2:(oh-ih)/2,setsar=1[screen];[1:v]hflip,scale=${insetWidth}:${insetHeight},setsar=1[cam];[screen][cam]overlay=W-w-32:H-h-32:shortest=1${hasAnnotations ? '[withcam]' : '[v]'}`;
        const annotationGraph = hasAnnotations
            ? `;[2:v]scale=${dimensions.width}:${dimensions.height},format=rgba[ann];[withcam][ann]overlay=0:0:format=auto[v]`
            : '';
        const exitCode = await ffmpeg.exec([
            '-i', screenName,
            '-i', cameraName,
            ...(hasAnnotations ? ['-f', 'concat', '-safe', '0', '-i', annotationListName] : []),
            '-filter_complex',
            cameraGraph + annotationGraph,
            '-map', '[v]',
            '-map', '0:a?',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '21',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '160k',
            '-shortest',
            '-movflags', '+faststart',
            outputName,
        ]);
        if (exitCode !== 0) throw new Error(`FFmpeg exited with code ${exitCode}`);
        const outputData = await ffmpeg.readFile(outputName);
        if (typeof outputData === 'string') throw new Error('FFmpeg returned an invalid screen-share recording.');
        onProgress(100);
        return new Blob([outputData as BlobPart], { type: 'video/mp4' });
    } finally {
        ffmpeg.off('progress', handleProgress);
        await ffmpeg.deleteFile(screenName).catch(() => undefined);
        await ffmpeg.deleteFile(cameraName).catch(() => undefined);
        await ffmpeg.deleteFile(outputName).catch(() => undefined);
        await ffmpeg.deleteFile(annotationListName).catch(() => undefined);
        for (const name of annotationFiles) await ffmpeg.deleteFile(name).catch(() => undefined);
    }
}
