import type { DepthMotion } from './depthEstimator';

const GRID = 96;
const MAX_PHOTO_TEXTURE = 2048;
const MAX_CACHED = 4;
const FOV_TAN = Math.tan((38 * Math.PI) / 360);
const DISPLACEMENT = 0.6;

const VERTEX = `
attribute vec2 aUv;
uniform sampler2D uDepth;
uniform mat4 uMvp;
uniform vec2 uHalf;
uniform float uDisp;
varying vec2 vUv;
void main() {
  float d = texture2D(uDepth, aUv).r;
  vec3 p = vec3((aUv.x - 0.5) * 2.0 * uHalf.x, (aUv.y - 0.5) * 2.0 * uHalf.y, (d - 0.5) * uDisp);
  gl_Position = uMvp * vec4(p, 1.0);
  vUv = aUv;
}`;

const FRAGMENT = `
precision mediump float;
uniform sampler2D uPhoto;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(uPhoto, vUv).rgb, 1.0);
}`;

interface CachedTextures {
    photo: WebGLTexture;
    depth: WebGLTexture;
    aspect: number;
}

export interface DepthRenderArgs {
    key: string;
    photo: HTMLImageElement | HTMLCanvasElement;
    depth: HTMLCanvasElement;
    width: number;
    height: number;
    motion: DepthMotion;
    progress: number;
}

export interface DepthRenderer {
    canvas: HTMLCanvasElement;
    render: (args: DepthRenderArgs) => HTMLCanvasElement;
    isLost: () => boolean;
}

type Mat4 = Float32Array;

const perspective = (fovTan: number, aspect: number, near: number, far: number): Mat4 => {
    const m = new Float32Array(16);
    m[0] = 1 / (fovTan * aspect);
    m[5] = 1 / fovTan;
    m[10] = (far + near) / (near - far);
    m[11] = -1;
    m[14] = (2 * far * near) / (near - far);
    return m;
};

const normalize = (v: number[]) => {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
};
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const lookAtOrigin = (eye: number[]): Mat4 => {
    const z = normalize(eye);
    const x = normalize(cross([0, 1, 0], z));
    const y = cross(z, x);
    const m = new Float32Array(16);
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2]; m[12] = -dot(x, eye);
    m[1] = y[0]; m[5] = y[1]; m[9] = y[2]; m[13] = -dot(y, eye);
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2]; m[14] = -dot(z, eye);
    m[15] = 1;
    return m;
};

const multiply = (a: Mat4, b: Mat4): Mat4 => {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col += 1) {
        for (let row = 0; row < 4; row += 1) {
            let sum = 0;
            for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[col * 4 + k];
            out[col * 4 + row] = sum;
        }
    }
    return out;
};

const getEye = (motion: DepthMotion, t: number, baseDistance: number) => {
    if (motion === 'depth-dolly') return [0.03 * baseDistance * Math.sin(t * Math.PI), 0, baseDistance * (1.05 - 0.17 * t)];
    if (motion === 'depth-orbit') {
        const angle = (t - 0.5) * 0.32;
        const distance = baseDistance * (1.02 - 0.05 * t);
        return [Math.sin(angle) * distance, 0.04 * baseDistance * Math.sin(t * Math.PI), Math.cos(angle) * distance];
    }
    const angle = 0.15 * Math.sin(t * Math.PI * 2);
    return [Math.sin(angle) * baseDistance, 0.05 * baseDistance * Math.sin(t * Math.PI * 4), Math.cos(angle) * baseDistance * 0.98];
};

let shared: DepthRenderer | null = null;

export const getDepthRenderer = (): DepthRenderer | null => {
    if (typeof document === 'undefined') return null;
    if (shared && !shared.isLost()) return shared;
    shared = createDepthRenderer();
    return shared;
};

