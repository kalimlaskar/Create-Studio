import { consumeAiSeconds, getRequestUserId, limitReachedResponse, refundAiSeconds } from '@/lib/plans/server';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TRANSLATE_MODEL = 'gemini-3.8-flash';
const TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const DEFAULT_SAMPLE_RATE = 24000;
const VOICES = { female: 'Kore', male: 'Puck' } as const;
// Spoken text is roughly 15 characters per second, used to count voiceover minutes.
const CHARS_PER_SECOND = 15;

const LANGUAGE_LABELS: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
};

type VoiceGender = keyof typeof VOICES;

interface DubBody {
    text?: unknown;
    sourceLanguage?: unknown;
    targetLanguage?: unknown;
    voiceGender?: unknown;
}

interface GeminiErrorBody { error?: { message?: string } }
interface TranslateResponse { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
interface AudioPart { type?: string; data?: string; mime_type?: string }
interface InteractionResponse {
    output_audio?: AudioPart;
    steps?: Array<{ content?: AudioPart[] }>;
}

/** A failure we can turn straight into a JSON error response. */
class RouteError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

const fail = (error: string, status: number) => Response.json({ error }, { status });

async function readGeminiError(response: Response, fallback: string) {
    const body = await response.json().catch(() => null) as GeminiErrorBody | null;
    return new RouteError(body?.error?.message ?? fallback, response.status === 429 ? 429 : 502);
}

async function geminiFetch(path: string, apiKey: string, payload: unknown) {
    return fetch(`${GEMINI_BASE}/${path}`, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
    });
}

/** Gemini speech models usually return raw 16-bit PCM. Browsers can only play it with a WAV header on top. */
function pcmToWav(pcm: Buffer, sampleRate = DEFAULT_SAMPLE_RATE, channels = 1, bitsPerSample = 16) {
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
}

function toPlayableWav(audioBase64: string, mimeType?: string) {
    const raw = Buffer.from(audioBase64, 'base64');
    if (raw.subarray(0, 4).toString('ascii') === 'RIFF') return raw; // already a WAV file
    const rate = Number(mimeType?.match(/rate=(\d+)/)?.[1]) || DEFAULT_SAMPLE_RATE;
    return pcmToWav(raw, rate);
}

async function translateScript(text: string, from: string, to: string, apiKey: string) {
    let response: Response;
    try {
        response = await geminiFetch(`models/${TRANSLATE_MODEL}:generateContent`, apiKey, {
            contents: [{
                parts: [{
                    text: `Translate this ${LANGUAGE_LABELS[from]} script into ${LANGUAGE_LABELS[to]} for spoken video. Preserve the meaning, make it sound natural and concise, and return only the translated script.\n\n${text}`,
                }],
            }],
            generationConfig: { temperature: 0.35 },
        });
    } catch {
        throw new RouteError('Translation service could not be reached. Please try again in a moment.', 502);
    }

    if (!response.ok) throw await readGeminiError(response, 'Translation service failed while preparing the dubbed version.');

    const result = await response.json() as TranslateResponse;
    const translated = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!translated) throw new RouteError('Translation service returned an empty translation. Please try again.', 502);
    return translated;
}

async function synthesizeSpeech(text: string, gender: VoiceGender, apiKey: string) {
    let response: Response;
    try {
        response = await geminiFetch('interactions', apiKey, {
            model: TTS_MODEL,
            input: [{
                type: 'user_input',
                content: [{
                    type: 'text',
                    text,
                    annotations: [{ type: 'speech_metadata', style: 'Warm, natural, conversational delivery for a short social video.' }],
                }],
            }],
            response_format: { type: 'audio' },
            generation_config: { speech_config: [{ voice: VOICES[gender] }] },
            store: false,
        });
    } catch {
        throw new RouteError('The voice service could not be reached. Please try again in a moment.', 502);
    }

    if (!response.ok) throw await readGeminiError(response, 'Text-to-speech generation failed during dubbing.');

    const result = await response.json() as InteractionResponse;
    const audio = result.output_audio?.data
        ? result.output_audio
        : result.steps?.flatMap((step) => step.content ?? []).find((part) => part.type === 'audio' && part.data);
    if (!audio?.data) throw new RouteError('Gemini did not return an audio track. Please try again.', 502);

    return toPlayableWav(audio.data, audio.mime_type);
}

export async function POST(request: Request) {
    const userId = await getRequestUserId();
    if (!userId) return fail('Sign in to use dubbing.', 401);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return fail('Dubbing requires a GEMINI_API_KEY to be configured on the server.', 503);

    let body: DubBody;
    try {
        body = await request.json();
    } catch {
        return fail('Send script text and the language settings to generate a dubbed voiceover.', 400);
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const sourceLanguage = typeof body.sourceLanguage === 'string' ? body.sourceLanguage : 'en';
    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'hi';
    const voiceGender = typeof body.voiceGender === 'string' ? body.voiceGender : 'female';

    if (!text) return fail('Add a script or transcript before generating a dubbed track.', 400);
    if (!(sourceLanguage in LANGUAGE_LABELS) || !(targetLanguage in LANGUAGE_LABELS)) {
        return fail('Unsupported language selection. Choose English, Hindi, Bengali, Tamil, or Telugu.', 400);
    }
    if (voiceGender !== 'female' && voiceGender !== 'male') return fail('Choose a female or male voice.', 400);

    const usage = await consumeAiSeconds(userId, 'voiceover', Math.max(3, Math.ceil(text.length / CHARS_PER_SECOND))).catch(() => null);
    if (!usage) return fail('Could not check your usage. Please try again.', 503);
    if (!usage.ok) return limitReachedResponse(usage, 'voiceover');

    try {
        const spokenText = sourceLanguage === targetLanguage
            ? text
            : await translateScript(text, sourceLanguage, targetLanguage, apiKey);
        const wav = await synthesizeSpeech(spokenText, voiceGender, apiKey);

        return new Response(new Uint8Array(wav), {
            headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        await refundAiSeconds(userId, 'voiceover', usage.charged);
        if (error instanceof RouteError) return fail(error.message, error.status);
        return fail('The dubbing engine could not generate audio for the selected language.', 502);
    }
}