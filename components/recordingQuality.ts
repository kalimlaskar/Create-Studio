import { AspectRatioType } from '@/types/studio';

export const CAMERA_INSET_VIDEO_BITRATE = 2_500_000;   // add this line

export const RECORDING_FRAME_RATE = 30;
export const RECORDING_VIDEO_BITRATE = 12_000_000;
export const RECORDING_AUDIO_BITRATE = 192_000;
export type ExportResolution = '720p' | '1080p';
export type ExportFormat = 'mp4' | 'webm';

export function getRecordingDimensions(aspectRatio: AspectRatioType) {
    switch (aspectRatio) {
        case '9:16':
            return { width: 1080, height: 1920 };
        case '1:1':
            return { width: 1080, height: 1080 };
        case '16:9':
        default:
            return { width: 1920, height: 1080 };
    }
}

export function getExportDimensions(aspectRatio: AspectRatioType, resolution: ExportResolution) {
    const shortEdge = resolution === '720p' ? 720 : 1080;
    if (aspectRatio === '9:16') {
        return { width: shortEdge, height: Math.round(shortEdge * 16 / 9) };
    }
    if (aspectRatio === '1:1') return { width: shortEdge, height: shortEdge };
    return { width: Math.round(shortEdge * 16 / 9), height: shortEdge };
}

export function getFrameCrop(videoWidth: number, videoHeight: number, aspectRatio: AspectRatioType) {
    const targetAspectRatio = aspectRatio === '9:16' ? 9 / 16 : aspectRatio === '1:1' ? 1 : 16 / 9;
    const sourceAspectRatio = videoWidth / videoHeight;

    if (sourceAspectRatio > targetAspectRatio) {
        const width = videoHeight * targetAspectRatio;
        return { x: (videoWidth - width) / 2, y: 0, width, height: videoHeight };
    }

    const height = videoWidth / targetAspectRatio;
    return { x: 0, y: (videoHeight - height) / 2, width: videoWidth, height };
}

export function createHighQualityRecorder(
    stream: MediaStream,
    overrides: Partial<Pick<MediaRecorderOptions, 'videoBitsPerSecond' | 'audioBitsPerSecond'>> = {}
) {
    const options: MediaRecorderOptions = {
        videoBitsPerSecond: RECORDING_VIDEO_BITRATE,
        audioBitsPerSecond: RECORDING_AUDIO_BITRATE,
        ...overrides,
    };
    const mimeTypes = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus'];
    const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));

    try {
        return new MediaRecorder(stream, mimeType ? { ...options, mimeType } : options);
    } catch {
        return new MediaRecorder(stream, options);
    }
}

const EXPORT_MIME_TYPES: Record<ExportFormat, string[]> = {
    mp4: ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4'],
    webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
};

export function isExportFormatSupported(format: ExportFormat) {
    return typeof MediaRecorder !== 'undefined'
        && typeof MediaRecorder.isTypeSupported === 'function'
        && EXPORT_MIME_TYPES[format].some((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

export function createExportRecorder(stream: MediaStream, format: ExportFormat, resolution: ExportResolution) {
    if (typeof MediaRecorder === 'undefined') throw new Error('Video export is not supported in this browser.');

    const mimeType = EXPORT_MIME_TYPES[format].find((type) => MediaRecorder.isTypeSupported(type))
        ?? (format === 'mp4'
            ? EXPORT_MIME_TYPES.webm.find((type) => MediaRecorder.isTypeSupported(type))
            : undefined);
    if (!mimeType) throw new Error(`This browser cannot record ${format.toUpperCase()} video.`);

    const options: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: resolution === '720p' ? 6_000_000 : RECORDING_VIDEO_BITRATE,
        audioBitsPerSecond: RECORDING_AUDIO_BITRATE,
    };
    return new MediaRecorder(stream, options);
}