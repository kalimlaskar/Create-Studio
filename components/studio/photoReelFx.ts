/* -------------------------------------------------------------------------- */
/* Trending "wow" effects for PhotoReelStudio                                 */
/*                                                                            */
/*  - Camera effects (punch zoom, beat pulse, shake) are a transform that is  */
/*    applied to the media. CSS in the preview, ctx transform in the export.  */
/*  - Overlay effects are drawn on a canvas on top of the frame. The same     */
/*    code runs in the live preview and in the export.                        */
/*  - RGB split is a pixel effect and is applied in the export only.          */
/* -------------------------------------------------------------------------- */

export type FxId =
    | 'whip-zoom' | 'beat-pulse' | 'shake'
    | 'flash' | 'glitch' | 'rgb-split' | 'speed-lines'
    | 'sparks' | 'bokeh' | 'confetti'
    | 'light-leak' | 'bloom' | 'film-grain' | 'scanlines' | 'letterbox';

export const FX_LIST: Array<{ id: FxId; label: string; emoji: string; group: 'Motion' | 'Hit' | 'Particles' | 'Look' }> = [
    { id: 'whip-zoom', label: 'Punch-in zoom', emoji: '🎯', group: 'Motion' },
    { id: 'beat-pulse', label: 'Beat pulse', emoji: '💓', group: 'Motion' },
    { id: 'shake', label: 'Handheld shake', emoji: '📳', group: 'Motion' },
    { id: 'flash', label: 'Flash on cut', emoji: '⚡', group: 'Hit' },
    { id: 'glitch', label: 'Glitch bursts', emoji: '👾', group: 'Hit' },
    { id: 'rgb-split', label: 'RGB split (export)', emoji: '🔴', group: 'Hit' },
    { id: 'speed-lines', label: 'Speed lines', emoji: '💨', group: 'Hit' },
    { id: 'sparks', label: 'Golden sparks', emoji: '✨', group: 'Particles' },
    { id: 'bokeh', label: 'Dreamy bokeh', emoji: '🫧', group: 'Particles' },
    { id: 'confetti', label: 'Confetti', emoji: '🎉', group: 'Particles' },
    { id: 'light-leak', label: 'Light leak', emoji: '🌅', group: 'Look' },
    { id: 'bloom', label: 'Dreamy glow', emoji: '🌟', group: 'Look' },
    { id: 'film-grain', label: 'Film grain', emoji: '🎞️', group: 'Look' },
    { id: 'scanlines', label: 'VHS scanlines', emoji: '📼', group: 'Look' },
    { id: 'letterbox', label: 'Cinema bars', emoji: '🎬', group: 'Look' },
];

export const FX_PRESETS: Array<{ id: string; label: string; emoji: string; blurb: string; fx: FxId[] }> = [
    { id: 'viral', label: 'Viral Pop', emoji: '🔥', blurb: 'Punch zoom, flash, beat, sparks', fx: ['whip-zoom', 'flash', 'beat-pulse', 'sparks'] },
    { id: 'cinematic', label: 'Cinematic', emoji: '🎬', blurb: 'Bars, grain, light leak, glow', fx: ['letterbox', 'film-grain', 'light-leak', 'bloom'] },
    { id: 'glitch', label: 'Glitch Hype', emoji: '👾', blurb: 'Glitch, RGB split, shake, VHS', fx: ['glitch', 'rgb-split', 'shake', 'scanlines'] },
    { id: 'dreamy', label: 'Dreamy', emoji: '🫧', blurb: 'Bokeh, glow, warm leak', fx: ['bokeh', 'bloom', 'light-leak'] },
    { id: 'party', label: 'Party', emoji: '🎉', blurb: 'Confetti, beat, flash, leak', fx: ['confetti', 'beat-pulse', 'flash', 'light-leak'] },
];

/* ------------------------------ helpers ----------------------------------- */

const has = (fx: FxId[] | undefined, id: FxId) => !!fx && fx.includes(id);

/** Stable pseudo-random 0..1 so preview and export always agree. */
const rand = (i: number, salt = 0) => {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
};

const glitchState = (seconds: number) => {
    const period = 1.3;
    const k = Math.floor(seconds / period);
    const local = seconds - k * period;
    return { k, active: local < 0.2 && seconds > 0.15 };
};

