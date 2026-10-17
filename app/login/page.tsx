import { AuthForm } from '@/components/auth/AuthForm';
import { AuthShell } from '@/components/auth/AuthShell';
import { enabledSocialProviders } from '@/lib/auth/providers';
import { getTemporaryAuthUsername, isDemoAuthEnabled } from '@/lib/auth/demo';

export const metadata = { title: 'Log in | Cliprame Studio' };

type LoginPageProps = { searchParams: Promise<{ next?: string; notice?: string; error?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const params = await searchParams;
    const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/studio';
    const supabaseConfigured = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );

    return (
        <AuthShell mode="login" anchorId="signin" skipLabel="Skip to sign in" title="Log in to Cliprame Studio">
            <AuthForm
                mode="login"
                variant="embedded"
                next={next}
                setup={!supabaseConfigured}
                demoMode={isDemoAuthEnabled()}
                demoUsername={getTemporaryAuthUsername()}
                supabaseConfigured={supabaseConfigured}
                providers={supabaseConfigured ? enabledSocialProviders() : []}
                error={params.error}
                notice={params.notice}
            />
        </AuthShell>
    );
}