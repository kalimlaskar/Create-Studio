// components/studio/textToSpeech.ts
export type NarrationLanguage = 'en' | 'hi' | 'bn' | 'ta' | 'te';
export type NarrationGender = 'female' | 'male';

export async function generateSpeechAudio(
    text: string,
    language: NarrationLanguage | string = 'en',
    gender: NarrationGender = 'female'
): Promise<{ file: File; url: string }> {
    // /api/dub handles English too: same source and target language skips translation
    const response = await fetch('/api/dub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            sourceLanguage: 'en',
            targetLanguage: language,
            voiceGender: gender,
        }),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Voiceover failed (${response.status}). Please try again.`);
    }

    const blob = await response.blob();
    if (blob.size === 0) throw new Error('The voice service returned empty audio.');

    const type = blob.type && blob.type.startsWith('audio/') ? blob.type : 'audio/wav';
    const file = new File([blob], `voiceover-${language}.wav`, { type });
    return { file, url: URL.createObjectURL(file) };
}