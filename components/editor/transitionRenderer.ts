import type { TransitionType } from '@/types/editor';

const QUAD_VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT_HEADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float uProgress;
uniform float uTime;
uniform float uAspect;
float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
`;

// Dark base that holds the outgoing frame, then hands over to the incoming frame, so the particles have a backdrop.
const BACKDROP_FRAGMENT = `${FRAGMENT_HEADER}
void main() {
    vec3 a = texture2D(uFrom, vUv).rgb;
    vec3 b = texture2D(uTo, vUv).rgb;
    float fa = 1.0 - smoothstep(0.1, 0.32, uProgress);
    float fb = smoothstep(0.68, 0.9, uProgress);
    vec3 base = vec3(0.012, 0.02, 0.05);
    gl_FragColor = vec4(base + a * fa + b * fb, 1.0);
}`;

const PORTAL_FRAGMENT = `${FRAGMENT_HEADER}
void main() {
    float p = uProgress;
    vec2 uv = vUv;
    vec2 d = (uv - 0.5) * vec2(uAspect, 1.0);
    float dist = length(d);
    float ang = atan(d.y, d.x);
    float maxR = length(vec2(uAspect, 1.0) * 0.5) * 1.18;
    float e = 1.0 - pow(1.0 - p, 2.2);
    float wobble = (sin(ang * 7.0 + uTime * 4.0) * 0.012 + sin(ang * 13.0 - uTime * 6.0) * 0.006) * (1.0 - p);
    float ringR = e * maxR + wobble;
    float delta = dist - ringR;

    float fade = smoothstep(0.0, 0.04, p) * (1.0 - smoothstep(0.94, 1.0, p));
    float lens = exp(-pow(delta / 0.09, 2.0)) * fade;
    vec2 dir = normalize(d + 1e-5);
    vec2 uvFrom = uv - (dir / vec2(uAspect, 1.0)) * lens * 0.035;
    float zoom = mix(0.8, 1.0, e);
    vec2 uvTo = 0.5 + (uv - 0.5) * zoom;

    vec3 a = texture2D(uFrom, uvFrom).rgb;
    vec3 b = texture2D(uTo, uvTo).rgb;
    float inside = 1.0 - smoothstep(-0.006, 0.006, delta);
    vec3 col = mix(a, b, inside);
    col *= 1.0 - 0.4 * lens * (1.0 - inside);

    float core = exp(-pow(delta / 0.010, 2.0));
    float glow = exp(-pow(delta / 0.055, 2.0));
    float halo = exp(-pow(delta / 0.16, 2.0));
    float spark = 0.75 + 0.25 * sin(ang * 24.0 + uTime * 9.0) * sin(ang * 5.0 - uTime * 3.0);
    vec3 cyan = vec3(0.15, 0.85, 1.0);
    vec3 purple = vec3(0.65, 0.3, 1.0);
    col += (vec3(1.0) * core * 1.3 * spark + cyan * glow * 0.95 + purple * halo * 0.4) * fade;
    gl_FragColor = vec4(col, 1.0);
}`;

const WARP_FRAGMENT = `${FRAGMENT_HEADER}
void main() {
    float p = uProgress;
    vec2 d = vUv - 0.5;
    float s = sin(p * 3.14159265);
    float s2 = s * s;
    float strength = s2 * 0.9;

    vec3 acc = vec3(0.0);
    for (int i = 0; i < 18; i++) {
        float t = float(i) / 17.0;
        vec2 suv = 0.5 + d * (1.0 - strength * t * 0.8);
        acc += p < 0.5 ? texture2D(uFrom, suv).rgb : texture2D(uTo, suv).rgb;
    }
    acc /= 18.0;

    vec2 dd = d * vec2(uAspect, 1.0);
    float r = length(dd);
    float ang = atan(dd.y, dd.x);
    float lane = (ang / 6.2831853 + 0.5) * 160.0;
    float h = hash1(floor(lane));
    float thin = 1.0 - smoothstep(0.0, 0.3, abs(fract(lane) - 0.5));
    float dash = pow(max(0.0, sin(r * (14.0 + h * 40.0) * 3.0 - uTime * (8.0 + 30.0 * s) * (0.4 + h))), 6.0);
    float streak = step(0.55, h) * thin * dash * smoothstep(0.04, 0.45, r);

    vec3 col = acc * (1.0 - 0.4 * s);
    col += vec3(0.7, 0.85, 1.0) * streak * s * 2.2;
    col += vec3(0.6, 0.8, 1.0) * exp(-r * r * 14.0) * s2 * 0.9;
    col += vec3(1.0) * exp(-pow((p - 0.5) * 8.0, 2.0)) * 0.85;
    gl_FragColor = vec4(col, 1.0);
}`;

// One point per grid cell. Cells sample colours from both frames, fly out and reform.
const PARTICLE_VERTEX = `
attribute vec2 aCell;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float uProgress;
uniform float uPointSize;
varying vec3 vColor;
varying float vAlpha;
varying float vAway;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
    vec2 uv = aCell;
    float r1 = hash(uv);
    float r2 = hash(uv + 17.13);
    float r3 = hash(uv + 41.7);
    float p = uProgress;
    bool disperse = p < 0.5;
    float t = disperse ? p * 2.0 : (p - 0.5) * 2.0;
    float stagger = disperse ? (uv.x * 0.35 + r1 * 0.3) : ((1.0 - uv.x) * 0.35 + r1 * 0.3);
    float lt = clamp((t - stagger * 0.5) / 0.675, 0.0, 1.0);
    float e = lt * lt * (3.0 - 2.0 * lt);
    float away = disperse ? e : 1.0 - e;

    vec2 c = uv - 0.5;
    vec2 dir = normalize(c + (vec2(r1, r2) - 0.5) * 1.2 + 0.0001);
    vec2 far = c + dir * (0.18 + 0.75 * r3);
    vec2 perp = vec2(-dir.y, dir.x);
    vec2 pos = c + (far - c) * away + perp * sin(away * 3.14159265) * (r2 - 0.5) * 0.5;

    vec3 colFrom = texture2D(uFrom, uv).rgb;
    vec3 colTo = texture2D(uTo, uv).rgb;
    vColor = mix(colFrom, colTo, smoothstep(0.45, 0.55, p)) + vec3(0.1, 0.7, 1.0) * away * 0.5;
    vAlpha = smoothstep(0.0, 0.12, away);
    vAway = away;
    gl_PointSize = uPointSize * (1.0 - 0.3 * away);
    gl_Position = vec4(pos * 2.0, 0.0, 1.0);
}`;

const PARTICLE_FRAGMENT = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
varying float vAway;
void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float shape = mix(1.0, 1.0 - smoothstep(0.55, 1.0, d), clamp(vAway * 2.0, 0.0, 1.0));
    float a = vAlpha * shape;
    gl_FragColor = vec4(vColor * a, a);
}`;

