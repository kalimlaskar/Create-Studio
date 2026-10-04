import { OverlayClip } from '@/types/editor';

const imageCache = new Map<string, HTMLImageElement>();

function getOverlayImage(source: string) {
    let image = imageCache.get(source);
    if (!image) {
        image = new Image();
        image.src = source;
        imageCache.set(source, image);
    }
    return image;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines;
}

export function drawActiveOverlays(
    ctx: CanvasRenderingContext2D,
    overlays: OverlayClip[],
    currentMs: number,
    width: number,
    height: number,
    scale = 1,
) {
    for (const overlay of overlays) {
        if (currentMs < overlay.startMs || currentMs > overlay.endMs) continue;
        const x = overlay.x * width;
        const y = overlay.y * height;

        if (overlay.type === 'image') {
            const image = getOverlayImage(overlay.content);
            if (!image.complete || image.naturalWidth === 0) continue;
            const drawWidth = width * (overlay.width ?? 0.32);
            const drawHeight = drawWidth * image.naturalHeight / image.naturalWidth;
            const maxHeight = height * 0.8;
            const fit = Math.min(1, maxHeight / drawHeight);
            ctx.drawImage(image, x - drawWidth * fit / 2, y - drawHeight * fit / 2, drawWidth * fit, drawHeight * fit);
            continue;
        }

        if (overlay.type !== 'text') continue;
        const fontSize = (overlay.fontSize ?? 32) * scale;
        const padding = fontSize * 0.32;
        const lineHeight = fontSize * 1.25;
        const maxTextWidth = width * 0.86 - padding * 2;
        ctx.save();
        ctx.font = `700 ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lines = wrapText(ctx, overlay.content, maxTextWidth);
        const textWidth = Math.min(maxTextWidth, Math.max(...lines.map((line) => ctx.measureText(line).width), 0));
        const boxWidth = textWidth + padding * 2;
        const boxHeight = lines.length * lineHeight + padding * 1.3;
        const style = overlay.textStyle ?? 'classic';

        if (style === 'banner' || style === 'highlight') {
            ctx.fillStyle = style === 'banner' ? 'rgba(10,10,10,0.78)' : 'rgba(250,204,21,0.92)';
            ctx.beginPath();
            ctx.roundRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight, fontSize * 0.2);
            ctx.fill();
        }

        lines.forEach((line, index) => {
            const lineY = y + (index - (lines.length - 1) / 2) * lineHeight;
            if (style === 'classic') {
                ctx.fillStyle = overlay.color ?? '#ffffff';
                ctx.strokeStyle = 'rgba(0,0,0,0.75)';
                ctx.lineWidth = fontSize * 0.12;
                ctx.strokeText(line, x, lineY, maxTextWidth);
                ctx.fillText(line, x, lineY, maxTextWidth);
            } else if (style === 'outline') {
                ctx.strokeStyle = overlay.color ?? '#ffffff';
                ctx.lineWidth = Math.max(1, fontSize * 0.07);
                ctx.strokeText(line, x, lineY, maxTextWidth);
            } else {
                ctx.fillStyle = style === 'highlight' ? '#111111' : (overlay.color ?? '#ffffff');
                ctx.fillText(line, x, lineY, maxTextWidth);
            }
        });
        ctx.restore();
    }
}
