import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { ArrowRight, ScreenShare, Sparkles } from 'lucide-react';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

/* ---------- Palette ----------
   ink     #14121F   text, dark surfaces
   paper   #F7F6FB   page background
   violet  #6A4CFF   primary accent
   pink    #FF3D81   secondary accent / playhead / REC
   yellow  #FFE347   caption highlight (the one "loud" color, used on captions only)
*/

const D = 'font-[family-name:var(--font-display)]';
const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6FB]';

const captionWords = ['Aaj', 'chalo', 'Hyderabad', 'ghoomte', 'hain'];
const prompterLines = [
  'Namaste doston, aaj ka video',
  'Hyderabad ke bare mein hai',
  'Charminar se shuru karte hain',
  'Phir biryani ki baat karenge',
];
const languages = ['English', 'हिन्दी', 'Hinglish', 'বাংলা', 'मराठी', 'தமிழ்', 'తెలుగు'];

const effects = [
  { name: 'Blur', bg: 'bg-[radial-gradient(circle_at_30%_30%,#e0e7ff,#818cf8)]' },
  { name: 'Green screen', bg: 'bg-[#22c55e]' },
  { name: 'Cutout', bg: 'bg-[linear-gradient(135deg,#FFE347,#FF3D81)]' },
  { name: 'Your image', bg: 'bg-[linear-gradient(160deg,#ffb86b,#5b3df5)]' },
];

const steps = [
  { n: '01', color: 'text-[#6A4CFF]', title: 'Start with an idea', text: 'Record a fresh take or bring the photos and clips you already have.' },
  { n: '02', color: 'text-[#FF3D81]', title: 'Shape the story', text: 'Add a script, captions, designed text, music, transitions, or narration.' },
  { n: '03', color: 'text-[#14121F]', title: 'Preview and export', text: 'Fine-tune the result, then download a video ready to share.' },
];

const useCases = [
  { rule: 'border-[#6A4CFF]', title: 'Social & personal', text: 'Turn everyday moments, travel photos, and ideas into reels people will remember.' },
  { rule: 'border-[#FF3D81]', title: 'Business & brands', text: 'Showcase a product, explain a service, or create a polished update for your audience.' },
  { rule: 'border-[#14121F]', title: 'Learning & explaining', text: 'Break down a topic, share a presentation, or make a lesson easier to follow.' },
];

