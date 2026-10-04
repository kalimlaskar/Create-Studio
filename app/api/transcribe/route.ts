import { hasAuthenticatedSupabaseUser } from '@/lib/supabase/authorization';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const LANGUAGE_CODES = new Set(['auto', 'en', 'hi', 'hinglish']);
export const maxDuration = 120;

interface TranscriptionResponse {
    words?: Array<{ word?: string; start?: number; end?: number }>;
    text?: string;
}

export async function POST(request: Request) {
    if (!await hasAuthenticatedSupabaseUser()) {
        return Response.json({ error: 'Sign in to generate captions.' }, { status: 401 });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return Response.json({ error: 'Automatic captions need an OPENAI_API_KEY configured on the server.' }, { status: 503 });
    }

    let body: FormData;
    try {
        body = await request.formData();
    } catch {
        return Response.json({ error: 'Upload a supported audio recording to generate captions.' }, { status: 400 });
    }

    const file = body.get('file');
    const language = String(body.get('language') ?? 'auto');
    if (!(file instanceof File) || file.size === 0) {
        return Response.json({ error: 'The audio recording is empty.' }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_BYTES) {
        return Response.json({ error: 'Audio is larger than the 25 MB transcription limit.' }, { status: 413 });
    }
    if (!LANGUAGE_CODES.has(language)) {
        return Response.json({ error: 'Choose Auto, English, Hindi, or Hinglish.' }, { status: 400 });
    }

    const providerForm = new FormData();
    providerForm.append('file', file, file.name || 'creator-studio-audio.webm');
    providerForm.append('model', 'whisper-1');
    providerForm.append('response_format', 'verbose_json');
    providerForm.append('timestamp_granularities[]', 'word');
    if (language === 'en' || language === 'hi') providerForm.append('language', language);
    if (language === 'hinglish') {
        providerForm.append('prompt', 'Hindi and English code-switching (Hinglish). Preserve spoken English words and write Hindi words in Roman script when possible.');
    }

    try {
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: providerForm,
            cache: 'no-store',
        });
        if (!response.ok) {
            const errorBody = await response.json().catch(() => null) as { error?: { message?: string } } | null;
            return Response.json(
                { error: errorBody?.error?.message ?? `Transcription service returned ${response.status}.` },
                { status: response.status === 413 ? 413 : 502 }
            );
        }

        const result = await response.json() as TranscriptionResponse;
        const words = (result.words ?? [])
            .filter((word) => typeof word.word === 'string' && Number.isFinite(word.start) && Number.isFinite(word.end))
            .map((word) => ({ word: word.word!.trim(), start: word.start!, end: word.end! }))
            .filter((word) => word.word && word.end > word.start);
        return Response.json({ words, text: result.text ?? '' });
    } catch {
        return Response.json({ error: 'Could not reach the transcription service. Check the server connection and try again.' }, { status: 502 });
    }
}
