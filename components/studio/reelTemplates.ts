import type { TextOverlayStyle } from '@/types/editor';
import type {
    FontKey, GradientPreset, PlatformAspect, ReelImage, ReelSettings, ReelTemplate, TextPosition,
} from './reelTypes';

/* -------------------------------------------------------------------------- */
/* Product templates (shoes, clothing, ...)                                   */
/* -------------------------------------------------------------------------- */

export interface ProductTemplate {
    id: string;
    label: string;
    emoji: string;
    blurb: string;
    spec: string;
    aspect: PlatformAspect;
    backgroundColor: string;
    secondsPerImage: number;
    gradient: GradientPreset;
    gradientStrength: number;
    brightness: number;
    saturation: number;
    transition: ReelImage['transition'];
    motions: ReelImage['motion'][];
    textStyle: TextOverlayStyle;
    textPosition: TextPosition;
    fontFamily: FontKey;
    textColor?: string;
    textSize?: number;
    shine: boolean;
    vignette: number;
    shots: Array<{ title: string; tip: string; caption: string }>;
}

export const PRODUCT_TEMPLATES: ProductTemplate[] = [
    {
        id: 'shoes', label: 'Shoes & sneakers', emoji: '👟', blurb: '3D orbit, shine, bold captions',
        spec: 'Square or 4:5 photos, 1080 px or larger, plain light background, whole shoe in frame.',
        aspect: '9:16', backgroundColor: '#ffffff', secondsPerImage: 2, gradient: 'warm', gradientStrength: 22, brightness: 106, saturation: 112,
        transition: 'slide', motions: ['depth-dolly', 'depth-orbit', 'depth-sway', 'zoom-in'],
        textStyle: 'banner', textPosition: 'bottom', fontFamily: 'sans', shine: true, vignette: 10,
        shots: [
            { title: 'Hero shot', tip: 'Whole shoe, side-on, plain background', caption: 'Meet your new everyday favorite.' },
            { title: 'Angle view', tip: 'Three-quarter angle showing toe and side', caption: 'Designed to stand out.' },
            { title: 'Detail close-up', tip: 'Sole, stitching or material texture', caption: 'Premium quality, built to last.' },
            { title: 'On-foot or lifestyle', tip: 'Worn outdoors or on a model', caption: 'Comfort that goes the distance.' },
            { title: 'Final shot', tip: 'Hero shot again, or the box and logo', caption: 'Available now. Link in bio.' },
        ],
    },
    {
        id: 'clothing', label: 'Clothing & fashion', emoji: '👗', blurb: 'Soft fades, serif captions',
        spec: 'Portrait 4:5 or 9:16 photos, 1080 px wide or larger, even lighting, flat-lay or on a model.',
        aspect: '9:16', backgroundColor: '#f3ede6', secondsPerImage: 2.5, gradient: 'sunset', gradientStrength: 14, brightness: 104, saturation: 104,
        transition: 'fade', motions: ['zoom-in', 'pan-left', 'zoom-out', 'pan-right'],
        textStyle: 'classic', textPosition: 'bottom', fontFamily: 'serif', textColor: '#ffffff', shine: false, vignette: 12,
        shots: [
            { title: 'Full look', tip: 'Head-to-toe on a model or mannequin', caption: 'The new season edit.' },
            { title: 'Fabric close-up', tip: 'Texture, weave or print up close', caption: 'Soft to touch. Made to last.' },
            { title: 'Fit and cut', tip: 'Back or side view showing the fit', caption: 'Cut for the way you move.' },
            { title: 'Styled outfit', tip: 'Paired with accessories or layers', caption: 'Style it your way.' },
            { title: 'Final look', tip: 'Best photo, or the brand tag', caption: 'Shop the collection.' },
        ],
    },
    {
        id: 'jewelry', label: 'Jewelry & necklaces', emoji: '💎', blurb: 'Dark luxe, gold text, sparkle',
        spec: 'Square close-ups, 1200 px or larger, dark or neutral background, piece centered with space around it.',
        aspect: '9:16', backgroundColor: '#0f0d14', secondsPerImage: 2.5, gradient: 'violet', gradientStrength: 18, brightness: 104, saturation: 108,
        transition: 'fade', motions: ['zoom-in', 'zoom-in', 'pan-left', 'zoom-out'],
        textStyle: 'classic', textPosition: 'bottom', fontFamily: 'serif', textColor: '#f5d38a', textSize: 1.05, shine: true, vignette: 32,
        shots: [
            { title: 'Hero piece', tip: 'Close-up, centered, clean background', caption: 'Crafted to be treasured.' },
            { title: 'Worn', tip: 'On the neck or wrist', caption: 'Made to be worn every day.' },
            { title: 'Detail', tip: 'Clasp, stone or engraving', caption: 'Every detail, perfected.' },
            { title: 'Gift ready', tip: 'In its box or packaging', caption: 'The perfect gift.' },
            { title: 'Final shot', tip: 'Best photo of the piece', caption: 'Shop now. Link in bio.' },
        ],
    },
    {
        id: 'saas', label: 'SaaS & dashboards', emoji: '📊', blurb: 'Screenshot walkthrough, 16:9',
        spec: '16:9 screenshots (1920×1080), PNG. Hide personal data and show one key screen per clip.',
        aspect: '16:9', backgroundColor: '#0b1020', secondsPerImage: 3, gradient: 'ocean', gradientStrength: 12, brightness: 100, saturation: 105,
        transition: 'slide', motions: ['zoom-in', 'pan-left', 'zoom-in', 'pan-right'],
        textStyle: 'banner', textPosition: 'bottom', fontFamily: 'sans', shine: false, vignette: 0,
        shots: [
            { title: 'Dashboard overview', tip: 'The main screen users see first', caption: 'All your numbers in one dashboard.' },
            { title: 'Key feature 1', tip: 'Your most valuable feature', caption: 'Track every metric in real time.' },
            { title: 'Key feature 2', tip: 'Another strong screen or chart', caption: 'Spot trends before they happen.' },
            { title: 'Reports or integrations', tip: 'Sharing, exports or connected tools', caption: 'Share reports in one click.' },
            { title: 'Call to action', tip: 'Pricing, signup or logo screen', caption: 'Start your free trial today.' },
        ],
    },
    {
        id: 'general', label: 'Any product', emoji: '📦', blurb: 'Clean 3D showcase for anything else',
        spec: 'Square or 4:5 photos, 1080 px or larger, product centered with some margin.',
        aspect: '9:16', backgroundColor: '#f6f6f6', secondsPerImage: 2, gradient: 'warm', gradientStrength: 28, brightness: 108, saturation: 112,
        transition: 'cut', motions: ['depth-dolly', 'zoom-in'],
        textStyle: 'banner', textPosition: 'bottom', fontFamily: 'sans', shine: true, vignette: 14,
        shots: [
            { title: 'Hero shot', tip: 'The product, centered and clear', caption: 'Meet your new favorite.' },
            { title: 'Key feature', tip: 'What makes it special', caption: 'Built different.' },
            { title: 'Detail', tip: 'A close-up of quality', caption: 'Quality you can feel.' },
            { title: 'In use', tip: 'The product being used', caption: 'Made for everyday life.' },
            { title: 'Call to action', tip: 'Best photo or the logo', caption: 'Get yours today.' },
        ],
    },
];

