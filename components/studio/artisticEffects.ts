export type CameraArtEffect = 'none' | 'comic' | 'sketch' | 'pixel' | 'anime' | 'avatar' | 'photo-avatar';

function makeScratchCanvas(width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function luminance(r: number, g: number, b: number) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function applyArtisticEffect(canvas: HTMLCanvasElement, effect: CameraArtEffect) {
    if (effect === 'none' || effect === 'avatar' || effect === 'photo-avatar' || canvas.width === 0 || canvas.height === 0) return;
    const maxDimension = effect === 'pixel' ? 56 : 360;
    const scale = Math.min(1, maxDimension / Math.max(canvas.width, canvas.height));
    const width = Math.max(1, Math.round(canvas.width * scale));
    const height = Math.max(1, Math.round(canvas.height * scale));
    const scratch = makeScratchCanvas(width, height);
    const context = scratch.getContext('2d', { willReadFrequently: true });
    const output = canvas.getContext('2d');
    if (!context || !output) return;

    context.imageSmoothingEnabled = effect !== 'pixel';
    context.drawImage(canvas, 0, 0, width, height);
    if (effect === 'pixel') {
        output.save();
        output.imageSmoothingEnabled = false;
        output.clearRect(0, 0, canvas.width, canvas.height);
        output.drawImage(scratch, 0, 0, canvas.width, canvas.height);
        output.restore();
        return;
    }

    const image = context.getImageData(0, 0, width, height);
    const { data } = image;
    const original = new Uint8ClampedArray(data);
    const edgeThreshold = effect === 'sketch' ? 30 : effect === 'anime' ? 46 : 38;
    const levels = effect === 'anime' ? 5 : 6;
    const quantize = (value: number) => Math.round(value / 255 * (levels - 1)) * (255 / (levels - 1));

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const right = (y * width + Math.min(width - 1, x + 1)) * 4;
            const below = (Math.min(height - 1, y + 1) * width + x) * 4;
            const currentLuma = luminance(original[index], original[index + 1], original[index + 2]);
            const rightLuma = luminance(original[right], original[right + 1], original[right + 2]);
            const belowLuma = luminance(original[below], original[below + 1], original[below + 2]);
            const edgeStrength = Math.abs(currentLuma - rightLuma) + Math.abs(currentLuma - belowLuma);

            if (effect === 'sketch') {
                const pencil = Math.max(0, Math.min(255, 255 - edgeStrength * 2.6 - (255 - currentLuma) * 0.12));
                data[index] = pencil;
                data[index + 1] = pencil;
                data[index + 2] = pencil;
            } else {
                const saturationBoost = effect === 'anime' ? 1.16 : 1.08;
                const average = (original[index] + original[index + 1] + original[index + 2]) / 3;
                const edge = edgeStrength > edgeThreshold;
                for (let channel = 0; channel < 3; channel++) {
                    const vivid = average + (original[index + channel] - average) * saturationBoost;
                    data[index + channel] = edge ? (effect === 'anime' ? 24 : 12) : quantize(vivid);
                }
            }
        }
    }
    context.putImageData(image, 0, 0);
    output.save();
    output.imageSmoothingEnabled = true;
    output.clearRect(0, 0, canvas.width, canvas.height);
    output.drawImage(scratch, 0, 0, canvas.width, canvas.height);
    output.restore();
}

export interface FaceLandmarkPoint {
    x: number;
    y: number;
}

function mapPoint(point: FaceLandmarkPoint | undefined, width: number, height: number) {
    if (!point) return { x: width / 2, y: height * 0.42 };
    return { x: (1 - point.x) * width, y: point.y * height };
}

