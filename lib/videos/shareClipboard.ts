'use client';

import { formatClock } from './types';

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);

export const shareUrlFor = (slug: string) => `${window.location.origin}/v/${slug}`;

/**
 * Copies a thumbnail with a play button that links to the video, ready to paste into
 * Gmail or Outlook. Falls back to plain text where rich copy isn't allowed.
 */
export async function copyEmailSnippet({ slug, title, durationMs, recipientName }: { slug: string; title: string; durationMs: number; recipientName?: string | null }) {
    const url = shareUrlFor(slug);
    const greeting = recipientName ? `Hi ${recipientName.split(' ')[0]},` : 'Hi,';
    const label = `▶ Watch “${title}” (${formatClock(durationMs)})`;
    const html = `<p>${escapeHtml(greeting)}</p><p>I recorded a quick video for you:</p><p><a href="${url}"><img src="${window.location.origin}/v/${slug}/thumbnail" alt="${escapeHtml(label)}" width="480" style="border-radius:12px;max-width:100%;border:0"></a></p><p><a href="${url}">${escapeHtml(label)}</a></p>`;
    const text = `${greeting}\n\nI recorded a quick video for you:\n${label}\n${url}`;
    try {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
    } catch {
        await navigator.clipboard.writeText(text);
    }
}
