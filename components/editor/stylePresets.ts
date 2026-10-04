import { CaptionStyle, ColorGradeSettings, ZoomKeyframe } from '@/types/editor';

export interface CompositeStylePreset {
    id: string;
    name: string;
    description: string;
    colorGrade: ColorGradeSettings;
    captionStyle: CaptionStyle;
    zoomScale: number;
}

export const COMPOSITE_STYLE_PRESETS: CompositeStylePreset[] = [
    {
        id: 'creator-clean',
        name: 'Creator clean',
        description: 'Natural color, classic captions, gentle framing.',
        colorGrade: { brightness: 102, contrast: 104, saturation: 105, temperature: 2 },
        captionStyle: 'classic',
        zoomScale: 1.04,
    },
    {
        id: 'warm-story',
        name: 'Warm story',
        description: 'Warm highlights with clean, readable captions.',
        colorGrade: { brightness: 105, contrast: 105, saturation: 112, temperature: 34 },
        captionStyle: 'minimal',
        zoomScale: 1.06,
    },
    {
        id: 'punchy-shorts',
        name: 'Punchy shorts',
        description: 'Vivid contrast, kinetic framing, bold word highlights.',
        colorGrade: { brightness: 105, contrast: 118, saturation: 132, temperature: 4 },
        captionStyle: 'bold',
        zoomScale: 1.12,
    },
    {
        id: 'noir-focus',
        name: 'Noir focus',
        description: 'Monochrome contrast and understated captions.',
        colorGrade: { brightness: 100, contrast: 116, saturation: 0, temperature: 0 },
        captionStyle: 'minimal',
        zoomScale: 1.03,
    },
];

export function getStyleZoomKeyframe(scale: number): ZoomKeyframe[] {
    return scale <= 1 ? [] : [{ id: `style-${scale}`, atMs: 0, scale }];
}