export const getTemplateClipStyle = (template: ProductTemplate, index: number, type: ReelImage['type']): Partial<ReelImage> => {
    const caption = template.shots[index]?.caption ?? '';
    return {
        transition: template.transition,
        motion: type === 'image' ? template.motions[index % template.motions.length] : 'none',
        textStyle: template.textStyle,
        textPosition: template.textPosition,
        textOffset: { x: 0, y: 0 },
        textSize: template.textSize ?? 1,
        textColor: template.textColor,
        fontFamily: template.fontFamily,
        shine: template.shine,
        vignette: template.vignette,
        overlayText: caption,
        autoCaption: Boolean(caption),
    };
};

/** Project-wide settings a product template changes. */
export const productTemplateSettings = (tpl: ProductTemplate): Partial<ReelSettings> => ({
    aspectRatio: tpl.aspect,
    backgroundColor: tpl.backgroundColor,
    secondsPerImage: tpl.secondsPerImage,
    gradient: tpl.gradient,
    gradientStrength: tpl.gradientStrength,
    brightness: tpl.brightness,
    saturation: tpl.saturation,
});

export const applyProductTemplateToClips = (tpl: ProductTemplate, clips: ReelImage[]): ReelImage[] =>
    clips.map((clip, index) => {
        const style = getTemplateClipStyle(tpl, index, clip.type);
        const keepCaption = clip.overlayText.trim() !== '' && !clip.autoCaption;
        return {
            ...clip,
            ...style,
            overlayText: keepCaption ? clip.overlayText : style.overlayText ?? '',
            autoCaption: keepCaption ? false : style.autoCaption,
        };
    });

