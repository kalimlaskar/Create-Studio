export type AspectRatioType = '9:16' | '16:9' | '1:1';
export type FilterPresetType = 'none' | 'cinematic' | 'warm' | 'mono';
export type BackgroundModeType = 'none' | 'blur' | 'green' | 'transparent' | 'image';
export type StudioInputMode = 'camera' | 'upload';
export type ScriptLanguage = 'en' | 'hi' | 'hinglish' | 'bn' | 'mr' | 'ta' | 'te';
export type CameraArtEffect = 'none' | 'comic' | 'sketch' | 'pixel' | 'anime' | 'avatar' | 'photo-avatar';

export type AirDrawingTool = 'pen' | 'highlighter' | 'arrow' | 'laser';
export type AirWritingLanguage = 'en' | 'hi';
export type AirWritingFont = 'sans' | 'serif' | 'mono' | 'marker' | 'rounded';

export type HologramColor = 'cyan' | 'purple' | 'green';

export type CameraFacing = 'user' | 'environment';

export interface StudioSettings {
    cameraFacing: CameraFacing;
    aspectRatio: AspectRatioType;
    brightness: number;
    contrast: number;
    filterPreset: FilterPresetType;
    cameraArtEffect: CameraArtEffect;
    hologramEnabled: boolean;
    hologramColor: HologramColor;
    hologramIntensity: number; // 0-100
    hologramFlicker: number; // 0-100
    cameraAvatarImageUrl: string | null;
    cameraAvatarMouthX: number;
    cameraAvatarMouthY: number;
    cameraAvatarMouthWidth: number;
    airDrawingEnabled: boolean;
    airDrawingColor: string;
    airDrawingSize: number; // 2-30
    airDrawingGlow: number; // 0-100
    airDrawingFade: boolean; // strokes vanish after 3s
    airDrawingPerformanceMode: boolean; // lower hand-detection frame rate
    airDrawingTool: AirDrawingTool;
    airWriteMode: boolean; // "Write to Text"
    airWriteLanguage: AirWritingLanguage;
    airWriteFont: AirWritingFont;
    airWriteColor: string;
    scriptText: string;
    scriptLanguage: ScriptLanguage;
    backgroundMode: BackgroundModeType;
    backgroundImageUrl: string | null; // object URL of the user-picked image
    inputMode: StudioInputMode; // Added
    uploadedVideoUrl?: string;  // Added
}