import { ColorGradeSettings } from '@/types/editor';

export function buildColorGradeFilter(colorGrade: ColorGradeSettings) {
    const warmth = colorGrade.temperature;
    // CSS filters do not expose color temperature directly, so approximate it
    // with a subtle hue shift, matching the editor preview.
    const hueRotate = warmth > 0 ? -Math.min(warmth, 100) * 0.15 : -warmth * 0.1;

    return `brightness(${colorGrade.brightness}%) contrast(${colorGrade.contrast}%) saturate(${colorGrade.saturation}%) hue-rotate(${hueRotate}deg)`;
}