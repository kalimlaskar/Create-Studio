/* -------------------------------------------------------------------------- */
/* Extras for PhotoReelStudio: animated borders + built-in music              */
/* -------------------------------------------------------------------------- */

/* ============================== BORDER EFFECTS ============================ */

export type BorderEffect = 'none' | 'glow' | 'sweep' | 'glitter' | 'rainbow';

export const BORDER_EFFECTS: Array<{ id: BorderEffect; label: string }> = [
    { id: 'none', label: 'None' },
    { id: 'glow', label: '✨ Neon glow (pulsing)' },
    { id: 'sweep', label: '☄️ Light sweep around border' },
    { id: 'glitter', label: '💫 Glitter border' },
    { id: 'rainbow', label: '🌈 Rainbow chase' },
];

const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
};

/** Point on the rectangle perimeter, p in [0, 1). */
const perimeterPoint = (p: number, x: number, y: number, w: number, h: number) => {
    let d = (((p % 1) + 1) % 1) * 2 * (w + h);
    if (d < w) return { x: x + d, y };
    d -= w;
    if (d < h) return { x: x + w, y: y + d };
    d -= h;
    if (d < w) return { x: x + w - d, y: y + h };
    d -= w;
    return { x, y: y + h - d };
};

const drawSparkle = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.quadraticCurveTo(cx, cy, cx + size, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + size);
    ctx.quadraticCurveTo(cx, cy, cx - size, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - size);
    ctx.closePath();
    ctx.fill();
};

/**
 * Draws an animated border on top of the frame.
 * `seconds` is the time inside the current clip, so the preview and the export animate identically.
 */
export function drawBorderEffect(ctx: CanvasRenderingContext2D, effect: BorderEffect | undefined, color: string | undefined, width: number, height: number, seconds: number) {
    if (!effect || effect === 'none') return;
    const accent = color ?? '#6A4CFF';
    const base = Math.min(width, height);
    const inset = base * 0.03;
    const lineWidth = Math.max(3, base * 0.011);
    const radius = base * 0.045;
    const x = inset;
    const y = inset;
    const w = width - inset * 2;
    const h = height - inset * 2;
    const pulse = 0.65 + 0.35 * Math.sin(seconds * 3.2);

    ctx.save();
    ctx.lineJoin = 'round';

    // 1. Soft glowing base line (every effect has this)
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = lineWidth * (3 + 5 * pulse);
    ctx.globalAlpha = effect === 'glow' ? 0.95 : 0.5;
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.stroke();
    if (effect === 'glow') {
        ctx.shadowBlur = lineWidth * (7 + 7 * pulse);
        ctx.globalAlpha = 0.5;
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // 2. Moving highlight that travels around the border
    if ((effect === 'sweep' || effect === 'glitter' || effect === 'rainbow') && typeof ctx.createConicGradient === 'function') {
        const angle = seconds * 2.4;
        const gradient = ctx.createConicGradient(angle, width / 2, height / 2);
        if (effect === 'rainbow') {
            for (let i = 0; i <= 6; i += 1) gradient.addColorStop(i / 6, `hsl(${(i * 60 + seconds * 120) % 360}, 95%, 60%)`);
        } else {
            gradient.addColorStop(0, 'rgba(255,255,255,0)');
            gradient.addColorStop(0.55, 'rgba(255,255,255,0)');
            gradient.addColorStop(0.85, accent);
            gradient.addColorStop(0.97, '#ffffff');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
        }
        ctx.strokeStyle = gradient;
        ctx.lineWidth = lineWidth * 1.35;
        ctx.shadowColor = effect === 'rainbow' ? '#ffffff' : accent;
        ctx.shadowBlur = lineWidth * 3;
        roundRectPath(ctx, x, y, w, h, radius);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // 3. Twinkling sparkles riding along the border
    if (effect === 'glitter') {
        const count = 34;
        ctx.shadowColor = '#ffffff';
        for (let i = 0; i < count; i += 1) {
            const seed = Math.sin(i * 91.7) * 43758.5453;
            const jitter = seed - Math.floor(seed); // stable 0..1 per sparkle
            const p = i / count + seconds * (0.05 + jitter * 0.04);
            const twinkle = Math.max(0, Math.sin(seconds * (4 + jitter * 4) + i * 1.9));
            if (twinkle < 0.05) continue;
            const point = perimeterPoint(p, x, y, w, h);
            const spread = (jitter - 0.5) * lineWidth * 3;
            const size = lineWidth * (0.9 + 2.2 * twinkle * (0.6 + jitter * 0.6));
            ctx.globalAlpha = 0.35 + 0.65 * twinkle;
            ctx.fillStyle = jitter > 0.7 ? accent : '#ffffff';
            ctx.shadowBlur = size * 2.5;
            drawSparkle(ctx, point.x + spread, point.y + spread, size);
        }
    }

    ctx.restore();
}

/* ============================== DEFAULT MUSIC ============================= */

export interface DefaultTrack {
    id: string;
    label: string;
    emoji: string;
    mood: string;
    bpm: number;
    chords: number[][]; // MIDI notes per bar
    wave: OscillatorType;
    cutoff: number;
    drums: 'none' | 'soft' | 'four' | 'lofi';
    bass: boolean;
    arp: boolean;
    padGain: number;
}

export const DEFAULT_TRACKS: DefaultTrack[] = [
    {
        id: 'lofi', label: 'Chill Lo-fi', emoji: '🌙', mood: 'Relaxed, fashion & lifestyle', bpm: 78,
        chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]],
        wave: 'triangle', cutoff: 1400, drums: 'lofi', bass: true, arp: false, padGain: 0.07,
    },
    {
        id: 'upbeat', label: 'Upbeat Pop', emoji: '⚡', mood: 'Energetic, shoes & product drops', bpm: 120,
        chords: [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]],
        wave: 'sawtooth', cutoff: 2200, drums: 'four', bass: true, arp: true, padGain: 0.05,
    },
    {
        id: 'cinematic', label: 'Cinematic Rise', emoji: '🎬', mood: 'Dramatic, 3D showcases', bpm: 70,
        chords: [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]],
        wave: 'sawtooth', cutoff: 900, drums: 'soft', bass: true, arp: false, padGain: 0.06,
    },
    {
        id: 'luxe', label: 'Luxe Sparkle', emoji: '💎', mood: 'Elegant, jewelry & premium', bpm: 92,
        chords: [[62, 65, 69, 72], [58, 62, 65, 69], [55, 58, 62, 65], [57, 61, 64, 67]],
        wave: 'sine', cutoff: 3000, drums: 'none', bass: false, arp: true, padGain: 0.07,
    },
];