export function drawTrackedAvatar(ctx: CanvasRenderingContext2D, width: number, height: number, landmarks?: FaceLandmarkPoint[]) {
    const point = (index: number) => mapPoint(landmarks?.[index], width, height);
    const leftEye = point(33);
    const rightEye = point(263);
    const leftCheek = point(234);
    const rightCheek = point(454);
    const nose = point(1);
    const upperLip = point(13);
    const lowerLip = point(14);
    const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
    const eyeCenterY = (leftEye.y + rightEye.y) / 2;
    const faceWidth = Math.max(width * 0.22, Math.min(width * 0.58, Math.abs(rightCheek.x - leftCheek.x) * 1.48));
    const faceHeight = faceWidth * 1.22;
    const centerY = eyeCenterY + faceHeight * 0.22;
    const eyeSpacing = Math.max(faceWidth * 0.19, Math.abs(rightEye.x - leftEye.x) * 1.48);
    const eyeY = centerY - faceHeight * 0.1;
    const eyeRadius = faceWidth * 0.07;
    const mouthOpen = Math.max(0, Math.min(faceHeight * 0.2, Math.abs(lowerLip.y - upperLip.y) * 2.5));
    const headTilt = Math.max(-0.18, Math.min(0.18, Math.atan2(rightEye.y - leftEye.y, Math.max(1, rightEye.x - leftEye.x))));

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#312e81');
    background.addColorStop(1, '#0f172a');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.translate(faceCenterX, centerY);
    ctx.rotate(headTilt);
    ctx.translate(-faceCenterX, -centerY);
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.ellipse(faceCenterX - faceWidth * 0.46, centerY + faceHeight * 0.04, faceWidth * 0.13, faceHeight * 0.17, 0, 0, Math.PI * 2);
    ctx.ellipse(faceCenterX + faceWidth * 0.46, centerY + faceHeight * 0.04, faceWidth * 0.13, faceHeight * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f4b183';
    ctx.beginPath();
    ctx.ellipse(faceCenterX, centerY, faceWidth * 0.5, faceHeight * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.ellipse(faceCenterX, centerY - faceHeight * 0.21, faceWidth * 0.53, faceHeight * 0.39, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(faceCenterX + faceWidth * 0.46, centerY - faceHeight * 0.16);
    ctx.quadraticCurveTo(faceCenterX, centerY - faceHeight * 0.45, faceCenterX - faceWidth * 0.48, centerY - faceHeight * 0.16);
    ctx.closePath();
    ctx.fill();

    const eyeX = [faceCenterX - eyeSpacing / 2, faceCenterX + eyeSpacing / 2];
    for (const x of eyeX) {
        ctx.fillStyle = '#fff7ed';
        ctx.beginPath();
        ctx.ellipse(x, eyeY, eyeRadius * 1.25, eyeRadius * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#312e81';
        ctx.beginPath();
        ctx.arc(x + (nose.x - faceCenterX) * 0.12, eyeY, eyeRadius * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(x + (nose.x - faceCenterX) * 0.12, eyeY, eyeRadius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4c1d95';
        ctx.lineWidth = Math.max(3, faceWidth * 0.025);
        ctx.beginPath();
        ctx.moveTo(x - eyeRadius, eyeY - eyeRadius * 1.75);
        ctx.quadraticCurveTo(x, eyeY - eyeRadius * 2.35, x + eyeRadius, eyeY - eyeRadius * 1.65);
        ctx.stroke();
    }

    ctx.strokeStyle = '#c2410c';
    ctx.lineWidth = Math.max(3, faceWidth * 0.018);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(faceCenterX, eyeY + eyeRadius * 0.6);
    ctx.quadraticCurveTo(faceCenterX + (nose.x - faceCenterX) * 0.16, centerY + faceHeight * 0.04, faceCenterX + (nose.x - faceCenterX) * 0.24, centerY + faceHeight * 0.06);
    ctx.stroke();

    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(faceCenterX, centerY + faceHeight * 0.27, faceWidth * 0.13, Math.max(faceHeight * 0.035, mouthOpen), 0, 0, Math.PI * 2);
    ctx.fill();
    if (mouthOpen > faceHeight * 0.06) {
        ctx.fillStyle = '#fff7ed';
        ctx.beginPath();
        ctx.ellipse(faceCenterX, centerY + faceHeight * 0.235, faceWidth * 0.1, faceHeight * 0.025, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = Math.max(4, faceWidth * 0.03);
        ctx.beginPath();
        ctx.moveTo(faceCenterX - faceWidth * 0.13, centerY + faceHeight * 0.27);
        ctx.quadraticCurveTo(faceCenterX, centerY + faceHeight * 0.34, faceCenterX + faceWidth * 0.13, centerY + faceHeight * 0.27);
        ctx.stroke();
    }

    ctx.restore();
}

export function drawPhotoAvatar(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    image: HTMLImageElement | null,
    mouthLevel: number,
    mouthXRatio: number,
    mouthYRatio: number,
    mouthWidthRatio: number
) {
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#312e81');
    background.addColorStop(1, '#0f172a');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
        const imageRatio = image.naturalWidth / image.naturalHeight;
        const canvasRatio = width / height;
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = image.naturalWidth;
        let sourceHeight = image.naturalHeight;
        if (imageRatio > canvasRatio) {
            sourceWidth = image.naturalHeight * canvasRatio;
            sourceX = (image.naturalWidth - sourceWidth) / 2;
        } else {
            sourceHeight = image.naturalWidth / canvasRatio;
            sourceY = (image.naturalHeight - sourceHeight) / 2;
        }
        ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);

        const mouthX = width * Math.max(0.15, Math.min(0.85, mouthXRatio));
        const mouthY = height * Math.max(0.35, Math.min(0.9, mouthYRatio));
        const mouthWidth = width * Math.max(0.035, Math.min(0.22, mouthWidthRatio));
        const level = Math.max(0, Math.min(1, mouthLevel));
        const mouthHeight = Math.max(height * 0.006, height * (0.012 + level * 0.075));
        ctx.fillStyle = 'rgba(55, 16, 24, 0.94)';
        ctx.strokeStyle = 'rgba(38, 12, 20, 0.9)';
        ctx.lineWidth = Math.max(2, width * 0.003);
        ctx.beginPath();
        ctx.ellipse(mouthX, mouthY, mouthWidth, mouthHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (level > 0.28) {
            ctx.fillStyle = 'rgba(255, 248, 240, 0.95)';
            ctx.beginPath();
            ctx.ellipse(mouthX, mouthY - mouthHeight * 0.28, mouthWidth * 0.72, Math.max(1, mouthHeight * 0.18), 0, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center';
        ctx.font = `600 ${Math.max(18, width * 0.035)}px sans-serif`;
        ctx.fillText('Choose a cartoon portrait', width / 2, height * 0.52, width * 0.8);
    }
    ctx.restore();
}
