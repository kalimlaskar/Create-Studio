import Link from 'next/link';
import type { ReactNode } from 'react';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { getMarketingSession } from '@/components/marketing/session';
import { D, focus, label } from '@/components/marketing/theme';

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

export async function LegalPage({ title, intro, current, children }: { title: string; intro: string; current: string; children: ReactNode }) {
    const session = await getMarketingSession();
    return (
        <MarketingShell session={session}>
            <div className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
                <nav aria-label="Legal" className="flex flex-wrap gap-2">
                    {LINKS.map((link) => (
                        <Link key={link.href} href={link.href} aria-current={link.href === current ? 'page' : undefined} className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${link.href === current ? 'border-[#15120F] bg-[#15120F] font-semibold text-[#F6F4EF]' : 'border-[#15120F]/15 text-[#15120F]/65 hover:border-[#15120F]/35 hover:text-[#15120F]'} ${focus}`}>{link.label}</Link>
                    ))}
                </nav>
                <article className="mt-10 text-[15px] leading-7 text-[#15120F]/75 [&_a]:font-medium [&_a]:text-[#5B3DF5] [&_a:hover]:underline [&_h2]:mt-12 [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-[1.4rem] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_h2]:text-[#15120F] [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-[#15120F] [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-[#15120F] [&_table]:mt-4 [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-[#15120F]/10 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_th]:pb-2 [&_th]:pr-4 [&_th]:text-left [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
                    <p className={label}>Last updated {LEGAL_UPDATED}</p>
                    <h1 className={`${D} !mt-4 text-[2.6rem] font-bold leading-[1] tracking-[-0.04em] text-[#15120F] sm:text-6xl`}>{title}</h1>
                    <p className="!mt-6 text-[17px] leading-7 text-[#15120F]/62">{intro}</p>
                    <div className="mt-10 border-t border-[#15120F]/10" />
                    {children}
                    <h2>Contact</h2>
                    <p>Questions or requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Complaints about personal data can be sent to our {GRIEVANCE_OFFICER} at the same address; we reply within 30 days.</p>
                </article>
            </div>
        </MarketingShell>
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
