// Server-side error reporting. Sentry starts only when SENTRY_DSN is set.
import * as Sentry from '@sentry/nextjs';

export async function register() {
    const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    Sentry.init({
        dsn,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
        // Never attach IP addresses, cookies or request bodies.
        sendDefaultPii: false,
    });
}

export const onRequestError = Sentry.captureRequestError;
