import { hasAuthenticatedSupabaseUser } from '@/lib/supabase/authorization';
import { consumeAiCredit } from '@/lib/supabase/ai-quota';

const SCRIPT_LANGUAGES: Record<string, string> = {
    en: 'natural conversational English',
    hi: 'natural spoken Hindi written in Devanagari',
    hinglish: 'natural spoken Hinglish mixing Hindi and English, written in Roman script',
    bn: 'natural spoken Bengali written in Bengali script',
    mr: 'natural spoken Marathi written in Devanagari',
    ta: 'natural spoken Tamil written in Tamil script',
    te: 'natural spoken Telugu written in Telugu script',
};

export async function POST(request: Request) {
    if (!await hasAuthenticatedSupabaseUser()) {
        return Response.json({ error: 'Sign in to generate scripts.' }, { status: 401 });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return Response.json({ error: 'AI scripts are unavailable until GEMINI_API_KEY is configured on the server.' }, { status: 503 });
    }

    const body = await request.json().catch(() => null) as { topic?: unknown; language?: unknown; tone?: unknown; seconds?: unknown } | null;
    const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
    const language = typeof body?.language === 'string' ? body.language : 'en';
    const tone = typeof body?.tone === 'string' ? body.tone.slice(0, 80) : 'warm and confident';
    const seconds = Number(body?.seconds);

    if (topic.length < 3 || topic.length > 240) {
        return Response.json({ error: 'Enter a topic between 3 and 240 characters.' }, { status: 400 });
    }
    if (!(language in SCRIPT_LANGUAGES)) {
        return Response.json({ error: 'Choose a supported Indian language or English.' }, { status: 400 });
    }
    if (![15, 30, 60, 90].includes(seconds)) {
        return Response.json({ error: 'Choose a script length of 15, 30, 60, or 90 seconds.' }, { status: 400 });
    }

    const limited = await consumeAiCredit();
    if (limited) return limited;

    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
            method: 'POST',
            headers: {
                'x-goog-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                        text: `Write a spoken-to-camera teleprompter script in ${SCRIPT_LANGUAGES[language]}. Use short natural lines, avoid stage directions and markdown, start with a strong one-sentence hook, and end with a simple call to action. Keep it close to ${seconds} seconds when spoken at a natural pace. Do not invent personal facts or statistics. Return only the script.`,
                    }],
                },
                contents: [{ parts: [{ text: `Topic: ${topic}\nTone: ${tone}` }] }],
                generationConfig: { maxOutputTokens: Math.max(1024, Math.ceil(seconds * 24)) },
            }),
            cache: 'no-store',
        });
        const result = await response.json() as {
            error?: { message?: string };
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        if (!response.ok) {
            return Response.json(
                { error: result.error?.message ?? 'The script service could not complete the request.' },
                { status: response.status === 429 ? 429 : 502 }
            );
        }
        const script = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
        if (!script) return Response.json({ error: 'The script service returned no text. Try again.' }, { status: 502 });
        return Response.json({ script });
    } catch {
        return Response.json({ error: 'Could not reach the script service. Try again when the server is online.' }, { status: 502 });
    }
}