/* ------------------------------ camera ------------------------------------ */

export interface CameraTransform {
    scale: number;
    dx: number; // fraction of frame width
    dy: number; // fraction of frame height
    rot: number; // radians
}

export function getCameraTransform(fx: FxId[] | undefined, seconds: number, bpm = 120): CameraTransform {
    let scale = 1;
    let dx = 0;
    let dy = 0;
    let rot = 0;
    if (!fx || fx.length === 0) return { scale, dx, dy, rot };

    if (has(fx, 'whip-zoom')) {
        const e = Math.exp(-seconds * 6.5);
        scale *= 1 + 0.4 * e;
        rot += 0.06 * e;
    }
    if (has(fx, 'beat-pulse')) {
        const beat = 60 / bpm;
        const phase = (seconds % beat) / beat;
        scale *= 1 + 0.055 * Math.exp(-phase * 7);
    }
    if (has(fx, 'shake')) {
        scale *= 1.035; // hides the edges while shaking
        dx += (Math.sin(seconds * 31) + Math.sin(seconds * 53 + 1.3) * 0.6) * 0.004;
        dy += (Math.sin(seconds * 37 + 2) + Math.sin(seconds * 61) * 0.6) * 0.004;
        rot += Math.sin(seconds * 23) * 0.004;
    }
    if (has(fx, 'glitch')) {
        const g = glitchState(seconds);
        if (g.active) {
            dx += (rand(g.k, 1) - 0.5) * 0.035;
            scale *= 1.02;
        }
    }
    return { scale, dx, dy, rot };
}

/** Canvas version, call between ctx.save() and ctx.restore() before drawing the media. */
export function applyCameraFx(ctx: CanvasRenderingContext2D, fx: FxId[] | undefined, w: number, h: number, seconds: number, bpm = 120) {
    const t = getCameraTransform(fx, seconds, bpm);
    if (t.scale === 1 && t.dx === 0 && t.dy === 0 && t.rot === 0) return;
    ctx.translate(w / 2 + t.dx * w, h / 2 + t.dy * h);
    ctx.rotate(t.rot);
    ctx.scale(t.scale, t.scale);
    ctx.translate(-w / 2, -h / 2);
}

/** CSS version for the live preview. */
export function cameraCss(fx: FxId[] | undefined, seconds: number, bpm = 120): string {
    const t = getCameraTransform(fx, seconds, bpm);
    if (t.scale === 1 && t.dx === 0 && t.dy === 0 && t.rot === 0) return 'none';
    return `translate(${(t.dx * 100).toFixed(3)}%, ${(t.dy * 100).toFixed(3)}%) rotate(${t.rot.toFixed(4)}rad) scale(${t.scale.toFixed(4)})`;
}

/* ------------------------------ pixel FX (export) ------------------------- */

let rgbSource: HTMLCanvasElement | null = null;
let rgbChannel: HTMLCanvasElement | null = null;

/** Chromatic aberration: splits the finished frame into red / green / blue and offsets them. */
export function drawRgbSplit(ctx: CanvasRenderingContext2D, fx: FxId[] | undefined, seconds: number, bpm = 120) {
    if (!has(fx, 'rgb-split')) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    if (!rgbSource || !rgbChannel) {
        rgbSource = document.createElement('canvas');
        rgbChannel = document.createElement('canvas');
    }
    if (rgbSource.width !== w || rgbSource.height !== h) {
        rgbSource.width = rgbChannel.width = w;
        rgbSource.height = rgbChannel.height = h;
    }
    const src = rgbSource.getContext('2d');
    const chan = rgbChannel.getContext('2d');
    if (!src || !chan) return;

    src.setTransform(1, 0, 0, 1, 0, 0);
    src.globalCompositeOperation = 'source-over';
    src.globalAlpha = 1;
    src.clearRect(0, 0, w, h);
    src.drawImage(ctx.canvas, 0, 0);

    const beat = 60 / bpm;
    const phase = (seconds % beat) / beat;
    const glitch = has(fx, 'glitch') ? glitchState(seconds) : { active: false };
    const amount = w * (0.0025 + 0.004 * Math.exp(-phase * 6)) + (glitch.active ? w * 0.012 : 0);
    const pad = amount + 2;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const channels: Array<[string, number]> = [['#ff0000', -amount], ['#00ff00', 0], ['#0000ff', amount]];
    channels.forEach(([color, offset]) => {
        chan.setTransform(1, 0, 0, 1, 0, 0);
        chan.globalCompositeOperation = 'source-over';
        chan.clearRect(0, 0, w, h);
        chan.drawImage(rgbSource!, offset - pad, -pad, w + pad * 2, h + pad * 2);
        chan.globalCompositeOperation = 'multiply';
        chan.fillStyle = color;
        chan.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(rgbChannel!, 0, 0);
    });
    ctx.restore();
}