const midiToFreq = (note: number) => 440 * 2 ** ((note - 69) / 12);

function tone(ctx: BaseAudioContext, dest: AudioNode, freq: number, start: number, dur: number, type: OscillatorType, gain: number, cutoff: number) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(gain, start + Math.min(0.06, dur / 4));
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(filter).connect(amp).connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.05);
}

function kick(ctx: BaseAudioContext, dest: AudioNode, t: number, gain: number) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.14);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(amp).connect(dest);
    osc.start(t);
    osc.stop(t + 0.32);
}

function hat(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, t: number, gain: number) {
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    src.buffer = noise;
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(filter).connect(amp).connect(dest);
    src.start(t);
    src.stop(t + 0.06);
}

function encodeWav(buffer: AudioBuffer): Blob {
    const channels = buffer.numberOfChannels;
    const length = buffer.length * channels * 2;
    const view = new DataView(new ArrayBuffer(44 + length));
    const writeString = (offset: number, text: string) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);
    let offset = 44;
    const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
    for (let i = 0; i < buffer.length; i += 1) {
        for (let c = 0; c < channels; c += 1) {
            const sample = Math.max(-1, Math.min(1, data[c][i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
        }
    }
    return new Blob([view], { type: 'audio/wav' });
}

const trackCache = new Map<string, File>();

/** Synthesizes a loopable ~24s track in the browser. No audio files or network needed. */
export async function createDefaultTrackFile(id: string): Promise<File> {
    const cached = trackCache.get(id);
    if (cached) return cached;
    const def = DEFAULT_TRACKS.find((track) => track.id === id);
    if (!def) throw new Error('Unknown music track.');

    const sampleRate = 32000;
    const beat = 60 / def.bpm;
    const barLen = beat * 4;
    const bars = Math.max(4, Math.ceil(24 / barLen));
    const totalSeconds = bars * barLen;
    const ctx = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate);

    const master = ctx.createGain();
    master.gain.value = 0.9;
    const compressor = ctx.createDynamicsCompressor();
    master.connect(compressor).connect(ctx.destination);

    const noise = ctx.createBuffer(1, Math.floor(sampleRate * 0.1), sampleRate);
    const noiseData = noise.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = Math.random() * 2 - 1;

    for (let bar = 0; bar < bars; bar += 1) {
        const chord = def.chords[bar % def.chords.length];
        const t0 = bar * barLen;

        chord.forEach((note) => tone(ctx, master, midiToFreq(note), t0, barLen * 0.98, def.wave, def.padGain, def.cutoff));

        if (def.bass) {
            for (let b = 0; b < 4; b += 1) {
                if (def.drums === 'four' || b % 2 === 0) tone(ctx, master, midiToFreq(chord[0] - 24), t0 + b * beat, beat * 0.9, 'sine', 0.22, 300);
            }
        }

        if (def.arp) {
            for (let i = 0; i < 8; i += 1) {
                const note = chord[i % chord.length] + (i % 2 ? 24 : 12);
                tone(ctx, master, midiToFreq(note), t0 + i * beat * 0.5, beat * 0.45, def.wave === 'sine' ? 'sine' : 'triangle', 0.05, 4000);
            }
        }

        for (let b = 0; b < 4; b += 1) {
            const t = t0 + b * beat;
            if (def.drums === 'four') {
                kick(ctx, master, t, 0.5);
                hat(ctx, master, noise, t + beat / 2, 0.07);
            } else if (def.drums === 'lofi') {
                if (b % 2 === 0) kick(ctx, master, t, 0.4);
                hat(ctx, master, noise, t, 0.05);
                hat(ctx, master, noise, t + beat * 0.5, 0.03);
            } else if (def.drums === 'soft' && b === 0) {
                kick(ctx, master, t, 0.35);
            }
        }
    }

    const rendered = await ctx.startRendering();
    const file = new File([encodeWav(rendered)], `${def.label}.wav`, { type: 'audio/wav' });
    trackCache.set(id, file);
    return file;
}

/* ============================== FULLSCREEN ================================ */

export const requestElementFullscreen = async (element: HTMLElement | null) => {
    if (!element) return;
    const anyEl = element as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
    if (element.requestFullscreen) await element.requestFullscreen();
    else if (anyEl.webkitRequestFullscreen) await anyEl.webkitRequestFullscreen();
};

export const exitDocumentFullscreen = async () => {
    const anyDoc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (anyDoc.webkitExitFullscreen) await anyDoc.webkitExitFullscreen();
};
