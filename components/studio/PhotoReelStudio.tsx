'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowDown, ArrowUp, Download, FolderOpen, ImagePlus, Loader2, Music2, Play, Save, Trash2, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react';
import { AspectRatioType } from '@/types/studio';
import { createExportRecorder, getExportDimensions, RECORDING_FRAME_RATE } from '@/components/recordingQuality';
import { drawFreeTierWatermark, FREE_VIDEO_LIMIT_MS } from '@/components/freeTier';
import { TextOverlayStyle } from '@/types/editor';
import { DepthMotion, getDepthMap, getPhotoCacheKey, isDepthMotion } from './depthEstimator';
import { getDepthRenderer } from './depthRenderer';
import { deletePhotoReelDraft, listPhotoReelDrafts, loadPhotoReelDraft, PhotoReelDraftSummary, savePhotoReelDraft } from './photoReelDrafts';

/* -------------------------------------------------------------------------- */
/* Types & constants                                                          */
/* -------------------------------------------------------------------------- */

type FontKey = 'sans' | 'serif' | 'mono' | 'display';
type GradientPreset = 'none' | 'sunset' | 'violet' | 'ocean' | 'warm';
type ReelTemplate = 'custom' | 'travel' | 'birthday' | 'product' | 'festival' | 'product-demo';
type PlatformAspect = '9:16' | '1:1' | '16:9' | '4:5';
type TextPosition = 'top' | 'center' | 'bottom';
type Corner = 'tl' | 'tr' | 'bl' | 'br';

interface ReelImage {
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
    textColor?: string;                    // caption color (hex)
    fontFamily?: FontKey;                  // caption font
    shine?: boolean;                       // light sweep across the product
    vignette?: number;                     // 0 – 60 (% darkness at the edges)
    softEdges?: boolean;                   // fade photo edges when zoomed out (3D clips)
    badgeText?: string;                    // sticker such as "NEW" or "₹999"
    badgeColor?: string;
    badgeCorner?: Corner;
    autoCaption?: boolean;                 // caption came from the template (safe to replace)
    scale?: number;                        // image zoom (0.5 – 2.5)
    motion: 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | DepthMotion;
    transition: 'cut' | 'fade' | 'slide' | 'zoom';
}

const FONT_FAMILIES: Record<FontKey, string> = {
    sans: 'sans-serif',
    serif: 'Georgia, serif',
    mono: 'ui-monospace, Menlo, monospace',
    display: 'Impact, "Arial Black", sans-serif',
};

const GRADIENTS: Array<{ id: GradientPreset; label: string; colors: [string, string] }> = [
    { id: 'none', label: 'None', colors: ['0,0,0', '0,0,0'] },
    { id: 'sunset', label: 'Sunset', colors: ['249,115,22', '190,24,93'] },
    { id: 'violet', label: 'Violet', colors: ['124,58,237', '30,64,175'] },
    { id: 'ocean', label: 'Ocean', colors: ['8,145,178', '30,58,138'] },
    { id: 'warm', label: 'Warm', colors: ['234,179,8', '220,38,38'] },
];

const TEXT_BASE_Y: Record<TextPosition, number> = { top: 15, center: 50, bottom: 82 }; // % of frame height

const getCanvasSize = (aspect: PlatformAspect) => ({
    width: aspect === '16:9' ? 960 : 540,
    height: aspect === '9:16' ? 960 : aspect === '4:5' ? 675 : 540,
});

const getReadableTextColor = (hex: string) => {
    const raw = hex.replace('#', '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#111111' : '#ffffff';
};

const getCornerPosition = (corner: Corner, boxW: number, boxH: number, width: number, height: number, margin: number) => ({
    x: corner === 'tl' || corner === 'bl' ? margin : width - boxW - margin,
    y: corner === 'tl' || corner === 'tr' ? margin * 1.6 : height - boxH - margin * 1.6,
});

/** Fades the edges of a drawn rectangle so a zoomed-out photo does not look like a hard-edged card. */
let softEdgeScratch: HTMLCanvasElement | null = null;
function drawSoftEdged(ctx: CanvasRenderingContext2D, source: CanvasImageSource, x: number, y: number, w: number, h: number, canvasW: number, canvasH: number, feather: number) {
    if (!softEdgeScratch) softEdgeScratch = document.createElement('canvas');
    if (softEdgeScratch.width !== canvasW || softEdgeScratch.height !== canvasH) {
        softEdgeScratch.width = canvasW;
        softEdgeScratch.height = canvasH;
    }
    const scratch = softEdgeScratch.getContext('2d');
    if (!scratch) {
        ctx.drawImage(source, x, y, w, h);
        return;
    }
    scratch.globalCompositeOperation = 'source-over';
    scratch.clearRect(0, 0, canvasW, canvasH);
    scratch.drawImage(source, x, y, w, h);
    scratch.globalCompositeOperation = 'destination-out';
    const f = Math.max(1, Math.min(feather, w / 2, h / 2));
    const fade = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
        const gradient = scratch.createLinearGradient(x0, y0, x1, y1);
        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        scratch.fillStyle = gradient;
        scratch.fillRect(rx, ry, rw, rh);
    };
    fade(x, 0, x + f, 0, x, y, f, h);
    fade(x + w, 0, x + w - f, 0, x + w - f, y, f, h);
    fade(0, y, 0, y + f, x, y, w, f);
    fade(0, y + h, 0, y + h - f, x, y + h - f, w, f);
    scratch.globalCompositeOperation = 'source-over';
    ctx.drawImage(softEdgeScratch, 0, 0);
}

