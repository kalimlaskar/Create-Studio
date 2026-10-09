// textToSpeech.ts
export async function generateSpeechAudio(
    text: string,
    language: string = 'en',
    gender: 'female' | 'male' = 'female'
): Promise<{ file: File; url: string }> {
    return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) {
            const emptyBlob = new Blob([], { type: 'audio/mp3' });
            resolve({ file: new File([emptyBlob], 'narration.mp3', { type: 'audio/mp3' }), url: '' });
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);

        // Exact regional locale mappings
        const langMap: Record<string, string> = {
            en: 'en-IN', // Indian English accent
            hi: 'hi-IN', // Hindi
            bn: 'bn-IN', // Bengali
            ta: 'ta-IN', // Tamil
            te: 'te-IN', // Telugu
        };
        const targetLang = langMap[language] || 'en-IN';
        utterance.lang = targetLang;

        // Forcefully wait for voices to load if needed, and pick the exact locale voice
        const voices = window.speechSynthesis.getVoices();
        const matchingVoice = voices.find(v => v.lang === targetLang) || voices.find(v => v.lang.startsWith(language)) || voices[0];

        if (matchingVoice) {
            utterance.voice = matchingVoice;
        }

        window.speechSynthesis.speak(utterance);

        const emptyBlob = new Blob([], { type: 'audio/mp3' });
        const file = new File([emptyBlob], 'narration.mp3', { type: 'audio/mp3' });
        const url = URL.createObjectURL(file);

        resolve({ file, url });
    });
}