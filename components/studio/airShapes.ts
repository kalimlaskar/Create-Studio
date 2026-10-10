interface Point { x: number; y: number }

const MIN_SIZE = 0.08;        // ignore shapes smaller than 8% of the frame
const ELLIPSE_STD = 0.085;    // lower = stricter circle detection
const RECT_EDGE = 0.045;      // lower = stricter box detection
const CORNER_REACH = 0.16;

// Resample a path to n evenly spaced points
function resample(pts: Point[], n: number): Point[] {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (total === 0) return pts;
    const step = total / (n - 1);
    const out: Point[] = [pts[0]];
    let acc = 0;
    let prev = pts[0];
    for (let i = 1; i < pts.length && out.length < n; i++) {
        const cur = pts[i];
        let d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
        while (acc + d >= step && out.length < n) {
            const t = (step - acc) / d;
            const p = { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t };
            out.push(p);
            prev = p;
            d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
            acc = 0;
        }
        acc += d;
        prev = cur;
    }
    while (out.length < n) out.push(pts[pts.length - 1]);
    return out;
}

/** Takes a stroke in 0-1 coordinates and returns a clean line, ellipse or rectangle, or null if it isn't one. */
export function recognizeShape(points: Point[], width: number, height: number): Point[] | null {
    if (points.length < 8) return null;
    const pts = resample(points.map((p) => ({ x: p.x * width, y: p.y * height })), 64);
    const toNorm = (arr: Point[]) => arr.map((p) => ({ x: p.x / width, y: p.y / height }));

    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const bw = maxX - minX;
    const bh = maxY - minY;
    const minDim = Math.min(width, height);
    if (Math.max(bw, bh) < minDim * MIN_SIZE) return null;

    let pathLen = 0;
    for (let i = 1; i < pts.length; i++) pathLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const first = pts[0];
    const last = pts[pts.length - 1];
    const chord = Math.hypot(last.x - first.x, last.y - first.y);

    // Straight line
    if (chord > pathLen * 0.9) {
        let maxDev = 0;
        for (const p of pts) {
            const dev = Math.abs((last.x - first.x) * (first.y - p.y) - (first.x - p.x) * (last.y - first.y)) / chord;
            maxDev = Math.max(maxDev, dev);
        }
        return maxDev < chord * 0.06 ? toNorm([first, last]) : null;
    }

    // Everything else must be a closed loop
    if (chord > pathLen * 0.2 || bw < minDim * 0.05 || bh < minDim * 0.05) return null;

    // Ellipse / circle
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const a = bw / 2;
    const b = bh / 2;
    const radii = pts.map((p) => Math.hypot((p.x - cx) / a, (p.y - cy) / b));
    const mean = radii.reduce((s, r) => s + r, 0) / radii.length;
    const std = Math.sqrt(radii.reduce((s, r) => s + (r - mean) ** 2, 0) / radii.length);
    if (std < ELLIPSE_STD && mean > 0.8 && mean < 1.15) {
        const ring: Point[] = [];
        for (let i = 0; i <= 72; i++) {
            const t = (i / 72) * Math.PI * 2;
            ring.push({ x: cx + a * Math.cos(t), y: cy + b * Math.sin(t) });
        }
        return toNorm(ring);
    }

    // Rectangle: hugs the bounding box and reaches all four corners
    const edge = pts.map((p) => Math.min(p.x - minX, maxX - p.x, p.y - minY, maxY - p.y));
    const meanEdge = edge.reduce((s, v) => s + v, 0) / edge.length / Math.min(bw, bh);
    const reach = Math.min(bw, bh) * CORNER_REACH;
    const corners: Point[] = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
    const hitsAllCorners = corners.every((c) => pts.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < reach));
    if (meanEdge < RECT_EDGE && hitsAllCorners) return toNorm([...corners, corners[0]]);

    return null;
}