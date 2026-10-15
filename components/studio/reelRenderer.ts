/**
 * THE one renderer. The live preview and the exported video both call `renderFrame`,
 * so what you see in the preview is, by construction, what ends up in the file.
 */
import { drawFreeTierWatermark } from '@/components/freeTier';
import { isDepthMotion, getPhotoCacheKey } from './depthEstimator';
import { getDepthRenderer } from './depthRenderer';
import { drawBorderEffect } from './photoReelExtras';
import { applyCameraFx, buildOverlayConfig, drawOverlayFx, drawRgbSplit } from './photoReelFx';
import type { ReelAssets } from './reelAssets';
import { Timeline, clipDurationMs, indexAtTime } from './reelTimeline';
import {
    Corner, FONT_FAMILIES, GRADIENTS, ReelImage, ReelSettings, TEXT_BASE_Y, TRANSITION_MS,
    clamp, getCornerPosition, getDefaultTextColor, getReadableTextColor,
} from './reelTypes';

export interface RenderContext {
    clips: ReelImage[];
    timeline: Timeline;
    settings: ReelSettings;
    assets: ReelAssets;
    logoImage: HTMLImageElement | null;
}

/* -------------------------------------------------------------------------- */
/* Small drawing helpers                                                      */
/* -------------------------------------------------------------------------- */

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

/** Vignette, shine sweep, badge sticker, brand logo and animated border. */
function drawProductEffects(
    ctx: CanvasRenderingContext2D, clip: ReelImage, width: number, height: number, t: number,
    logo: { image: HTMLImageElement | null; corner: Corner; sizePct: number }, seconds: number,
) {
    drawOverlayFx(ctx, clip.fx, width, height, seconds, buildOverlayConfig(clip));

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

    drawBorderEffect(ctx, clip.borderEffect, clip.borderColor, width, height, seconds);
}

