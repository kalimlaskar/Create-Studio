import { AspectRatioType, CameraArtEffect, ScriptLanguage } from './studio';

export type OverlayType = 'text' | 'image' | 'icon';
export type TextOverlayStyle = 'classic' | 'banner' | 'highlight' | 'outline';

export interface BaseClip {
    id: string;
    startMs: number; // Timeline position start
    endMs: number;   // Timeline position end
}

export interface TimeRange {
    startMs: number;
    endMs: number;
}

export type TimelineClipType = 'video' | 'image';

export interface TimelineClip extends BaseClip {
    type: TimelineClipType;
    url: string;
    name: string;
    trimStartMs: number;
    trimEndMs: number;
    speed: number; // Independent speed multiplier (e.g. 0.5 for slow motion)
}

export interface OverlayClip extends BaseClip {
    type: OverlayType;
    content: string;
    x: number;
    y: number;
    fontSize?: number;
    color?: string;
    textStyle?: TextOverlayStyle;
    width?: number;
    iconSize?: number;
}

export interface CaptionCue extends BaseClip {
    text: string;
    groupId?: string;
}

export type CaptionStyle = 'classic' | 'bold' | 'minimal';
export type EditorTabId = 'color' | 'text' | 'captions' | 'zoom' | 'speed' | 'music' | 'style' | 'clip' | 'coach';

export type TransitionType = 'particles' | 'portal' | 'warp';

export interface ClipTransition {
    atMs: number;
    type: TransitionType;
    durationMs: number;
}

export interface VideoEditState {
    trimStartMs: number;
    trimEndMs: number;
    splitPointsMs: number[];
    transitions?: ClipTransition[];
    deletedRanges?: TimeRange[];
}

export type BackgroundKind = 'none' | 'color' | 'gradient' | 'image';

export interface BackgroundSegment extends BaseClip {
    kind: BackgroundKind;
    value: string;
}

export interface AudioTrackClip extends BaseClip {
    url: string;
    volume: number; // 0-1
    loop?: boolean;
    fadeInMs?: number;
    fadeOutMs?: number;
}

export interface SpeedSegment extends BaseClip {
    rate: number;
}

export interface ColorGradeSettings {
    brightness: number;
    contrast: number;
    saturation: number;
    temperature: number;
}

export interface ZoomKeyframe {
    id: string;
    atMs: number;
    scale: number;
}

export interface EditorTracks {
    clips: TimelineClip[]; // Multiple video footages & images across timeline
    background: BackgroundSegment[];
    overlays: OverlayClip[];
    captions: CaptionCue[];
    audio: AudioTrackClip[];
    speed: SpeedSegment[];
    zoom: ZoomKeyframe[];
}

export interface EditorProject {
    title: string;
    sourceVideoUrl: string;
    durationMs: number;
    aspectRatio: AspectRatioType;
    teleprompterScript: string;
    scriptLanguage: ScriptLanguage;
    cameraArtEffect: CameraArtEffect;
    captionStyle: CaptionStyle;
    videoEdit: VideoEditState;
    muteOriginalAudio: boolean;
    tracks: EditorTracks;
    colorGrade: ColorGradeSettings;
}

export const DEFAULT_COLOR_GRADE: ColorGradeSettings = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    temperature: 0,
};

export function createEmptyProject(
    sourceVideoUrl: string,
    durationMs: number,
    aspectRatio: AspectRatioType = '16:9',
    teleprompterScript = '',
    scriptLanguage: ScriptLanguage = 'en',
    cameraArtEffect: CameraArtEffect = 'none',
): EditorProject {
    return {
        title: 'Untitled creator project',
        sourceVideoUrl,
        durationMs,
        aspectRatio,
        teleprompterScript,
        scriptLanguage,
        cameraArtEffect,
        captionStyle: 'classic',
        videoEdit: { trimStartMs: 0, trimEndMs: durationMs, splitPointsMs: [], deletedRanges: [] },
        muteOriginalAudio: false,
        tracks: {
            clips: [
                {
                    id: 'primary-source-clip',
                    type: 'video',
                    url: sourceVideoUrl,
                    name: 'Main Video',
                    startMs: 0,
                    endMs: durationMs,
                    trimStartMs: 0,
                    trimEndMs: durationMs,
                    speed: 1.0,
                },
            ],
            background: [],
            overlays: [],
            captions: [],
            audio: [],
            speed: [],
            zoom: [],
        },
        colorGrade: { ...DEFAULT_COLOR_GRADE },
    };
}