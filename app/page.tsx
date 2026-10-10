import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { ArrowRight, Check, Eraser, EyeOff, Film, Hand, Languages, Layers, Mic, Pencil, Plus, Scissors, ScreenShare, Sparkles, Type } from 'lucide-react';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

/* ---------- Palette ----------
   ink     #14121F   text, dark surfaces
   paper   #F7F6FB   page background
   violet  #6A4CFF   primary accent
   pink    #FF3D81   secondary accent / playhead / REC
   yellow  #FFE347   highlight (captions, selections)
*/

const D = 'font-[family-name:var(--font-display)]';
const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6FB]';

const prompterLines = [
  'Hi everyone, welcome to the demo',
  'This is where your team sees',
  'every campaign in one place',
  'Let me show you how it works',
];
const languages = ['English', 'हिन्दी', 'Hinglish', 'বাংলা', 'मराठी', 'தமிழ்', 'తెలుగు'];
const marqueeItems = ['Product demos', 'Tutorials', 'Course lessons', 'Pitch walkthroughs', 'Travel reels', 'Release notes', 'Customer onboarding', 'Explainers'];

const demoPoints = [
  { title: 'A floating camera card', text: 'Your face stays on screen while you walk through the product, so viewers connect with you, not just your cursor.' },
  { title: 'A teleprompter only you can see', text: 'Read your script right on the shared screen. It never shows up in the recording.' },
  { title: 'Showcase frames', text: 'Wrap your screen in a browser window, a macOS window or a minimal card, on Aurora, Sunset, Midnight or Paper backgrounds.' },
  { title: 'Point with your finger', text: 'Circle a button or underline a number by drawing in the air while you talk.' },
];

const frames = [
  { name: 'Browser', bg: 'bg-[linear-gradient(135deg,#c7d2fe,#fbcfe8)]', bar: true },
  { name: 'macOS', bg: 'bg-[linear-gradient(135deg,#ffb86b,#ff6a8b)]', bar: true },
  { name: 'Minimal', bg: 'bg-[linear-gradient(135deg,#14121F,#3b2d8f)]', bar: false },
];

const editPoints = [
  'Click any word to jump to that moment',
  'Select a phrase and delete it. The video closes the gap',
  'Mark in and out on the timeline to cut a section',
  'Trim and split, and restore anything you removed',
];

const gestures = [
  { icon: '☝️', label: 'Point to draw' },
  { icon: '🤏', label: 'Pinch to write' },
  { icon: '✌️', label: 'Two fingers to erase' },
  { icon: '✊', label: 'Fist to undo' },
  { icon: '🖐', label: 'Open palm to clear' },
];

const features = [
  { icon: Type, color: 'bg-[#6A4CFF]', title: 'Captions that follow your voice', text: 'Word-by-word highlighting in English, Hindi and Hinglish, in sync with your speech.' },
  { icon: Languages, color: 'bg-[#FF3D81]', title: 'AI scripts and dubbing', text: 'Type a topic, get a script in seven languages, and add an AI voiceover when you need one.' },
  { icon: Layers, color: 'bg-[#14121F]', title: 'Backgrounds in one tap', text: 'Blur, green screen, clean cutout or your own image, without a green wall behind you.' },
  { icon: Sparkles, color: 'bg-[#6A4CFF]', title: 'Hologram and cartoon looks', text: 'Turn yourself into a glowing hologram, a comic, a pencil sketch or an anime avatar.' },
  { icon: Film, color: 'bg-[#FF3D81]', title: 'Sci-fi transitions', text: 'Particle dissolve, portal and warp transitions between the parts of your video.' },
  { icon: Mic, color: 'bg-[#14121F]', title: 'Photo and clip reels', text: 'Mix photos and clips with music and narration, using templates for travel, birthdays and products.' },
];

const steps = [
  { n: '01', color: 'text-[#6A4CFF]', title: 'Record or upload', text: 'Record your screen and camera in one take, or bring a video you already have.' },
  { n: '02', color: 'text-[#FF3D81]', title: 'Edit by reading', text: 'Delete words from the transcript, trim the ends, add captions, music and zooms.' },
  { n: '03', color: 'text-[#14121F]', title: 'Export and share', text: 'Download a finished video, sized for reels, YouTube or the web.' },
];

