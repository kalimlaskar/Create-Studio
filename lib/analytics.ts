'use client';

import posthog from 'posthog-js';

// Product events for PostHog. Does nothing unless NEXT_PUBLIC_POSTHOG_KEY is set
// (see instrumentation-client.ts). Never pass personal data such as emails or names.
export type ProductEvent =
    | 'export_completed'
    | 'video_shared'
    | 'personal_link_created'
    | 'chapters_saved'
    | 'video_uploaded'
    | 'embed_code_copied'
    | 'video_access_changed';

export function track(event: ProductEvent, properties?: Record<string, string | number | boolean>) {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !posthog.__loaded) return;
    posthog.capture(event, properties);
}
