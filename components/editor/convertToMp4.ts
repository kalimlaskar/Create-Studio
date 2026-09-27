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
            '-preset', 'ultrafast',
            '-crf', '23',
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
