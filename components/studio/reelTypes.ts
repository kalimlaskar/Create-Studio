import type { TextOverlayStyle } from '@/types/editor';
import type { DepthMotion } from './depthEstimator';
import type { BorderEffect } from './photoReelExtras';
import type { FxId } from './photoReelFx';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type FontKey = 'sans' | 'serif' | 'mono' | 'display';
export type GradientPreset = 'none' | 'sunset' | 'violet' | 'ocean' | 'warm';
export type ReelTemplate = 'custom' | 'travel' | 'birthday' | 'product' | 'festival' | 'product-demo';
export type PlatformAspect = '9:16' | '1:1' | '16:9' | '4:5';
export type TextPosition = 'top' | 'center' | 'bottom';
export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export type NarrationLanguage = 'en' | 'hi' | 'bn' | 'ta' | 'te';
export type VoiceGender = 'female' | 'male';
export type TransitionType = 'cut' | 'fade' | 'slide' | 'zoom';
export type MotionType = 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | DepthMotion;

export interface ReelImage {
    id: string;
    type: 'image' | 'video';
    file: File;
    url: string;
    durationMs: number;
    sourceDurationMs?: number;
    overlayText: string;
    description: string;
    textStyle: TextOverlayStyle;
    textPosition: TextPosition;
    textOffset?: { x: number; y: number }; // caption offset, % of frame
    textSize?: number;                     // caption size multiplier (0.5 – 2.5)
    textColor?: string;
    fontFamily?: FontKey;
    shine?: boolean;
    vignette?: number;                     // 0 – 60
    softEdges?: boolean;
    badgeText?: string;
    badgeColor?: string;
    badgeCorner?: Corner;
    borderEffect?: BorderEffect;
    borderColor?: string;
    fx?: FxId[];
    speed?: number;                        // 0.25 – 4
    autoCaption?: boolean;
    scale?: number;                        // 0.5 – 2.5
    motion: MotionType;
    transition: TransitionType;

    cursorTargetX?: number;
    cursorTargetY?: number;
    cursorColor?: string;
    cursorScale?: number;
    rippleTargetX?: number;
    rippleTargetY?: number;
    rippleScale?: number;
    rippleColor?: string;
    rippleSpeed?: number;
}

/** Everything that is project-wide (not per clip). Saved 1:1 into drafts. */
export interface ReelSettings {
    aspectRatio: PlatformAspect;
    backgroundColor: string;
    secondsPerImage: number;
    gradient: GradientPreset;
    gradientStrength: number;
    brightness: number;
    saturation: number;
    musicVolume: number;
    fxBpm: number;
    template: ReelTemplate;
    productTemplateId: string | null;
    narrationText: string;
    narrationLanguage: NarrationLanguage;
    narrationVoiceGender: VoiceGender;
    logoCorner: Corner;
    logoSize: number;
}

export const DEFAULT_SETTINGS: ReelSettings = {
    aspectRatio: '9:16',
    backgroundColor: '#f6f6f6',
    secondsPerImage: 3,
    gradient: 'sunset',
    gradientStrength: 35,
    brightness: 100,
    saturation: 100,
    musicVolume: 70,
    fxBpm: 120,
    template: 'custom',
    productTemplateId: null,
    narrationText: '',
    narrationLanguage: 'en',
    narrationVoiceGender: 'female',
    logoCorner: 'tr',
    logoSize: 18,
};

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const FONT_FAMILIES: Record<FontKey, string> = {
    sans: 'sans-serif',
    serif: 'Georgia, serif',
    mono: 'ui-monospace, Menlo, monospace',
    display: 'Impact, "Arial Black", sans-serif',
};

export const GRADIENTS: Array<{ id: GradientPreset; label: string; colors: [string, string] }> = [
    { id: 'none', label: 'None', colors: ['0,0,0', '0,0,0'] },
    { id: 'sunset', label: 'Sunset', colors: ['249,115,22', '190,24,93'] },
    { id: 'violet', label: 'Violet', colors: ['124,58,237', '30,64,175'] },
    { id: 'ocean', label: 'Ocean', colors: ['8,145,178', '30,58,138'] },
    { id: 'warm', label: 'Warm', colors: ['234,179,8', '220,38,38'] },
];

export const TEXT_BASE_Y: Record<TextPosition, number> = { top: 15, center: 50, bottom: 82 };

export const MAX_IMAGES = 20;
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const DEFAULT_VIDEO_CLIP_MS = 5000;
export const TRANSITION_MS = 450;
export const SPEED_PRESETS = [0.25, 0.5, 1, 1.5, 2, 3, 4];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const getDefaultTextColor = (style: TextOverlayStyle) => (style === 'highlight' ? '#111111' : '#ffffff');

export const getCanvasSize = (aspect: PlatformAspect) => ({
    width: aspect === '16:9' ? 960 : 540,
    height: aspect === '9:16' ? 960 : aspect === '4:5' ? 675 : 540,
});

export const getReadableTextColor = (hex: string) => {
    const raw = hex.replace('#', '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#111111' : '#ffffff';
};

export const getCornerPosition = (corner: Corner, boxW: number, boxH: number, width: number, height: number, margin: number) => ({
    x: corner === 'tl' || corner === 'bl' ? margin : width - boxW - margin,
    y: corner === 'tl' || corner === 'tr' ? margin * 1.6 : height - boxH - margin * 1.6,
});

/** Changing speed on a video also changes how long the clip lasts on the timeline. */
export const withSpeed = (clip: ReelImage, next: number): ReelImage => {
    const speed = clamp(Math.round(next * 100) / 100, 0.25, 4);
    if (clip.type !== 'video') return { ...clip, speed };
    const used = clip.durationMs * (clip.speed ?? 1);
    return { ...clip, speed, durationMs: Math.max(300, used / speed) };
};
