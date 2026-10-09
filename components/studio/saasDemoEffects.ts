import { ReelImage } from '@/types/studio';

/**
 * Renders the high-end SaaS window frame, smooth focus zoom, 3D perspective tilt, 
 * animated cursor, and glowing click ripple effect onto the canvas.
 */
export function drawSaasDemoEffect(
    ctx: CanvasRenderingContext2D,
    clip: ReelImage,
    element: CanvasImageSource,
    width: number,
    height: number,
    motionProgress: number,
    filter: string
) {
    const isSaaS = clip.focusX !== undefined && clip.focusY !== undefined;
    const focusX = clip.focusX ?? 50;
    const focusY = clip.focusY ?? 50;

    const motionT = Math.max(0, Math.min(1, motionProgress));

    // Smooth easing for camera motion
    const easeT = motionT < 0.5 ? 2 * motionT * motionT : -1 + (4 - 2 * motionT) * motionT;

    // Zoom & Pan calculation towards focus point
    const baseScale = 1.05 + 0.15 * easeT;
    const focusZoom = isSaaS ? 1.35 * easeT : 1;
    const totalScale = baseScale * focusZoom * (clip.scale ?? 1);

    const targetPixelX = (focusX / 100) * width;
    const targetPixelY = (focusY / 100) * height;
    const panX = isSaaS ? (width / 2 - targetPixelX) * 0.45 * easeT : 0;
    const panY = isSaaS ? (height / 2 - targetPixelY) * 0.45 * easeT : 0;
    const tiltAngle = isSaaS ? (focusX > 50 ? -0.018 : 0.018) * easeT : 0;

    const sourceWidth = element instanceof HTMLImageElement ? element.naturalWidth
        : element instanceof HTMLVideoElement ? element.videoWidth
            : element instanceof HTMLCanvasElement ? element.width : 540;
    const sourceHeight = element instanceof HTMLImageElement ? element.naturalHeight
        : element instanceof HTMLVideoElement ? element.videoHeight
            : element instanceof HTMLCanvasElement ? element.height : 960;

    const ratio = Math.min(width / sourceWidth, height / sourceHeight) * 0.92;
    const drawW = sourceWidth * ratio * totalScale;
    const drawH = sourceHeight * ratio * totalScale;
    const drawX = (width - drawW) / 2 + panX;
    const drawY = (height - drawH) / 2 + panY;

    ctx.save();

    // Apply 3D Perspective Tilt
    if (tiltAngle !== 0) {
        ctx.translate(width / 2, height / 2);
        ctx.rotate(tiltAngle);
        ctx.translate(-width / 2, -height / 2);
    }

    // Draw Window Chrome (MacBook style browser/app frame)
    const barH = height * 0.055;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#181825';
    ctx.beginPath();
    ctx.roundRect(drawX, drawY, drawW, drawH, 14);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Window control dots
    const dotR = height * 0.007;
    const dotY = drawY + barH / 2;
    ['#ff5f56', '#ffbd2e', '#27c93f'].forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(drawX + width * 0.03 + i * (dotR * 3.5), dotY, dotR, 0, Math.PI * 2);
        ctx.fill();
    });

    // Window URL / Title pill
    ctx.fillStyle = '#2a2a3c';
    ctx.beginPath();
    ctx.roundRect(drawX + width * 0.18, drawY + barH * 0.2, drawW * 0.64, barH * 0.6, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '500 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('app.yourproduct.com/dashboard', drawX + drawW / 2, dotY);

    // Clip Screenshot Inside Window
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(drawX, drawY + barH, drawW, drawH - barH, [0, 0, 14, 14]);
    ctx.clip();
    ctx.filter = filter;
    ctx.drawImage(element, drawX, drawY + barH, drawW, drawH - barH);
    ctx.restore();

    // Glowing Click & Ripple Effect
    if (clip.clickEffect && isSaaS) {
        const clickWindowT = Math.max(0, Math.min(1, (motionT - 0.35) / 0.45));
        if (clickWindowT > 0 && clickWindowT < 1) {
            const clickX = drawX + (focusX / 100) * drawW;
            const clickY = drawY + barH + (focusY / 100) * (drawH - barH);

            ctx.save();
            const radius = clickWindowT * 42;
            const alpha = 1 - clickWindowT;
            ctx.beginPath();
            ctx.arc(clickX, clickY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(106, 76, 255, ${alpha})`;
            ctx.lineWidth = 3.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(clickX, clickY, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#6A4CFF';
            ctx.shadowColor = '#6A4CFF';
            ctx.shadowBlur = 18;
            ctx.fill();

            const cursorStartX = clickX + 45;
            const cursorStartY = clickY + 45;
            const curX = cursorStartX + (clickX - cursorStartX) * Math.min(1, clickWindowT * 2.2);
            const curY = cursorStartY + (clickY - cursorStartY) * Math.min(1, clickWindowT * 2.2);

            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#0f0e17';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(curX, curY);
            ctx.lineTo(curX, curY + 20);
            ctx.lineTo(curX + 6, curY + 15);
            ctx.lineTo(curX + 13, curY + 23);
            ctx.lineTo(curX + 16, curY + 20);
            ctx.lineTo(curX + 9, curY + 12);
            ctx.lineTo(curX + 15, curY + 12);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }

    ctx.restore();
}