'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { ArrowRight, Sparkles, Play, Clock, CheckCircle2, X } from 'lucide-react';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

const D = 'font-[family-name:var(--font-display)]';
const focus =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6FB]';

const css = `
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.rise{opacity:0;animation:rise .8s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--d,0)*90ms)}
.dots{background-image:radial-gradient(rgba(20,18,31,.1) 1px,transparent 1px);background-size:22px 22px;-webkit-mask-image:radial-gradient(ellipse at 50% 35%,#000 25%,transparent 70%);mask-image:radial-gradient(ellipse at 50% 35%,#000 25%,transparent 70%)}
`;

function Wordmark() {
    return (
        <Link href="/" aria-label="Cliprame home" className={`group inline-flex shrink-0 items-center gap-2.5 rounded-full font-semibold tracking-tight text-[#14121F] ${focus}`}>
            <Image src="/cliprame-icon.svg" alt="" width={36} height={36} className="h-9 w-9 transition-transform duration-200 group-hover:scale-105" />
            <span className={`${D} text-lg font-bold`}>Cliprame</span>
        </Link>
    );
}

const navLink = `rounded-full px-4 py-2 text-sm font-medium text-[#14121F]/65 transition-colors hover:bg-[#14121F]/[0.06] hover:text-[#14121F] ${focus}`;
const mobileNavLink = 'shrink-0 rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-medium text-[#14121F]/70 backdrop-blur transition-colors hover:text-[#14121F]';
const card = 'rounded-[2rem] border border-[#14121F]/10 bg-white shadow-[0_1px_0_rgba(20,18,31,0.04),0_24px_48px_-28px_rgba(20,18,31,0.28)]';
const gradientText = 'bg-gradient-to-r from-[#6A4CFF] via-[#9a4cff] to-[#FF3D81] bg-clip-text text-transparent';

const productDemos = [
    {
        title: 'SaaS Product Walkthrough',
        description: 'A 2-minute overview showing how to record software dashboards with a floating creator camera card.',
        duration: '2:14',
        badge: 'Flagship Demo',
        bgGradient: 'from-[#14121F] via-[#2c2742] to-[#3b2d8f]',
        videoUrl: 'https://pub-fa1d3ce0ee934e5fbbf83449e9efe21c.r2.dev/Demo/saas-product-walkthrough.mp4',
    },
    {
        title: 'Editing by Transcript',
        description: 'See how highlighting filler words in the transcript instantly cuts them out of the video timeline.',
        duration: '1:45',
        badge: 'Editor Highlight',
        bgGradient: 'from-[#6A4CFF] via-[#7d63ff] to-[#28C840]',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    },
    {
        title: 'Hidden Teleprompter in Action',
        description: 'Watch a creator read smoothly through a script while sharing their screen without ever looking away.',
        duration: '1:30',
        badge: 'Workflow',
        bgGradient: 'from-[#FF3D81] via-[#ff689d] to-[#6A4CFF]',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    },
    {
        title: 'Hand-Tracked Air Drawing',
        description: 'Circle buttons and highlight numbers in real time using hand gestures while talking through a feature.',
        duration: '1:15',
        badge: 'Interactive',
        bgGradient: 'from-[#14121F] via-[#3b2d8f] to-[#FF3D81]',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    },
    {
        title: 'Photo to Parallax Reel',
        description: 'Turn a static photo gallery into a high-impact, music-backed social reel with sci-fi transitions.',
        duration: '0:55',
        badge: 'Reels Studio',
        bgGradient: 'from-[#38BDF8] via-[#6A4CFF] to-[#FF3D81]',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    },
    {
        title: 'Multi-Language AI Dubbing',
        description: 'Generate translated captions and AI voiceovers in Hindi, Hinglish, and Spanish with a single click.',
        duration: '1:20',
        badge: 'AI Features',
        bgGradient: 'from-[#FFE347] via-[#ffaa33] to-[#FF3D81]',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    },
];

interface ClientProps {
    isLoggedIn: boolean;
    userPlan: string;
    displayName: string;
}

