import Link from 'next/link';
import { AuthForm } from '@/components/auth/AuthForm';
import { isDemoAuthEnabled } from '@/lib/auth/demo';

export const metadata = { title: 'Sign in | CreatorStudio' };

type LoginPageProps = { searchParams: Promise<{ next?: string; setup?: string; notice?: string; error?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const params = await searchParams;
    const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/studio';
    return (
        <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#080a12] px-4 py-12 text-white">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(79,70,229,0.18),transparent_42%),radial-gradient(ellipse_at_85%_80%,rgba(14,165,233,0.12),transparent_40%)]" />
            <Link href="/" className="absolute left-5 top-5 text-sm text-neutral-400 transition hover:text-white">← Back home</Link>
            <div className="relative z-10"><AuthForm mode="login" next={next} setup={params.setup === '1' || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} demoMode={isDemoAuthEnabled()} error={params.error} notice={params.notice} /></div>
        </main>
    );
}