const createDepthRenderer = (): DepthRenderer | null => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: false });
    if (!gl || gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 1) return null;
    let lost = false;
    canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); lost = true; });

    const compile = (type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

    const uvs = new Float32Array((GRID + 1) * (GRID + 1) * 2);
    for (let y = 0; y <= GRID; y += 1) {
        for (let x = 0; x <= GRID; x += 1) {
            const offset = (y * (GRID + 1) + x) * 2;
            uvs[offset] = x / GRID;
            uvs[offset + 1] = y / GRID;
        }
    }
    const indices = new Uint16Array(GRID * GRID * 6);
    let cursor = 0;
    for (let y = 0; y < GRID; y += 1) {
        for (let x = 0; x < GRID; x += 1) {
            const a = y * (GRID + 1) + x;
            const b = a + 1;
            const c = a + GRID + 1;
            const d = c + 1;
            indices.set([a, c, b, b, c, d], cursor);
            cursor += 6;
        }
    }
    const uvBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const uvLocation = gl.getAttribLocation(program, 'aUv');
    const uniforms = {
        depth: gl.getUniformLocation(program, 'uDepth'),
        photo: gl.getUniformLocation(program, 'uPhoto'),
        mvp: gl.getUniformLocation(program, 'uMvp'),
        half: gl.getUniformLocation(program, 'uHalf'),
        disp: gl.getUniformLocation(program, 'uDisp'),
    };

    const cache = new Map<string, CachedTextures>();

    const uploadTexture = (source: TexImageSource) => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return texture;
    };

    const getTextures = (args: DepthRenderArgs): CachedTextures => {
        const existing = cache.get(args.key);
        if (existing) {
            cache.delete(args.key);
            cache.set(args.key, existing);
            return existing;
        }
        const naturalWidth = args.photo instanceof HTMLImageElement ? args.photo.naturalWidth : args.photo.width;
        const naturalHeight = args.photo instanceof HTMLImageElement ? args.photo.naturalHeight : args.photo.height;
        const scale = Math.min(1, MAX_PHOTO_TEXTURE / Math.max(naturalWidth, naturalHeight));
        const scaled = document.createElement('canvas');
        scaled.width = Math.max(1, Math.round(naturalWidth * scale));
        scaled.height = Math.max(1, Math.round(naturalHeight * scale));
        scaled.getContext('2d')?.drawImage(args.photo, 0, 0, scaled.width, scaled.height);
        const textures: CachedTextures = { photo: uploadTexture(scaled)!, depth: uploadTexture(args.depth)!, aspect: naturalWidth / naturalHeight };
        cache.set(args.key, textures);
        while (cache.size > MAX_CACHED) {
            const oldestKey = cache.keys().next().value as string;
            const oldest = cache.get(oldestKey)!;
            gl.deleteTexture(oldest.photo);
            gl.deleteTexture(oldest.depth);
            cache.delete(oldestKey);
        }
        return textures;
    };

    const render = (args: DepthRenderArgs) => {
        if (canvas.width !== args.width || canvas.height !== args.height) {
            canvas.width = args.width;
            canvas.height = args.height;
        }
        const textures = getTextures(args);
        const canvasAspect = args.width / args.height;
        const halfHeight = 1;
        const halfWidth = textures.aspect;
        // Base distance where the oversized plane still covers the frame during camera moves.
        const baseDistance = Math.min(halfHeight / FOV_TAN, halfWidth / (canvasAspect * FOV_TAN)) / 1.2;
        const t = Math.max(0, Math.min(1, args.progress));
        const view = lookAtOrigin(getEye(args.motion, t, baseDistance));
        const mvp = multiply(perspective(FOV_TAN, canvasAspect, 0.1, 50), view);

        gl.viewport(0, 0, args.width, args.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.enableVertexAttribArray(uvLocation);
        gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures.photo);
        gl.uniform1i(uniforms.photo, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textures.depth);
        gl.uniform1i(uniforms.depth, 1);
        gl.uniformMatrix4fv(uniforms.mvp, false, mvp);
        gl.uniform2f(uniforms.half, halfWidth, halfHeight);
        gl.uniform1f(uniforms.disp, DISPLACEMENT);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
        return canvas;
    };

    return { canvas, render, isLost: () => lost || gl.isContextLost() };
};
