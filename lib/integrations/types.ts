// Shared by the integrations settings page and the server.

export type IntegrationKind = 'webhook' | 'slack' | 'hubspot';
export type NotificationType = 'video.viewed' | 'video.completed' | 'cta.clicked' | 'form.submitted' | 'call.booked';

export const NOTIFICATION_TYPES: Array<{ id: NotificationType; label: string; hint: string }> = [
    { id: 'video.viewed', label: 'Started watching', hint: 'The first second of a viewing' },
    { id: 'video.completed', label: 'Watched to the end', hint: 'Reached the last second' },
    { id: 'cta.clicked', label: 'Clicked the button', hint: 'The call to action under the video' },
    { id: 'form.submitted', label: 'Filled in a form', hint: 'A form before, during or after the video' },
    { id: 'call.booked', label: 'Booked a call', hint: 'Through a booking embed, like Calendly' },
];

export const MAX_INTEGRATIONS = 20;

export interface Integration {
    id: string;
    kind: IntegrationKind;
    name: string;
    /** Safe preview of where it sends, e.g. "hooks.slack.com/…/x7Qa". */
    targetHint: string;
    events: NotificationType[];
    identifiedOnly: boolean;
    enabled: boolean;
    lastStatus: 'ok' | 'failed' | null;
    lastError: string | null;
    lastDeliveredAt: string | null;
    createdAt: string;
}

/** What every integration receives; webhooks get it as JSON exactly like this. */
export interface NotificationPayload {
    id: string;
    type: NotificationType;
    createdAt: string;
    test?: boolean;
    video: { id: string; title: string; durationSeconds: number; analyticsUrl: string; shareUrl: string };
    viewer: {
        /** Recipient name or verified email; null for anonymous viewers. */
        name: string | null;
        email: string | null;
        company: string | null;
        identified: boolean;
        device: string | null;
        country: string | null;
        /** "share" for the share page, "embed" when watched on a website. */
        source: 'share' | 'embed';
        website: string | null;
    };
    watch: { percentWatched: number; watchedSeconds: number; completed: boolean; ctaClicked: boolean };
    /** For form.submitted: the form and what the viewer entered, including hidden fields. */
    form?: { id: string; title: string; values: Record<string, string>; hidden: Record<string, string> };
}

/** Who watched, in a phrase: "Ana Lopez (Acme)", "ana@acme.com" or "Someone". */
export function viewerPhrase(viewer: NotificationPayload['viewer']) {
    const who = viewer.name || viewer.email || 'Someone';
    return viewer.company ? `${who} (${viewer.company})` : who;
}

/** One-line summary used by Slack and HubSpot. */
export function notificationSummary(payload: NotificationPayload) {
    const who = viewerPhrase(payload.viewer);
    const title = `“${payload.video.title}”`;
    if (payload.type === 'video.completed') return `${who} watched ${title} to the end`;
    if (payload.type === 'cta.clicked') return `${who} clicked the button on ${title}`;
    if (payload.type === 'form.submitted') return `${who} filled in “${payload.form?.title ?? 'a form'}” on ${title}`;
    if (payload.type === 'call.booked') return `${who} booked a call from ${title}`;
    return `${who} started watching ${title}`;
}
