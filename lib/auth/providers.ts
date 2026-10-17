// Social sign-in providers. Each must be switched on in Supabase (Authentication →
// Sign In / Providers) before it's listed in AUTH_PROVIDERS, or its button would lead
// to a Supabase error page. Add more here (e.g. 'azure', 'linkedin_oidc') later.

export const SOCIAL_PROVIDERS = {
    google: { label: 'Google' },
} as const;

export type SocialProvider = keyof typeof SOCIAL_PROVIDERS;

export const isSocialProvider = (value: unknown): value is SocialProvider =>
    typeof value === 'string' && Object.hasOwn(SOCIAL_PROVIDERS, value);

/** Providers turned on for this deployment, from AUTH_PROVIDERS (comma-separated, e.g. "google"). */
export function enabledSocialProviders(): SocialProvider[] {
    return (process.env.AUTH_PROVIDERS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(isSocialProvider);
}