const useCases = [
  { rule: 'border-[#6A4CFF]', title: 'Product teams & founders', text: 'Record a clean demo, release walkthrough or customer onboarding video without a video editor.' },
  { rule: 'border-[#FF3D81]', title: 'Teachers & creators', text: 'Explain a topic on camera, show your screen mid-take, and cut the stumbles by deleting words.' },
  { rule: 'border-[#14121F]', title: 'Social & travel stories', text: 'Turn photos, clips and ideas into captioned reels in your own language.' },
];

const faqs = [
  { q: 'Do I need to install anything?', a: 'No. Cliprame runs in your browser, so you can record, edit and export from one tab.' },
  { q: 'Will viewers see my teleprompter?', a: 'No. The teleprompter is only on your screen while you record, and it is not part of the video.' },
  { q: 'How does editing by transcript work?', a: 'Your video is transcribed word by word. Select words in the transcript and delete them, and that part of the video is cut. Anything you remove can be restored.' },
  { q: 'Where are my videos stored?', a: 'Recordings and drafts stay on your device. Audio is only sent for processing when you ask for captions, a transcript or AI features.' },
  { q: 'Is it free?', a: 'You can start for free. See the pricing page for plan details.' },
];

const css = `
.cap{display:inline-block;padding:.02em .22em;border-radius:.3em}
@keyframes prompter{to{transform:translateY(-50%)}}
.prompter{animation:prompter 16s linear infinite}
.prompter-mask{-webkit-mask-image:linear-gradient(transparent,#000 28%,#000 72%,transparent);mask-image:linear-gradient(transparent,#000 28%,#000 72%,transparent)}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.rise{opacity:0;animation:rise .8s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--d,0)*90ms)}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.floaty{animation:floaty 6s ease-in-out infinite;animation-delay:calc(var(--i,0)*-1.5s)}
@keyframes marquee{to{transform:translateX(-50%)}}
.marquee{animation:marquee 34s linear infinite}
.marquee-mask{-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
@keyframes draw{0%{stroke-dashoffset:1}35%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:1}}
.draw{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 6s ease-in-out infinite;animation-delay:calc(var(--i,0)*.5s)}
@keyframes pulseSel{0%,100%{background:rgba(106,76,255,.18)}50%{background:rgba(106,76,255,.32)}}
.sel{animation:pulseSel 2.4s ease-in-out infinite}
.dots{background-image:radial-gradient(rgba(20,18,31,.1) 1px,transparent 1px);background-size:22px 22px;-webkit-mask-image:radial-gradient(ellipse at 50% 35%,#000 25%,transparent 70%);mask-image:radial-gradient(ellipse at 50% 35%,#000 25%,transparent 70%)}
details summary::-webkit-details-marker{display:none}
@media (prefers-reduced-motion:reduce){.prompter,.floaty,.marquee,.sel{animation:none}.draw{animation:none;stroke-dashoffset:0}.rise{animation:none;opacity:1}}
`;

function Wordmark() {
  return (
    <Link href="/" aria-label="Cliprame home" className={`group inline-flex shrink-0 items-center gap-2.5 rounded-full font-semibold tracking-tight text-[#14121F] ${focus}`}>
      <Image src="/cliprame-icon.svg" alt="" width={36} height={36} className="h-9 w-9 transition-transform duration-200 group-hover:scale-105" />
      <span className={`${D} text-lg font-bold`}>Cliprame</span>
    </Link>
  );
}