/** Vignette, shine sweep, badge sticker and brand logo. Shared by the live preview and the export. */
function drawProductEffects(ctx: CanvasRenderingContext2D, clip: ReelImage, width: number, height: number, t: number, logo: { image: HTMLImageElement | null; corner: Corner; sizePct: number }) {
    const vignette = clip.vignette ?? 0;
    if (vignette > 0) {
        const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${(vignette / 100) * 0.7})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    if (clip.shine) {
        const sweep = clamp((t - 0.2) / 0.5, 0, 1);
        if (sweep > 0 && sweep < 1) {
            const bandW = width * 0.28;
            const slant = 0.35;
            const x = -bandW + sweep * (width + bandW * 2 + slant * height);
            ctx.save();
            ctx.transform(1, 0, -slant, 1, 0, 0);
            const gradient = ctx.createLinearGradient(x, 0, x + bandW, 0);
            gradient.addColorStop(0, 'rgba(255,255,255,0)');
            gradient.addColorStop(0.5, 'rgba(255,255,255,0.38)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x, 0, bandW, height);
            ctx.restore();
        }
    }

    const badge = clip.badgeText?.trim();
    if (badge) {
        const fontSize = Math.round(width * 0.045);
        ctx.save();
        ctx.font = `800 ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const boxW = ctx.measureText(badge).width + fontSize * 1.4;
        const boxH = fontSize * 1.9;
        const { x, y } = getCornerPosition(clip.badgeCorner ?? 'tl', boxW, boxH, width, height, width * 0.05);
        const color = clip.badgeColor ?? '#ef4444';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, boxW, boxH, boxH / 2);
        ctx.fill();
        ctx.fillStyle = getReadableTextColor(color);
        ctx.fillText(badge, x + boxW / 2, y + boxH / 2 + fontSize * 0.04);
        ctx.restore();
    }

    if (logo.image && logo.image.complete && logo.image.naturalWidth > 0) {
        const logoW = width * (logo.sizePct / 100);
        const logoH = logoW * (logo.image.naturalHeight / logo.image.naturalWidth);
        const { x, y } = getCornerPosition(logo.corner, logoW, logoH, width, height, width * 0.05);
        ctx.drawImage(logo.image, x, y, logoW, logoH);
    }
}

/* -------------------------------------------------------------------------- */
/* Product templates: pick a category, add photos, done                       */
/* -------------------------------------------------------------------------- */

interface ProductTemplate {
    id: string;
    label: string;
    emoji: string;
    blurb: string;
    spec: string; // recommended upload
    aspect: PlatformAspect;
    backgroundColor: string;
    secondsPerImage: number;
    gradient: GradientPreset;
    gradientStrength: number;
    brightness: number;
    saturation: number;
    transition: ReelImage['transition'];
    motions: ReelImage['motion'][]; // cycled per photo
    textStyle: TextOverlayStyle;
    textPosition: TextPosition;
    fontFamily: FontKey;
    textColor?: string;
    textSize?: number;
    shine: boolean;
    vignette: number;
    shots: Array<{ title: string; tip: string; caption: string }>;
}

const PRODUCT_TEMPLATES: ProductTemplate[] = [
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

const getTemplateClipStyle = (template: ProductTemplate, index: number, type: ReelImage['type']): Partial<ReelImage> => {
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

const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const DEFAULT_VIDEO_CLIP_MS = 5000;
const TRANSITION_MS = 450;

const SELECT_CLASS = 'w-full appearance-none rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3 py-2 pr-8 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none cursor-pointer shadow-xs';
const RANGE_CLASS = 'mt-2 w-full accent-[#6A4CFF] bg-[#14121F]/10 h-1.5 rounded-full';
const CARD_CLASS = 'space-y-3 rounded-2xl border border-[#14121F]/10 bg-white p-4 shadow-xs';

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const getDefaultTextColor = (style: TextOverlayStyle) => (style === 'highlight' ? '#111111' : '#ffffff');

/* -------------------------------------------------------------------------- */
/* Small reusable UI pieces                                                   */
/* -------------------------------------------------------------------------- */

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
    return (
        <label className="block text-xs font-semibold text-[#14121F]">
            {label}
            <div className="relative mt-1.5">
                <select value={value} onChange={(event) => onChange(event.target.value)} className={SELECT_CLASS}>{children}</select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#14121F]/50" />
            </div>
        </label>
    );
}

function RangeField({ label, display, min, max, step, value, onChange }: { label: string; display: string; min: number; max: number; step?: number; value: number; onChange: (value: number) => void }) {
    return (
        <label className="block text-xs font-semibold text-[#14121F]">
            {label} · {display}
            <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className={RANGE_CLASS} />
        </label>
    );
}

function DepthPreview({ clip, depth, progress, aspectRatio, filter, backgroundColor, scale, softEdges }: {
    clip: ReelImage;
    depth: HTMLCanvasElement;
    progress: number;
    aspectRatio: PlatformAspect;
    filter: string;
    backgroundColor: string;
    scale: number;
    softEdges: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { width, height } = getCanvasSize(aspectRatio);
    const [image, setImage] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
        const element = new Image();
        element.onload = () => setImage(element);
        element.src = clip.url;
    }, [clip.url]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const renderer = getDepthRenderer();
        if (!canvas || !renderer || !image || !image.naturalWidth || !isDepthMotion(clip.motion)) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Zoom is drawn into the canvas itself (same math as the export), not via CSS.
        const scaledW = width * scale;
        const scaledH = height * scale;
        const dx = (width - scaledW) / 2;
        const dy = (height - scaledH) / 2;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
        try {
            const frame = renderer.render({ key: getPhotoCacheKey(clip.file), photo: image, depth, width, height, motion: clip.motion, progress });
            if (softEdges && scale < 0.98) drawSoftEdged(ctx, frame, dx, dy, scaledW, scaledH, width, height, Math.min(width, height) * 0.08);
            else ctx.drawImage(frame, dx, dy, scaledW, scaledH);
        } catch {
            ctx.drawImage(image, dx, dy, scaledW, scaledH);
        }
    }, [clip, depth, image, progress, width, height, backgroundColor, scale, softEdges]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="h-full w-full object-contain"
            style={{ filter, backgroundColor }}
        />
    );
}

/** Live preview of vignette, shine, badge and logo (same drawing code as the export). */
function EffectsOverlay({ clip, progress, aspectRatio, logoImage, logoCorner, logoSize }: {
    clip: ReelImage;
    progress: number;
    aspectRatio: PlatformAspect;
    logoImage: HTMLImageElement | null;
    logoCorner: Corner;
    logoSize: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { width, height } = getCanvasSize(aspectRatio);

    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        drawProductEffects(ctx, clip, width, height, progress, { image: logoImage, corner: logoCorner, sizePct: logoSize });
    }, [clip, progress, width, height, logoImage, logoCorner, logoSize]);

    return <canvas ref={canvasRef} width={width} height={height} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/** Draggable caption shown over the preview. Uses the same % + font math as the canvas export. */
function CaptionOverlay({ clip, onPointerDown, onPointerMove, onPointerUp }: {
    clip: ReelImage;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
    const color = clip.textColor ?? getDefaultTextColor(clip.textStyle);
    const isOutline = clip.textStyle === 'outline';
    const boxClass = clip.textStyle === 'banner' ? 'rounded-lg bg-black/80' : clip.textStyle === 'highlight' ? 'rounded-lg bg-yellow-400/95' : '';

    return (
        <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`absolute cursor-move text-center font-bold leading-tight ${boxClass}`}
            style={{
                left: `${50 + (clip.textOffset?.x ?? 0)}%`,
                top: `${TEXT_BASE_Y[clip.textPosition] + (clip.textOffset?.y ?? 0)}%`,
                transform: 'translate(-50%, -50%)',
                width: 'max-content',
                maxWidth: '82%',
                fontSize: `${6.5 * (clip.textSize ?? 1)}cqw`,
                fontFamily: FONT_FAMILIES[clip.fontFamily ?? 'sans'],
                padding: '0.3em 0.42em',
                color: isOutline ? 'transparent' : color,
                WebkitTextStroke: isOutline ? `0.07em ${color}` : undefined,
                textShadow: clip.textStyle === 'classic' ? '0 0 0.1em rgba(0,0,0,.9), 0 0 0.2em rgba(0,0,0,.6)' : undefined,
                touchAction: 'none',
            }}
        >
            {clip.overlayText}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

export function PhotoReelStudio({ onBack }: { onBack: () => void }) {
    /* ---- clips & look ---- */
    const [images, setImages] = useState<ReelImage[]>([]);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState<PlatformAspect>('9:16');
    const [backgroundColor, setBackgroundColor] = useState<string>('#f6f6f6');
    const [secondsPerImage, setSecondsPerImage] = useState(3);
    const [gradient, setGradient] = useState<GradientPreset>('sunset');
    const [gradientStrength, setGradientStrength] = useState(35);
    const [brightness, setBrightness] = useState(100);
    const [saturation, setSaturation] = useState(100);
    const [template, setTemplate] = useState<ReelTemplate>('custom');

    /* ---- audio ---- */
    const [music, setMusic] = useState<{ file: File; url: string } | null>(null);
    const [musicVolume, setMusicVolume] = useState(70);
    const [narrationText, setNarrationText] = useState('');
    const [narrationLanguage, setNarrationLanguage] = useState<'en' | 'hi' | 'bn' | 'ta' | 'te'>('en');
    const [narrationVoiceGender, setNarrationVoiceGender] = useState<'female' | 'male'>('female');
    const [voiceover, setVoiceover] = useState<{ file: File; url: string } | null>(null);

    /* ---- brand logo ---- */
    const [logo, setLogo] = useState<{ file: File; url: string } | null>(null);
    const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
    const [logoCorner, setLogoCorner] = useState<Corner>('tr');
    const [logoSize, setLogoSize] = useState(18);

    /* ---- preview ---- */
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [previewTimeMs, setPreviewTimeMs] = useState(0);
    const [isDraggingCaption, setIsDraggingCaption] = useState(false);

    /* ---- export ---- */
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportStatus, setExportStatus] = useState<string | null>(null);
    const [completedExportUrl, setCompletedExportUrl] = useState<string | null>(null);

    /* ---- drafts & errors ---- */
    const [drafts, setDrafts] = useState<PhotoReelDraftSummary[]>([]);
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    /* ---- product templates ---- */
    const [productTemplateId, setProductTemplateId] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    /* ---- depth ---- */
    const [depthStatus, setDepthStatus] = useState<Record<string, 'ready' | 'failed'>>({});
    const [depthMaps, setDepthMaps] = useState<Record<string, HTMLCanvasElement>>({});

    /* ---- refs ---- */
    const frameRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const musicInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const exportVoiceoverRef = useRef<HTMLAudioElement | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement>(null);
    const previewVoiceoverRef = useRef<HTMLAudioElement>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
    const videoCacheRef = useRef(new Map<string, HTMLVideoElement>());
    const videoPosterFramesRef = useRef(new Map<string, HTMLCanvasElement>());
    const depthMapsRef = useRef(new Map<string, HTMLCanvasElement>());
    const depthJobsRef = useRef(new Map<string, string>());
    const imagesRef = useRef(images);
    const musicRef = useRef(music);
    const voiceoverRef = useRef(voiceover);
    const logoRef = useRef(logo);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const previewTimeRef = useRef(0);

    /* ---- derived ---- */
    const getClipDurationMs = (clip: ReelImage) => (clip.type === 'image' ? secondsPerImage * 1000 : clip.durationMs);
    const durationMs = images.reduce((total, clip) => total + getClipDurationMs(clip), 0);
    const getStartAtIndex = (targetIndex: number) => images.slice(0, targetIndex).reduce((total, clip) => total + getClipDurationMs(clip), 0);
    const getIndexAtTime = (timeMs: number) => {
        let elapsedMs = 0;
        for (let index = 0; index < images.length; index += 1) {
            elapsedMs += getClipDurationMs(images[index]);
            if (timeMs < elapsedMs) return index;
        }
        return Math.max(0, images.length - 1);
    };

    const safePreviewIndex = getIndexAtTime(previewTimeMs);
    const activeImage = images[safePreviewIndex] ?? null;
    const activeClipStartMs = getStartAtIndex(safePreviewIndex);
    const selectedImage = images.find((image) => image.id === selectedImageId) ?? null;
    const productTemplate = PRODUCT_TEMPLATES.find((item) => item.id === productTemplateId) ?? null;
    const durationLabel = useMemo(() => `${(durationMs / 1000).toFixed(0)} sec`, [durationMs]);

    const updateClip = (id: string, patch: Partial<ReelImage>) =>
        setImages((current) => current.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip)));
    const updateSelected = (patch: Partial<ReelImage>) => {
        if (selectedImageId) updateClip(selectedImageId, patch);
    };

    /* ---------------------------------------------------------------------- */
    /* Effects                                                                */
    /* ---------------------------------------------------------------------- */

    useEffect(() => {
        imagesRef.current = images;
        musicRef.current = music;
        voiceoverRef.current = voiceover;
        logoRef.current = logo;
    }, [images, music, voiceover, logo]);

    useEffect(() => {
        if (!logo) {
            setLogoImage(null);
            return;
        }
        const element = new Image();
        element.onload = () => setLogoImage(element);
        element.src = logo.url;
    }, [logo]);

    const ensureDepth = (clip: ReelImage): Promise<void> => {
        const cacheKey = getPhotoCacheKey(clip.file);
        if (depthJobsRef.current.get(clip.id) === cacheKey) return Promise.resolve();
        depthJobsRef.current.set(clip.id, cacheKey);
        return getDepthMap(clip.file)
            .then((depth) => {
                depthMapsRef.current.set(clip.id, depth);
                setDepthMaps((current) => ({ ...current, [clip.id]: depth }));
                setDepthStatus((current) => ({ ...current, [clip.id]: 'ready' }));
            })
            .catch(() => {
                setDepthStatus((current) => ({ ...current, [clip.id]: 'failed' }));
            });
    };

    useEffect(() => {
        images.forEach((clip) => {
            if (clip.type === 'image' && isDepthMotion(clip.motion)) void ensureDepth(clip);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images]);

    useEffect(() => {
        let cancelled = false;
        listPhotoReelDrafts()
            .then((items) => { if (!cancelled) setDrafts(items); })
            .catch(() => { if (!cancelled) setError('Could not load saved reel drafts.'); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => () => {
        imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
        if (musicRef.current) URL.revokeObjectURL(musicRef.current.url);
        if (voiceoverRef.current) URL.revokeObjectURL(voiceoverRef.current.url);
        if (logoRef.current) URL.revokeObjectURL(logoRef.current.url);
        audioRef.current?.pause();
        exportVoiceoverRef.current?.pause();
        previewAudioRef.current?.pause();
        previewVoiceoverRef.current?.pause();
        videoCacheRef.current.forEach((video) => { video.pause(); video.src = ''; });
        void audioContextRef.current?.close().catch(() => undefined);
    }, []);

    useEffect(() => () => {
        if (completedExportUrl) URL.revokeObjectURL(completedExportUrl);
    }, [completedExportUrl]);

    /* ---------------------------------------------------------------------- */
    /* Preview playback                                                       */
    /* ---------------------------------------------------------------------- */

    const seekPreview = (timeMs: number) => {
        const nextTime = clamp(timeMs, 0, durationMs);
        previewTimeRef.current = nextTime;
        setPreviewTimeMs(nextTime);
        const audio = previewAudioRef.current;
        if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
            audio.currentTime = (nextTime / 1000) % audio.duration;
        }
        const voiceoverAudio = previewVoiceoverRef.current;
        if (voiceoverAudio && Number.isFinite(voiceoverAudio.duration) && voiceoverAudio.duration > 0) {
            voiceoverAudio.currentTime = Math.min(nextTime / 1000, Math.max(0, voiceoverAudio.duration - 0.05));
        }
        const video = previewVideoRef.current;
        if (video && activeImage?.type === 'video' && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            const localTime = Math.max(0, (nextTime - activeClipStartMs) / 1000);
            video.currentTime = Math.min(localTime, Math.max(0, (video.duration || localTime) - 0.05));
        }
    };

    const togglePreview = () => {
        if (!images.length) return;
        if (isPreviewPlaying) {
            setIsPreviewPlaying(false);
            return;
        }
        if (previewTimeRef.current >= durationMs) seekPreview(0);
        setIsPreviewPlaying(true);
    };

    useEffect(() => {
        if (!isPreviewPlaying || images.length === 0) return;
        let frameId = 0;
        let lastFrameTime = performance.now();
        const audio = previewAudioRef.current;
        const voice = previewVoiceoverRef.current;
        if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
            audio.currentTime = (previewTimeRef.current / 1000) % audio.duration;
            audio.play().catch(() => setError('The music preview could not start.'));
        }
        if (voice && Number.isFinite(voice.duration) && voice.duration > 0 && previewTimeRef.current < voice.duration * 1000) {
            voice.currentTime = previewTimeRef.current / 1000;
            voice.play().catch(() => setError('The voiceover preview could not start.'));
        }
        const advance = (now: number) => {
            const elapsed = now - lastFrameTime;
            lastFrameTime = now;
            const nextTime = Math.min(durationMs, previewTimeRef.current + elapsed);
            previewTimeRef.current = nextTime;
            setPreviewTimeMs(nextTime);

            const activeAudio = previewAudioRef.current;
            if (activeAudio && !activeAudio.paused && Number.isFinite(activeAudio.duration) && activeAudio.duration > 0) {
                const expected = (nextTime / 1000) % activeAudio.duration;
                if (Math.abs(activeAudio.currentTime - expected) > 0.4) activeAudio.currentTime = expected;
            }
            const activeVoice = previewVoiceoverRef.current;
            if (activeVoice && !activeVoice.paused && Number.isFinite(activeVoice.duration) && activeVoice.duration > 0) {
                if (nextTime < activeVoice.duration * 1000) {
                    if (Math.abs(activeVoice.currentTime - nextTime / 1000) > 0.4) activeVoice.currentTime = nextTime / 1000;
                } else {
                    activeVoice.pause();
                }
            }
            if (nextTime >= durationMs) {
                setIsPreviewPlaying(false);
                return;
            }
            frameId = requestAnimationFrame(advance);
        };
        frameId = requestAnimationFrame(advance);
        return () => {
            cancelAnimationFrame(frameId);
            audio?.pause();
            voice?.pause();
        };
    }, [isPreviewPlaying, images.length, durationMs]);

    useEffect(() => {
        const audio = previewAudioRef.current;
        if (audio) {
            audio.volume = musicVolume / 100;
            audio.loop = true;
            if (!music) audio.pause();
        }
        const voice = previewVoiceoverRef.current;
        if (voice) voice.volume = 1;
    }, [music, musicVolume]);

    useEffect(() => {
        if (activeImage?.type !== 'video') return;
        const video = previewVideoRef.current;
        if (!video) return;
        video.muted = true;
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            const localTime = Math.max(0, (previewTimeRef.current - activeClipStartMs) / 1000);
            video.currentTime = Math.min(localTime, Math.max(0, (video.duration || localTime) - 0.05));
        }
        if (isPreviewPlaying) video.play().catch(() => setError('This video clip could not play in the preview.'));
        else video.pause();
        return () => video.pause();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeImage?.id, activeImage?.type, activeClipStartMs, isPreviewPlaying]);

    /* ---------------------------------------------------------------------- */
    /* Clip management                                                        */
    /* ---------------------------------------------------------------------- */

    const addImages = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        setError(null);

        const validFiles = files.filter((file) =>
            (file.type.startsWith('image/') && file.size <= MAX_IMAGE_BYTES) ||
            (file.type.startsWith('video/') && file.size <= MAX_VIDEO_BYTES));
        if (validFiles.length !== files.length) setError('Some files were skipped. Use images under 12 MB and videos under 100 MB.');

        const accepted = validFiles.slice(0, Math.max(0, MAX_IMAGES - images.length));
        if (accepted.length < validFiles.length) setError(`A reel can contain up to ${MAX_IMAGES} photos and video clips combined.`);

        const nextImages = accepted.map((file, fileIndex): ReelImage => {
            const type: ReelImage['type'] = file.type.startsWith('video/') ? 'video' : 'image';
            const url = URL.createObjectURL(file);
            const baseClip: ReelImage = {
                id: makeId(),
                type,
                file,
                url,
                durationMs: type === 'image' ? secondsPerImage * 1000 : DEFAULT_VIDEO_CLIP_MS,
                overlayText: '',
                description: '',
                textStyle: 'banner',
                textPosition: 'bottom',
                textOffset: { x: 0, y: 0 },
                textSize: 1,
                fontFamily: 'sans',
                scale: 1,
                motion: type === 'image' ? 'zoom-in' : 'none',
                transition: 'fade',
            };
            const clip: ReelImage = productTemplate
                ? { ...baseClip, ...getTemplateClipStyle(productTemplate, images.length + fileIndex, type) }
                : baseClip;
            if (type === 'video') {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.muted = true;
                video.playsInline = true;
                videoCacheRef.current.set(clip.id, video);
                video.onloadedmetadata = () => {
                    const sourceDurationMs = Number.isFinite(video.duration) ? video.duration * 1000 : DEFAULT_VIDEO_CLIP_MS;
                    updateClip(clip.id, { sourceDurationMs, durationMs: Math.min(DEFAULT_VIDEO_CLIP_MS, sourceDurationMs) });
                };
                video.onerror = () => setError(`Could not load video clip ${file.name}. Try an MP4 or WebM file.`);
                video.src = url;
            }
            return clip;
        });

        setImages((current) => [...current, ...nextImages]);
        void checkResolution(accepted);
        if (!selectedImageId && nextImages[0]) setSelectedImageId(nextImages[0].id);
        if (images.length === 0 && nextImages.length > 0) seekPreview(0);
        setIsPreviewPlaying(false);
    };

    const removeImage = (id: string) => {
        setImages((current) => {
            const image = current.find((item) => item.id === id);
            if (image) URL.revokeObjectURL(image.url);
            imageCacheRef.current.delete(id);
            videoPosterFramesRef.current.delete(id);
            const video = videoCacheRef.current.get(id);
            if (video) {
                video.pause();
                video.src = '';
                videoCacheRef.current.delete(id);
            }
            const remaining = current.filter((item) => item.id !== id);
            if (selectedImageId === id) setSelectedImageId(remaining[0]?.id ?? null);
            if (remaining.length === 0) seekPreview(0);
            return remaining;
        });
    };

    const moveImage = (id: string, direction: -1 | 1) => {
        setImages((current) => {
            const index = current.findIndex((item) => item.id === id);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= current.length) return current;
            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const setMusicFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('audio/')) {
            setError('Choose an audio file for the background music.');
            return;
        }
        if (music) URL.revokeObjectURL(music.url);
        setMusic({ file, url: URL.createObjectURL(file) });
        setError(null);
    };

    /** Non-blocking quality check: warn about small photos instead of rejecting them. */
    const checkResolution = async (files: File[]) => {
        const low: string[] = [];
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            try {
                const bitmap = await createImageBitmap(file);
                if (Math.min(bitmap.width, bitmap.height) < 720) low.push(`${file.name} (${bitmap.width}×${bitmap.height})`);
                bitmap.close();
            } catch {
                /* ignore unreadable files, the normal decode path reports them */
            }
        }
        setNotice(low.length ? `Low resolution, so it may look soft in the reel: ${low.join(', ')}. Use photos 1080 px or larger.` : null);
    };

    const applyProductTemplate = (id: string | null) => {
        setProductTemplateId(id);
        setTemplate('custom');
        const tpl = PRODUCT_TEMPLATES.find((item) => item.id === id);
        if (!tpl) return;
        setAspectRatio(tpl.aspect);
        setBackgroundColor(tpl.backgroundColor);
        setSecondsPerImage(tpl.secondsPerImage);
        setGradient(tpl.gradient);
        setGradientStrength(tpl.gradientStrength);
        setBrightness(tpl.brightness);
        setSaturation(tpl.saturation);
        setImages((current) => current.map((clip, index) => {
            const style = getTemplateClipStyle(tpl, index, clip.type);
            const keepCaption = clip.overlayText.trim() !== '' && !clip.autoCaption;
            return {
                ...clip,
                ...style,
                overlayText: keepCaption ? clip.overlayText : style.overlayText ?? '',
                autoCaption: keepCaption ? false : style.autoCaption,
            };
        }));
    };

    const setLogoFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Choose an image file (PNG with a transparent background works best) for the logo.');
            return;
        }
        if (logo) URL.revokeObjectURL(logo.url);
        setLogo({ file, url: URL.createObjectURL(file) });
        setError(null);
    };

    /** Samples the top-left pixel of the selected photo and uses it as the reel background. */
    const matchBackgroundToPhoto = () => {
        if (!selectedImage || selectedImage.type !== 'image') return;
        const element = getImage(selectedImage);
        if (!element.naturalWidth) return;
        try {
            const probe = document.createElement('canvas');
            probe.width = 4;
            probe.height = 4;
            const probeCtx = probe.getContext('2d', { willReadFrequently: true });
            if (!probeCtx) return;
            probeCtx.drawImage(element, 0, 0, 4, 4);
            const [r, g, b] = probeCtx.getImageData(0, 0, 1, 1).data;
            setBackgroundColor(`#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`);
        } catch {
            setError('Could not read the background color from this photo.');
        }
    };

    const applyTemplate = (nextTemplate: ReelTemplate) => {
        setTemplate(nextTemplate);
        if (nextTemplate === 'custom') return;

        const config: Record<Exclude<ReelTemplate, 'custom'>, {
            gradient: GradientPreset; strength: number; brightness: number; saturation: number;
            transition: ReelImage['transition']; motion: ReelImage['motion'];
            style: TextOverlayStyle; position: TextPosition; seconds: number; caption: string;
        }> = {
            travel: { gradient: 'ocean', strength: 30, brightness: 108, saturation: 112, transition: 'fade', motion: 'pan-left', style: 'classic', position: 'bottom', seconds: 4, caption: 'A little moment from the journey ✨' },
            birthday: { gradient: 'violet', strength: 42, brightness: 105, saturation: 118, transition: 'zoom', motion: 'zoom-in', style: 'highlight', position: 'center', seconds: 3, caption: 'Celebrating a day as special as you 🎂' },
            product: { gradient: 'warm', strength: 28, brightness: 105, saturation: 108, transition: 'slide', motion: 'zoom-in', style: 'banner', position: 'bottom', seconds: 3, caption: 'Meet your new everyday favorite.' },
            festival: { gradient: 'sunset', strength: 40, brightness: 108, saturation: 120, transition: 'fade', motion: 'zoom-in', style: 'highlight', position: 'center', seconds: 3, caption: 'Wishing you joy, light, and togetherness ✨' },
            'product-demo': { gradient: 'warm', strength: 28, brightness: 108, saturation: 112, transition: 'cut', motion: 'depth-dolly', style: 'banner', position: 'bottom', seconds: 1.5, caption: '✨ Premium quality, built to last.' },
        };

        const preset = config[nextTemplate];
        setGradient(preset.gradient);
        setGradientStrength(preset.strength);
        setBrightness(preset.brightness);
        setSaturation(preset.saturation);
        setSecondsPerImage(preset.seconds);
        setImages((current) => current.map((clip) => ({
            ...clip,
            transition: preset.transition,
            motion: clip.type === 'image' ? preset.motion : clip.motion,
            textStyle: preset.style,
            textPosition: preset.position,
            overlayText: clip.overlayText.trim() ? clip.overlayText : preset.caption,
            shine: nextTemplate === 'product-demo' || nextTemplate === 'product' ? true : clip.shine,
            vignette: nextTemplate === 'product-demo' ? clip.vignette ?? 14 : clip.vignette,
        })));
    };

    /* ---------------------------------------------------------------------- */
    /* Caption dragging                                                       */
    /* ---------------------------------------------------------------------- */

    const handleCaptionPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!activeImage) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setSelectedImageId(activeImage.id);
        setIsDraggingCaption(true);
    };

    const handleCaptionPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingCaption || !activeImage || !frameRef.current) return;
        const rect = frameRef.current.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dx = (event.movementX / rect.width) * 100;
        const dy = (event.movementY / rect.height) * 100;
        const current = activeImage.textOffset ?? { x: 0, y: 0 };
        updateClip(activeImage.id, {
            textOffset: { x: clamp(current.x + dx, -45, 45), y: clamp(current.y + dy, -50, 50) },
        });
    };

    const handleCaptionPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        setIsDraggingCaption(false);
    };

    /* ---------------------------------------------------------------------- */
    /* Media helpers                                                          */
    /* ---------------------------------------------------------------------- */

    const getImage = (image: ReelImage) => {
        let element = imageCacheRef.current.get(image.id);
        if (!element) {
            element = new Image();
            element.src = image.url;
            imageCacheRef.current.set(image.id, element);
        }
        return element;
    };

    const getVideo = (clip: ReelImage) => {
        let element = videoCacheRef.current.get(clip.id);
        if (!element) {
            element = document.createElement('video');
            element.src = clip.url;
            element.preload = 'auto';
            element.muted = true;
            element.playsInline = true;
            videoCacheRef.current.set(clip.id, element);
        }
        return element;
    };

    const waitForImageDecode = async (image: HTMLImageElement, fileName: string) => {
        try {
            if (!image.complete || image.naturalWidth === 0) {
                await new Promise<void>((resolve, reject) => {
                    const timeout = window.setTimeout(() => reject(new Error(`Photo ${fileName} took too long to load.`)), 10000);
                    image.onload = () => { window.clearTimeout(timeout); resolve(); };
                    image.onerror = () => { window.clearTimeout(timeout); reject(new Error(`Could not decode photo ${fileName}.`)); };
                });
            }
            if (typeof image.decode === 'function') await image.decode();
            if (image.naturalWidth === 0 || image.naturalHeight === 0) throw new Error(`Could not decode photo ${fileName}.`);
        } catch (cause) {
            throw cause instanceof Error ? cause : new Error(`Could not decode photo ${fileName}.`);
        }
    };

    const waitForVideoFrame = (video: HTMLVideoElement, fileName: string, timeoutMs = 10000) => new Promise<boolean>((resolve, reject) => {
        const hasFrame = () => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0;
        if (hasFrame()) {
            resolve(true);
            return;
        }
        const events = ['loadeddata', 'canplay', 'seeked', 'playing', 'timeupdate'] as const;
        const cleanup = () => {
            window.clearTimeout(timeout);
            events.forEach((name) => video.removeEventListener(name, checkReady));
            video.removeEventListener('error', handleError);
        };
        const checkReady = () => {
            if (hasFrame()) {
                cleanup();
                resolve(true);
            }
        };
        const handleError = () => {
            cleanup();
            reject(new Error(`Could not decode ${fileName}.`));
        };
        const timeout = window.setTimeout(() => {
            cleanup();
            resolve(false);
        }, timeoutMs);
        events.forEach((name) => video.addEventListener(name, checkReady));
        video.addEventListener('error', handleError);
        checkReady();
    });

    /* ---------------------------------------------------------------------- */
    /* Canvas rendering (used by export)                                      */
    /* ---------------------------------------------------------------------- */

    const drawCaption = (ctx: CanvasRenderingContext2D, image: ReelImage, width: number, height: number) => {
        if (!image.overlayText.trim()) return;

        const fontSize = Math.max(14, Math.round(width * 0.065 * (image.textSize ?? 1)));
        const padding = fontSize * 0.42;
        const textColor = image.textColor ?? getDefaultTextColor(image.textStyle);
        ctx.font = `700 ${fontSize}px ${FONT_FAMILIES[image.fontFamily ?? 'sans']}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxWidth = width * 0.82;

        const textX = width / 2 + (image.textOffset?.x ?? 0) * (width / 100);
        const textY = height * (TEXT_BASE_Y[image.textPosition] / 100) + (image.textOffset?.y ?? 0) * (height / 100);

        const words = image.overlayText.trim().split(/\s+/);
        const lines: string[] = [];
        let line = '';
        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (line && ctx.measureText(candidate).width > maxWidth - padding * 2) {
                lines.push(line);
                line = word;
            } else line = candidate;
        }
        if (line) lines.push(line);

        const lineHeight = fontSize * 1.2;
        const textHeight = lines.length * lineHeight;
        const boxWidth = Math.min(maxWidth, Math.max(...lines.map((item) => ctx.measureText(item).width), 0) + padding * 2);

        if (image.textStyle === 'banner' || image.textStyle === 'highlight') {
            ctx.fillStyle = image.textStyle === 'banner' ? 'rgba(10,10,10,0.78)' : 'rgba(250,204,21,0.92)';
            ctx.beginPath();
            ctx.roundRect(textX - boxWidth / 2, textY - textHeight / 2 - padding / 2, boxWidth, textHeight + padding, fontSize * 0.2);
            ctx.fill();
        }

        lines.forEach((item, index) => {
            const y = textY + (index - (lines.length - 1) / 2) * lineHeight;
            if (image.textStyle === 'outline') {
                ctx.strokeStyle = textColor;
                ctx.lineWidth = Math.max(2, fontSize * 0.07);
                ctx.strokeText(item, textX, y, maxWidth);
                return;
            }
            if (image.textStyle === 'classic') {
                ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                ctx.lineWidth = fontSize * 0.1;
                ctx.strokeText(item, textX, y, maxWidth);
            }
            ctx.fillStyle = textColor;
            ctx.fillText(item, textX, y, maxWidth);
        });
    };

    const drawSlide = (ctx: CanvasRenderingContext2D, image: ReelImage, width: number, height: number, progress = 0, motionProgress = progress) => {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        const liveVideo = image.type === 'video' ? getVideo(image) : null;
        const videoHasFrame = Boolean(liveVideo && liveVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && liveVideo.videoWidth > 0);
        const element: CanvasImageSource = image.type === 'image'
            ? getImage(image)
            : videoHasFrame ? liveVideo! : videoPosterFramesRef.current.get(image.id) ?? liveVideo!;

        const sourceWidth = element instanceof HTMLImageElement ? element.naturalWidth
            : element instanceof HTMLVideoElement ? element.videoWidth
                : element instanceof HTMLCanvasElement ? element.width : 0;
        const sourceHeight = element instanceof HTMLImageElement ? element.naturalHeight
            : element instanceof HTMLVideoElement ? element.videoHeight
                : element instanceof HTMLCanvasElement ? element.height : 0;
        if (sourceWidth === 0 || sourceHeight === 0) return;

        const progressClamped = clamp(progress, 0, 1);
        const motionT = clamp(motionProgress, 0, 1);
        const requestedMotion = image.type === 'image' ? image.motion ?? 'zoom-in' : 'none';
        const userScale = image.scale ?? 1;

        // 3D depth frame (if the clip uses a depth motion and the map is ready)
        let depthFrame: HTMLCanvasElement | null = null;
        if (isDepthMotion(requestedMotion) && element instanceof HTMLImageElement) {
            const depthMap = depthMapsRef.current.get(image.id);
            const renderer = depthMap ? getDepthRenderer() : null;
            if (depthMap && renderer) {
                try {
                    depthFrame = renderer.render({ key: getPhotoCacheKey(image.file), photo: element, depth: depthMap, width, height, motion: requestedMotion, progress: motionT });
                } catch {
                    depthFrame = null;
                }
            }
        }

        const motion = isDepthMotion(requestedMotion) ? 'zoom-in' : requestedMotion;
        const motionScale = (motion === 'zoom-in' || motion === 'pan-left' || motion === 'pan-right'
            ? 1 + 0.12 * motionT
            : motion === 'zoom-out' ? 1.12 - 0.12 * motionT : 1) * userScale;

        const ratio = Math.min(width / sourceWidth, height / sourceHeight) * 0.95;
        const drawW = sourceWidth * ratio * motionScale;
        const drawH = sourceHeight * ratio * motionScale;
        const drawX = (width - drawW) / 2;
        const drawY = (height - drawH) / 2;

        ctx.save();

        // Entry transition
        const transition = image.transition ?? 'fade';
        if (transition === 'fade') ctx.globalAlpha = progressClamped;
        else if (transition === 'slide') ctx.translate((1 - progressClamped) * width, 0);
        else if (transition === 'zoom') {
            const transitionScale = 1.12 - 0.12 * progressClamped;
            ctx.translate(width / 2, height / 2);
            ctx.scale(transitionScale, transitionScale);
            ctx.translate(-width / 2, -height / 2);
        }

        // Media (the user zoom now applies to depth frames too)
        ctx.filter = `brightness(${brightness}%) saturate(${saturation}%)`;
        const isSaaSMode = productTemplateId === 'saas' || aspectRatio === '16:9';

        if (isSaaSMode && image.type === 'image') {
            const barH = height * 0.06;
            ctx.fillStyle = '#1e1e2e';
            ctx.beginPath();
            ctx.roundRect(drawX, drawY, drawW, drawH, 12);
            ctx.fill();

            const dotR = height * 0.008;
            const dotY = drawY + barH / 2;
            ['#ef4444', '#f59e0b', '#10b981'].forEach((color, i) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(drawX + width * 0.03 + i * (dotR * 3), dotY, dotR, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(drawX, drawY + barH, drawW, drawH - barH, [0, 0, 12, 12]);
            ctx.clip();
            if (depthFrame) {
                ctx.drawImage(depthFrame, drawX, drawY + barH, drawW, drawH - barH);
            } else {
                ctx.drawImage(element, drawX, drawY + barH, drawW, drawH - barH);
            }
            ctx.restore();
        } else if (depthFrame) {
            const depthW = width * userScale;
            const depthH = height * userScale;
            const depthX = (width - depthW) / 2;
            const depthY = (height - depthH) / 2;
            if (image.softEdges !== false && userScale < 0.98) drawSoftEdged(ctx, depthFrame, depthX, depthY, depthW, depthH, width, height, Math.min(width, height) * 0.08);
            else ctx.drawImage(depthFrame, depthX, depthY, depthW, depthH);
        } else {
            ctx.drawImage(element, drawX, drawY, drawW, drawH);
        }
        ctx.filter = 'none';

        // Gradient overlay
        if (gradient !== 'none') {
            const colors = GRADIENTS.find((item) => item.id === gradient)?.colors ?? ['0,0,0', '0,0,0'];
            const overlay = ctx.createLinearGradient(0, 0, 0, height);
            const alpha = gradientStrength / 100;
            overlay.addColorStop(0, `rgba(${colors[0]},${alpha * 0.2})`);
            overlay.addColorStop(0.48, `rgba(${colors[0]},${alpha * 0.52})`);
            overlay.addColorStop(1, `rgba(${colors[1]},${alpha})`);
            ctx.fillStyle = overlay;
            ctx.fillRect(0, 0, width, height);
        }

        drawProductEffects(ctx, image, width, height, motionT, { image: logoImage, corner: logoCorner, sizePct: logoSize });
        drawCaption(ctx, image, width, height);
        ctx.restore();
    };

    /* ---------------------------------------------------------------------- */
    /* Drafts                                                                 */
    /* ---------------------------------------------------------------------- */

    const saveDraft = async () => {
        if (isSavingDraft) return;
        setIsSavingDraft(true);
        setError(null);
        try {
            const id = currentDraftId ?? makeId();
            const savedAt = Date.now();
            const stamp = new Date(savedAt).toLocaleString();
            const data: any = {
                aspectRatio: aspectRatio as unknown as AspectRatioType,
                backgroundColor,
                secondsPerImage,
                gradient,
                gradientStrength,
                brightness,
                saturation,
                musicVolume,
                template,
                productTemplateId,
                narrationText,
                narrationLanguage,
                narrationVoiceGender,
                clips: images.map((clip) => ({
                    id: clip.id,
                    type: clip.type,
                    fileName: clip.file.name,
                    fileType: clip.file.type,
                    blob: clip.file,
                    durationMs: clip.durationMs,
                    sourceDurationMs: clip.sourceDurationMs,
                    overlayText: clip.overlayText,
                    description: clip.description,
                    textStyle: clip.textStyle,
                    textPosition: clip.textPosition,
                    textOffset: clip.textOffset,
                    textSize: clip.textSize,
                    textColor: clip.textColor,
                    fontFamily: clip.fontFamily,
                    shine: clip.shine,
                    vignette: clip.vignette,
                    softEdges: clip.softEdges,
                    autoCaption: clip.autoCaption,
                    badgeText: clip.badgeText,
                    badgeColor: clip.badgeColor,
                    badgeCorner: clip.badgeCorner,
                    scale: clip.scale,
                    motion: clip.motion,
                    transition: clip.transition,
                })),
                music: music ? { fileName: music.file.name, fileType: music.file.type, blob: music.file } : undefined,
                voiceover: voiceover ? { fileName: voiceover.file.name, fileType: voiceover.file.type, blob: voiceover.file } : undefined,
                logo: logo ? { fileName: logo.file.name, fileType: logo.file.type, blob: logo.file } : undefined,
                logoCorner,
                logoSize,
            };
            const summary: PhotoReelDraftSummary = {
                id,
                title: images.length ? `Photo + video reel · ${stamp}` : `Untitled reel · ${stamp}`,
                savedAt,
                clipCount: images.length,
                durationMs,
            };
            await savePhotoReelDraft({ ...summary, data });
            setCurrentDraftId(id);
            setDrafts(await listPhotoReelDrafts());
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save this reel draft.');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const openDraft = async (id: string) => {
        if (isLoadingDraft) return;
        setIsLoadingDraft(true);
        setError(null);
        setIsPreviewPlaying(false);
        try {
            const draft = await loadPhotoReelDraft(id);
            const saved = draft.data as any;

            imagesRef.current.forEach((clip) => URL.revokeObjectURL(clip.url));
            if (musicRef.current) URL.revokeObjectURL(musicRef.current.url);
            if (voiceoverRef.current) URL.revokeObjectURL(voiceoverRef.current.url);
            videoCacheRef.current.forEach((video) => { video.pause(); video.src = ''; });
            videoCacheRef.current.clear();
            imageCacheRef.current.clear();
            videoPosterFramesRef.current.clear();
            depthJobsRef.current.clear();
            depthMapsRef.current.clear();
            setDepthMaps({});
            setDepthStatus({});

            const clips: ReelImage[] = (saved.clips as any[]).map((clip) => {
                const file = new File([clip.blob], clip.fileName, { type: clip.fileType });
                const url = URL.createObjectURL(file);
                if (clip.type === 'video') {
                    const video = document.createElement('video');
                    video.preload = 'metadata';
                    video.muted = true;
                    video.playsInline = true;
                    video.src = url;
                    videoCacheRef.current.set(clip.id, video);
                }
                return {
                    ...clip,
                    file,
                    url,
                    description: clip.description ?? '',
                    textOffset: clip.textOffset ?? { x: 0, y: 0 },
                    textSize: clip.textSize ?? 1,
                    fontFamily: clip.fontFamily ?? 'sans',
                    scale: clip.scale ?? 1,
                    motion: clip.motion ?? (clip.type === 'image' ? 'zoom-in' : 'none'),
                    transition: clip.transition ?? 'fade',
                };
            });

            const restoreAudio = (item: any) => {
                if (!item) return null;
                const file = new File([item.blob], item.fileName, { type: item.fileType });
                return { file, url: URL.createObjectURL(file) };
            };

            setImages(clips);
            setSelectedImageId(clips[0]?.id ?? null);
            setAspectRatio((saved.aspectRatio as PlatformAspect) ?? '9:16');
            setBackgroundColor(saved.backgroundColor ?? '#f6f6f6');
            setSecondsPerImage(saved.secondsPerImage);
            setGradient(saved.gradient);
            setGradientStrength(saved.gradientStrength);
            setBrightness(saved.brightness);
            setSaturation(saved.saturation);
            setMusicVolume(saved.musicVolume);
            setTemplate(saved.template ?? 'custom');
            setProductTemplateId(saved.productTemplateId ?? null);
            setNarrationText(saved.narrationText ?? '');
            setNarrationLanguage(saved.narrationLanguage ?? 'en');
            setNarrationVoiceGender(saved.narrationVoiceGender ?? 'female');
            setVoiceover(restoreAudio(saved.voiceover));
            if (logoRef.current) URL.revokeObjectURL(logoRef.current.url);
            setLogo(restoreAudio(saved.logo));
            setLogoCorner(saved.logoCorner ?? 'tr');
            setLogoSize(saved.logoSize ?? 18);
            setMusic(restoreAudio(saved.music));
            seekPreview(0);
            setCurrentDraftId(draft.id);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not open this reel draft.');
        } finally {
            setIsLoadingDraft(false);
        }
    };

    const removeDraft = async (id: string) => {
        try {
            await deletePhotoReelDraft(id);
            setDrafts(await listPhotoReelDrafts());
            if (currentDraftId === id) setCurrentDraftId(null);
        } catch {
            setError('Could not delete this saved reel draft.');
        }
    };

    /* ---------------------------------------------------------------------- */
    /* Export                                                                 */
    /* ---------------------------------------------------------------------- */

    const exportReel = async () => {
        if (!images.length || isExporting) return;
        if (durationMs > FREE_VIDEO_LIMIT_MS) {
            setError('This free-plan reel can be up to 60 seconds.');
            return;
        }
        setError(null);
        setIsExporting(true);
        setExportProgress(0);
        setCompletedExportUrl(null);
        setExportStatus('Preparing your photos, clips, and audio…');

        const canvas = canvasRef.current;
        if (!canvas) {
            setIsExporting(false);
            return;
        }

        let canvasStream: MediaStream | null = null;
        let recorder: MediaRecorder | null = null;
        let audioContext: AudioContext | null = null;
        let voiceoverAudioElement: HTMLAudioElement | null = null;
        let frameId = 0;

        try {
            const dimensions = getExportDimensions(aspectRatio as unknown as AspectRatioType, '1080p');
            canvas.width = dimensions.width;
            canvas.height = dimensions.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not prepare the reel canvas.');
            const exportCanvas = canvas;
            const exportContext = ctx;

            // 1. Depth maps
            const depthClips = images.filter((clip) => clip.type === 'image' && isDepthMotion(clip.motion));
            for (const [index, clip] of depthClips.entries()) {
                setExportStatus(`Computing 3D depth map ${index + 1} of ${depthClips.length}…`);
                await ensureDepth(clip);
            }

            // 2. Decode / prepare every clip
            for (const [index, clip] of images.entries()) {
                setExportStatus(`Preparing clip ${index + 1} of ${images.length}…`);
                if (clip.type === 'image') {
                    await waitForImageDecode(getImage(clip), clip.file.name);
                    continue;
                }
                const element = getVideo(clip);
                if (element.readyState < HTMLMediaElement.HAVE_METADATA) {
                    await new Promise<void>((resolve, reject) => {
                        const timeout = window.setTimeout(() => reject(new Error('Video loading timeout.')), 10000);
                        element.addEventListener('loadedmetadata', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
                        element.load();
                    });
                }
                if (!(await waitForVideoFrame(element, clip.file.name))) throw new Error('Could not decode video frame.');
                const poster = document.createElement('canvas');
                poster.width = element.videoWidth;
                poster.height = element.videoHeight;
                poster.getContext('2d')?.drawImage(element, 0, 0, poster.width, poster.height);
                videoPosterFramesRef.current.set(clip.id, poster);
                element.pause();
                element.currentTime = 0;
            }

            // 3. First frame + streams
            drawSlide(ctx, images[0], canvas.width, canvas.height, images[0].transition === 'cut' ? 1 : 0, 0);
            drawFreeTierWatermark(ctx, canvas.width, canvas.height);
            canvasStream = canvas.captureStream(RECORDING_FRAME_RATE);
            const tracks = [...canvasStream.getVideoTracks()];

            // 4. Audio graph
            let audioElement: HTMLAudioElement | null = null;
            if (music || voiceover) {
                audioContext = new AudioContext();
                audioContextRef.current = audioContext;
                const destination = audioContext.createMediaStreamDestination();
                tracks.push(...destination.stream.getAudioTracks());
                await audioContext.resume();

                const prepareAudioTrack = async (url: string, volume: number, shouldLoop: boolean, label: string) => {
                    const element = new Audio(url);
                    element.preload = 'auto';
                    element.loop = shouldLoop;
                    element.volume = 1;
                    const source = audioContext!.createMediaElementSource(element);
                    const gain = audioContext!.createGain();
                    gain.gain.value = volume;
                    source.connect(gain);
                    gain.connect(destination);
                    await new Promise<void>((resolve, reject) => {
                        if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) { resolve(); return; }
                        const timeout = window.setTimeout(() => reject(new Error(`${label} loading timeout.`)), 10000);
                        element.addEventListener('canplay', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
                        element.load();
                    });
                    element.currentTime = 0;
                    return element;
                };

                if (music) {
                    audioElement = await prepareAudioTrack(music.url, musicVolume / 100, true, 'Background music');
                    audioRef.current = audioElement;
                }
                if (voiceover) {
                    voiceoverAudioElement = await prepareAudioTrack(voiceover.url, 1, false, 'Voiceover');
                    exportVoiceoverRef.current = voiceoverAudioElement;
                }
            }

            // 5. Recorder
            recorder = createExportRecorder(new MediaStream(tracks), 'mp4', '1080p');
            const chunks: Blob[] = [];
            const activeRecorder = recorder;
            let renderingError: Error | null = null;
            const recording = new Promise<Blob>((resolve, reject) => {
                activeRecorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
                activeRecorder.onerror = () => reject(new Error('Browser encoding error.'));
                activeRecorder.onstop = () => {
                    if (renderingError) {
                        reject(renderingError);
                        return;
                    }
                    const blob = new Blob(chunks, { type: activeRecorder.mimeType || 'video/webm' });
                    if (blob.size) resolve(blob);
                    else reject(new Error('Exported reel is empty.'));
                };
            });

            setExportStatus('Rendering your reel…');
            activeRecorder.start(250);
            const audioPlayback = Promise.all([
                audioElement?.play().catch(() => { }),
                voiceoverAudioElement?.play().catch(() => { }),
            ]);

            // 6. Frame loop
            let elapsed = 0;
            let previousFrameTimestamp: number | null = null;
            let activeVideoId: string | null = null;
            let lastReportedClip = -1;

            const renderFrame = async (timestamp: number) => {
                if (previousFrameTimestamp !== null) elapsed += timestamp - previousFrameTimestamp;
                previousFrameTimestamp = timestamp;
                if (elapsed >= durationMs) {
                    if (activeRecorder.state === 'recording') activeRecorder.stop();
                    return;
                }

                const index = getIndexAtTime(elapsed);
                const clip = images[index];
                if (index !== lastReportedClip) {
                    lastReportedClip = index;
                    setExportStatus(`Rendering clip ${index + 1} of ${images.length}…`);
                }
                const localTimeMs = Math.max(0, elapsed - getStartAtIndex(index));

                if (clip.type === 'video') {
                    const video = getVideo(clip);
                    video.muted = true;
                    if (activeVideoId !== clip.id) {
                        videoCacheRef.current.forEach((item, id) => { if (id !== clip.id) item.pause(); });
                        const targetTime = Math.min(localTimeMs / 1000, Math.max(0, video.duration - 0.05));
                        if (Math.abs(video.currentTime - targetTime) > 0.08) {
                            const seeked = new Promise<void>((resolve) => {
                                const timeout = window.setTimeout(() => resolve(), 1500);
                                video.addEventListener('seeked', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
                            });
                            video.currentTime = targetTime;
                            await seeked;
                        }
                        await video.play();
                        await waitForVideoFrame(video, clip.file.name, 1500);
                        activeVideoId = clip.id;
                    }
                } else {
                    if (activeVideoId) {
                        videoCacheRef.current.get(activeVideoId)?.pause();
                        activeVideoId = null;
                    }
                    await waitForImageDecode(getImage(clip), clip.file.name);
                }

                const transitionProgress = clip.transition === 'cut' ? 1 : Math.min(1, localTimeMs / TRANSITION_MS);
                const motionProgress = localTimeMs / Math.max(1, getClipDurationMs(clip));
                drawSlide(exportContext, clip, exportCanvas.width, exportCanvas.height, transitionProgress, motionProgress);
                drawFreeTierWatermark(exportContext, exportCanvas.width, exportCanvas.height);
                setExportProgress(5 + Math.min(80, Math.floor((elapsed / durationMs) * 80)));
                scheduleRender();
            };

            const scheduleRender = () => {
                frameId = requestAnimationFrame((timestamp) => {
                    void renderFrame(timestamp).catch((cause: unknown) => {
                        renderingError = cause instanceof Error ? cause : new Error('Rendering failed.');
                        if (activeRecorder.state === 'recording') activeRecorder.stop();
                    });
                });
            };
            scheduleRender();

            // 7. Finish
            let result = await Promise.all([recording, audioPlayback]).then(([recorded]) => recorded);
            if (!result.type.toLowerCase().startsWith('video/mp4')) {
                setExportStatus('Encoding MP4…');
                setExportProgress(85);
                const { convertWebmToMp4 } = await import('@/components/editor/convertToMp4');
                result = await convertWebmToMp4(result, (progress) => setExportProgress(100 - Math.ceil((1 - progress / 100) * 15)));
            }

            const url = URL.createObjectURL(result);
            setCompletedExportUrl(url);
            setExportStatus('Reel is ready! Your download should start automatically.');
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'product-reel.mp4';
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setExportProgress(100);
        } catch (cause) {
            if (recorder?.state === 'recording') recorder.stop();
            setError(cause instanceof Error ? cause.message : 'Could not export reel.');
            setExportStatus('Export stopped.');
        } finally {
            cancelAnimationFrame(frameId);
            if (recorder?.state === 'recording') recorder.stop();
            audioRef.current?.pause();
            exportVoiceoverRef.current?.pause();
            audioRef.current = null;
            exportVoiceoverRef.current = null;
            videoCacheRef.current.forEach((video) => video.pause());
            videoPosterFramesRef.current.clear();
            canvasStream?.getTracks().forEach((track) => track.stop());
            await audioContext?.close().catch(() => undefined);
            audioContextRef.current = null;
            setIsExporting(false);
        }
    };

    /* ---------------------------------------------------------------------- */
    /* Preview styling                                                        */
    /* ---------------------------------------------------------------------- */

    const filterStyle = `brightness(${brightness}%) saturate(${saturation}%)`;
    const activeScale = activeImage?.scale ?? 1;
    const activeClipProgress = activeImage ? clamp((previewTimeMs - activeClipStartMs) / getClipDurationMs(activeImage), 0, 1) : 0;
    const transitionProgress = !activeImage || activeImage.transition === 'cut'
        ? 1
        : Math.min(1, (activeClipProgress * getClipDurationMs(activeImage)) / TRANSITION_MS);
    const transitionStyle: React.CSSProperties = activeImage?.transition === 'slide'
        ? { transform: `translateX(${(1 - transitionProgress) * 100}%)` }
        : activeImage?.transition === 'zoom'
            ? { transform: `scale(${1.12 - transitionProgress * 0.12})` }
            : { opacity: activeImage?.transition === 'fade' ? transitionProgress : 1 };

    const photoMotion = activeImage?.type === 'image' ? activeImage.motion ?? 'zoom-in' : 'none';
    const activeUsesDepth = activeImage?.type === 'image' && isDepthMotion(photoMotion);
    const activeDepth = activeUsesDepth && depthStatus[activeImage!.id] === 'ready' ? depthMaps[activeImage!.id] ?? null : null;
    const activeDepthLoading = activeUsesDepth && !depthStatus[activeImage!.id];

    const frameSizeClass = aspectRatio === '9:16' ? 'h-[min(62dvh,38rem)] aspect-9/16'
        : aspectRatio === '1:1' ? 'h-[min(62dvh,38rem)] aspect-square'
            : aspectRatio === '4:5' ? 'h-[min(62dvh,38rem)] aspect-4/5'
                : 'w-full aspect-video';

    const mediaStyle: React.CSSProperties = { filter: filterStyle, transform: `scale(${activeScale})` };

    /* ---------------------------------------------------------------------- */
    /* Render                                                                 */
    /* ---------------------------------------------------------------------- */

    return (
        <main className="grain flex min-h-dvh flex-col bg-[#14121F] font-[family-name:var(--font-body)] text-[#14121F] lg:h-dvh lg:flex-row lg:overflow-hidden">
            <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-b border-[#14121F]/10 bg-[#F7F6FB] p-4 lg:max-h-full lg:w-92 lg:border-b-0 lg:border-r lg:p-5">
                <button type="button" onClick={onBack} className="flex w-fit items-center gap-2 rounded-xl border border-[#14121F]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#14121F]/80 shadow-xs transition hover:border-[#6A4CFF]/40 hover:bg-white">
                    <ArrowLeft className="h-3.5 w-3.5 text-[#14121F]/60" /> All creation options
                </button>

                <header>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6A4CFF]">Product Reel Studio</p>
                    <h1 className="mt-1 text-xl font-extrabold text-[#14121F]">3D Product Showcase</h1>
                    <p className="mt-1 text-xs leading-relaxed text-[#14121F]/60">Create cinematic orbits, custom backgrounds, and platform-optimized formats.</p>
                </header>

                {/* ---------------- Templates ---------------- */}
                <section className={CARD_CLASS}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Start from a template</h2>
                        {productTemplate && <button type="button" onClick={() => applyProductTemplate(null)} className="text-xs font-semibold text-[#14121F]/50 hover:text-red-600">Clear</button>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {PRODUCT_TEMPLATES.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => { applyProductTemplate(item.id); setShowAdvanced(false); }}
                                className={`rounded-xl border p-3 text-left transition ${productTemplateId === item.id ? 'border-[#6A4CFF] bg-[#6A4CFF]/5' : 'border-[#14121F]/10 bg-[#F7F6FB] hover:border-[#6A4CFF]/50'}`}
                            >
                                <span className="block text-lg">{item.emoji}</span>
                                <span className="mt-1 block text-xs font-bold text-[#14121F]">{item.label}</span>
                                <span className="mt-0.5 block text-[10px] font-medium leading-snug text-[#14121F]/55">{item.blurb}</span>
                            </button>
                        ))}
                    </div>
                    {productTemplate ? (
                        <>
                            <p className="text-[11px] leading-relaxed text-[#14121F]/60"><span className="font-semibold text-[#14121F]/80">Best upload:</span> {productTemplate.spec}</p>
                            <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="w-full rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3 py-2 text-xs font-semibold text-[#14121F]/80 transition hover:border-[#6A4CFF]">
                                {showAdvanced ? 'Hide advanced controls' : 'Show advanced controls'}
                            </button>
                        </>
                    ) : (
                        <p className="text-[11px] leading-relaxed text-[#14121F]/60">Pick a category, then add your photos. Format, motion, colors and captions are set for you.</p>
                    )}
                </section>

                {/* ---------------- Clips & drafts ---------------- */}
                <section className={CARD_CLASS}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Reel clips <span className="text-[#14121F]/40">({images.length}/{MAX_IMAGES})</span></h2>
                        <span className="font-mono text-xs font-semibold text-[#14121F]/60">{durationLabel}</span>
                    </div>
                    <input ref={imageInputRef} type="file" accept="image/*,video/*" multiple onChange={addImages} className="hidden" />

                    <section className="space-y-2.5 rounded-xl border border-[#14121F]/10 bg-[#F7F6FB] p-3.5">
                        <button type="button" onClick={() => void saveDraft()} disabled={isSavingDraft || isExporting} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#6A4CFF]/30 bg-[#6A4CFF]/10 px-3.5 py-2.5 text-xs font-semibold text-[#6A4CFF] shadow-xs transition hover:bg-[#6A4CFF]/20 disabled:cursor-not-allowed disabled:opacity-50">
                            {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isSavingDraft ? 'Saving draft…' : currentDraftId ? 'Update saved draft' : 'Save as draft'}
                        </button>
                        <details>
                            <summary className="flex cursor-pointer list-none items-center gap-2 px-1 py-1 text-xs font-semibold text-[#14121F]/80 hover:text-[#14121F]">
                                <FolderOpen className="h-3.5 w-3.5 text-[#6A4CFF]" /> Saved reel drafts ({drafts.length})
                            </summary>
                            <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                                {drafts.map((draft) => (
                                    <div key={draft.id} className="flex items-center gap-2 rounded-xl border border-[#14121F]/10 bg-white px-3 py-2 shadow-xs">
                                        <button type="button" onClick={() => void openDraft(draft.id)} disabled={isLoadingDraft} className="min-w-0 flex-1 text-left text-xs text-[#14121F] disabled:opacity-50">
                                            <span className="block truncate font-semibold">{draft.title}</span>
                                            <span className="mt-0.5 block text-[10px] font-medium text-[#14121F]/50">{draft.clipCount} clips · {Math.round(draft.durationMs / 1000)} sec</span>
                                        </button>
                                        <button type="button" onClick={() => void removeDraft(draft.id)} aria-label={`Delete ${draft.title}`} className="rounded-lg p-1.5 text-[#14121F]/40 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                ))}
                                {drafts.length === 0 && <p className="px-2 py-2 text-[11px] font-medium text-[#14121F]/50">No saved drafts yet.</p>}
                            </div>
                        </details>
                    </section>

                    <button type="button" onClick={() => imageInputRef.current?.click()} disabled={images.length >= MAX_IMAGES} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#14121F]/20 py-3.5 text-xs font-semibold text-[#14121F]/70 transition-colors hover:border-[#6A4CFF] hover:bg-[#6A4CFF]/5 hover:text-[#6A4CFF] disabled:opacity-40">
                        <ImagePlus className="h-4 w-4" /> Add photos or videos
                    </button>

                    {productTemplate && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#14121F]/50">Shot list</p>
                            {productTemplate.shots.map((shot, index) => {
                                const filled = images[index];
                                return (
                                    <button
                                        key={shot.title}
                                        type="button"
                                        onClick={() => {
                                            if (filled) { setSelectedImageId(filled.id); setIsPreviewPlaying(false); seekPreview(getStartAtIndex(index)); }
                                            else imageInputRef.current?.click();
                                        }}
                                        className="flex w-full items-start gap-2 rounded-lg border border-[#14121F]/10 bg-[#F7F6FB] px-2.5 py-2 text-left transition hover:border-[#6A4CFF]/50"
                                    >
                                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${filled ? 'bg-[#6A4CFF] text-white' : 'bg-[#14121F]/10 text-[#14121F]/50'}`}>{filled ? '✓' : index + 1}</span>
                                        <span className="min-w-0">
                                            <span className="block text-xs font-semibold text-[#14121F]">{shot.title}</span>
                                            <span className="block text-[10px] text-[#14121F]/50">{shot.tip}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="space-y-2">
                        {images.map((image, index) => (
                            <div key={image.id} className={`flex items-center gap-2 rounded-xl border p-2.5 shadow-xs ${selectedImageId === image.id ? 'border-[#6A4CFF]/60 bg-[#6A4CFF]/5' : 'border-[#14121F]/10 bg-white'}`}>
                                <button
                                    type="button"
                                    onClick={() => { setSelectedImageId(image.id); setIsPreviewPlaying(false); seekPreview(getStartAtIndex(index)); }}
                                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                                >
                                    {image.type === 'video'
                                        ? <video src={image.url} muted playsInline className="h-10 w-10 shrink-0 rounded-lg bg-black/5 object-contain shadow-xs" />
                                        : <img src={image.url} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-black/5 object-contain shadow-xs" />}
                                    <span className="min-w-0">
                                        <span className="block text-xs font-semibold text-[#14121F]">Clip {index + 1}</span>
                                        <span className="block truncate text-[10px] font-medium text-[#14121F]/50">{image.file.name}</span>
                                    </span>
                                </button>
                                <button type="button" onClick={() => moveImage(image.id, -1)} disabled={index === 0} aria-label="Move up" className="rounded-lg p-1.5 text-[#14121F]/50 hover:bg-[#14121F]/10 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={() => moveImage(image.id, 1)} disabled={index === images.length - 1} aria-label="Move down" className="rounded-lg p-1.5 text-[#14121F]/50 hover:bg-[#14121F]/10 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={() => removeImage(image.id)} aria-label="Remove clip" className="rounded-lg p-1.5 text-[#14121F]/40 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ---------------- Image look ---------------- */}
                <section className={`${CARD_CLASS} ${productTemplate && !showAdvanced ? 'hidden' : ''}`}>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Image Look</h2>

                    <SelectField label="Reel template" value={template} onChange={(value) => applyTemplate(value as ReelTemplate)}>
                        <option value="custom">Custom look</option>
                        <option value="product-demo">⚡ Product 3D Showcase Preset</option>
                        <option value="travel">Travel diary</option>
                        <option value="birthday">Birthday</option>
                        <option value="product">Product launch</option>
                        <option value="festival">Festival</option>
                    </SelectField>

                    <SelectField label="Frame format" value={aspectRatio} onChange={(value) => setAspectRatio(value as PlatformAspect)}>
                        <option value="9:16">Reel · 9:16</option>
                        <option value="1:1">Square · 1:1</option>
                        <option value="4:5">Portrait · 4:5</option>
                        <option value="16:9">Landscape · 16:9</option>
                    </SelectField>

                    <div className="flex items-center justify-between pt-1">
                        <label className="text-xs font-semibold text-[#14121F]">Custom Background Color</label>
                        <div className="flex items-center gap-2">
                            <input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} className="h-7 w-9 cursor-pointer rounded-lg border border-[#14121F]/20 bg-transparent p-0" />
                            <span className="font-mono text-[11px] text-[#14121F]/60">{backgroundColor}</span>
                        </div>
                    </div>
                    {selectedImage?.type === 'image' && (
                        <button type="button" onClick={matchBackgroundToPhoto} className="w-full rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3 py-2 text-xs font-semibold text-[#14121F]/80 transition hover:border-[#6A4CFF]">Match background to selected photo</button>
                    )}

                    <RangeField label="Seconds per photo" display={`${secondsPerImage}s`} min={1} max={8} value={secondsPerImage} onChange={setSecondsPerImage} />

                    <SelectField label="Gradient overlay" value={gradient} onChange={(value) => setGradient(value as GradientPreset)}>
                        {GRADIENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </SelectField>

                    <RangeField label="Gradient strength" display={`${gradientStrength}%`} min={0} max={100} value={gradientStrength} onChange={setGradientStrength} />
                    <RangeField label="Brightness" display={`${brightness}%`} min={50} max={150} value={brightness} onChange={setBrightness} />
                    <RangeField label="Saturation" display={`${saturation}%`} min={0} max={200} value={saturation} onChange={setSaturation} />

                    {selectedImage && (
                        <div className="space-y-3 border-t border-[#14121F]/10 pt-3">
                            <h3 className="text-xs font-bold text-[#6A4CFF]">Selected Clip Adjustments</h3>

                            <label className="block text-xs font-semibold text-[#14121F]">Image Zoom · {((selectedImage.scale ?? 1) * 100).toFixed(0)}%
                                <div className="mt-1 flex items-center gap-2">
                                    <ZoomOut className="h-4 w-4 text-[#14121F]/50" />
                                    <input
                                        type="range" min={0.5} max={2.5} step={0.05}
                                        value={selectedImage.scale ?? 1}
                                        onChange={(event) => updateSelected({ scale: Number(event.target.value) })}
                                        className="w-full accent-[#6A4CFF]"
                                    />
                                    <ZoomIn className="h-4 w-4 text-[#14121F]/50" />
                                </div>
                            </label>

                            <div className="grid grid-cols-2 gap-2.5 pt-2">
                                <SelectField label="Entry transition" value={selectedImage.transition ?? 'fade'} onChange={(value) => updateSelected({ transition: value as ReelImage['transition'] })}>
                                    <option value="cut">Cut</option>
                                    <option value="fade">Fade</option>
                                    <option value="slide">Slide</option>
                                    <option value="zoom">Zoom</option>
                                </SelectField>

                                {selectedImage.type === 'image' && (
                                    <div>
                                        <SelectField label="3D Camera Motion" value={selectedImage.motion ?? 'none'} onChange={(value) => updateSelected({ motion: value as ReelImage['motion'] })}>
                                            <option value="none">Still</option>
                                            <option value="zoom-in">Slow zoom in</option>
                                            <option value="zoom-out">Slow zoom out</option>
                                            <option value="depth-orbit">🔄 Product Orbit</option>
                                            <option value="depth-sway">↔️ Turntable Sway</option>
                                            <option value="depth-dolly">🔍 3D Dolly In</option>
                                        </SelectField>
                                        {isDepthMotion(selectedImage.motion) && (
                                            <span className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-[#6A4CFF]">
                                                {depthStatus[selectedImage.id] === 'failed'
                                                    ? 'Depth failed — showing a plain zoom.'
                                                    : !depthStatus[selectedImage.id]
                                                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Computing 3D depth…</>
                                                        : '3D Camera ready.'}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* ---------------- Caption ---------------- */}
                <section className={CARD_CLASS}>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Add text to a clip</h2>
                    {selectedImage ? (
                        <>
                            <textarea
                                aria-label="Text overlay"
                                value={selectedImage.overlayText}
                                onChange={(event) => updateSelected({ overlayText: event.target.value.slice(0, 120), autoCaption: false })}
                                maxLength={120}
                                rows={2}
                                placeholder="Type product highlight text…"
                                className="w-full resize-y rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3.5 py-2.5 text-xs text-[#14121F] shadow-xs placeholder:text-[#14121F]/40 focus:border-[#6A4CFF] focus:outline-none"
                            />
                            <p className="text-[10px] italic text-[#14121F]/50">💡 Tip: Drag the caption on the preview to reposition it.</p>

                            <div className="grid grid-cols-2 gap-2.5">
                                <SelectField label="Design" value={selectedImage.textStyle} onChange={(value) => updateSelected({ textStyle: value as TextOverlayStyle })}>
                                    <option value="classic">Classic</option>
                                    <option value="banner">Banner</option>
                                    <option value="highlight">Highlight</option>
                                    <option value="outline">Outline</option>
                                </SelectField>
                                <SelectField label="Position" value={selectedImage.textPosition} onChange={(value) => updateSelected({ textPosition: value as TextPosition, textOffset: { x: 0, y: 0 } })}>
                                    <option value="top">Top</option>
                                    <option value="center">Center</option>
                                    <option value="bottom">Bottom</option>
                                </SelectField>
                            </div>

                            <RangeField
                                label="Font size"
                                display={`${Math.round((selectedImage.textSize ?? 1) * 100)}%`}
                                min={0.5} max={2.5} step={0.05}
                                value={selectedImage.textSize ?? 1}
                                onChange={(value) => updateSelected({ textSize: value })}
                            />

                            <div className="grid grid-cols-2 gap-2.5">
                                <SelectField label="Font" value={selectedImage.fontFamily ?? 'sans'} onChange={(value) => updateSelected({ fontFamily: value as FontKey })}>
                                    <option value="sans">Sans</option>
                                    <option value="serif">Serif</option>
                                    <option value="mono">Mono</option>
                                    <option value="display">Impact</option>
                                </SelectField>
                                <label className="block text-xs font-semibold text-[#14121F]">Color
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={selectedImage.textColor ?? getDefaultTextColor(selectedImage.textStyle)}
                                            onChange={(event) => updateSelected({ textColor: event.target.value })}
                                            className="h-9 w-full cursor-pointer rounded-lg border border-[#14121F]/20 p-0"
                                        />
                                    </div>
                                </label>
                            </div>

                            <div className="flex gap-2">
                                <button type="button" onClick={() => updateSelected({ textOffset: { x: 0, y: 0 } })} className="flex-1 rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3 py-2 text-xs font-semibold text-[#14121F]/80 transition hover:border-[#6A4CFF]">Reset position</button>
                                <button type="button" onClick={() => updateSelected({ textSize: 1, textColor: undefined, fontFamily: 'sans' })} className="flex-1 rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3 py-2 text-xs font-semibold text-[#14121F]/80 transition hover:border-[#6A4CFF]">Reset style</button>
                            </div>
                        </>
                    ) : (
                        <p className="rounded-xl border border-dashed border-[#14121F]/20 px-3.5 py-4 text-center text-xs font-medium text-[#14121F]/50">Select a clip to add text.</p>
                    )}
                </section>

                {/* ---------------- Product effects ---------------- */}
                <section className={`${CARD_CLASS} ${productTemplate && !showAdvanced ? 'hidden' : ''}`}>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Product effects</h2>
                    {selectedImage ? (
                        <>
                            <label className="flex items-center justify-between text-xs font-semibold text-[#14121F]">
                                Shine sweep
                                <input type="checkbox" checked={!!selectedImage.shine} onChange={(event) => updateSelected({ shine: event.target.checked })} className="h-4 w-4 accent-[#6A4CFF]" />
                            </label>
                            {selectedImage.type === 'image' && isDepthMotion(selectedImage.motion) && (
                                <label className="flex items-center justify-between text-xs font-semibold text-[#14121F]">
                                    Soft edges when zoomed out
                                    <input type="checkbox" checked={selectedImage.softEdges !== false} onChange={(event) => updateSelected({ softEdges: event.target.checked })} className="h-4 w-4 accent-[#6A4CFF]" />
                                </label>
                            )}
                            <RangeField label="Vignette" display={`${selectedImage.vignette ?? 0}%`} min={0} max={60} value={selectedImage.vignette ?? 0} onChange={(value) => updateSelected({ vignette: value })} />
                            <input
                                aria-label="Badge text"
                                value={selectedImage.badgeText ?? ''}
                                onChange={(event) => updateSelected({ badgeText: event.target.value.slice(0, 24) })}
                                placeholder="Badge: NEW, 50% OFF, ₹999…"
                                className="w-full rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3.5 py-2.5 text-xs text-[#14121F] shadow-xs placeholder:text-[#14121F]/40 focus:border-[#6A4CFF] focus:outline-none"
                            />
                            <div className="grid grid-cols-2 gap-2.5">
                                <SelectField label="Badge corner" value={selectedImage.badgeCorner ?? 'tl'} onChange={(value) => updateSelected({ badgeCorner: value as Corner })}>
                                    <option value="tl">Top left</option>
                                    <option value="tr">Top right</option>
                                    <option value="bl">Bottom left</option>
                                    <option value="br">Bottom right</option>
                                </SelectField>
                                <label className="block text-xs font-semibold text-[#14121F]">Badge color
                                    <input type="color" value={selectedImage.badgeColor ?? '#ef4444'} onChange={(event) => updateSelected({ badgeColor: event.target.value })} className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-[#14121F]/20 p-0" />
                                </label>
                            </div>
                        </>
                    ) : (
                        <p className="rounded-xl border border-dashed border-[#14121F]/20 px-3.5 py-4 text-center text-xs font-medium text-[#14121F]/50">Select a clip to add effects.</p>
                    )}
                </section>

                {/* ---------------- Brand logo ---------------- */}
                <section className={CARD_CLASS}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Brand logo</h2>
                        {logo && <button type="button" onClick={() => { URL.revokeObjectURL(logo.url); setLogo(null); }} className="text-xs font-semibold text-[#14121F]/50 hover:text-red-600">Remove</button>}
                    </div>
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={setLogoFile} className="hidden" />
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="w-full rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3.5 py-2.5 text-left text-xs font-semibold text-[#14121F] shadow-xs transition hover:border-[#6A4CFF]">
                        {logo ? logo.file.name : 'Upload logo (PNG works best)'}
                    </button>
                    {logo && (
                        <>
                            <SelectField label="Logo corner" value={logoCorner} onChange={(value) => setLogoCorner(value as Corner)}>
                                <option value="tl">Top left</option>
                                <option value="tr">Top right</option>
                                <option value="bl">Bottom left</option>
                                <option value="br">Bottom right</option>
                            </SelectField>
                            <RangeField label="Logo size" display={`${logoSize}%`} min={6} max={40} value={logoSize} onChange={setLogoSize} />
                        </>
                    )}
                </section>

                {/* ---------------- Music ---------------- */}
                <section className={CARD_CLASS}>
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#14121F]/70"><Music2 className="h-4 w-4 text-[#6A4CFF]" /> Background music</h2>
                        {music && <button type="button" onClick={() => { URL.revokeObjectURL(music.url); setMusic(null); }} className="text-xs font-semibold text-[#14121F]/50 hover:text-red-600">Remove</button>}
                    </div>
                    <input ref={musicInputRef} type="file" accept="audio/*" onChange={setMusicFile} className="hidden" />
                    <button type="button" onClick={() => musicInputRef.current?.click()} className="w-full rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3.5 py-2.5 text-left text-xs font-semibold text-[#14121F] shadow-xs transition hover:border-[#6A4CFF]">
                        {music ? music.file.name : 'Choose music track'}
                    </button>
                    {music && (
                        <>
                            <audio ref={previewAudioRef} src={music.url} controls preload="auto" className="w-full accent-[#6A4CFF]" />
                            <RangeField label="Music volume" display={`${musicVolume}%`} min={0} max={100} value={musicVolume} onChange={setMusicVolume} />
                        </>
                    )}
                </section>
            </aside>

            {/* ---------------- Preview ---------------- */}
            <section className="flex min-h-[70dvh] min-w-0 flex-1 flex-col items-center justify-center gap-4 p-4 lg:min-h-0 lg:p-8">
                <div className="flex w-full max-w-4xl items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold uppercase tracking-wider text-[#14121F]/70">Reel preview</h2>
                        <p className="text-xs font-medium text-[#14121F]/50">{images.length} clips · {durationLabel}</p>
                    </div>
                    {images.length > 0 && (
                        <button type="button" onClick={togglePreview} className="flex items-center gap-2 rounded-xl border border-[#14121F]/15 bg-white px-4 py-2 text-xs font-semibold text-[#14121F] shadow-xs transition hover:border-[#6A4CFF]/40 hover:bg-gray-100">
                            <Play className="h-3.5 w-3.5 text-[#6A4CFF]" />
                            {isPreviewPlaying ? 'Pause preview' : 'Play preview'}
                        </button>
                    )}
                </div>

                <div className="relative flex max-h-[65dvh] min-h-80 w-full max-w-4xl select-none items-center justify-center overflow-hidden rounded-3xl border border-[#14121F]/10 bg-[#F7F6FB] p-5 shadow-sm">
                    <div
                        ref={frameRef}
                        className={`relative flex items-center justify-center overflow-hidden rounded-2xl shadow-xl ${frameSizeClass}`}
                        style={{ backgroundColor, containerType: 'inline-size', ...transitionStyle }}
                    >
                        {(() => {
                            const isSaaSMode = productTemplateId === 'saas' || aspectRatio === '16:9';
                            if (isSaaSMode && activeImage?.type === 'image') {
                                return (
                                    <div className="flex flex-col h-full w-full bg-[#1e1e2e] rounded-xl overflow-hidden shadow-2xl border border-white/10" style={mediaStyle}>
                                        <div className="flex items-center gap-1.5 px-3 py-2 bg-[#181824] shrink-0">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                        </div>
                                        <div className="relative flex-1 overflow-hidden bg-black">
                                            <img src={activeImage.url} alt="" className="h-full w-full object-fill" />
                                        </div>
                                    </div>
                                );
                            }
                            if (activeImage?.type === 'video') {
                                return <video key={activeImage.id} ref={previewVideoRef} src={activeImage.url} muted playsInline preload="auto" className="h-full w-full object-contain" style={mediaStyle} />;
                            }
                            if (activeImage && activeDepth) {
                                return <DepthPreview clip={activeImage} depth={activeDepth} progress={activeClipProgress} aspectRatio={aspectRatio} filter={filterStyle} backgroundColor={backgroundColor} scale={activeScale} softEdges={activeImage.softEdges !== false} />;
                            }
                            if (activeImage) {
                                return <img src={activeImage.url} alt="" className="h-full w-full object-contain" style={mediaStyle} />;
                            }
                            return (
                                <div className="flex h-full items-center justify-center text-center text-xs font-semibold text-black/40">
                                    <span><ImagePlus className="mx-auto mb-3 h-8 w-8 text-black/30" />Add product photos or videos</span>
                                </div>
                            );
                        })()}

                        {activeDepthLoading && (
                            <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rendering 3D camera angles…
                            </div>
                        )}

                        {activeImage && (
                            <EffectsOverlay clip={activeImage} progress={activeClipProgress} aspectRatio={aspectRatio} logoImage={logoImage} logoCorner={logoCorner} logoSize={logoSize} />
                        )}

                        {activeImage?.overlayText && (
                            <CaptionOverlay
                                clip={activeImage}
                                onPointerDown={handleCaptionPointerDown}
                                onPointerMove={handleCaptionPointerMove}
                                onPointerUp={handleCaptionPointerUp}
                            />
                        )}
                    </div>
                </div>

                {images.length > 0 && (
                    <div className="w-full max-w-4xl rounded-2xl border border-[#14121F]/10 bg-white p-4 shadow-xs">
                        <div className="mb-2.5 flex justify-between font-mono text-xs font-semibold text-[#14121F]/70">
                            <span>Clip {safePreviewIndex + 1} of {images.length}</span>
                            <span>{(previewTimeMs / 1000).toFixed(1)}s / {(durationMs / 1000).toFixed(1)}s</span>
                        </div>
                        <input type="range" min={0} max={Math.max(durationMs, 1)} step={100} value={Math.min(previewTimeMs, durationMs)} onChange={(event) => seekPreview(Number(event.target.value))} className="h-1.5 w-full cursor-pointer rounded-full bg-[#14121F]/10 accent-[#6A4CFF]" />
                    </div>
                )}

                <div className="flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#14121F]/10 bg-white p-4 shadow-xs">
                    <div className="text-xs font-semibold text-[#14121F]/70">{durationLabel} total</div>
                    <button type="button" onClick={() => void exportReel()} disabled={!images.length || isExporting} className="flex items-center gap-2 rounded-xl bg-[#6A4CFF] px-6 py-3 text-xs font-bold text-white shadow-md shadow-[#6A4CFF]/20 transition hover:bg-[#5839e0] disabled:opacity-50">
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {isExporting ? `Rendering (${exportProgress}%)...` : 'Create & download reel'}
                    </button>
                </div>

                {isExporting && exportStatus && <p className="w-full max-w-4xl text-xs font-medium text-white/70">{exportStatus}</p>}
                {notice && <p role="status" className="w-full max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-medium text-amber-800 shadow-xs">{notice}</p>}
                {error && <p role="alert" className="w-full max-w-4xl rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-600 shadow-xs">{error}</p>}
                <canvas ref={canvasRef} className="hidden" />
            </section>
        </main>
    );
}