function drawCaption(ctx: CanvasRenderingContext2D, clip: ReelImage, width: number, height: number) {
    if (!clip.overlayText.trim()) return;

    const fontSize = Math.max(14, Math.round(width * 0.065 * (clip.textSize ?? 1)));
    const padding = fontSize * 0.42;
    const textColor = clip.textColor ?? getDefaultTextColor(clip.textStyle);
    ctx.font = `700 ${fontSize}px ${FONT_FAMILIES[clip.fontFamily ?? 'sans']}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxWidth = width * 0.82;

    const textX = width / 2 + (clip.textOffset?.x ?? 0) * (width / 100);
    const textY = height * (TEXT_BASE_Y[clip.textPosition] / 100) + (clip.textOffset?.y ?? 0) * (height / 100);

    const words = clip.overlayText.trim().split(/\s+/);
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

    if (clip.textStyle === 'banner' || clip.textStyle === 'highlight') {
        ctx.fillStyle = clip.textStyle === 'banner' ? 'rgba(10,10,10,0.78)' : 'rgba(250,204,21,0.92)';
        ctx.beginPath();
        ctx.roundRect(textX - boxWidth / 2, textY - textHeight / 2 - padding / 2, boxWidth, textHeight + padding, fontSize * 0.2);
        ctx.fill();
    }

    lines.forEach((item, index) => {
        const y = textY + (index - (lines.length - 1) / 2) * lineHeight;
        if (clip.textStyle === 'outline') {
            ctx.strokeStyle = textColor;
            ctx.lineWidth = Math.max(2, fontSize * 0.07);
            ctx.strokeText(item, textX, y, maxWidth);
            return;
        }
        if (clip.textStyle === 'classic') {
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = fontSize * 0.1;
            ctx.strokeText(item, textX, y, maxWidth);
        }
        ctx.fillStyle = textColor;
        ctx.fillText(item, textX, y, maxWidth);
    });
}

/* -------------------------------------------------------------------------- */
/* One slide                                                                  */
/* -------------------------------------------------------------------------- */

function drawSlide(
    ctx: CanvasRenderingContext2D, clip: ReelImage, rc: RenderContext,
    width: number, height: number, transitionProgress: number, motionProgress: number,
) {
    const { settings, assets } = rc;
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    const liveVideo = clip.type === 'video' ? assets.getVideo(clip) : null;
    const videoHasFrame = Boolean(liveVideo && liveVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && liveVideo.videoWidth > 0);
    const element: CanvasImageSource = clip.type === 'image'
        ? assets.getImage(clip)
        : videoHasFrame ? liveVideo! : assets.posters.get(clip.id) ?? liveVideo!;

    const sourceWidth = element instanceof HTMLImageElement ? element.naturalWidth
        : element instanceof HTMLVideoElement ? element.videoWidth
            : element instanceof HTMLCanvasElement ? element.width : 0;
    const sourceHeight = element instanceof HTMLImageElement ? element.naturalHeight
        : element instanceof HTMLVideoElement ? element.videoHeight
            : element instanceof HTMLCanvasElement ? element.height : 0;
    if (sourceWidth === 0 || sourceHeight === 0) return;

    const transitionT = clamp(transitionProgress, 0, 1);
    const motionT = clamp(motionProgress, 0, 1);
    const clipSeconds = (motionT * clipDurationMs(clip, settings.secondsPerImage)) / 1000;
    const requestedMotion = clip.type === 'image' ? clip.motion ?? 'zoom-in' : 'none';
    const userScale = clip.scale ?? 1;

    let depthFrame: HTMLCanvasElement | null = null;
    if (isDepthMotion(requestedMotion) && element instanceof HTMLImageElement) {
        const depthMap = assets.depthMaps.get(clip.id);
        const renderer = depthMap ? getDepthRenderer() : null;
        if (depthMap && renderer) {
            try {
                depthFrame = renderer.render({ key: getPhotoCacheKey(clip.file), photo: element, depth: depthMap, width, height, motion: requestedMotion, progress: motionT });
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

    const transition = clip.transition ?? 'fade';
    if (transition === 'fade') ctx.globalAlpha = transitionT;
    else if (transition === 'slide') ctx.translate((1 - transitionT) * width, 0);
    else if (transition === 'zoom') {
        const transitionScale = 1.12 - 0.12 * transitionT;
        ctx.translate(width / 2, height / 2);
        ctx.scale(transitionScale, transitionScale);
        ctx.translate(-width / 2, -height / 2);
    }

    ctx.save();
    applyCameraFx(ctx, clip.fx, width, height, clipSeconds, settings.fxBpm);

    ctx.filter = `brightness(${settings.brightness}%) saturate(${settings.saturation}%)`;
    const isSaaSMode = settings.productTemplateId === 'saas' || settings.aspectRatio === '16:9';

    if (isSaaSMode && clip.type === 'image') {
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
        ctx.drawImage(depthFrame ?? element, drawX, drawY + barH, drawW, drawH - barH);
        ctx.restore();
    } else if (depthFrame) {
        const depthW = width * userScale;
        const depthH = height * userScale;
        const depthX = (width - depthW) / 2;
        const depthY = (height - depthH) / 2;
        if (clip.softEdges !== false && userScale < 0.98) drawSoftEdged(ctx, depthFrame, depthX, depthY, depthW, depthH, width, height, Math.min(width, height) * 0.08);
        else ctx.drawImage(depthFrame, depthX, depthY, depthW, depthH);
    } else {
        ctx.drawImage(element, drawX, drawY, drawW, drawH);
    }
    ctx.filter = 'none';

    if (settings.gradient !== 'none') {
        const colors = GRADIENTS.find((item) => item.id === settings.gradient)?.colors ?? ['0,0,0', '0,0,0'];
        const overlay = ctx.createLinearGradient(0, 0, 0, height);
        const alpha = settings.gradientStrength / 100;
        overlay.addColorStop(0, `rgba(${colors[0]},${alpha * 0.2})`);
        overlay.addColorStop(0.48, `rgba(${colors[0]},${alpha * 0.52})`);
        overlay.addColorStop(1, `rgba(${colors[1]},${alpha})`);
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
    drawRgbSplit(ctx, clip.fx, clipSeconds, settings.fxBpm);
    drawProductEffects(ctx, clip, width, height, motionT, { image: rc.logoImage, corner: settings.logoCorner, sizePct: settings.logoSize }, clipSeconds);
    drawCaption(ctx, clip, width, height);
    ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* Public entry point                                                         */
/* -------------------------------------------------------------------------- */

/** Draws the reel as it looks `timeMs` into the timeline onto `ctx.canvas`. Synchronous and side-effect free. */
export function renderFrame(ctx: CanvasRenderingContext2D, rc: RenderContext, timeMs: number, opts: { watermark?: boolean } = {}) {
    const { width, height } = ctx.canvas;
    const index = indexAtTime(rc.timeline, timeMs);
    const clip = rc.clips[index];

    if (!clip) {
        ctx.fillStyle = rc.settings.backgroundColor;
        ctx.fillRect(0, 0, width, height);
        return;
    }

    const localMs = Math.max(0, timeMs - rc.timeline.starts[index]);
    const clipMs = Math.max(1, rc.timeline.durations[index]);
    const transitionProgress = clip.transition === 'cut' ? 1 : Math.min(1, localMs / TRANSITION_MS);

    drawSlide(ctx, clip, rc, width, height, transitionProgress, localMs / clipMs);
    if (opts.watermark) drawFreeTierWatermark(ctx, width, height);
}
