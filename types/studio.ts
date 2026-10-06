export type AspectRatioType = '9:16' | '16:9' | '1:1';
export type FilterPresetType = 'none' | 'cinematic' | 'warm' | 'mono';
export type BackgroundModeType = 'none' | 'blur' | 'green' | 'transparent' | 'image';
export type StudioInputMode = 'camera' | 'upload';
export type ScriptLanguage = 'en' | 'hi' | 'hinglish' | 'bn' | 'mr' | 'ta' | 'te';
export type CameraArtEffect = 'none' | 'comic' | 'sketch' | 'pixel' | 'anime' | 'avatar' | 'photo-avatar';

export type CameraFacing = 'user' | 'environment';

export interface StudioSettings {
    cameraFacing: CameraFacing;
    aspectRatio: AspectRatioType;
    brightness: number;
    contrast: number;
    filterPreset: FilterPresetType;
    cameraArtEffect: CameraArtEffect;
    cameraAvatarImageUrl: string | null;
    cameraAvatarMouthX: number;
    cameraAvatarMouthY: number;
    cameraAvatarMouthWidth: number;
    scriptText: string;
    scriptLanguage: ScriptLanguage;
    backgroundMode: BackgroundModeType;
    backgroundImageUrl: string | null; // object URL of the user-picked image
    inputMode: StudioInputMode; // Added
    uploadedVideoUrl?: string;  // Added
}