export default function DemoShowcaseClient({ isLoggedIn, userPlan, displayName }: ClientProps) {
    const [activeVideo, setActiveVideo] = useState<{ title: string; url: string } | null>(null);
    const initialLetter = displayName.charAt(0).toUpperCase();

    return (
        <main className={`${display.variable} ${body.variable} min-h-dvh overflow-x-clip bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F] selection:bg-[#6A4CFF]/20`}>
            <style dangerouslySetInnerHTML={{ __html: css }} />

            {/* Floating glass nav */}
            <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-full border border-white/70 bg-white/70 pl-4 pr-2 shadow-[0_10px_30px_-10px_rgba(20,18,31,0.18)] backdrop-blur-xl sm:h-16 sm:pl-5">
                    <Wordmark />
                    <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
                        <Link href="/" className={navLink}>Home</Link>
                        <span aria-current="page" className="rounded-full bg-[#14121F]/[0.08] px-4 py-2 text-sm font-semibold text-[#14121F]">Demos</span>
                        <Link href="/features" className={navLink}>Features</Link>
                        <Link href="/pricing" className={navLink}>Pricing</Link>
                    </nav>

                    <div className="flex shrink-0 items-center gap-2">
                        {isLoggedIn ? (
                            <>
                                {userPlan ? (
                                    <span className="rounded-full bg-[#6A4CFF]/10 px-4 py-1.5 text-xs font-bold text-[#6A4CFF]">
                                        {userPlan}
                                    </span>
                                ) : (
                                    <Link href="/pricing" className="inline-flex items-center gap-1 rounded-full border border-[#14121F]/10 bg-[#F7F6FB] px-3 py-1.5 text-xs font-semibold text-[#14121F]/70 transition hover:bg-[#14121F]/10">
                                        Free Tier · Upgrade
                                    </Link>
                                )}

                                <Link
                                    href="/studio"
                                    className={`inline-flex items-center gap-2 rounded-full border border-[#14121F]/10 bg-white py-1.5 pl-2 pr-4 text-sm font-semibold text-[#14121F] shadow-sm transition hover:border-[#6A4CFF]/40 hover:shadow-md ${focus}`}
                                >
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6A4CFF] text-xs font-bold text-white shadow-xs">
                                        {initialLetter}
                                    </span>
                                    <span className="max-w-[100px] truncate">{displayName}</span>
                                    <ArrowRight className="h-3.5 w-3.5 text-[#14121F]/40" />
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link href="/login" className={`rounded-full px-3 py-2 text-sm font-medium text-[#14121F]/75 transition-colors hover:text-[#14121F] sm:px-4 ${focus}`}>Log in</Link>
                                <Link href="/login?setup=1" className={`inline-flex items-center gap-1.5 rounded-full bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2c2742] sm:px-5 ${focus}`}>
                                    Try the studio <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </>
                        )}
                    </div>
                </div>
                <nav aria-label="Mobile main navigation" className="mx-auto mt-2 flex max-w-5xl gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
                    <Link href="/" className={mobileNavLink}>Home</Link>
                    <span className="shrink-0 rounded-full bg-[#14121F] px-3.5 py-1.5 text-xs font-medium text-white">Demos</span>
                    <Link href="/features" className={mobileNavLink}>Features</Link>
                    <Link href="/pricing" className={mobileNavLink}>Pricing</Link>
                </nav>
            </header>

            {/* Hero */}
            <section className="relative mx-auto max-w-5xl px-5 pb-16 pt-16 text-center sm:px-8">
                <div className="dots pointer-events-none absolute inset-x-0 top-0 -z-0 h-[400px]" aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6A4CFF]/10 px-3.5 py-1 text-xs font-semibold text-[#6A4CFF]">
                    <Sparkles className="h-3.5 w-3.5" /> Product Demo Library
                </span>
                <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">
                    Explore Product <span className={gradientText}>Walkthroughs</span>
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-base text-[#14121F]/65 sm:text-lg">
                    Browse our curated list of product demos and feature guides, recorded and edited entirely inside Cliprame. Click any card to watch the video.
                </p>
            </section>

            {/* Product Demos List Grid */}
            <section className="mx-auto max-w-6xl px-5 pb-28 sm:px-8">
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {productDemos.map((demo) => (
                        <div
                            key={demo.title}
                            onClick={() => setActiveVideo({ title: demo.title, url: demo.videoUrl })}
                            className={`${card} group flex cursor-pointer flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-20px_rgba(20,18,31,0.25)]`}
                        >
                            {/* Video Thumbnail Placeholder */}
                            <div className={`relative aspect-video w-full bg-gradient-to-br ${demo.bgGradient} p-4 flex flex-col justify-between overflow-hidden`}>
                                <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />

                                <div className="relative z-10 flex items-center justify-between">
                                    <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                                        {demo.badge}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                                        <Clock className="h-3 w-3" /> {demo.duration}
                                    </span>
                                </div>

                                <div className="relative z-10 flex justify-center py-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-white shadow-lg backdrop-blur-md transition-transform duration-300 group-hover:scale-110 group-hover:bg-white/30">
                                        <Play className="ml-0.5 h-6 w-6 fill-current" />
                                    </div>
                                </div>

                                <div className="relative z-10 text-[10px] font-medium text-white/70">
                                    Click to play demo
                                </div>
                            </div>

                            {/* Content Details */}
                            <div className="flex flex-1 flex-col justify-between p-6">
                                <div>
                                    <h3 className={`${D} text-xl font-bold tracking-tight text-[#14121F]`}>{demo.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-[#14121F]/65">{demo.description}</p>
                                </div>

                                <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[#6A4CFF]">
                                    <CheckCircle2 className="h-4 w-4" /> Built with Cliprame Studio
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Video Popup Modal */}
            {activeVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
                    <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-neutral-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
                            <h3 className="text-base font-bold text-white">{activeVideo.title}</h3>
                            <button
                                type="button"
                                onClick={() => setActiveVideo(null)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="relative aspect-video w-full bg-black">
                            <video
                                src={activeVideo.url}
                                controls
                                autoPlay
                                playsInline
                                className="h-full w-full object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="relative border-t border-[#14121F]/10">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[#14121F]/55 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
                    <Wordmark />
                    <p>Record. Edit. Share your story.</p>
                    <div className="flex items-center gap-5">
                        <Link href="/pricing" className="transition hover:text-[#14121F]">Pricing</Link>
                        {!isLoggedIn ? (
                            <Link href="/login" className="transition hover:text-[#14121F]">Log in</Link>
                        ) : null}
                        <Link href="/studio" className="transition hover:text-[#14121F]">Go to Studio</Link>
                    </div>
                </div>
            </footer>
        </main>
    );
}