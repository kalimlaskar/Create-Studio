'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, BellRing, Check, Copy, EyeOff, Hash, Lock, Mail, MousePointerClick, Play, ScreenShare, Send, X } from 'lucide-react';
import { D, focus, label, serif } from '@/components/marketing/theme';

const FLAGSHIP = {
    title: 'A 2-minute product walkthrough',
    description: 'Recorded and edited in Cliprame: screen and camera in one take, a teleprompter the viewer never sees, and the stumbles cut by deleting words.',
    duration: '2:14',
    videoUrl: 'https://assets.cliprame.com/Demo/saas-product-walkthrough.mp4',
};

type TourId = 'record' | 'send' | 'lock' | 'alert';

const TOUR: Array<{ id: TourId; step: string; title: string; text: string; icon: typeof Play }> = [
    { id: 'record', step: 'You record', title: 'One take, with your notes on screen', text: 'Share your screen, keep your face in a floating card, and read talking points only you can see. Fix mistakes by deleting words.', icon: ScreenShare },
    { id: 'send', step: 'They open', title: 'A page made for them', text: 'Your prospect gets a page with their name on it, your video, chapters to jump to and a button to book a call. No account needed.', icon: Send },
    { id: 'lock', step: 'Optional lock', title: 'Only the right people get in', text: 'For pricing or proposals, ask for a PIN, a password or an email code, limited to their company.', icon: Lock },
    { id: 'alert', step: 'You find out', title: 'A ping the moment they watch', text: 'Slack, HubSpot or your CRM hears when they start, finish or click, with how far they got and what they rewatched.', icon: BellRing },
];

const SCRIPTS = [
    {
        title: 'Cold outreach',
        when: 'First touch · 60–90 seconds',
        lines: [
            'Hi {name}, I made this video just for you.',
            'I was looking at {company}’s site and noticed {one specific thing}.',
            'Teams like yours usually lose time on {problem}. Here’s how we fix it. [show 1 screen]',
            'If that’s useful, the button under this video books 15 minutes with me.',
        ],
        cta: 'Book 15 minutes',
    },
    {
        title: 'Demo follow-up',
        when: 'Same day as the call · 2 minutes',
        lines: [
            'Hi {name}, thanks for the time today.',
            'You asked about {question}. Here it is in the product. [show it]',
            'I added chapters so you can send the pricing part straight to {decision maker}.',
            'Next step we agreed: {next step}. Click below if you want to move it up.',
        ],
        cta: 'Pick a time',
    },
    {
        title: 'Proposal walkthrough',
        when: 'With the proposal · lock it with a password',
        lines: [
            'Hi {name}, rather than send a PDF, I wanted to walk you through it.',
            'Here’s the scope, and why we suggest {approach}. [scroll the proposal]',
            'Pricing is in the third chapter, with the two options we discussed.',
            'Any questions, reply to this email or book a call below.',
        ],
        cta: 'Accept proposal',
    },
    {
        title: 'Renewal check-in',
        when: '45 days before renewal · 90 seconds',
        lines: [
            'Hi {name}, quick look back at the last year together.',
            'Your team used {feature} the most, and saved about {result}.',
            'Here’s what’s coming next that fits how you work. [show it]',
            'Happy to plan the renewal whenever suits you.',
        ],
        cta: 'Plan the renewal',
    },
];

