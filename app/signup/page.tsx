import { AuthForm } from '@/components/auth/AuthForm';
import { AuthShell } from '@/components/auth/AuthShell';
import { isDemoAuthEnabled } from '@/lib/auth/demo';

export const metadata = { title: 'Create your account | Cliprame' };

type SignupPageProps = { searchParams: Promise<{ next?: string }> };

export default async function SignupPage({ searchParams }: SignupPageProps) {
    const params = await searchParams;
    const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/studio';
    const supabaseConfigured = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );

    return (
        <AuthShell mode="signup" anchorId="signup" skipLabel="Skip to sign up" title="Create your Cliprame account">
            <AuthForm
                mode="signup"
                variant="embedded"
                next={next}
                setup={!supabaseConfigured}
                demoMode={isDemoAuthEnabled()}
                supabaseConfigured={supabaseConfigured}
            />
        </AuthShell>
    );
}