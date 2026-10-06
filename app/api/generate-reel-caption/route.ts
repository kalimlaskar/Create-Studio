import { hasAuthenticatedSupabaseUser } from '@/lib/supabase/authorization';
import { consumeAiCredit } from '@/lib/supabase/ai-quota';

const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
};

export async function POST(request: Request) {
    if (!await hasAuthenticatedSupabaseUser()) {
        return Response.json({ error: 'Sign in to generate reel captions.' }, { status: 401 });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: 'AI captions require GEMINI_API_KEY on the server.' }, { status: 503 });

    const body = await request.json().catch(() => null) as { description?: unknown; language?: unknown; template?: unknown } | null;
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const language = typeof body?.language === 'string' && body.language in LANGUAGE_NAMES ? body.language : 'en';
    const template = typeof body?.template === 'string' ? body.template.slice(0, 60) : 'social media reel';
    if (description.length < 3 || description.length > 500) {
        return Response.json({ error: 'Enter a short description between 3 and 500 characters.' }, { status: 400 });
    }

    const limited = await consumeAiCredit();
    if (limited) return limited;

    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
            method: 'POST',
            headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: `Write one short, engaging on-screen caption for a ${template} reel in ${LANGUAGE_NAMES[language]}. Use no more than 12 words, no hashtags, and return only the caption.` }] },
                contents: [{ parts: [{ text: description }] }],
                generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
            }),
            cache: 'no-store',
        });
        const result = await response.json() as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        if (!response.ok) {
            return Response.json({ error: result.error?.message ?? 'Gemini could not generate a caption.' }, { status: response.status === 429 ? 429 : 502 });
        }
        const caption = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
        if (!caption) return Response.json({ error: 'Gemini returned an empty caption. Try again.' }, { status: 502 });
        return Response.json({ caption });
    } catch {
        return Response.json({ error: 'Could not reach the caption service. Please try again.' }, { status: 502 });
    }
}
