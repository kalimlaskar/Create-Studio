export type AspectRatioType = '9:16' | '16:9' | '1:1';
export type FilterPresetType = 'none' | 'cinematic' | 'warm' | 'mono';
export type BackgroundModeType = 'none' | 'blur' | 'green' | 'transparent' | 'image';
export type StudioInputMode = 'camera' | 'upload';

export interface StudioSettings {
    aspectRatio: AspectRatioType;
    brightness: number;
    contrast: number;
    filterPreset: FilterPresetType;
    scriptText: string;
    backgroundMode: BackgroundModeType;
    backgroundImageUrl: string | null; // object URL of the user-picked image
    inputMode: StudioInputMode; // Added
    uploadedVideoUrl?: string;  // Added
}