import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, AudioLines, Clapperboard, Images, Layers3, Play, Video, WandSparkles } from 'lucide-react';

const features = [
  { icon: Clapperboard, title: 'Record your way', text: 'Use a teleprompter, choose your frame, and capture a polished take right in your browser.' },
  { icon: Images, title: 'Bring media together', text: 'Mix photos and video clips into a reel with titles, transitions, music, and narration.' },
  { icon: WandSparkles, title: 'Make every detail yours', text: 'Style captions, color, and overlays, then preview your edits before exporting.' },
];

const steps = [
  { number: '01', title: 'Start with an idea', text: 'Record a fresh take or bring the photos and clips you already have.' },
  { number: '02', title: 'Shape the story', text: 'Add a script, captions, designed text, music, transitions, or narration.' },
  { number: '03', title: 'Preview and export', text: 'Fine-tune the result, then download a video ready to share.' },
];

function Wordmark() {
  return <Link href="/" aria-label="Cliprame home" className="group inline-flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-white">
    <Image src="/cliprame-icon.svg" alt="" width={40} height={40} className="h-10 w-10 transition-transform duration-200 group-hover:scale-105" />
    <span className="text-lg">Cliprame</span>
  </Link>;
}

export default function HomePage() {
  return (
    <main className="min-h-dvh overflow-x-clip bg-[#080a12] text-white selection:bg-indigo-400/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(79,70,229,0.16),transparent_34%),radial-gradient(ellipse_at_85%_42%,rgba(56,189,248,0.09),transparent_32%)]" />
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#080a12]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-[76px] sm:px-8 lg:px-12">
          <Wordmark />
          <nav aria-label="Main navigation" className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.035] p-1 text-sm md:flex">
            <a href="#features" className="rounded-full px-4 py-2 text-neutral-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">Features</a>
            <a href="#how-it-works" className="rounded-full px-4 py-2 text-neutral-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">How it works</a>
            <a href="#use-cases" className="rounded-full px-4 py-2 text-neutral-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">Use cases</a>
            <Link href="/pricing" className="rounded-full px-4 py-2 text-neutral-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">Pricing</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link href="/login" className="rounded-full px-2.5 py-2 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 sm:px-4 sm:text-sm">Log in</Link>
            <Link href="/login?setup=1" className="rounded-full bg-linear-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80 sm:px-5 sm:text-sm">Try the studio <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link>
          </div>
        </div>
        <nav aria-label="Mobile main navigation" className="flex gap-1 overflow-x-auto border-t border-white/[0.05] px-4 pb-2.5 pt-2 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
          <a href="#features" className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-white/[0.07] hover:text-white">Features</a>
          <a href="#how-it-works" className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-white/[0.07] hover:text-white">How it works</a>
          <a href="#use-cases" className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-white/[0.07] hover:text-white">Use cases</a>
          <Link href="/pricing" className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-white/[0.07] hover:text-white">Pricing</Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pb-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-300">Cliprame workspace</div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">What are we creating today?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">Start with a recording or bring your photos and clips together into a reel.</p>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <Link href="/login?setup=1" className="group flex min-h-44 items-start gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 transition hover:border-indigo-500/60 hover:bg-neutral-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300"><Video className="h-6 w-6" /></span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-neutral-500">RECORD</span>
                <span className="mt-1 block text-lg font-semibold text-white">Record a video</span>
                <span className="mt-1 block text-sm leading-5 text-neutral-400">Camera, teleprompter, creative effects, and editing.</span>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-300">Open recording studio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </span>
            </Link>
            <Link href="/login?setup=1" className="group flex min-h-44 items-start gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 transition hover:border-fuchsia-500/60 hover:bg-neutral-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 sm:p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300"><Images className="h-6 w-6" /></span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-neutral-500">REELS</span>
                <span className="mt-1 block text-lg font-semibold text-white">Create a photo + video reel</span>
                <span className="mt-1 block text-sm leading-5 text-neutral-400">Combine clips and photos with text, music, and narration.</span>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-fuchsia-300">Start a reel <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </span>
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-neutral-800 pt-4 text-xs text-neutral-500"><span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Ready in your browser</span><span>Drafts stay on this device</span></div>
        </div>

        <div className="hidden">
          <div className="absolute -inset-10 rounded-[3rem] bg-indigo-500/10 blur-3xl" />
          <div className="relative rounded-4xl border border-white/10 bg-[#11141f]/90 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-4">
            <div className="flex items-center justify-between px-2 pb-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-400" /></div><span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">Your creative workspace</span><span className="w-9" /></div>
            <div className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#181b28] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300">A short story · 00:24</p><p className="mt-1 text-sm font-semibold text-white">A moment worth remembering</p></div><span className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-[10px] text-neutral-300">9:16</span></div>
              <div className="relative mx-auto flex aspect-9/10 max-h-90 items-end overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_32%,rgba(56,189,248,.6),transparent_26%),linear-gradient(160deg,#1e3a5f_0%,#101827_58%,#412d50_100%)] p-5">
                <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(155deg, transparent 25%, rgba(255,255,255,.12) 25.3%, transparent 25.8%), linear-gradient(25deg, transparent 59%, rgba(255,255,255,.14) 59.3%, transparent 59.8%)' }} />
                <div className="absolute left-[17%] top-[22%] h-20 w-20 rounded-full bg-sky-100/10 blur-2xl" /><div className="absolute right-[15%] top-[32%] h-16 w-16 rounded-full bg-indigo-300/20 blur-xl" />
                <div className="relative z-10 w-full rounded-xl border border-white/15 bg-black/35 p-4 backdrop-blur-md"><p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-200">A little recap</p><p className="mt-1.5 text-lg font-semibold leading-tight text-white">Collect the moments.<br />Keep the feeling.</p><div className="mt-3 flex items-center gap-2"><span className="h-1 flex-1 overflow-hidden rounded-full bg-white/15"><span className="block h-full w-2/3 rounded-full bg-indigo-300" /></span><span className="text-[9px] text-neutral-300">00:24</span></div></div>
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

      <section id="use-cases" className="relative z-10 mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12 lg:pb-24"><div className="mb-8 max-w-xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Made for all kinds of stories</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">One studio. Your kind of video.</h2><p className="mt-4 text-sm leading-7 text-neutral-400">From a quick social clip to a thoughtful explainer, start with the story you want to share.</p></div><div className="grid gap-4 md:grid-cols-3"><article className="rounded-2xl border border-white/8 bg-[#10131d] p-5"><p className="text-sm font-semibold">Social & personal</p><p className="mt-2 text-sm leading-6 text-neutral-400">Turn everyday moments, travel photos, and ideas into reels people will remember.</p></article><article className="rounded-2xl border border-white/8 bg-[#10131d] p-5"><p className="text-sm font-semibold">Business & brands</p><p className="mt-2 text-sm leading-6 text-neutral-400">Showcase a product, explain a service, or create a polished update for your audience.</p></article><article className="rounded-2xl border border-white/8 bg-[#10131d] p-5"><p className="text-sm font-semibold">Learning & explaining</p><p className="mt-2 text-sm leading-6 text-neutral-400">Break down a topic, share a presentation, or make a lesson easier to follow.</p></article></div><div className="mt-8 flex flex-col items-start justify-between gap-5 rounded-3xl border border-indigo-300/15 bg-[linear-gradient(120deg,rgba(79,70,229,.15),rgba(30,41,59,.65)_52%,rgba(14,165,233,.1))] p-6 sm:flex-row sm:items-center sm:p-8"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">Ready when you are</p><h3 className="mt-2 text-xl font-semibold">Bring your idea. We’ll help with the polish.</h3></div><Link href="/login?setup=1" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-indigo-100">Explore the studio <ArrowRight className="h-4 w-4" /></Link></div></section>

      <footer className="relative z-10 border-t border-white/[0.07]"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-neutral-500 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12"><Wordmark /><p>Record. Edit. Share your story.</p><div className="flex items-center gap-5"><Link href="/pricing" className="transition hover:text-white">Pricing</Link><Link href="/login" className="transition hover:text-white">Log in</Link><Link href="/login?setup=1" className="transition hover:text-white">Try the studio</Link></div></div></footer>
    </main>
  );
}
