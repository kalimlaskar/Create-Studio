import { AspectRatioType, CameraArtEffect, ScriptLanguage } from './studio';

export type OverlayType = 'text' | 'image' | 'icon';
export type TextOverlayStyle = 'classic' | 'banner' | 'highlight' | 'outline';

export interface BaseClip {
    id: string;
    startMs: number;
    endMs: number;
}

export interface OverlayClip extends BaseClip {
    type: OverlayType;
    content: string;           // text string, or icon identifier
    x: number;                 // 0-1, fraction of canvas width
    y: number;                 // 0-1, fraction of canvas height
    fontSize?: number;         // text only
    color?: string;
    textStyle?: TextOverlayStyle;
    width?: number;            // image width as a fraction of canvas width
    iconSize?: number;         // icon only
}

export interface CaptionCue extends BaseClip {
    text: string;
    groupId?: string;
}

export type CaptionStyle = 'classic' | 'bold' | 'minimal';
export type EditorTabId = 'color' | 'text' | 'captions' | 'zoom' | 'speed' | 'music' | 'style' | 'clip' | 'coach';

export type TransitionType = 'particles' | 'portal' | 'warp';

export interface ClipTransition {
    atMs: number;       // the split point the transition starts at
    type: TransitionType;
    durationMs: number; // 500-2000
}

export interface VideoEditState {
    trimStartMs: number;
    trimEndMs: number;
    splitPointsMs: number[];
    transitions?: ClipTransition[];
}

export type BackgroundKind = 'none' | 'color' | 'gradient' | 'image';

export interface BackgroundSegment extends BaseClip {
    kind: BackgroundKind;
    value: string; // hex color, CSS gradient string, or image URL depending on kind
}

export interface AudioTrackClip extends BaseClip {
    url: string;
    volume: number; // 0-1
    loop?: boolean;
    fadeInMs?: number;
    fadeOutMs?: number;
}

export interface SpeedSegment extends BaseClip {
    rate: number; // 0.25-1.0 playback speed
}

export interface ColorGradeSettings {
    brightness: number; // 100 = neutral
    contrast: number;
    saturation: number;
    temperature: number; // -100 (cool) to 100 (warm)
}

export interface EditorTracks {
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
export interface ZoomKeyframe {
    id: string;
    atMs: number;
    scale: number; // 1 = 100% (no zoom), 1.5 = 150%, etc.
}
export function createEmptyProject(sourceVideoUrl: string, durationMs: number, aspectRatio: AspectRatioType = '16:9', teleprompterScript = '', scriptLanguage: ScriptLanguage = 'en', cameraArtEffect: CameraArtEffect = 'none'): EditorProject {
    return {
        title: 'Untitled creator project',
        sourceVideoUrl,
        durationMs,
        aspectRatio,
        teleprompterScript,
        scriptLanguage,
        cameraArtEffect,
        captionStyle: 'classic',
        videoEdit: { trimStartMs: 0, trimEndMs: durationMs, splitPointsMs: [] },
        muteOriginalAudio: false,
        tracks: {
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