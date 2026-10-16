// Browser monitoring. Each tool starts only when its key is set.
//  - Sentry (NEXT_PUBLIC_SENTRY_DSN): JavaScript errors, without personal data.
//  - PostHog (NEXT_PUBLIC_POSTHOG_KEY): product analytics for the app itself. It never
//    runs on /v/ share pages, so people watching shared videos aren't sent to a third party.
import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
    Sentry.init({
        dsn: sentryDsn,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
        tracesSampleRate: 0.1,
        sendDefaultPii: false,
    });
}

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey && !window.location.pathname.startsWith('/v/')) {
    posthog.init(posthogKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
        capture_pageview: 'history_change',
        person_profiles: 'identified_only',
        respect_dnt: true,
        disable_session_recording: true,
    });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