export default function DemoShowcaseClient({ isLoggedIn }: { isLoggedIn: boolean }) {
    const [playing, setPlaying] = useState(false);
    const [tour, setTour] = useState<TourId>('record');
    const [copied, setCopied] = useState<string | null>(null);
    const current = TOUR.find((item) => item.id === tour) ?? TOUR[0];

    useEffect(() => {
        if (!playing) return;
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setPlaying(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [playing]);

    const copyScript = async (title: string, lines: string[]) => {
        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setCopied(title);
            window.setTimeout(() => setCopied((value) => (value === title ? null : value)), 1800);
        } catch { /* clipboard blocked; the script stays visible to copy by hand */ }
    };

    return (
        <>
            {/* Hero */}
            <section className="mx-auto max-w-6xl px-5 pb-14 pt-14 sm:px-8 sm:pt-20">
                <p className={label}>Demo</p>
                <div className="mt-5 grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
                    <h1 className={`${D} text-[2.9rem] font-bold leading-[0.96] tracking-[-0.045em] sm:text-7xl`}>
                        See it from <span className={`${serif} text-[#5B3DF5]`}>both sides.</span>
                    </h1>
                    <p className="text-[17px] leading-7 text-[#15120F]/62 lg:pb-2">What you record, what your prospect sees, and what you find out afterwards. Then borrow a script and send your first one.</p>
                </div>
            </section>

            {/* Flagship video */}
            <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
                <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    className={`group grid w-full overflow-hidden rounded-2xl border border-[#15120F]/10 bg-white text-left transition hover:border-[#15120F]/25 md:grid-cols-[1.35fr_1fr] ${focus}`}
                >
                    <span className="relative flex aspect-video items-center justify-center bg-[#15120F]">
                        <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(91,61,245,0.35),transparent_60%)]" />
                        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#F6F4EF] text-[#15120F] transition group-hover:scale-105"><Play className="ml-1 h-6 w-6 fill-current" /></span>
                        <span className="absolute bottom-4 left-4 text-[12px] tabular-nums text-[#F6F4EF]/70">{FLAGSHIP.duration}</span>
                    </span>
                    <span className="flex flex-col justify-center p-7 sm:p-9">
                        <span className={label}>Made with Cliprame</span>
                        <span className={`${D} mt-3 block text-2xl font-bold tracking-tight`}>{FLAGSHIP.title}</span>
                        <span className="mt-3 block text-[15px] leading-7 text-[#15120F]/62">{FLAGSHIP.description}</span>
                        <span className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold underline decoration-[#15120F]/25 underline-offset-4 group-hover:decoration-[#15120F]">Watch it <ArrowRight className="h-4 w-4" /></span>
                    </span>
                </button>
            </section>

            {/* Both sides */}
            <section aria-labelledby="tour-title" className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
                <div className="mb-10 flex items-center gap-4"><span className={label}>01 — How one video plays out</span><span className="h-px flex-1 bg-[#15120F]/10" /></div>
                <h2 id="tour-title" className="sr-only">How one video plays out</h2>
                <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
                    <div role="tablist" aria-label="Steps" className="divide-y divide-[#15120F]/10 border-y border-[#15120F]/10">
                        {TOUR.map((item, index) => {
                            const active = item.id === tour;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    aria-controls="tour-panel"
                                    onClick={() => setTour(item.id)}
                                    className={`grid w-full grid-cols-[2.5rem_1fr] gap-3 py-5 text-left transition ${focus}`}
                                >
                                    <span className={`${serif} text-3xl leading-none ${active ? 'text-[#5B3DF5]' : 'text-[#15120F]/25'}`}>{index + 1}</span>
                                    <span>
                                        <span className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#15120F]/40">{item.step}</span>
                                        <span className={`${D} mt-1 block text-lg font-bold tracking-tight ${active ? '' : 'text-[#15120F]/55'}`}>{item.title}</span>
                                        {active && <span className="mt-2 block text-[15px] leading-7 text-[#15120F]/62">{item.text}</span>}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div id="tour-panel" role="tabpanel" aria-label={current.title} className="flex min-h-[24rem] items-center justify-center rounded-2xl border border-[#15120F]/10 bg-[#EFECE4] p-6 sm:p-10">
                        <div key={tour} className="mk-rise w-full max-w-md">
                            {tour === 'record' && (
                                <div className="relative rounded-xl border border-[#15120F]/10 bg-white p-2 shadow-[0_30px_60px_-36px_rgba(21,18,15,0.5)]">
                                    <div className="aspect-[16/10] rounded-lg bg-[#F3F1EC] p-4">
                                        <span className="block h-2.5 w-1/3 rounded bg-[#15120F]/70" />
                                        <span className="mt-3 block h-2 w-full rounded bg-[#15120F]/10" />
                                        <span className="mt-2 block h-2 w-4/5 rounded bg-[#15120F]/10" />
                                        <span className="mt-4 block h-[45%] rounded-lg border border-[#15120F]/8 bg-white" />
                                    </div>
                                    <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded bg-[#15120F] px-2 py-1 text-[10px] font-semibold text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E5484D]" />REC 00:38</span>
                                    <span className="absolute -bottom-4 -right-4 h-20 w-24 rounded-lg bg-[linear-gradient(160deg,#E8C9A8,#C98B6B)] ring-4 ring-white" />
                                    <div className="absolute -left-5 -top-7 w-44 -rotate-2 rounded-lg bg-[#15120F] p-2.5 text-[11px] text-[#F6F4EF] shadow-xl">
                                        <p className="mb-1 flex items-center justify-between text-[9px] text-[#F6F4EF]/55">Teleprompter <span className="inline-flex items-center gap-1"><EyeOff className="h-2.5 w-2.5" />only you</span></p>
                                        Hi Ana, I made this just for you…
                                    </div>
                                </div>
                            )}
                            {tour === 'send' && (
                                <div className="rounded-xl border border-[#15120F]/10 bg-white p-5 shadow-[0_30px_60px_-36px_rgba(21,18,15,0.5)]">
                                    <p className="text-xs font-semibold text-[#5B3DF5]">Hi Ana, this video is for you</p>
                                    <p className={`${D} mt-0.5 text-lg font-bold tracking-tight`}>How Acme can onboard faster</p>
                                    <div className="mt-3 flex aspect-video items-center justify-center rounded-lg bg-[#15120F]"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F6F4EF]"><Play className="ml-0.5 h-5 w-5 fill-current" /></span></div>
                                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-[#15120F]/60">
                                        {['0:00 Intro', '0:42 Your setup', '1:30 Pricing'].map((chapter) => <span key={chapter} className="rounded-md border border-[#15120F]/10 px-2 py-1">{chapter}</span>)}
                                        <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-[#15120F] px-2.5 py-1 font-semibold text-[#F6F4EF]"><MousePointerClick className="h-3 w-3" /> Book a call</span>
                                    </div>
                                </div>
                            )}
                            {tour === 'lock' && (
                                <div className="mx-auto max-w-xs rounded-xl border border-[#15120F]/10 bg-white p-5 shadow-[0_30px_60px_-36px_rgba(21,18,15,0.5)]">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5B3DF5]/10 text-[#5B3DF5]"><Mail className="h-4 w-4" /></span>
                                    <p className="mt-3 font-semibold">Confirm your email to watch</p>
                                    <p className="text-xs text-[#15120F]/50">We’ll send a 6-digit code to your inbox.</p>
                                    <span className="mt-4 block rounded-lg border border-[#15120F]/12 px-3 py-2.5 text-xs text-[#15120F]/65">ana@acme.com</span>
                                    <span className="mt-2 block rounded-lg bg-[#15120F] py-2.5 text-center text-sm font-semibold text-[#F6F4EF]">Send code</span>
                                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#15120F]/45"><Lock className="h-3 w-3" /> Only people at acme.com</p>
                                </div>
                            )}
                            {tour === 'alert' && (
                                <div className="overflow-hidden rounded-xl border border-[#15120F]/10 bg-white shadow-[0_30px_60px_-36px_rgba(21,18,15,0.5)]">
                                    <div className="flex items-center gap-2 bg-[#3F0E40] px-4 py-2.5 text-[12px] font-semibold text-white/90"><Hash className="h-3.5 w-3.5" /> sales-alerts</div>
                                    <ul className="space-y-3.5 p-4">
                                        {[
                                            { time: '10:42', text: 'started watching', meta: 'desktop · Pune' },
                                            { time: '10:45', text: 'watched it to the end', meta: '100% · rewatched Pricing' },
                                            { time: '10:45', text: 'clicked Book a call', meta: '' },
                                        ].map((alert, index) => (
                                            <li key={alert.text} className="mk-rise flex gap-2.5" style={{ '--d': index } as CSSProperties}>
                                                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#15120F] text-[11px] font-bold text-[#F6F4EF]">C</span>
                                                <p className="text-[13px] leading-[1.35rem] text-[#1D1C1D]"><span className="font-bold">Cliprame</span> <span className="text-[11px] text-[#1D1C1D]/45">{alert.time}</span><br /><span className="font-bold">Ana Lopez</span> <span className="text-[#1D1C1D]/60">(Acme)</span> {alert.text}{alert.meta && <><br /><span className="text-[11.5px] text-[#1D1C1D]/50">{alert.meta}</span></>}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Scripts */}
            <section aria-labelledby="scripts-title" className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
                <div className="mb-10 flex items-center gap-4"><span className={label}>02 — Scripts to borrow</span><span className="h-px flex-1 bg-[#15120F]/10" /></div>
                <div className="mb-10 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
                    <h2 id="scripts-title" className={`${D} text-4xl font-bold leading-[1.04] tracking-[-0.035em] sm:text-5xl`}>Four videos worth sending <span className={`${serif} text-[#5B3DF5]`}>this week.</span></h2>
                    <p className="text-[16px] leading-7 text-[#15120F]/62 lg:pt-3">Copy one, swap the {'{brackets}'}, and paste it into the teleprompter. Keep it under two minutes; the button under the video does the rest.</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                    {SCRIPTS.map((script) => (
                        <article key={script.title} className="flex flex-col rounded-2xl border border-[#15120F]/10 bg-white p-6">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className={`${D} text-xl font-bold tracking-tight`}>{script.title}</h3>
                                    <p className="mt-0.5 text-[13px] text-[#15120F]/50">{script.when}</p>
                                </div>
                                <button type="button" onClick={() => void copyScript(script.title, script.lines)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#15120F]/12 px-3 py-1.5 text-xs font-semibold transition hover:border-[#15120F]/30 ${focus}`}>
                                    {copied === script.title ? <><Check className="h-3.5 w-3.5 text-[#0E9F6E]" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                                </button>
                            </div>
                            <ol className="mt-5 flex-1 space-y-2.5 border-l-2 border-[#5B3DF5]/30 pl-4 text-[15px] leading-7 text-[#15120F]/80">
                                {script.lines.map((line) => <li key={line}>{line}</li>)}
                            </ol>
                            <p className="mt-5 border-t border-[#15120F]/[0.07] pt-4 text-[13px] text-[#15120F]/55">Button under the video: <span className={`${serif} text-base text-[#15120F]`}>“{script.cta}”</span></p>
                        </article>
                    ))}
                </div>
            </section>

            {/* Closing */}
            <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
                <div className="flex flex-col gap-8 rounded-2xl bg-[#15120F] px-7 py-14 text-[#F6F4EF] sm:px-14 lg:flex-row lg:items-end lg:justify-between">
                    <h2 className={`${D} max-w-2xl text-4xl font-bold leading-[1.04] tracking-[-0.04em] sm:text-5xl`}>Your turn. Record one <span className={`${serif} text-[#B6A6FF]`}>in two minutes.</span></h2>
                    <Link href={isLoggedIn ? '/studio' : '/signup'} className={`inline-flex w-fit items-center gap-2 rounded-xl bg-[#F6F4EF] px-5 py-3 text-[15px] font-semibold text-[#15120F] hover:bg-white ${focus}`}>
                        {isLoggedIn ? 'Open your studio' : 'Start free'} <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </section>

            {/* Video */}
            {playing && (
                <div role="dialog" aria-modal="true" aria-label={FLAGSHIP.title} className="fixed inset-0 z-50 flex items-center justify-center bg-[#15120F]/85 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setPlaying(false); }}>
                    <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-black">
                        <button type="button" onClick={() => setPlaying(false)} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white/80 hover:text-white"><X className="h-4 w-4" /></button>
                        <video src={FLAGSHIP.videoUrl} controls autoPlay playsInline className="aspect-video w-full" />
                    </div>
                </div>
            )}
        </>
    );
}