export interface TransitionRenderOptions {
    type: TransitionType;
    from: HTMLCanvasElement;
    fromKey: string;
    to: HTMLCanvasElement;
    progress: number;
    timeSeconds: number;
    performanceMode: boolean;
}

export interface TransitionRenderer {
    /** Draws the transition frame. Returns the WebGL canvas, or null if WebGL is unavailable. */
    render: (options: TransitionRenderOptions) => HTMLCanvasElement | null;
    dispose: () => void;
}

const PARTICLE_COLUMNS = 90;
const PARTICLE_COLUMNS_PERFORMANCE = 40;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Transition shader failed to compile:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function link(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string, attribute: string) {
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, attribute);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Transition program failed to link:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

export function createTransitionRenderer(): TransitionRenderer | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl) return null;

    const backdrop = link(gl, QUAD_VERTEX, BACKDROP_FRAGMENT, 'aPosition');
    const portal = link(gl, QUAD_VERTEX, PORTAL_FRAGMENT, 'aPosition');
    const warp = link(gl, QUAD_VERTEX, WARP_FRAGMENT, 'aPosition');
    const canSampleInVertex = (gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) as number) > 0;
    const particles = canSampleInVertex ? link(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT, 'aCell') : null;
    if (!backdrop || !portal || !warp) return null;

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const cellBuffer = gl.createBuffer();
    let cellColumns = 0;
    let cellRows = 0;
    let cellCount = 0;
    const maxPointSize = (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1] || 64;

    const makeTexture = () => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return texture;
    };
    const fromTexture = makeTexture();
    const toTexture = makeTexture();
    let uploadedFromKey = '';

    let lost = false;
    const onLost = (event: Event) => { event.preventDefault(); lost = true; };
    canvas.addEventListener('webglcontextlost', onLost);

    const setUniforms = (program: WebGLProgram, options: TransitionRenderOptions) => {
        gl.useProgram(program);
        gl.uniform1i(gl.getUniformLocation(program, 'uFrom'), 0);
        gl.uniform1i(gl.getUniformLocation(program, 'uTo'), 1);
        gl.uniform1f(gl.getUniformLocation(program, 'uProgress'), Math.min(1, Math.max(0, options.progress)));
        gl.uniform1f(gl.getUniformLocation(program, 'uTime'), options.timeSeconds);
        gl.uniform1f(gl.getUniformLocation(program, 'uAspect'), canvas.width / canvas.height);
    };

    const bindQuad = () => {
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    };

    const rebuildCells = (columns: number) => {
        const rows = Math.max(1, Math.round(columns * canvas.height / canvas.width));
        if (columns === cellColumns && rows === cellRows) return;
        cellColumns = columns;
        cellRows = rows;
        cellCount = columns * rows;
        const data = new Float32Array(cellCount * 2);
        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                const index = (row * columns + column) * 2;
                data[index] = (column + 0.5) / columns;
                data[index + 1] = (row + 0.5) / rows;
            }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, cellBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    };

    return {
        render(options) {
            const { to } = options;
            if (lost || gl.isContextLost() || to.width === 0 || to.height === 0) return null;

            // Performance mode renders at half size; the caller scales the result up.
            const scale = options.performanceMode ? 0.5 : 1;
            const width = Math.max(2, Math.round(to.width * scale));
            const height = Math.max(2, Math.round(to.height * scale));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
            gl.viewport(0, 0, width, height);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, fromTexture);
            if (uploadedFromKey !== options.fromKey) {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, options.from);
                uploadedFromKey = options.fromKey;
            }
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, toTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, to);

            gl.disable(gl.BLEND);
            const type = options.type === 'particles' && !particles ? 'portal' : options.type;
            if (type === 'particles' && particles) {
                setUniforms(backdrop, options);
                bindQuad();
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

                rebuildCells(options.performanceMode ? PARTICLE_COLUMNS_PERFORMANCE : PARTICLE_COLUMNS);
                setUniforms(particles, options);
                gl.uniform1f(gl.getUniformLocation(particles, 'uPointSize'), Math.min(maxPointSize, (width / cellColumns) * 1.15));
                gl.bindBuffer(gl.ARRAY_BUFFER, cellBuffer);
                gl.enableVertexAttribArray(0);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                gl.drawArrays(gl.POINTS, 0, cellCount);
                gl.disable(gl.BLEND);
            } else {
                setUniforms(type === 'warp' ? warp : portal, options);
                bindQuad();
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
            return canvas;
        },
        dispose() {
            canvas.removeEventListener('webglcontextlost', onLost);
            gl.deleteTexture(fromTexture);
            gl.deleteTexture(toTexture);
            gl.deleteBuffer(quadBuffer);
            gl.deleteBuffer(cellBuffer);
            [backdrop, portal, warp, particles].forEach((program) => program && gl.deleteProgram(program));
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        },
    };
}