const css = `
.cap{display:inline-block;padding:.02em .22em;border-radius:.3em;animation:capHit 4.5s infinite;animation-delay:calc(var(--i)*.9s)}
@keyframes capHit{0%,18%{background:#FFE347;color:#14121F;transform:translateY(-2px) scale(1.06)}24%,100%{background:rgba(255,227,71,0);color:#fff;transform:none}}
@keyframes prompter{to{transform:translateY(-50%)}}
.prompter{animation:prompter 16s linear infinite}
.prompter-mask{-webkit-mask-image:linear-gradient(transparent,#000 28%,#000 72%,transparent);mask-image:linear-gradient(transparent,#000 28%,#000 72%,transparent)}
@keyframes bar{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
.bar{transform-origin:center;animation:bar 1s ease-in-out infinite;animation-delay:calc(var(--i)*.12s)}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.rise{opacity:0;animation:rise .8s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--d,0)*90ms)}
@media (prefers-reduced-motion:reduce){.cap,.prompter,.bar{animation:none}.rise{animation:none;opacity:1}}
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
const h2 = `${D} text-4xl font-bold leading-[1.02] tracking-[-0.03em] text-[#14121F] sm:text-5xl lg:text-6xl`;
const tile = 'relative overflow-hidden border border-[#14121F]/10 p-6 sm:p-8';
const tileTitle = `${D} text-2xl font-bold leading-tight tracking-tight`;
const tileText = 'mt-3 text-[15px] leading-7';

export default function HomePage() {
  return (
    <main className={`${display.variable} ${body.variable} min-h-dvh overflow-x-clip bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F] selection:bg-[#6A4CFF]/20`}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Floating glass nav */}
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-full border border-white/70 bg-white/70 pl-4 pr-2 shadow-[0_10px_30px_-10px_rgba(20,18,31,0.18)] backdrop-blur-xl sm:h-16 sm:pl-5">
          <Wordmark />
          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            <a href="#features" className={navLink}>Features</a>
            <a href="#how-it-works" className={navLink}>How it works</a>
            <a href="#use-cases" className={navLink}>Use cases</a>
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
          <a href="#features" className={mobileNavLink}>Features</a>
          <a href="#how-it-works" className={mobileNavLink}>How it works</a>
          <a href="#use-cases" className={mobileNavLink}>Use cases</a>
          <Link href="/pricing" className={mobileNavLink}>Pricing</Link>
        </nav>
      </header>

      {/* Hero: Compact height so it fits entirely in the first viewport */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-8 px-5 py-6 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-6 lg:px-12 lg:py-10">
        <div>
          <h1 className={`rise ${D} text-[2.4rem] font-extrabold leading-[0.96] tracking-[-0.04em] sm:text-5xl lg:text-[4.2rem]`} style={{ '--d': 0 } as CSSProperties}>
            Record, caption and post from one browser tab.
          </h1>
          <p className="rise mt-4 max-w-xl text-sm leading-relaxed text-[#14121F]/65 sm:text-base sm:leading-7" style={{ '--d': 1 } as CSSProperties}>
            A teleprompter, word-by-word captions and photo reels in one studio. Write scripts in seven Indian and global languages. No install, and no timeline to learn.
          </p>
          <div className="rise mt-6 flex flex-wrap items-center gap-3" style={{ '--d': 2 } as CSSProperties}>
            <Link href="/login?setup=1" className={`group inline-flex items-center gap-2 rounded-full bg-[#14121F] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-10px_rgba(20,18,31,0.55)] transition hover:-translate-y-0.5 hover:bg-[#2c2742] ${focus}`}>
              Try the studio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#how-it-works" className={`inline-flex items-center rounded-full border border-[#14121F]/15 bg-white/60 px-5 py-3 text-sm font-semibold text-[#14121F] transition hover:bg-white ${focus}`}>
              See how it works
            </a>
          </div>
          <p className="rise mt-3 text-xs text-[#14121F]/55" style={{ '--d': 3 } as CSSProperties}>Free to start. Drafts stay on your device.</p>
          <div className="rise mt-6" style={{ '--d': 4 } as CSSProperties}>
            <p className="text-xs font-medium text-[#14121F]/70">AI script writing in</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {languages.map((l) => (
                <li key={l} className="rounded-full border border-[#14121F]/10 bg-white px-3 py-1 text-xs font-medium text-[#14121F]/80">{l}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Product moment: a reel being captioned */}
        <div className="rise relative mx-auto w-full max-w-[380px] py-2" style={{ '--d': 3 } as CSSProperties}>
          <div className="absolute -left-8 top-8 h-48 w-48 rounded-full bg-[#6A4CFF]/25 blur-3xl" />
          <div className="absolute -right-4 bottom-6 h-48 w-48 rounded-full bg-[#FF3D81]/20 blur-3xl" />

          <div className="relative mx-auto w-[240px] rotate-[2.5deg] rounded-[2.5rem] bg-[#14121F] p-2 shadow-[0_30px_60px_-15px_rgba(20,18,31,0.45)] sm:w-[260px]">
            <div className="relative aspect-[9/18.5] overflow-hidden rounded-[2.1rem] bg-[linear-gradient(180deg,#ffb86b_0%,#ff6a8b_46%,#5b3df5_100%)]">
              <div className="absolute left-1/2 top-[28%] h-20 w-20 -translate-x-1/2 rounded-full bg-[#FFE9A8]" />
              <div className="absolute -bottom-10 -left-10 h-40 w-64 rounded-[50%] bg-[#2a1a5e]" />
              <div className="absolute -bottom-14 -right-12 h-44 w-64 rounded-[50%] bg-[#1b1040]" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(transparent,rgba(20,18,31,0.55))]" />

              <div className="absolute inset-x-4 top-8 flex items-center justify-between text-[10px] font-semibold text-white">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-0.5 backdrop-blur">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF3D81]" />REC 00:24
                </span>
                <span className="rounded-full bg-black/35 px-2 py-0.5 backdrop-blur">9:16</span>
              </div>

              <div className="absolute inset-x-3 bottom-8 text-center">
                <p className={`${D} text-[1.4rem] font-extrabold leading-snug text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]`}>
                  {captionWords.map((w, i) => (
                    <span key={w}>
                      <span className="cap" style={{ '--i': i } as CSSProperties}>{w}</span>{' '}
                    </span>
                  ))}
                </p>
              </div>
            </div>
            <div className="absolute left-1/2 top-[16px] h-4 w-16 -translate-x-1/2 rounded-full bg-[#14121F]" />
          </div>

          {/* Floating teleprompter */}
          <div className="absolute -left-6 top-20 hidden w-48 rounded-2xl border border-white/70 bg-white/80 p-2.5 shadow-[0_20px_40px_-12px_rgba(20,18,31,0.25)] backdrop-blur-xl sm:block lg:-left-10">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-[#14121F]/55">
              <span>Teleprompter</span>
              <span className="inline-flex items-center gap-1 text-[#6A4CFF]"><Sparkles className="h-2.5 w-2.5" />AI script</span>
            </div>
            <div className="prompter-mask h-[72px] overflow-hidden">
              <div className="prompter text-[12px] font-medium leading-4 text-[#14121F]">
                {[...prompterLines, ...prompterLines].map((line, i) => (
                  <p key={i} className="pb-1">{line}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Floating captions chip */}
          <div className="absolute -right-4 bottom-20 hidden items-center gap-2.5 rounded-2xl border border-white/70 bg-white/85 px-3 py-2.5 shadow-[0_20px_40px_-12px_rgba(20,18,31,0.25)] backdrop-blur-xl sm:flex lg:-right-6">
            <span className="flex h-7 items-center gap-[3px]" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="bar block h-5 w-1 rounded-full bg-[#6A4CFF]" style={{ '--i': i } as CSSProperties} />
              ))}
            </span>
            <span>
              <span className="block text-[11px] font-semibold">Captions ready</span>
              <span className="block text-[10px] text-[#14121F]/55">Hinglish, in sync</span>
            </span>
          </div>
        </div>
      </section>

      {/* Bento features */}
      <section id="features" className="relative mx-auto max-w-7xl scroll-mt-28 px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        <div className="max-w-3xl">
          <h2 className={h2}>Less fiddling with tools. More time for your story.</h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#14121F]/65">From first take to final export, keep your creative flow simple and focused.</p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {/* Teleprompter + AI script */}
          <article className={`${tile} rounded-[2rem] bg-white md:col-span-2 lg:col-span-4`}>
            <div className="grid items-center gap-8 sm:grid-cols-2">
              <div>
                <h3 className={`${tileTitle} sm:text-3xl`}>Write the script with AI. Read it while you record.</h3>
                <p className={`${tileText} max-w-sm text-[#14121F]/65`}>Type a topic and get a script in seven languages. The teleprompter scrolls on screen while you record.</p>
              </div>
              <div className="rounded-2xl bg-[#14121F] p-5 text-white">
                <div className="flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs">
                  <span className="truncate text-white/80">Topic: a day in Hyderabad</span>
                  <span className="shrink-0 rounded-full bg-[#6A4CFF] px-2 py-0.5 font-semibold">Hinglish</span>
                </div>
                <div className={`${D} mt-4 space-y-2 text-lg font-semibold leading-snug`}>
                  <p className="text-white/35">Namaste doston, aaj ka video</p>
                  <p>Hyderabad ke bare mein <span className="rounded bg-[#FFE347] px-1 text-[#14121F]">hai</span></p>
                  <p className="text-white/35">Charminar se shuru karte hain</p>
                </div>
              </div>
            </div>
          </article>

          {/* Captions */}
          <article className={`${tile} flex flex-col justify-between rounded-[1.75rem] border-transparent bg-[#6A4CFF] text-white lg:col-span-2`}>
            <div>
              <h3 className={tileTitle}>Captions that follow your voice</h3>
              <p className={`${tileText} text-white/80`}>Word-by-word highlighting in English, Hindi and Hinglish.</p>
            </div>
            <p className={`${D} mt-8 text-3xl font-extrabold leading-tight`}>
              Yeh <mark className="rounded-md bg-[#FFE347] px-1.5 text-[#14121F]">sabse</mark> mast hai
            </p>
          </article>

          {/* Effects */}
          <article className={`${tile} rounded-[1.75rem] bg-white lg:col-span-2`}>
            <h3 className={tileTitle}>Look good anywhere</h3>
            <p className={`${tileText} text-[#14121F]/65`}>Blur your background, key out a green screen, or drop in your own image.</p>
            <div className="mt-6 grid grid-cols-4 gap-2 text-center text-[11px] font-medium text-[#14121F]/60">
              {effects.map((e) => (
                <div key={e.name}>
                  <span className={`mx-auto block h-12 w-12 rounded-full ring-1 ring-[#14121F]/10 ${e.bg}`} />
                  <span className="mt-1.5 block leading-tight">{e.name}</span>
                </div>
              ))}
            </div>
          </article>

          {/* Photo reels */}
          <article className={`${tile} rounded-[1.75rem] bg-white lg:col-span-2`}>
            <h3 className={tileTitle}>Photos and clips, one reel</h3>
            <p className={`${tileText} text-[#14121F]/65`}>Transitions, music and narration, with templates for travel, birthdays and products.</p>
            <div className="relative mt-6 h-32" aria-hidden="true">
              <div className="absolute left-4 top-3 h-28 w-20 -rotate-12 rounded-xl bg-[linear-gradient(160deg,#38BDF8,#6A4CFF)] shadow-lg" />
              <div className="absolute left-16 top-0 h-28 w-20 rotate-3 rounded-xl bg-[linear-gradient(160deg,#FFE347,#FF3D81)] shadow-lg" />
              <div className="absolute left-32 top-5 h-28 w-20 rotate-12 rounded-xl bg-[linear-gradient(160deg,#FF3D81,#14121F)] shadow-lg" />
            </div>
          </article>

          {/* Editor */}
          <article className={`${tile} rounded-[1.75rem] bg-white lg:col-span-2`}>
            <h3 className={tileTitle}>Edit without a learning curve</h3>
            <p className={`${tileText} text-[#14121F]/65`}>Trim, split, zoom in on key moments, and change speed.</p>
            <div className="relative mt-6 rounded-xl bg-[#14121F]/[0.04] p-3" aria-hidden="true">
              <div className="flex gap-1.5">
                <span className="h-8 flex-[3] rounded-lg bg-[#6A4CFF]" />
                <span className="h-8 flex-[2] rounded-lg bg-[#6A4CFF]/55" />
                <span className="h-8 flex-[2] rounded-lg bg-[#6A4CFF]" />
              </div>
              <div className="mt-2 flex gap-1.5">
                <span className="h-3 flex-[2] rounded bg-[#FF3D81]/70" />
                <span className="h-3 flex-[4] rounded bg-[#14121F]/10" />
                <span className="h-3 flex-[1] rounded bg-[#FFE347]" />
              </div>
              <span className="absolute inset-y-2 left-[42%] w-0.5 rounded bg-[#FF3D81]" />
            </div>
          </article>

          {/* Screen share */}
          <article className={`${tile} rounded-[2rem] border-transparent bg-[#14121F] text-white md:col-span-2 lg:col-span-6`}>
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#6A4CFF]/40 blur-3xl" />
            <div className="relative grid items-center gap-8 md:grid-cols-2">
              <div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><ScreenShare className="h-5 w-5" /></span>
                <h3 className={`${tileTitle} mt-5 sm:text-3xl`}>Explain it on camera. Then show your screen.</h3>
                <p className={`${tileText} max-w-md text-white/70`}>Start recording yourself, share a page in the middle of the take, and keep talking. Great for lessons, demos and walkthroughs.</p>
              </div>
              <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-4" aria-hidden="true">
                <div className="space-y-2.5 rounded-xl bg-white p-4">
                  <span className="block h-3 w-1/3 rounded bg-[#14121F]/80" />
                  <span className="block h-2 w-full rounded bg-[#14121F]/10" />
                  <span className="block h-2 w-5/6 rounded bg-[#14121F]/10" />
                  <span className="block h-16 w-full rounded-lg bg-[linear-gradient(120deg,#e0e7ff,#fce7f3)]" />
                </div>
                <span className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-[linear-gradient(160deg,#ffb86b,#FF3D81)] ring-4 ring-[#14121F]" />
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* How it works: a real sequence */}
      <section id="how-it-works" className="relative mx-auto max-w-7xl scroll-mt-28 px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <h2 className={h2}>From idea to ready-to-share.</h2>
            <p className="mt-5 max-w-sm text-base leading-7 text-[#14121F]/65">No complicated timeline to learn. Start with what you have and build from there.</p>
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
          <h2 className={h2}>One studio. Your kind of video.</h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#14121F]/65">From a quick social clip to a thoughtful explainer, start with the story you want to share.</p>
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

      {/* Closing CTA */}
      <section className="relative mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[#14121F] px-6 py-16 text-center text-white sm:px-12 sm:py-24">
          <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#6A4CFF]/45 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-[#FF3D81]/35 blur-3xl" />
          <div className="relative">
            <h2 className={`${D} mx-auto max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl`}>Bring your idea. We’ll help with the polish.</h2>
            <Link href="/login?setup=1" className={`group mt-9 inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-[#14121F] transition hover:-translate-y-0.5 hover:bg-[#FFE347] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#14121F]`}>
              Explore the studio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-4 text-sm text-white/55">Free to start.</p>
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