/* ------------------------------ overlay FX -------------------------------- */

let grainTile: HTMLCanvasElement | null = null;
const getGrainTile = () => {
    if (!grainTile) {
        grainTile = document.createElement('canvas');
        grainTile.width = 160;
        grainTile.height = 160;
        const g = grainTile.getContext('2d');
        if (g) {
            const img = g.createImageData(160, 160);
            for (let i = 0; i < img.data.length; i += 4) {
                const v = Math.random() * 255;
                img.data[i] = v;
                img.data[i + 1] = v;
                img.data[i + 2] = v;
                img.data[i + 3] = 255;
            }
            g.putImageData(img, 0, 0);
        }
    }
    return grainTile;
};

/** Everything that is drawn on top of the picture. `seconds` is the time inside the current clip. */
export function drawOverlayFx(ctx: CanvasRenderingContext2D, fx: FxId[] | undefined, w: number, h: number, seconds: number) {
    if (!fx || fx.length === 0) return;
    const u = w / 540; // scale unit so the preview and the 1080p export look the same
    ctx.save();

    if (has(fx, 'light-leak')) {
        ctx.globalCompositeOperation = 'screen';
        const pulse = 0.65 + 0.35 * Math.sin(seconds * 1.4);
        const x1 = w * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(seconds * 0.8)));
        const g1 = ctx.createRadialGradient(x1, h * 0.12, 0, x1, h * 0.12, w * 0.9);
        g1.addColorStop(0, `rgba(255,140,60,${0.5 * pulse})`);
        g1.addColorStop(1, 'rgba(255,140,60,0)');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, w, h);
        const x2 = w * (0.8 - 0.5 * (0.5 + 0.5 * Math.sin(seconds * 0.6 + 1)));
        const g2 = ctx.createRadialGradient(x2, h * 0.95, 0, x2, h * 0.95, w * 0.8);
        g2.addColorStop(0, `rgba(255,70,150,${0.4 * pulse})`);
        g2.addColorStop(1, 'rgba(255,70,150,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, w, h);
    }

    if (has(fx, 'bloom')) {
        ctx.globalCompositeOperation = 'screen';
        const pulse = 0.5 + 0.5 * Math.sin(seconds * 1.8);
        const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.7);
        g.addColorStop(0, `rgba(255,255,255,${0.1 + 0.1 * pulse})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }

    if (has(fx, 'bokeh')) {
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 16; i += 1) {
            const r = (0.04 + rand(i, 1) * 0.08) * w;
            const x = (rand(i, 2) + Math.sin(seconds * 0.3 + i) * 0.05) * w;
            const y = ((((rand(i, 3) - seconds * 0.02 * (0.5 + rand(i, 4))) % 1) + 1) % 1) * h;
            const a = 0.12 + 0.14 * (0.5 + 0.5 * Math.sin(seconds * 1.5 + i));
            const hue = rand(i, 5) > 0.5 ? '255,200,230' : '190,230,255';
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(${hue},${a})`);
            g.addColorStop(0.7, `rgba(${hue},${a * 0.6})`);
            g.addColorStop(1, `rgba(${hue},0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (has(fx, 'sparks')) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = '#ffcc66';
        for (let i = 0; i < 44; i += 1) {
            const cycle = 2.4 + rand(i, 1) * 2.4;
            const t = (seconds / cycle + rand(i, 2)) % 1;
            const x = (rand(i, 3) + Math.sin(seconds * 1.3 + i) * 0.02) * w;
            const y = h * (1.05 - t * 1.2);
            const size = (1.2 + rand(i, 4) * 2.8) * u;
            ctx.globalAlpha = Math.sin(t * Math.PI) * (0.5 + 0.5 * Math.sin(seconds * 9 + i));
            ctx.shadowBlur = size * 4;
            ctx.fillStyle = rand(i, 5) > 0.7 ? '#ffffff' : '#ffd27a';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    if (has(fx, 'confetti')) {
        for (let i = 0; i < 70; i += 1) {
            const cycle = 3 + rand(i, 1) * 3;
            const t = (seconds / cycle + rand(i, 2)) % 1;
            const x = (rand(i, 3) + Math.sin(seconds * 1.5 + i) * 0.03) * w;
            const y = (-0.1 + t * 1.2) * h;
            const size = (5 + rand(i, 4) * 6) * u;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(seconds * (2 + rand(i, 5) * 4) + i);
            ctx.scale(1, Math.cos(seconds * 5 + i));
            ctx.fillStyle = `hsl(${Math.floor(rand(i, 6) * 360)}, 90%, 60%)`;
            ctx.fillRect(-size / 2, -size / 4, size, size / 2);
            ctx.restore();
        }
    }

    if (has(fx, 'glitch')) {
        const g = glitchState(seconds);
        if (g.active) {
            ctx.globalCompositeOperation = 'screen';
            const bars = 5 + Math.floor(rand(g.k, 2) * 5);
            for (let j = 0; j < bars; j += 1) {
                const y = rand(g.k, j + 3) * h;
                const bh = h * (0.01 + rand(g.k, j + 9) * 0.05);
                const ox = (rand(g.k, j + 15) - 0.5) * w * 0.12;
                ctx.fillStyle = j % 2 ? 'rgba(0,255,255,0.35)' : 'rgba(255,0,200,0.35)';
                ctx.fillRect(ox, y, w, bh);
            }
        }
    }

    if (has(fx, 'speed-lines') && seconds < 0.7) {
        const a = 1 - seconds / 0.7;
        const reach = Math.max(w, h);
        ctx.translate(w / 2, h / 2);
        for (let i = 0; i < 48; i += 1) {
            const angle = rand(i, 2) * Math.PI * 2;
            const inner = reach * (0.28 + rand(i, 3) * 0.2);
            const outer = reach * 0.9;
            const width = 0.01 + rand(i, 4) * 0.02;
            ctx.fillStyle = `rgba(255,255,255,${a * 0.35 * (0.5 + rand(i, 5) * 0.5)})`;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
            ctx.lineTo(Math.cos(angle - width) * outer, Math.sin(angle - width) * outer);
            ctx.lineTo(Math.cos(angle + width) * outer, Math.sin(angle + width) * outer);
            ctx.closePath();
            ctx.fill();
        }
        ctx.translate(-w / 2, -h / 2);
    }

    if (has(fx, 'scanlines')) {
        ctx.globalCompositeOperation = 'source-over';
        const step = Math.max(3, Math.round(4 * u));
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, step / 2);
        const bandY = (((seconds * 0.25) % 1.3) - 0.15) * h;
        const band = ctx.createLinearGradient(0, bandY, 0, bandY + h * 0.12);
        band.addColorStop(0, 'rgba(255,255,255,0)');
        band.addColorStop(0.5, 'rgba(255,255,255,0.07)');
        band.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = band;
        ctx.fillRect(0, bandY, w, h * 0.12);
    }

    if (has(fx, 'film-grain')) {
        const frame = Math.floor(seconds * 24);
        const pattern = ctx.createPattern(getGrainTile(), 'repeat');
        if (pattern) {
            ctx.globalCompositeOperation = 'overlay';
            ctx.globalAlpha = 0.14;
            ctx.translate(-rand(frame, 1) * 160, -rand(frame, 2) * 160);
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, w + 160, h + 160);
            ctx.translate(rand(frame, 1) * 160, rand(frame, 2) * 160);
            ctx.globalAlpha = 1;
        }
    }

    if (has(fx, 'flash') && seconds < 0.3) {
        const a = 1 - seconds / 0.3;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(255,255,255,${a * a * 0.85})`;
        ctx.fillRect(0, 0, w, h);
    }

    if (has(fx, 'letterbox')) {
        const ease = 1 - (1 - Math.min(1, seconds / 0.7)) ** 3;
        const bar = h * 0.1 * ease;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, bar);
        ctx.fillRect(0, h - bar, w, bar);
    }

    ctx.restore();
}
