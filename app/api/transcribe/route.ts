import { consumeAiSeconds, getRequestUserId, limitReachedResponse, refundAiSeconds } from '@/lib/plans/server';

// Gemini inline audio shares a ~20 MB request limit, and base64 adds ~33%
const MAX_AUDIO_BYTES = 14 * 1024 * 1024;
const LANGUAGE_CODES = new Set(['auto', 'en', 'hi', 'hinglish']);
const GEMINI_MODEL = 'gemini-3.8-flash';
export const maxDuration = 120;

interface GeminiWord { word?: string; start?: number; end?: number }
interface GeminiResponse {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
}

const LANGUAGE_HINTS: Record<string, string> = {
    auto: 'Detect the spoken language automatically.',
    en: 'The speech is English.',
    hi: 'The speech is Hindi. Write it in Devanagari script.',
    hinglish: 'The speech mixes Hindi and English (Hinglish). Keep spoken English words as they are and write Hindi words in Roman script.',
};

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(request: Request) {
    const userId = await getRequestUserId();
    if (!userId) return fail('Sign in to generate captions.', 401);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return fail('Automatic captions need a GEMINI_API_KEY configured on the server.', 503);

    let body: FormData;
    try {
        body = await request.formData();
    } catch {
        return fail('Upload a supported audio recording to generate captions.', 400);
    }

    const file = body.get('file');
    const language = String(body.get('language') ?? 'auto');
    if (!(file instanceof File) || file.size === 0) return fail('The audio recording is empty.', 400);
    if (file.size > MAX_AUDIO_BYTES) return fail('Audio is too large for transcription. Trim the video and try again.', 413);
    if (!LANGUAGE_CODES.has(language)) return fail('Choose Auto, English, Hindi, or Hinglish.', 400);

    // The client reports the length, but a file can't be shorter than its size allows.
    const reported = Number(body.get('durationSeconds'));
    const seconds = Math.max(Number.isFinite(reported) ? reported : 0, Math.ceil(file.size / 32000));

    const usage = await consumeAiSeconds(userId, 'transcription', seconds).catch(() => null);
    if (!usage) return fail('Could not check your usage. Please try again.', 503);
    if (!usage.ok) return limitReachedResponse(usage, 'transcription');
    const refund = () => refundAiSeconds(userId, 'transcription', usage.charged);

    const mimeType = (file.type || 'audio/webm').split(';')[0];
    const audioBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');

    const prompt = [
        'Transcribe this audio word by word with precise timestamps.',
        LANGUAGE_HINTS[language],
        'Return every spoken word in order. "start" and "end" are seconds from the beginning of the audio, as decimal numbers (for example 1.24).',
        'Each word must have end greater than start, and words must not overlap. Do not skip words, do not add words, and ignore silence and music.',
    ].join(' ');

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: audioBase64 } },
                        ],
                    }],
                    generationConfig: {
                        temperature: 0,
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: 'OBJECT',
                            properties: {
                                text: { type: 'STRING' },
                                words: {
                                    type: 'ARRAY',
                                    items: {
                                        type: 'OBJECT',
                                        properties: {
                                            word: { type: 'STRING' },
                                            start: { type: 'NUMBER' },
                                            end: { type: 'NUMBER' },
                                        },
                                        required: ['word', 'start', 'end'],
                                    },
                                },
                            },
                            required: ['words'],
                        },
                    },
                }),
                cache: 'no-store',
            },
        );

        const result = await response.json().catch(() => null) as GeminiResponse | null;
        if (!response.ok) {
            await refund();
            return fail(result?.error?.message ?? `Transcription service returned ${response.status}.`, response.status === 413 ? 413 : 502);
        }

        const raw = result?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
        let parsed: { text?: string; words?: GeminiWord[] };
        try {
            parsed = JSON.parse(raw);
        } catch {
            await refund();
            return fail('The transcription came back in an unreadable format. Try again.', 502);
        }

        // Clean up: valid numbers, in order, no overlaps
        let cursor = 0;
        const words = (parsed.words ?? [])
            .filter((w) => typeof w.word === 'string' && Number.isFinite(w.start) && Number.isFinite(w.end))
            .map((w) => ({ word: w.word!.trim(), start: w.start!, end: w.end! }))
            .filter((w) => w.word && w.end > w.start)
            .sort((a, b) => a.start - b.start)
            .map((w) => {
                const start = Math.max(w.start, cursor);
                const end = Math.max(w.end, start + 0.05);
                cursor = end;
                return { word: w.word, start, end };
            });

        return Response.json({ words, text: parsed.text ?? words.map((w) => w.word).join(' ') });
    } catch {
        await refund();
        return fail('Could not reach the transcription service. Check the server connection and try again.', 502);
    }
}