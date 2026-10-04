import { CaptionCue, CaptionStyle } from '@/types/editor';

export function drawActiveCaption(
    ctx: CanvasRenderingContext2D,
    cues: CaptionCue[],
    currentMs: number,
    style: CaptionStyle,
    canvasWidth: number,
    canvasHeight: number
) {
    const active = cues.find((cue) => currentMs >= cue.startMs && currentMs <= cue.endMs);
    if (!active) return;

    const group = active.groupId
        ? cues.filter((cue) => cue.groupId === active.groupId && cue.text.trim()).sort((a, b) => a.startMs - b.startMs)
        : [active];
    const fontSize = Math.max(26, Math.round(canvasWidth * (style === 'bold' ? 0.052 : 0.045)));
    const baselineY = Math.round(canvasHeight * 0.84);
    const words = group.map((cue) => cue.text.trim());
    if (words.length === 0) return;

    ctx.save();
    ctx.font = `${style === 'minimal' ? 600 : 800} ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const gap = fontSize * 0.32;
    const widths = group.map((cue) => ctx.measureText(cue.text.trim()).width);
    const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, words.length - 1);
    const maxWidth = canvasWidth * 0.88;
    const scale = totalWidth > maxWidth ? maxWidth / totalWidth : 1;
    const xStart = (canvasWidth - totalWidth * scale) / 2;
    const textHeight = fontSize * 1.45;

    if (style === 'classic') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        const boxWidth = Math.min(totalWidth * scale + fontSize * 0.7, maxWidth + fontSize * 0.7);
        ctx.fillRect((canvasWidth - boxWidth) / 2, baselineY - textHeight / 2, boxWidth, textHeight);
    }

    let x = xStart;
    group.forEach((cue, index) => {
        const isActiveWord = cue.id === active.id;
        if (style === 'bold') {
            ctx.lineWidth = Math.max(3, fontSize * 0.12);
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.strokeText(cue.text.trim(), x, baselineY, widths[index] * scale);
            ctx.fillStyle = isActiveWord ? '#fde047' : '#ffffff';
        } else if (style === 'minimal') {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = fontSize * 0.25;
            ctx.fillStyle = isActiveWord ? '#ffffff' : 'rgba(255, 255, 255, 0.82)';
        } else {
            ctx.fillStyle = '#ffffff';
        }
        ctx.save();
        ctx.translate(x, baselineY);
        ctx.scale(scale, scale);
        ctx.fillText(cue.text.trim(), 0, 0);
        ctx.restore();
        x += (widths[index] + gap) * scale;
    });
    ctx.restore();
}