/* -------------------------------------------------------------------------- */
/* "Reel template" presets (travel, birthday, ...)                            */
/* -------------------------------------------------------------------------- */

interface ReelPreset {
    gradient: GradientPreset; strength: number; brightness: number; saturation: number;
    transition: ReelImage['transition']; motion: ReelImage['motion'];
    style: TextOverlayStyle; position: TextPosition; seconds: number; caption: string;
}

export const REEL_PRESETS: Record<Exclude<ReelTemplate, 'custom'>, ReelPreset> = {
    travel: { gradient: 'ocean', strength: 30, brightness: 108, saturation: 112, transition: 'fade', motion: 'pan-left', style: 'classic', position: 'bottom', seconds: 4, caption: 'A little moment from the journey ✨' },
    birthday: { gradient: 'violet', strength: 42, brightness: 105, saturation: 118, transition: 'zoom', motion: 'zoom-in', style: 'highlight', position: 'center', seconds: 3, caption: 'Celebrating a day as special as you 🎂' },
    product: { gradient: 'warm', strength: 28, brightness: 105, saturation: 108, transition: 'slide', motion: 'zoom-in', style: 'banner', position: 'bottom', seconds: 3, caption: 'Meet your new everyday favorite.' },
    festival: { gradient: 'sunset', strength: 40, brightness: 108, saturation: 120, transition: 'fade', motion: 'zoom-in', style: 'highlight', position: 'center', seconds: 3, caption: 'Wishing you joy, light, and togetherness ✨' },
    'product-demo': { gradient: 'warm', strength: 28, brightness: 108, saturation: 112, transition: 'cut', motion: 'depth-dolly', style: 'banner', position: 'bottom', seconds: 1.5, caption: '✨ Premium quality, built to last.' },
};

export const reelPresetSettings = (template: Exclude<ReelTemplate, 'custom'>): Partial<ReelSettings> => {
    const preset = REEL_PRESETS[template];
    return {
        gradient: preset.gradient,
        gradientStrength: preset.strength,
        brightness: preset.brightness,
        saturation: preset.saturation,
        secondsPerImage: preset.seconds,
    };
};

export const applyReelPresetToClips = (template: Exclude<ReelTemplate, 'custom'>, clips: ReelImage[]): ReelImage[] => {
    const preset = REEL_PRESETS[template];
    const showcase = template === 'product-demo' || template === 'product';
    return clips.map((clip) => ({
        ...clip,
        transition: preset.transition,
        motion: clip.type === 'image' ? preset.motion : clip.motion,
        textStyle: preset.style,
        textPosition: preset.position,
        overlayText: clip.overlayText.trim() ? clip.overlayText : preset.caption,
        shine: showcase ? true : clip.shine,
        vignette: template === 'product-demo' ? clip.vignette ?? 14 : clip.vignette,
    }));
};
