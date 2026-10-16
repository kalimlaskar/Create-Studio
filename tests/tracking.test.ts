import { describe, expect, it } from 'vitest';
import { capPlayedSeconds, isAutomatedAgent } from '@/lib/videos/tracking';

describe('fake view protection', () => {
    it('ignores link previews and bots', () => {
        expect(isAutomatedAgent('Slackbot-LinkExpanding 1.0')).toBe(true);
        expect(isAutomatedAgent('WhatsApp/2.23.20')).toBe(true);
        expect(isAutomatedAgent('Mozilla/5.0 HeadlessChrome/120')).toBe(true);
        expect(isAutomatedAgent(null)).toBe(true);
        expect(isAutomatedAgent('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36')).toBe(false);
    });

    it('accepts only as much watching as time allows', () => {
        const hour = Array.from({ length: 3600 }, (_, second) => [second, 1] as [number, number]);
        // 5 seconds since the last report allows about 18 played seconds (2x speed plus slack).
        const accepted = capPlayedSeconds(hour, 5000);
        expect(accepted.reduce((sum, [, times]) => sum + times, 0)).toBe(18);
        // Normal playback within the window is kept in full.
        expect(capPlayedSeconds([[10, 1], [11, 1], [12, 1]], 5000)).toEqual([[10, 1], [11, 1], [12, 1]]);
    });
});
