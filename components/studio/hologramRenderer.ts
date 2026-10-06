import type { HologramColor } from '@/types/studio';

export interface HologramParams {
    color: HologramColor;
    intensity: number; // 0..1
    flicker: number; // 0..1
    timeSeconds: number;
    outputHeight?: number;
}

const COLORS: Record<HologramColor, [number, number, number]> = {
    cyan: [0.1, 0.85, 1.0],
    purple: [0.68, 0.38, 1.0],
    green: [0.2, 1.0, 0.5],
};

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// The person texture carries the segmentation mask in its alpha channel.
const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uPerson;
uniform vec2 uTexel;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uFlicker;
uniform float uTime;
uniform float uHeight;

float hash(float n) { return fract(sin(n * 91.3458) * 47453.5453); }

float maskAt(vec2 uv) { return texture2D(uPerson, uv).a; }
float lumaAt(vec2 uv) {
    vec3 c = texture2D(uPerson, uv).rgb;
    return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
    vec2 uv = vUv;

    // Occasional horizontal glitch bands, scaled by flicker amount.
    float slot = floor(uTime * 14.0);
    float glitchOn = step(0.93 - uFlicker * 0.12, hash(slot)) * uFlicker;
    float band = step(0.5, fract(uv.y * 9.0 + hash(slot + 3.0) * 20.0)) * step(0.6, hash(floor(uv.y * 24.0) + slot));
    uv.x += glitchOn * band * 0.012;

    // Chromatic aberration: each channel samples the person at a different x offset.
    float shift = (1.5 + 2.5 * uIntensity) * uTexel.x;
    float aR = maskAt(uv + vec2(shift, 0.0));
    float aG = maskAt(uv);
    float aB = maskAt(uv - vec2(shift, 0.0));
    float lR = lumaAt(uv + vec2(shift, 0.0));
    float lG = lumaAt(uv);
    float lB = lumaAt(uv - vec2(shift, 0.0));

    // Edge glow from a ring of mask taps at two radii.
    float ring1 = 0.0;
    float ring2 = 0.0;
    for (int i = 0; i < 4; i++) {
        float ang = float(i) * 1.570796 + 0.785398;
        vec2 dir = vec2(cos(ang), sin(ang));
        ring1 += maskAt(uv + dir * uTexel * 3.0);
        ring2 += maskAt(uv + dir * uTexel * 8.0);
    }
    ring1 /= 4.0;
    ring2 /= 4.0;
    float outerGlow = clamp(ring2 - aG, 0.0, 1.0) * 0.9 + clamp(ring1 - aG, 0.0, 1.0) * 1.2;
    float innerEdge = aG * (1.0 - ring1) * 2.2;
    float edge = clamp(outerGlow + innerEdge, 0.0, 1.0);

    // Scan lines (fine) plus a slow bright sweep.
    float lines = 0.5 + 0.5 * sin(uv.y * uHeight * 0.9 - uTime * 6.0);
    float scan = mix(1.0, 0.45 + 0.55 * lines, 0.55 + 0.35 * uIntensity);
    float sweepPos = fract(uTime * 0.18);
    float sweep = exp(-pow((uv.y - sweepPos) * 14.0, 2.0)) * 0.35;

    // Subtle global flicker.
    float flick = 1.0 - uFlicker * (0.18 * hash(floor(uTime * 30.0)) + 0.08 * sin(uTime * 55.0));

    vec3 tint = uColor;
    vec3 bright = mix(tint, vec3(1.0), 0.45);

    float bodyBase = 0.25 + 0.95 * pow(lG, 0.8);
    vec3 body = vec3(
        tint.r * (0.25 + 0.95 * pow(lR, 0.8)),
        tint.g * bodyBase,
        tint.b * (0.25 + 0.95 * pow(lB, 0.8))
    ) * 1.25;
    body += tint * sweep * aG;

    float bodyAlpha = (0.55 + 0.4 * uIntensity) * scan * flick;
    vec3 color = body * vec3(aR, aG, aB) * bodyAlpha;
    color += bright * edge * (0.45 + 1.1 * uIntensity) * flick;

    // Light beam rising from the bottom (y = 0 is the bottom edge).
    float height01 = uv.y;
    float spread = 0.2 + 0.28 * (1.0 - height01);
    float beamX = exp(-pow((uv.x - 0.5) / spread, 2.0));
    float beam = beamX * pow(1.0 - height01, 1.4) * 0.55;
    float pad = exp(-pow((uv.y - 0.015) / 0.035, 2.0)) * exp(-pow((uv.x - 0.5) / 0.32, 2.0));
    float rays = 0.85 + 0.15 * sin(uv.x * 60.0 + uTime * 1.5);
    float beamPulse = 0.9 + 0.1 * sin(uTime * 2.2);
    float beamAmount = (beam * rays * beamPulse + pad * 1.4) * (0.35 + 0.9 * uIntensity) * flick;
    color += tint * beamAmount;

    float alpha = clamp(max(max(color.r, color.g), color.b), 0.0, 1.0);
    // Premultiplied output.
    gl_FragColor = vec4(min(color, vec3(alpha)), alpha);
}`;

export interface HologramRenderer {
    /** Renders the hologram layer from a person canvas (RGB + mask alpha). Returns null if WebGL is unavailable. */
    render: (person: HTMLCanvasElement, params: HologramParams) => HTMLCanvasElement | null;
    dispose: () => void;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Hologram shader failed to compile:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

export function createHologramRenderer(): HologramRenderer | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false });
    if (!gl) return null;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Hologram program failed to link:', gl.getProgramInfoLog(program));
        return null;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const uniforms = {
        person: gl.getUniformLocation(program, 'uPerson'),
        texel: gl.getUniformLocation(program, 'uTexel'),
        color: gl.getUniformLocation(program, 'uColor'),
        intensity: gl.getUniformLocation(program, 'uIntensity'),
        flicker: gl.getUniformLocation(program, 'uFlicker'),
        time: gl.getUniformLocation(program, 'uTime'),
        height: gl.getUniformLocation(program, 'uHeight'),
    };

    let lost = false;
    const onLost = (event: Event) => { event.preventDefault(); lost = true; };
    canvas.addEventListener('webglcontextlost', onLost);

    return {
        render(person, params) {
            if (lost || gl.isContextLost() || person.width === 0 || person.height === 0) return null;
            if (canvas.width !== person.width || canvas.height !== person.height) {
                canvas.width = person.width;
                canvas.height = person.height;
            }
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, person);

            const [r, g, b] = COLORS[params.color];
            gl.uniform1i(uniforms.person, 0);
            gl.uniform2f(uniforms.texel, 1 / canvas.width, 1 / canvas.height);
            gl.uniform3f(uniforms.color, r, g, b);
            gl.uniform1f(uniforms.intensity, Math.min(1, Math.max(0, params.intensity)));
            gl.uniform1f(uniforms.flicker, Math.min(1, Math.max(0, params.flicker)));
            gl.uniform1f(uniforms.time, params.timeSeconds);
            gl.uniform1f(uniforms.height, params.outputHeight ?? canvas.height);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            return canvas;
        },
        dispose() {
            canvas.removeEventListener('webglcontextlost', onLost);
            gl.deleteTexture(texture);
            gl.deleteBuffer(buffer);
            gl.deleteProgram(program);
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        },
    };
}
