// Draws the camera bubble onto the captured tab inside the recorder, so the
// camera works on every site. A camera frame placed inside the page is blocked
// by sites whose Permissions-Policy forbids cameras in embedded frames.
//
// The camera drives the frame rate: tab capture only sends frames when the page
// changes, but the camera sends ~30 a second, so the bubble keeps moving even on
// a still page. Uses insertable streams (MediaStreamTrackProcessor/Generator).

const RING = 7; // gradient ring width, in output pixels at 1080p

/** Normalized bubble layout: centre x/y as a fraction of the viewport, size as a fraction of its height. */
export const DEFAULT_LAYOUT = { x: 0.1, y: 0.8, size: 0.24 };

export function createCompositor(tabTrack, cameraTrack, initialLayout = DEFAULT_LAYOUT) {
    const canvas = new OffscreenCanvas(1280, 720);
    const ctx = canvas.getContext('2d', { alpha: false });
    const output = new MediaStreamTrackGenerator({ kind: 'video' });
    const writer = output.writable.getWriter();
    const tabReader = new MediaStreamTrackProcessor({ track: tabTrack }).readable.getReader();
    const cameraReader = new MediaStreamTrackProcessor({ track: cameraTrack }).readable.getReader();

    let layout = { ...initialLayout };
    let latestTab = null;
    let stopped = false;

    // Keep only the newest tab frame.
    (async () => {
        while (!stopped) {
            const { value, done } = await tabReader.read();
            if (done) break;
            latestTab?.close();
            latestTab = value;
        }
    })().catch(() => {});

    (async () => {
        while (!stopped) {
            const { value: camera, done } = await cameraReader.read();
            if (done) break;
            try {
                if (latestTab && (canvas.width !== latestTab.displayWidth || canvas.height !== latestTab.displayHeight)) {
                    canvas.width = latestTab.displayWidth;
                    canvas.height = latestTab.displayHeight;
                }
                ctx.fillStyle = '#0B0A10';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                if (latestTab) ctx.drawImage(latestTab, 0, 0, canvas.width, canvas.height);
                drawBubble(ctx, camera, canvas.width, canvas.height, layout);
                const frame = new VideoFrame(canvas, { timestamp: camera.timestamp });
                await writer.write(frame);
            } finally {
                camera.close();
            }
        }
    })().catch(() => {});

    return {
        track: output,
        setLayout(next) { layout = { ...layout, ...next }; },
        stop() {
            stopped = true;
            latestTab?.close();
            latestTab = null;
            void tabReader.cancel().catch(() => {});
            void cameraReader.cancel().catch(() => {});
            void writer.close().catch(() => {});
            output.stop();
        },
    };
}

function drawBubble(ctx, camera, width, height, layout) {
    const scale = height / 1080;
    const diameter = Math.max(60, layout.size * height);
    const radius = diameter / 2;
    const cx = Math.min(Math.max(radius, layout.x * width), width - radius);
    const cy = Math.min(Math.max(radius, layout.y * height), height - radius);
    const ring = RING * scale;

    // Soft shadow and gradient ring, matching the bubble on the page.
    ctx.save();
    ctx.shadowColor = 'rgba(20, 18, 31, 0.45)';
    ctx.shadowBlur = 30 * scale;
    ctx.shadowOffsetY = 12 * scale;
    const gradient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    gradient.addColorStop(0, '#6A4CFF');
    gradient.addColorStop(0.55, '#8B5CF6');
    gradient.addColorStop(1, '#FF3D81');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Camera, cropped to a square from the centre and mirrored like a selfie view.
    const inner = radius - ring;
    const side = Math.min(camera.displayWidth, camera.displayHeight);
    const sx = (camera.displayWidth - side) / 2;
    const sy = (camera.displayHeight - side) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.drawImage(camera, sx, sy, side, side, -inner, -inner, inner * 2, inner * 2);
    ctx.restore();
}
