// Reads a video's length from its MP4 header, so the server doesn't have to trust
// the length the browser reports. The movie header box ("mvhd") holds a timescale
// and a duration. It sits near the start of "faststart" files (what our ffmpeg
// export writes) or near the end of others, so callers pass both ends of the file.
//
// Fragmented MP4 (what Chrome's MediaRecorder writes) leaves mvhd at 0; the
// fragment total is then in "mehd". If neither is set, the length is unknown and
// callers fall back to the per-plan size cap.

const MAX_PLAUSIBLE_MS = 24 * 3600 * 1000;

function findBox(bytes: Uint8Array, type: string, from = 0) {
    const [a, b, c, d] = [...type].map((char) => char.charCodeAt(0));
    for (let i = Math.max(4, from); i + 4 <= bytes.length; i += 1) {
        if (bytes[i] === a && bytes[i + 1] === b && bytes[i + 2] === c && bytes[i + 3] === d) return i;
    }
    return -1;
}

const readUint32 = (view: DataView, offset: number) => view.getUint32(offset);
const readUint64 = (view: DataView, offset: number) => view.getUint32(offset) * 2 ** 32 + view.getUint32(offset + 4);

/** mvhd: version(1) flags(3) [created, modified] timescale duration. */
function parseMvhd(bytes: Uint8Array, typeOffset: number): { timescale: number; duration: number } | null {
    const start = typeOffset + 4;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = bytes[start];
    if (version === 0 && start + 20 <= bytes.length) {
        return { timescale: readUint32(view, start + 12), duration: readUint32(view, start + 16) };
    }
    if (version === 1 && start + 32 <= bytes.length) {
        return { timescale: readUint32(view, start + 20), duration: readUint64(view, start + 24) };
    }
    return null;
}

/** mehd (fragmented files): version(1) flags(3) fragment_duration, in the mvhd timescale. */
function parseMehd(bytes: Uint8Array, typeOffset: number): number | null {
    const start = typeOffset + 4;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = bytes[start];
    if (version === 0 && start + 8 <= bytes.length) return readUint32(view, start + 4);
    if (version === 1 && start + 12 <= bytes.length) return readUint64(view, start + 4);
    return null;
}

/** Duration in milliseconds from one chunk of an MP4, or null if this chunk doesn't say. */
export function mp4DurationMs(bytes: Uint8Array): number | null {
    let offset = findBox(bytes, 'mvhd');
    while (offset !== -1) {
        const header = parseMvhd(bytes, offset);
        if (header && header.timescale > 0) {
            let duration = header.duration;
            if (!duration) {
                const mehd = findBox(bytes, 'mehd', offset);
                const fragment = mehd === -1 ? null : parseMehd(bytes, mehd);
                if (fragment) duration = fragment;
            }
            const ms = Math.round((duration / header.timescale) * 1000);
            if (ms > 0 && ms < MAX_PLAUSIBLE_MS) return ms;
            if (duration === 0) return null; // header found, but this file doesn't record its length
        }
        offset = findBox(bytes, 'mvhd', offset + 4);
    }
    return null;
}
