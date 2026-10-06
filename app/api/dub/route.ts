import { hasAuthenticatedSupabaseUser } from '@/lib/supabase/authorization';
import { consumeAiCredit } from '@/lib/supabase/ai-quota';

const SUPPORTED_LANGUAGES = new Set(['en', 'hi', 'bn', 'ta', 'te']);
const LANGUAGE_LABELS: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
};

export async function POST(request: Request) {
    if (!await hasAuthenticatedSupabaseUser()) {
        return Response.json({ error: 'Sign in to use dubbing.' }, { status: 401 });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return Response.json({ error: 'Dubbing requires a GEMINI_API_KEY to be configured on the server.' }, { status: 503 });
    }

    let body: { text?: unknown; sourceLanguage?: unknown; targetLanguage?: unknown; voiceGender?: unknown };
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'Send script text and the language settings to generate a dubbed voiceover.' }, { status: 400 });
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const sourceLanguage = typeof body.sourceLanguage === 'string' ? body.sourceLanguage : 'en';
    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'hi';
    const voiceGender = typeof body.voiceGender === 'string' ? body.voiceGender : 'female';

    if (!text) {
        return Response.json({ error: 'Add a script or transcript before generating a dubbed track.' }, { status: 400 });
    }

    if (!SUPPORTED_LANGUAGES.has(sourceLanguage) || !SUPPORTED_LANGUAGES.has(targetLanguage)) {
        return Response.json({ error: 'Unsupported language selection. Choose English, Hindi, Bengali, Tamil, or Telugu.' }, { status: 400 });
    }
    if (voiceGender !== 'female' && voiceGender !== 'male') {
        return Response.json({ error: 'Choose a female or male voice.' }, { status: 400 });
    }

    const limited = await consumeAiCredit();
    if (limited) return limited;

    let translatedText = text;

    if (sourceLanguage !== targetLanguage) {
        try {
            const translationRequest = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
                method: 'POST',
                headers: {
                    'x-goog-api-key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Translate this ${LANGUAGE_LABELS[sourceLanguage]} script into ${LANGUAGE_LABELS[targetLanguage]} for spoken video. Preserve the meaning, make it sound natural and concise, and return only the translated script.\n\n${text}`,
                        }],
                    }],
                    generationConfig: { temperature: 0.35 },
                }),
                cache: 'no-store',
            });

            if (!translationRequest.ok) {
                const translationErrorBody = await translationRequest.json().catch(() => null) as { error?: { message?: string } } | null;
                return Response.json(
                    { error: translationErrorBody?.error?.message ?? 'Translation service failed while preparing the dubbed version.' },
                    { status: translationRequest.status === 429 ? 429 : 502 }
                );
            }

            const translationResult = await translationRequest.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
            const candidateText = translationResult.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
            if (candidateText) {
                translatedText = candidateText;
            } else {
                return Response.json({ error: 'Translation service returned an empty translation. Please try again.' }, { status: 502 });
            }
        } catch {
            return Response.json({ error: 'Translation service could not be reached. Please try again in a moment.' }, { status: 502 });
        }
    }

    try {
        const ttsRequest = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
            method: 'POST',
            headers: {
                'x-goog-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gemini-3.8-flash-lite-tts',
                input: [{
                    type: 'user_input',
                    content: [{
                        type: 'text',
                        text: translatedText,
                        annotations: [{ type: 'speech_metadata', style: 'Warm, natural, conversational delivery for a short social video.' }],
                    }],
                }],
                response_format: { type: 'audio' },
                generation_config: { speech_config: [{ voice: voiceGender === 'male' ? 'Puck' : 'Kore' }] },
                store: false,
            }),
            cache: 'no-store',
        });

        if (!ttsRequest.ok) {
            const ttsErrorBody = await ttsRequest.json().catch(() => null) as { error?: { message?: string } } | null;
            return Response.json(
                { error: ttsErrorBody?.error?.message ?? 'Text-to-speech generation failed during dubbing.' },
                { status: ttsRequest.status === 429 ? 429 : 502 }
            );
        }

        const result = await ttsRequest.json() as {
            output_audio?: { data?: string };
            steps?: Array<{ content?: Array<{ type?: string; data?: string }> }>;
        };
        const audioBase64 = result.output_audio?.data
            ?? result.steps?.flatMap((step) => step.content ?? []).find((content) => content.type === 'audio' && content.data)?.data;
        if (!audioBase64) {
            return Response.json({ error: 'Gemini did not return an audio track. Please try again.' }, { status: 502 });
        }

        const audioBytes = Buffer.from(audioBase64, 'base64');
        return new Response(new Uint8Array(audioBytes), {
            headers: {
                'Content-Type': 'audio/wav',
                'Cache-Control': 'no-store',
            },
        });
    } catch {
        return Response.json({ error: 'The dubbing engine could not generate audio for the selected language.' }, { status: 502 });
    }
}