function Eyebrow({ children, tone = 'violet' }: { children: React.ReactNode; tone?: 'violet' | 'pink' | 'light' }) {
  const styles = {
    violet: 'bg-[#6A4CFF]/10 text-[#6A4CFF]',
    pink: 'bg-[#FF3D81]/10 text-[#FF3D81]',
    light: 'bg-white/10 text-white/80',
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>{children}</span>;
}

const navLink = `rounded-full px-4 py-2 text-sm font-medium text-[#14121F]/65 transition-colors hover:bg-[#14121F]/[0.06] hover:text-[#14121F] ${focus}`;
const mobileNavLink = 'shrink-0 rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-medium text-[#14121F]/70 backdrop-blur transition-colors hover:text-[#14121F]';
const h2 = `${D} text-4xl font-bold leading-[1.02] tracking-[-0.03em] text-[#14121F] sm:text-5xl lg:text-6xl`;
const card = 'rounded-[2rem] border border-[#14121F]/10 bg-white shadow-[0_1px_0_rgba(20,18,31,0.04),0_24px_48px_-28px_rgba(20,18,31,0.28)]';
const gradientText = 'bg-gradient-to-r from-[#6A4CFF] via-[#9a4cff] to-[#FF3D81] bg-clip-text text-transparent';

export default function HomePage() {
  return (
    <main className={`${display.variable} ${body.variable} min-h-dvh overflow-x-clip bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F] selection:bg-[#6A4CFF]/20`}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Floating glass nav */}
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-full border border-white/70 bg-white/70 pl-4 pr-2 shadow-[0_10px_30px_-10px_rgba(20,18,31,0.18)] backdrop-blur-xl sm:h-16 sm:pl-5">
          <Wordmark />
          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            <a href="#demos" className={navLink}>Demos</a>
            <a href="#edit" className={navLink}>Edit by text</a>
            <a href="#features" className={navLink}>Features</a>
            <Link href="/pricing" className={navLink}>Pricing</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <Link href="/login" className={`rounded-full px-3 py-2 text-sm font-medium text-[#14121F]/75 transition-colors hover:text-[#14121F] sm:px-4 ${focus}`}>Log in</Link>
            <Link href="/login?setup=1" className={`inline-flex items-center gap-1.5 rounded-full bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2c2742] sm:px-5 ${focus}`}>
              Try the studio <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <nav aria-label="Mobile main navigation" className="mx-auto mt-2 flex max-w-5xl gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
          <a href="#demos" className={mobileNavLink}>Demos</a>
          <a href="#edit" className={mobileNavLink}>Edit by text</a>
          <a href="#features" className={mobileNavLink}>Features</a>
          <Link href="/pricing" className={mobileNavLink}>Pricing</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.02fr_.98fr] lg:gap-8 lg:px-12 lg:pb-24 lg:pt-14">
        <div className="dots pointer-events-none absolute inset-x-0 top-0 -z-0 h-[640px]" aria-hidden="true" />
        <div className="relative">
          <div className="rise" style={{ '--d': 0 } as CSSProperties}>
            <Eyebrow><Sparkles className="h-3.5 w-3.5" /> New: edit your video by deleting words</Eyebrow>
          </div>
          <h1 className={`rise mt-5 ${D} text-[2.6rem] font-extrabold leading-[0.96] tracking-[-0.04em] sm:text-6xl lg:text-[4.6rem]`} style={{ '--d': 1 } as CSSProperties}>
            Record the demo.
            <br />
            Edit it <span className={gradientText}>like a doc.</span>
          </h1>
          <p className="rise mt-5 max-w-xl text-base leading-7 text-[#14121F]/65 sm:text-lg sm:leading-8" style={{ '--d': 2 } as CSSProperties}>
            Share your screen with your face in a floating card, read from a teleprompter only you can see, then fix mistakes by deleting words from the transcript. All in one browser tab.
          </p>
          <div className="rise mt-7 flex flex-wrap items-center gap-3" style={{ '--d': 3 } as CSSProperties}>
            <Link href="/login?setup=1" className={`group inline-flex items-center gap-2 rounded-full bg-[#14121F] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_14px_34px_-10px_rgba(20,18,31,0.55)] transition hover:-translate-y-0.5 hover:bg-[#2c2742] ${focus}`}>
              Try the studio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#demos" className={`inline-flex items-center rounded-full border border-[#14121F]/15 bg-white/70 px-6 py-3.5 text-sm font-semibold text-[#14121F] backdrop-blur transition hover:bg-white ${focus}`}>
              See it in action
            </a>
          </div>
          <p className="rise mt-4 text-xs text-[#14121F]/55" style={{ '--d': 4 } as CSSProperties}>Free to start · No install · Drafts stay on your device</p>

          <ul className="rise mt-8 grid max-w-xl gap-2.5 sm:grid-cols-3" style={{ '--d': 5 } as CSSProperties}>
            {[
              { icon: ScreenShare, label: 'Screen + camera in one take' },
              { icon: EyeOff, label: 'Private teleprompter' },
              { icon: Scissors, label: 'Cut video by cutting text' },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-2.5 rounded-2xl border border-[#14121F]/10 bg-white/80 px-3.5 py-3 text-xs font-semibold text-[#14121F]/80 backdrop-blur">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#6A4CFF]/10 text-[#6A4CFF]"><item.icon className="h-3.5 w-3.5" /></span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Product moment */}
        <div className="rise relative mx-auto w-full max-w-[600px] pb-12 pt-4" style={{ '--d': 3 } as CSSProperties}>
          <div className="absolute -left-10 top-6 h-56 w-56 rounded-full bg-[#6A4CFF]/25 blur-3xl" />
          <div className="absolute -right-6 bottom-10 h-56 w-56 rounded-full bg-[#FF3D81]/20 blur-3xl" />

          <div className="relative rounded-[1.6rem] border border-[#14121F]/10 bg-white p-2 shadow-[0_40px_80px_-30px_rgba(20,18,31,0.4)]">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              <span className="mx-auto rounded-full bg-[#14121F]/[0.05] px-4 py-1 text-[10px] font-medium text-[#14121F]/50">yourproduct.com/dashboard</span>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#F7F6FB]">
              {/* fake dashboard */}
              <div className="absolute inset-y-0 left-0 w-[15%] space-y-2 border-r border-[#14121F]/5 bg-white p-2.5">
                <span className="block h-2 w-3/4 rounded bg-[#6A4CFF]" />
                <span className="block h-2 w-full rounded bg-[#14121F]/10" />
                <span className="block h-2 w-2/3 rounded bg-[#14121F]/10" />
                <span className="block h-2 w-5/6 rounded bg-[#14121F]/10" />
              </div>
              <div className="absolute inset-y-0 left-[15%] right-0 p-[3%]">
                <div className="flex h-[22%] gap-2">
                  {['#6A4CFF', '#FF3D81', '#14121F'].map((c) => (
                    <div key={c} className="flex-1 rounded-xl border border-[#14121F]/5 bg-white p-2">
                      <span className="block h-1.5 w-1/2 rounded bg-[#14121F]/15" />
                      <span className="mt-2 block h-3 w-3/4 rounded" style={{ background: c }} />
                    </div>
                  ))}
                </div>
                <div className="mt-[4%] flex h-[56%] items-end gap-[3%] rounded-xl border border-[#14121F]/5 bg-white p-[3%]">
                  {[40, 65, 50, 80, 62, 90, 74, 98].map((h, i) => (
                    <span key={i} className="flex-1 rounded-t-md bg-[linear-gradient(180deg,#6A4CFF,#a995ff)]" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#14121F]/80 px-2.5 py-1 text-[10px] font-semibold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF3D81]" />REC 02:14
              </span>
              {/* hand-drawn annotation */}
              <svg viewBox="0 0 400 250" className="pointer-events-none absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
                <ellipse className="draw" pathLength={1} cx="230" cy="40" rx="64" ry="33" stroke="#FF3D81" strokeWidth="4" strokeLinecap="round" />
                <path className="draw" pathLength={1} style={{ '--i': 1 } as CSSProperties} d="M318 118 C 296 108, 280 92, 268 76 M268 76 L 281 80 M268 76 L 270 90" stroke="#FF3D81" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* PIP camera card */}
          <div className="floaty absolute -bottom-2 -right-2 w-[32%] sm:-right-6" style={{ '--i': 1 } as CSSProperties}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#ffb86b,#ff6a8b_55%,#6A4CFF)] shadow-[0_20px_40px_-12px_rgba(20,18,31,0.45)] ring-4 ring-white">
              <span className="absolute left-1/2 top-[20%] h-[36%] w-[27%] -translate-x-1/2 rounded-full bg-[#FFE9A8]" />
              <span className="absolute -bottom-[20%] left-1/2 h-[54%] w-[74%] -translate-x-1/2 rounded-[50%] bg-[#2a1a5e]" />
              <span className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-bold text-white">YOU</span>
            </div>
          </div>

          {/* Private teleprompter */}
          <div className="floaty absolute -left-3 top-20 hidden w-48 sm:block lg:-left-12" style={{ '--i': 0 } as CSSProperties}>
            <div className="rounded-2xl bg-[#14121F]/90 p-3 text-white shadow-[0_24px_48px_-14px_rgba(20,18,31,0.5)] backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between text-[10px] font-semibold text-white/60">
                <span>Teleprompter</span>
                <span className="inline-flex items-center gap-1 text-[#FFE347]"><EyeOff className="h-2.5 w-2.5" />Only you</span>
              </div>
              <div className="prompter-mask h-[72px] overflow-hidden">
                <div className="prompter text-[12px] font-medium leading-4">
                  {[...prompterLines, ...prompterLines].map((line, i) => (
                    <p key={i} className="pb-1">{line}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Transcript chip */}
          <div className="floaty absolute -bottom-6 left-2 hidden sm:block sm:left-6" style={{ '--i': 2 } as CSSProperties}>
            <div className="rounded-2xl border border-[#14121F]/10 bg-white px-3.5 py-3 text-[12px] font-medium shadow-[0_20px_40px_-14px_rgba(20,18,31,0.3)]">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#14121F]/50">Transcript</p>
              <p>
                So <span className="rounded bg-red-50 px-1 text-red-500 line-through">um</span>{' '}
                <span className="sel rounded px-1">this is</span> the dashboard
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <section aria-label="What people make with Cliprame" className="relative border-y border-[#14121F]/10 bg-white/60 py-5 backdrop-blur">
        <div className="marquee-mask overflow-hidden">
          <ul className="marquee flex w-max gap-3">
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <li key={i} className="flex items-center gap-3 whitespace-nowrap rounded-full border border-[#14121F]/10 bg-white px-5 py-2 text-sm font-semibold text-[#14121F]/75">
                <span className="h-1.5 w-1.5 rounded-full bg-[#6A4CFF]" />{item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Demos */}
      <section id="demos" className="relative mx-auto max-w-7xl scroll-mt-28 px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <div className="grid items-center gap-14 lg:grid-cols-[.95fr_1.05fr]">
          <div>
            <Eyebrow><ScreenShare className="h-3.5 w-3.5" /> Product demos & explainers</Eyebrow>
            <h2 className={`${h2} mt-5`}>Your screen. Your face. Your script, <span className={gradientText}>privately.</span></h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#14121F]/65">Record walkthroughs that feel personal and look polished, without juggling a recorder, a teleprompter app and an editor.</p>
            <ul className="mt-8 space-y-5">
              {demoPoints.map((p) => (
                <li key={p.title} className="flex gap-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6A4CFF] text-white"><Check className="h-3.5 w-3.5" /></span>
                  <div>
                    <h3 className={`${D} text-lg font-bold tracking-tight`}>{p.title}</h3>
                    <p className="mt-1 text-[15px] leading-7 text-[#14121F]/65">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${card} relative p-5 sm:p-7`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#14121F]/60">Showcase frames</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {frames.map((f) => (
                <div key={f.name} className="text-center">
                  <div className={`relative aspect-[3/4] overflow-hidden rounded-2xl ${f.bg} p-2.5`}>
                    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-lg">
                      {f.bar && (
                        <div className="flex items-center gap-1 border-b border-[#14121F]/5 px-1.5 py-1.5">
                          <span className="h-1 w-1 rounded-full bg-[#FF5F57]" /><span className="h-1 w-1 rounded-full bg-[#FEBC2E]" /><span className="h-1 w-1 rounded-full bg-[#28C840]" />
                        </div>
                      )}
                      <div className="flex-1 space-y-1.5 p-2">
                        <span className="block h-1.5 w-1/2 rounded bg-[#14121F]/70" />
                        <span className="block h-1 w-full rounded bg-[#14121F]/10" />
                        <span className="block h-1 w-4/5 rounded bg-[#14121F]/10" />
                        <span className="block h-8 w-full rounded bg-[linear-gradient(120deg,#e0e7ff,#fce7f3)]" />
                      </div>
                    </div>
                  </div>
                  <span className="mt-2 block text-xs font-semibold text-[#14121F]/70">{f.name}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#F7F6FB] p-3.5">
              <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(135deg,#c7d2fe,#fbcfe8)]">
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-[linear-gradient(160deg,#ffb86b,#FF3D81)] ring-2 ring-white" />
              </span>
              <p className="text-[13px] leading-5 text-[#14121F]/70"><strong className="font-semibold text-[#14121F]">Floating camera card</strong> sits on top of any frame, so you are always part of the demo.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Edit by text */}
      <section id="edit" className="relative mx-auto max-w-7xl scroll-mt-28 px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
          <div className={`${card} order-2 p-5 sm:p-7 lg:order-1`}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#14121F]/60">Script</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"><Scissors className="h-3.5 w-3.5" /> Delete selected</span>
            </div>
            <p className="mt-4 text-[17px] leading-9 text-[#14121F]">
              Welcome back everyone,{' '}
              <span className="rounded bg-red-50 px-1 text-red-500 line-through">so um basically like</span>{' '}
              today I want to show you how{' '}
              <span className="rounded bg-[#FFE347] px-1">our dashboard</span>{' '}
              tracks every campaign.{' '}
              <span className="sel rounded px-1">Sorry, let me start that sentence again.</span>{' '}
              It brings all your reports into one place.
            </p>

            <div className="mt-6">
              <div className="relative h-10 overflow-hidden rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB]">
                <span className="absolute inset-y-0 left-0 w-[22%] bg-[#6A4CFF]/15" />
                <span className="absolute inset-y-0 left-[22%] w-[14%] border-x border-red-500 bg-red-500/25 [background-image:repeating-linear-gradient(45deg,transparent_0_4px,rgba(239,68,68,.35)_4px_8px)]" />
                <span className="absolute inset-y-0 left-[36%] w-[24%] bg-[#6A4CFF]/15" />
                <span className="absolute inset-y-0 left-[60%] w-[18%] border-x border-red-500 bg-red-500/25 [background-image:repeating-linear-gradient(45deg,transparent_0_4px,rgba(239,68,68,.35)_4px_8px)]" />
                <span className="absolute inset-y-0 left-[78%] right-0 bg-[#6A4CFF]/15" />
                <span className="absolute inset-y-1 left-[48%] w-0.5 rounded bg-[#FF3D81]" />
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-semibold text-[#14121F]/50">
                <span>0:00</span><span className="text-red-500">Removed parts are hatched. Tap to restore</span><span>2:48</span>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <Eyebrow tone="pink"><Scissors className="h-3.5 w-3.5" /> Edit by text</Eyebrow>
            <h2 className={`${h2} mt-5`}>Fix the take by deleting the words.</h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#14121F]/65">Your recording is transcribed word by word. Stumbled on a sentence? Select it, delete it, and the video closes the gap. No timeline hunting.</p>
            <ul className="mt-8 space-y-3.5">
              {editPoints.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[15px] leading-6 text-[#14121F]/80">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF3D81] text-white"><Check className="h-3 w-3" /></span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Air drawing */}
      <section className="relative mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[#14121F] p-7 text-white sm:p-12">
          <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#6A4CFF]/45 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-[#FF3D81]/30 blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Eyebrow tone="light"><Hand className="h-3.5 w-3.5" /> Hand-tracked drawing</Eyebrow>
              <h2 className={`${D} mt-5 text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl`}>Draw, write and erase with just your hand.</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-white/70">Circle a button, underline a number or write a note on your shared screen. Rough circles, boxes and lines snap into clean shapes, and everything is part of your recording.</p>
              <ul className="mt-7 flex flex-wrap gap-2">
                {gestures.map((g) => (
                  <li key={g.label} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white/90">
                    <span aria-hidden="true">{g.icon}</span>{g.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative aspect-[16/11] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-4">
              <div className="h-full rounded-2xl bg-white p-4">
                <span className="block h-3 w-1/3 rounded bg-[#14121F]/80" />
                <span className="mt-3 block h-2 w-full rounded bg-[#14121F]/10" />
                <span className="mt-2 block h-2 w-5/6 rounded bg-[#14121F]/10" />
                <span className="mt-4 block h-[42%] w-full rounded-xl bg-[linear-gradient(120deg,#e0e7ff,#fce7f3)]" />
              </div>
              <svg viewBox="0 0 400 275" className="pointer-events-none absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]" fill="none" aria-hidden="true">
                <rect className="draw" pathLength={1} x="40" y="150" width="150" height="76" rx="6" stroke="#22d3ee" strokeWidth="4" strokeLinejoin="round" />
                <ellipse className="draw" pathLength={1} style={{ '--i': 1 } as CSSProperties} cx="290" cy="60" rx="60" ry="30" stroke="#FF3D81" strokeWidth="4" />
                <path className="draw" pathLength={1} style={{ '--i': 2 } as CSSProperties} d="M70 60 Q 100 30, 130 62 T 190 58" stroke="#FFE347" strokeWidth="5" strokeLinecap="round" />
              </svg>
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-[#14121F]/85 px-3 py-1.5 text-[10px] font-semibold text-white">
                <Pencil className="h-3 w-3" /> Snapped to shapes <Eraser className="ml-1 h-3 w-3" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section id="features" className="relative mx-auto max-w-7xl scroll-mt-28 px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        <div className="max-w-3xl">
          <h2 className={h2}>Everything around the take, already built in.</h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#14121F]/65">Captions, scripts, backgrounds and effects live in the same studio, so you stay in the flow.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className={`${card} group p-6 transition hover:-translate-y-1 sm:p-7`}>
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white ${f.color}`}><f.icon className="h-5 w-5" /></span>
              <h3 className={`${D} mt-5 text-xl font-bold leading-tight tracking-tight`}>{f.title}</h3>
              <p className="mt-2.5 text-[15px] leading-7 text-[#14121F]/65">{f.text}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium text-[#14121F]/70">AI script writing in</span>
          {languages.map((l) => (
            <span key={l} className="rounded-full border border-[#14121F]/10 bg-white px-3 py-1 text-xs font-medium text-[#14121F]/80">{l}</span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative mx-auto max-w-7xl scroll-mt-28 px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <h2 className={h2}>From first take to shareable video.</h2>
            <p className="mt-5 max-w-sm text-base leading-7 text-[#14121F]/65">Three steps, no complicated timeline to learn.</p>
          </div>
          <ol className="divide-y divide-[#14121F]/10 border-y border-[#14121F]/10">
            {steps.map((s) => (
              <li key={s.n} className="grid grid-cols-[auto_1fr] items-baseline gap-6 py-7 sm:gap-10 sm:py-9">
                <span className={`${D} text-5xl font-extrabold tracking-tight sm:text-7xl ${s.color}`}>{s.n}</span>
                <div>
                  <h3 className={`${D} text-xl font-bold tracking-tight sm:text-2xl`}>{s.title}</h3>
                  <p className="mt-2 max-w-md text-[15px] leading-7 text-[#14121F]/65">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="relative mx-auto max-w-7xl scroll-mt-28 px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        <div className="max-w-2xl">
          <h2 className={h2}>Made for people who explain things.</h2>
        </div>
        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {useCases.map((u) => (
            <article key={u.title} className={`border-t-2 pt-6 ${u.rule}`}>
              <h3 className={`${D} text-2xl font-bold tracking-tight`}>{u.title}</h3>
              <p className="mt-3 text-[15px] leading-7 text-[#14121F]/65">{u.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative mx-auto max-w-4xl scroll-mt-28 px-5 pb-24 sm:px-8 lg:pb-32">
        <h2 className={`${h2} text-center`}>Good questions.</h2>
        <div className="mt-10 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className={`${card} group rounded-3xl px-6 py-5`}>
              <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold ${focus} rounded-lg`}>
                {f.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6A4CFF]/10 text-[#6A4CFF] transition-transform group-open:rotate-45"><Plus className="h-4 w-4" /></span>
              </summary>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#14121F]/65">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-[#14121F]/10 bg-[linear-gradient(135deg,#ede9ff,#ffe6f0_55%,#fff6c9)] px-6 py-16 text-center sm:px-12 sm:py-24">
          <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[#6A4CFF]/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-[#FF3D81]/25 blur-3xl" />
          <div className="relative">
            <h2 className={`${D} mx-auto max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] text-[#14121F] sm:text-6xl`}>Your next demo is one take away.</h2>
            <p className="mx-auto mt-5 max-w-md text-base leading-7 text-[#14121F]/65">Open the studio, hit record, and fix the rest by editing the transcript.</p>
            <Link href="/login?setup=1" className={`group mt-9 inline-flex items-center gap-2 rounded-full bg-[#14121F] px-7 py-4 text-sm font-semibold text-white shadow-[0_14px_34px_-10px_rgba(20,18,31,0.55)] transition hover:-translate-y-0.5 hover:bg-[#2c2742] ${focus}`}>
              Try the studio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-4 text-sm text-[#14121F]/55">Free to start. No install.</p>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-[#14121F]/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[#14121F]/55 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <Wordmark />
          <p>Record. Edit. Share your story.</p>
          <div className="flex items-center gap-5">
            <Link href="/pricing" className="transition hover:text-[#14121F]">Pricing</Link>
            <Link href="/login" className="transition hover:text-[#14121F]">Log in</Link>
            <Link href="/login?setup=1" className="transition hover:text-[#14121F]">Try the studio</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}