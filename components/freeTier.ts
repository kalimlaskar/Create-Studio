export const FREE_VIDEO_LIMIT_MS = 60_000;

export function drawFreeTierWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const fontSize = Math.max(14, Math.round(width * 0.018));
    const padding = Math.max(10, Math.round(width * 0.012));
    const label = 'CREATOR STUDIO · FREE';
    ctx.save();
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const labelWidth = ctx.measureText(label).width;
    const x = width - labelWidth - padding * 3;
    const y = height - fontSize - padding * 3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(x, y, labelWidth + padding * 2, fontSize + padding * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillText(label, x + padding, y + padding + fontSize / 2);
    ctx.restore();
}
