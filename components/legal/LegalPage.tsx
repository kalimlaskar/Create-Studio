import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';

// Shared layout for the legal pages. The wording describes what the app does today
// (see the code it references). Have a lawyer review it before relying on it, and
// update it whenever data handling changes.

export const LEGAL_UPDATED = '17 October 2026';
export const COMPANY = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Cliprame';
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@cliprame.com';
export const GRIEVANCE_OFFICER = process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER || 'Grievance Officer';

const LINKS = [
    { href: '/privacy', label: 'Privacy policy' },
    { href: '/terms', label: 'Terms of service' },
    { href: '/dpa', label: 'Data processing agreement' },
];

export function LegalPage({ title, intro, current, children }: { title: string; intro: string; current: string; children: ReactNode }) {
    return (
        <main className="min-h-dvh bg-[#F7F6FB] text-[#14121F]">
            <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
                <Link href="/" className="inline-flex items-center gap-2">
                    <Image src="/cliprame-icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
                    <span className="font-bold">Cliprame</span>
                </Link>
                <nav aria-label="Legal" className="hidden gap-4 text-sm sm:flex">
                    {LINKS.map((link) => (
                        <Link key={link.href} href={link.href} aria-current={link.href === current ? 'page' : undefined} className={link.href === current ? 'font-semibold' : 'text-[#14121F]/60 hover:text-[#14121F]'}>{link.label}</Link>
                    ))}
                </nav>
            </header>
            <article className="mx-auto max-w-3xl px-5 pb-20 text-[15px] leading-7 text-[#14121F]/80 [&_a]:font-medium [&_a]:text-[#6A4CFF] [&_a:hover]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#14121F] [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-[#14121F] [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-[#14121F] [&_table]:mt-4 [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-[#14121F]/10 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_th]:pb-2 [&_th]:pr-4 [&_th]:text-left [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
                <h1 className="text-3xl font-bold tracking-tight text-[#14121F] sm:text-4xl">{title}</h1>
                <p className="!mt-2 text-sm text-[#14121F]/50">Last updated {LEGAL_UPDATED}</p>
                <p className="!mt-6 text-base">{intro}</p>
                {children}
                <h2>Contact</h2>
                <p>Questions or requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Complaints about personal data can be sent to our {GRIEVANCE_OFFICER} at the same address; we reply within 30 days.</p>
            </article>
        </main>
    );
}

export const SUBPROCESSORS = [
    { name: 'Supabase', purpose: 'Accounts, sign-in and the database (profiles, videos, links, analytics, billing records)', location: 'Region chosen for the project' },
    { name: 'Cloudflare R2', purpose: 'Storage of uploaded videos and poster images', location: 'Automatic placement (Asia Pacific for this bucket)' },
    { name: 'Google (Gemini API)', purpose: 'AI transcription, script writing, captions, translation and voiceover, only when you use those features', location: 'Google data centres' },
    { name: 'Resend', purpose: 'Sending one-time codes to viewers who unlock a protected video by email (when enabled)', location: 'United States' },
    { name: 'Razorpay', purpose: 'Subscription payments; card and bank details are handled by Razorpay, not us', location: 'India' },
    { name: 'Vercel', purpose: 'Hosting the website and API', location: 'Global edge network' },
    { name: 'Sentry', purpose: 'Error reports from the app, without IP addresses or cookies (when enabled)', location: 'United States or EU' },
    { name: 'PostHog', purpose: 'Product usage analytics inside the app, never on share pages (when enabled)', location: 'United States or EU' },
];
