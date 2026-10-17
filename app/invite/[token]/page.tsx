import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { Users } from 'lucide-react';
import { signOutAction } from '@/app/auth/actions';
import { AcceptInvite } from '@/components/team/AcceptInvite';
import { focus } from '@/components/videos/ui';
import { getStudioUser } from '@/lib/videos/server';
import { findInvite } from '@/lib/workspaces/server';
import { ROLE_LABELS } from '@/lib/workspaces/types';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const D = 'font-[family-name:var(--font-display)]';
const primary = `inline-flex items-center justify-center gap-2 rounded-xl bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742] ${focus}`;
const ghost = `inline-flex items-center justify-center gap-2 rounded-xl border border-[#14121F]/12 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-[#F7F6FB] ${focus}`;

export const metadata = { title: 'Join a workspace | Cliprame', robots: { index: false } };

function Frame({ children }: { children: ReactNode }) {
    return (
        <main className={`${display.variable} ${body.variable} flex min-h-dvh flex-col items-center justify-center bg-[#F7F6FB] px-4 py-12 font-[family-name:var(--font-body)] text-[#14121F]`}>
            <Link href="/" aria-label="Cliprame home" className={`mb-8 flex items-center gap-2 rounded-full ${focus}`}>
                <Image src="/cliprame-icon.svg" alt="" width={32} height={32} className="h-8 w-8" />
                <span className={`${D} text-lg font-bold tracking-tight`}>Cliprame</span>
            </Link>
            <div className="w-full max-w-md rounded-3xl border border-[#14121F]/8 bg-white p-6 text-center sm:p-8">{children}</div>
        </main>
    );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const [invite, user] = await Promise.all([findInvite(token), getStudioUser().catch(() => null)]);

    if (!invite || !invite.usable) {
        return (
            <Frame>
                <h1 className={`${D} text-2xl font-bold tracking-tight`}>This invite can’t be used</h1>
                <p className="mt-3 text-sm leading-6 text-[#14121F]/60">It has expired, was cancelled, or was already accepted. Ask whoever invited you to send a new one.</p>
                <Link href={user ? '/studio' : '/'} className={`${primary} mt-6`}>{user ? 'Go to your studio' : 'Go to Cliprame'}</Link>
            </Frame>
        );
    }

    const intro = (
        <>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6A4CFF]/10 text-[#6A4CFF]"><Users className="h-6 w-6" /></span>
            <h1 className={`${D} mt-4 text-2xl font-bold tracking-tight`}>Join {invite.workspaceName}</h1>
            <p className="mt-3 text-sm leading-6 text-[#14121F]/60">
                {invite.inviterName ? <><strong className="text-[#14121F]">{invite.inviterName}</strong> invited you</> : 'You’re invited'} to share videos, viewer analytics and leads with the team, as {invite.role === 'admin' ? 'an' : 'a'} {ROLE_LABELS[invite.role].toLowerCase()}.
            </p>
            <p className="mt-2 text-xs text-[#14121F]/45">For {invite.email}</p>
        </>
    );

    if (!user) {
        const next = encodeURIComponent(`/invite/${token}`);
        return (
            <Frame>
                {intro}
                <div className="mt-6 grid gap-2">
                    <Link href={`/signup?next=${next}`} className={primary}>Create a free account</Link>
                    <Link href={`/login?next=${next}`} className={ghost}>I already have an account</Link>
                </div>
                <p className="mt-4 text-xs text-[#14121F]/45">Use {invite.email}, the address the invite was sent to.</p>
            </Frame>
        );
    }

    const { data: claims } = await user.supabase.auth.getClaims();
    const email = typeof claims?.claims?.email === 'string' ? claims.claims.email.toLowerCase() : '';
    if (email !== invite.email) {
        return (
            <Frame>
                {intro}
                <p className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">You’re signed in as <strong>{email || 'another account'}</strong>. Sign out, then open this link again and sign in as {invite.email}.</p>
                <form action={signOutAction} className="mt-4">
                    <button type="submit" className={`${ghost} w-full`}>Sign out</button>
                </form>
            </Frame>
        );
    }

    return (
        <Frame>
            {intro}
            <AcceptInvite token={token} />
        </Frame>
    );
}
