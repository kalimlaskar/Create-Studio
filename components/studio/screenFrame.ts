// screenFrame.ts
// Draws a shared-screen video inside a styled "app window" on top of a gradient
// background. Meant to be called from the RECORDING compositor (the canvas that is
// captured by MediaRecorder) only while screen share is active.
//
// No dependencies. All sizes scale with the canvas, so it works for 9:16, 16:9, 1:1.

export type ScreenFrameStyle = 'browser' | 'macos' | 'minimal' | 'off';
export type ScreenFrameBackground = 'aurora' | 'sunset' | 'midnight' | 'paper';

export interface ScreenFrameOptions {
    style: ScreenFrameStyle;
    background: ScreenFrameBackground;
    /** 0 -> 1 entry animation. Drive it from the time screen share started (see getFrameProgress). */
    progress: number;
    /** Text shown in the address pill of the 'browser' style. */
    label?: string;
    /** Space around the window as a fraction of the shorter canvas side. Default 0.05 */
    paddingRatio?: number;
}

export interface Rect { x: number; y: number; w: number; h: number }

export interface ScreenFrameLayout {
    window: Rect;   // whole window including title bar
    content: Rect;  // where the screen video is drawn
}

const BACKGROUNDS: Record<ScreenFrameBackground, { stops: [string, string, string]; glows: [string, string]; light: boolean }> = {
    aurora: { stops: ['#0f172a', '#312e81', '#0e7490'], glows: ['#22d3ee', '#a78bfa'], light: false },
    sunset: { stops: ['#1e1b4b', '#9d174d', '#f97316'], glows: ['#fb7185', '#fbbf24'], light: false },
    midnight: { stops: ['#020617', '#0f172a', '#1e293b'], glows: ['#6366f1', '#38bdf8'], light: false },
    paper: { stops: ['#f8fafc', '#e2e8f0', '#cbd5e1'], glows: ['#ffffff', '#94a3b8'], light: true },
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Convenience: progress for an entry animation of `durationMs` starting at `startedAtMs`. */
export function getFrameProgress(nowMs: number, startedAtMs: number, durationMs = 600): number {
    return clamp01((nowMs - startedAtMs) / durationMs);
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function titleBarHeight(style: ScreenFrameStyle, base: number): number {
    if (style === 'browser') return base * 0.05;
    if (style === 'macos') return base * 0.038;
    return 0;
}

export function computeScreenFrameLayout(
    canvasW: number, canvasH: number, srcW: number, srcH: number,
    style: ScreenFrameStyle, paddingRatio = 0.05,
): ScreenFrameLayout {
    const base = Math.min(canvasW, canvasH);
    const pad = base * paddingRatio;
    const titleH = titleBarHeight(style, base);
    const availW = canvasW - pad * 2;
    const availH = canvasH - pad * 2;
    const aspect = srcW / Math.max(1, srcH);

    let contentW = availW;
    let contentH = contentW / aspect;
    if (contentH + titleH > availH) {
        contentH = availH - titleH;
        contentW = contentH * aspect;
    }
    const winW = contentW;
    const winH = contentH + titleH;
    const winX = (canvasW - winW) / 2;
    const winY = (canvasH - winH) / 2;
    return {
        window: { x: winX, y: winY, w: winW, h: winH },
        content: { x: winX, y: winY + titleH, w: contentW, h: contentH },
    };
}

function paintBackground(ctx: CanvasRenderingContext2D, W: number, H: number, bg: ScreenFrameBackground, alpha: number) {
    const theme = BACKGROUNDS[bg];
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, theme.stops[0]);
    g.addColorStop(0.55, theme.stops[1]);
    g.addColorStop(1, theme.stops[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const glow = (cx: number, cy: number, radius: number, color: string, a: number) => {
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        rg.addColorStop(0, color);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = alpha * a;
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
    };
    const reach = Math.max(W, H);
    glow(W * 0.15, H * 0.1, reach * 0.6, theme.glows[0], 0.35);
    glow(W * 0.9, H * 0.95, reach * 0.55, theme.glows[1], 0.3);
    ctx.restore();
}

function paintTitleBar(
    ctx: CanvasRenderingContext2D, win: Rect, titleH: number, style: ScreenFrameStyle, light: boolean, label: string,
) {
    ctx.fillStyle = light ? '#f1f5f9' : '#1c1d22';
    ctx.fillRect(win.x, win.y, win.w, titleH);
    ctx.fillStyle = light ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(win.x, win.y + titleH - 1, win.w, 1);

    const dotR = titleH * 0.16;
    const dotY = win.y + titleH / 2;
    const dotStart = win.x + titleH * 0.55;
    ['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => {
        ctx.beginPath();
        ctx.arc(dotStart + i * dotR * 3, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    });

    if (style === 'browser') {
        const pillH = titleH * 0.58;
        const pillW = win.w * 0.5;
        const pillX = win.x + (win.w - pillW) / 2;
        const pillY = win.y + (titleH - pillH) / 2;
        roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
        ctx.fillStyle = light ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.fillStyle = light ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.6)';
        ctx.font = `${Math.round(pillH * 0.52)}px system-ui, -apple-system, Segoe UI, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, pillX + pillW / 2, pillY + pillH / 2 + 1, pillW * 0.9);
    }
}

/**
 * Draws the framed screen share. Returns the layout (so you can place your camera
 * inset relative to the window), or null when style is 'off' and nothing was drawn.
 *
 * IMPORTANT: while options.progress < 1, draw your normal (pre-share) frame first, then
 * call this. The background fades in over it, which gives a smooth transition.
 */
export function drawScreenFrame(
    ctx: CanvasRenderingContext2D,
    screen: CanvasImageSource,
    srcW: number,
    srcH: number,
    canvasW: number,
    canvasH: number,
    options: ScreenFrameOptions,
): ScreenFrameLayout | null {
    // Settings saved before this feature existed can be missing these fields, so fall back to defaults.
    const style: ScreenFrameStyle = options.style ?? 'browser';
    const backgroundKey: ScreenFrameBackground = options.background && options.background in BACKGROUNDS ? options.background : 'aurora';
    if (style === 'off' || srcW <= 0 || srcH <= 0) return null;

    const t = easeOutCubic(clamp01(Number.isFinite(options.progress) ? options.progress : 1));
    const base = Math.min(canvasW, canvasH);
    const theme = BACKGROUNDS[backgroundKey];
    const layout = computeScreenFrameLayout(canvasW, canvasH, srcW, srcH, style, options.paddingRatio);
    const { window: win, content } = layout;
    const titleH = titleBarHeight(style, base);
    const radius = base * 0.022;

    paintBackground(ctx, canvasW, canvasH, backgroundKey, t);

    ctx.save();
    // Scale the window in around the canvas centre as the animation plays.
    const scale = 0.94 + 0.06 * t;
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.scale(scale, scale);
    ctx.translate(-canvasW / 2, -canvasH / 2);
    ctx.globalAlpha = t;

    // Drop shadow under the window.
    ctx.save();
    ctx.shadowColor = theme.light ? 'rgba(15,23,42,0.25)' : 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = base * 0.05;
    ctx.shadowOffsetY = base * 0.016;
    roundedRectPath(ctx, win.x, win.y, win.w, win.h, radius);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    // Window contents, clipped to the rounded rectangle.
    ctx.save();
    roundedRectPath(ctx, win.x, win.y, win.w, win.h, radius);
    ctx.clip();
    if (titleH > 0) {
        paintTitleBar(ctx, win, titleH, style, theme.light, options.label || 'Screen share');
    }
    ctx.drawImage(screen, content.x, content.y, content.w, content.h);
    ctx.restore();

    // Thin highlight border.
    roundedRectPath(ctx, win.x, win.y, win.w, win.h, radius);
    ctx.lineWidth = Math.max(1, base * 0.0015);
    ctx.strokeStyle = theme.light ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.14)';
    ctx.stroke();

    ctx.restore();
    return layout;
}