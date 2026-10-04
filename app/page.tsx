import Link from 'next/link';
import { ArrowDown, ArrowRight, AudioLines, Check, Clapperboard, Images, Layers3, Play, Sparkles, WandSparkles } from 'lucide-react';

const features = [
    { icon: Clapperboard, title: 'Record with confidence', text: 'Read naturally from a teleprompter, choose your frame, and record right in your browser.' },
    { icon: Images, title: 'Turn photos into a reel', text: 'Mix photos and video clips, add titles, transitions, music, and narration.' },
    { icon: WandSparkles, title: 'Polish without the hassle', text: 'Style captions, color, and overlays, then preview every change before exporting.' },
];

const steps = [
    { number: '01', title: 'Choose your story', text: 'Start with a camera recording or bring your photos and clips.' },
    { number: '02', title: 'Make it yours', text: 'Add a script, captions, designed text, music, transitions, and a voiceover.' },
    { number: '03', title: 'Export and share', text: 'Preview the result and download a polished video ready to post or present.' },
];

function Wordmark() {
    return <Link href="/" className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-white"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-950/40"><Sparkles className="h-5 w-5" /></span><span>Creator<span className="text-indigo-300">Studio</span></span></Link>;
}

export default function HomePage() {
    return (
        <main className="min-h-dvh overflow-hidden bg-[#080a12] text-white selection:bg-indigo-400/30">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(79,70,229,0.16),transparent_34%),radial-gradient(ellipse_at_85%_42%,rgba(56,189,248,0.09),transparent_32%)]" />
            <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
                <Wordmark />
                <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm text-neutral-400 md:flex"><a href="#features" className="transition hover:text-white">Features</a><a href="#how-it-works" className="transition hover:text-white">How it works</a><a href="#for-teachers" className="transition hover:text-white">For educators</a></nav>
                <div className="flex items-center gap-2 sm:gap-3"><Link href="/login" className="rounded-xl px-3 py-2 text-sm font-medium text-neutral-300 transition hover:text-white sm:px-4">Log in</Link><Link href="/signup" className="rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-indigo-100 sm:px-5">Get started <span className="hidden sm:inline">free</span></Link></div>
            </header>

            <section className="relative z-10 mx-auto grid min-h-170 max-w-7xl items-center gap-14 px-5 pb-24 pt-14 sm:px-8 lg:grid-cols-[1.02fr_.98fr] lg:px-12 lg:pb-32 lg:pt-20">
                <div className="max-w-2xl">
                    <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/[0.07] px-3.5 py-2 text-xs font-medium text-indigo-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.7)]" />Your idea deserves a great video</div>
                    <h1 className="text-5xl font-semibold leading-[1.04] tracking-[-0.055em] text-white sm:text-6xl lg:text-[4.65rem]">Teach it. Tell it.<br /><span className="bg-linear-to-r from-indigo-300 via-sky-200 to-fuchsia-300 bg-clip-text text-transparent">Make it a reel.</span></h1>
                    <p className="mt-7 max-w-xl text-base leading-7 text-neutral-400 sm:text-lg sm:leading-8">A welcoming video studio for teachers, students, and creators. Record a clear lesson or turn your photos and clips into something people want to watch.</p>
                    <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-950/50 transition hover:bg-indigo-400">Create your free account <ArrowRight className="h-4 w-4" /></Link><a href="#how-it-works" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/3 px-6 py-3.5 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/6">See how it works <ArrowDown className="h-4 w-4" /></a></div>
                    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-500"><span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />Start free</span><span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />No editing experience needed</span><span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />Create in your browser</span></div>
                </div>

                <div className="relative mx-auto w-full max-w-135 lg:ml-auto">
                    <div className="absolute -inset-10 rounded-[3rem] bg-indigo-500/10 blur-3xl" />
                    <div className="relative rounded-4xl border border-white/10 bg-[#11141f]/90 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-4">
                        <div className="flex items-center justify-between px-2 pb-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-400" /></div><span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">Your creative workspace</span><span className="w-9" /></div>
                        <div className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#181b28] p-4 sm:p-5">
                            <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300">Quick lesson · 00:24</p><p className="mt-1 text-sm font-semibold text-white">The water cycle, simply</p></div><span className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-[10px] text-neutral-300">9:16</span></div>
                            <div className="relative mx-auto flex aspect-9/10 max-h-90 items-end overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_32%,rgba(56,189,248,.6),transparent_26%),linear-gradient(160deg,#1e3a5f_0%,#101827_58%,#412d50_100%)] p-5">
                                <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(155deg, transparent 25%, rgba(255,255,255,.12) 25.3%, transparent 25.8%), linear-gradient(25deg, transparent 59%, rgba(255,255,255,.14) 59.3%, transparent 59.8%)' }} />
                                <div className="absolute left-[17%] top-[22%] h-20 w-20 rounded-full bg-sky-100/10 blur-2xl" /><div className="absolute right-[15%] top-[32%] h-16 w-16 rounded-full bg-indigo-300/20 blur-xl" />
                                <div className="relative z-10 w-full rounded-xl border border-white/15 bg-black/35 p-4 backdrop-blur-md"><p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-200">Science · chapter 04</p><p className="mt-1.5 text-lg font-semibold leading-tight text-white">Water is always<br />on the move.</p><div className="mt-3 flex items-center gap-2"><span className="h-1 flex-1 overflow-hidden rounded-full bg-white/15"><span className="block h-full w-2/3 rounded-full bg-indigo-300" /></span><span className="text-[9px] text-neutral-300">00:24</span></div></div>
                                <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-2.5 py-1.5 text-[9px] text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />REC</div>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-200"><AudioLines className="h-4 w-4" /></span><div><p className="text-[10px] font-medium text-white">Captions ready</p><p className="text-[9px] text-neutral-500">Clear, readable, on time</p></div></div><button aria-label="Preview example video" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-950 shadow-lg"><Play className="ml-0.5 h-4 w-4 fill-current" /></button></div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/8 bg-white/3 p-3"><Images className="h-4 w-4 text-fuchsia-300" /><p className="mt-2 text-[10px] font-medium text-neutral-200">Photo reel</p></div><div className="rounded-xl border border-white/8 bg-white/3 p-3"><AudioLines className="h-4 w-4 text-sky-300" /><p className="mt-2 text-[10px] font-medium text-neutral-200">Voice + music</p></div><div className="rounded-xl border border-white/8 bg-white/3 p-3"><Layers3 className="h-4 w-4 text-indigo-300" /><p className="mt-2 text-[10px] font-medium text-neutral-200">Text + style</p></div></div>
                    </div>
                </div>
            </section>

            <section id="features" className="relative z-10 border-y border-white/[0.07] bg-white/[0.018]">
                <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-24"><div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Everything in one place</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Less fiddling with tools.<br />More time for your story.</h2><p className="mt-4 text-sm leading-7 text-neutral-400">From first take to final export, keep your creative flow simple and focused.</p></div><div className="mt-10 grid gap-4 md:grid-cols-3">{features.map(({ icon: Icon, title, text }, index) => <article key={title} className="rounded-2xl border border-white/8 bg-[#10131d] p-6 transition hover:-translate-y-1 hover:border-indigo-400/25"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${index === 1 ? 'bg-fuchsia-400/10 text-fuchsia-300' : 'bg-indigo-400/10 text-indigo-300'}`}><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-neutral-400">{text}</p></article>)}</div></div>
            </section>

            <section id="how-it-works" className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-24"><div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">A simple creative flow</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From idea to<br />ready-to-share.</h2><p className="mt-4 max-w-sm text-sm leading-7 text-neutral-400">No complicated timeline to learn. Start with what you have and build from there.</p></div><div className="grid gap-3 sm:grid-cols-3">{steps.map((step) => <article key={step.number} className="rounded-2xl border border-white/8 bg-white/2.5 p-5"><p className="font-mono text-xs text-indigo-300">{step.number}</p><h3 className="mt-6 text-base font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-neutral-400">{step.text}</p></article>)}</div></div></section>

            <section id="for-teachers" className="relative z-10 mx-5 mb-20 overflow-hidden rounded-4xl border border-indigo-300/15 bg-[linear-gradient(120deg,rgba(79,70,229,.15),rgba(30,41,59,.65)_52%,rgba(14,165,233,.1))] px-6 py-12 sm:mx-8 sm:px-10 lg:mx-auto lg:mb-24 lg:max-w-7xl lg:px-14 lg:py-16"><div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" /><div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">Made for explaining things</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A more human way to teach on screen.</h2><p className="mt-4 text-sm leading-7 text-neutral-300">Create mini-lessons, revision explainers, project presentations, and classroom updates with tools designed to keep the focus on your message.</p></div><Link href="/signup" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-neutral-950 transition hover:bg-indigo-100">Start creating <ArrowRight className="h-4 w-4" /></Link></div></section>

            <footer className="relative z-10 border-t border-white/[0.07]"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-neutral-500 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12"><Wordmark /><p>Make a lesson. Make a reel. Make it yours.</p><div className="flex items-center gap-5"><Link href="/login" className="transition hover:text-white">Log in</Link><Link href="/signup" className="transition hover:text-white">Sign up</Link></div></div></footer>
        </main>
    );
}
