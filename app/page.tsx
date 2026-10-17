import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Plus } from 'lucide-react';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { getMarketingSession } from '@/components/marketing/session';
import { GateForm, Heatmap, HeroStage, Note, SlackPanel, Teleprompter, Window } from '@/components/marketing/Scenes';
import { D, btnGhost, btnPrimary, card, focus, h2, label, serif } from '@/components/marketing/theme';

const usedFor = ['cold outreach', 'demo follow-ups', 'proposals', 'pricing questions', 'investor updates', 'onboarding'];

const steps = [
  { title: 'Record in one take', text: 'Screen and camera together, with your notes on a teleprompter only you can see. Fluffed a line? Delete it from the transcript and the video closes the gap.' },
  { title: 'Send one link', text: 'Each prospect gets their own page with their name on it. Paste it into an email as a clickable thumbnail, or drop it into LinkedIn or Slack.' },
  { title: 'Hear when it lands', text: 'A Slack message the moment they press play. Then the details: how far they got, what they went back to, whether they booked the call.' },
];

const integrations = [
  { name: 'Slack', what: 'A message in your channel when someone starts, finishes, fills in a form or books.', how: 'Direct' },
  { name: 'HubSpot', what: 'Timeline notes on the contact, and form submissions straight into your HubSpot forms.', how: 'Direct' },
  { name: 'Calendly, Cal.com', what: 'Your booking page inside the player, at the moment you choose. Calendly bookings are tracked.', how: 'Paste a link' },
  { name: 'Salesforce, Pipedrive', what: 'Leads and watch events as signed JSON, or Web-to-Lead form posts.', how: 'Webhook' },
  { name: 'Zapier, Make, n8n', what: 'Anything else your team runs on.', how: 'Webhook' },
];

const useCases = [
  { who: 'Founders & sales', text: 'Swap the fifth follow-up email for a two-minute video. Call when Slack says they watched it twice.' },
  { who: 'Agencies & freelancers', text: 'Walk the client through the proposal yourself. Lock it with a password and see which part they reread.' },
  { who: 'Marketing & success', text: 'Put a short form in front of a product tour, with UTM source passed to HubSpot. Spot accounts that never pressed play.' },
];

const faqs = [
  { q: 'Does my prospect need an account?', a: 'No. They open the link and press play. If you’ve locked the video or added a form, they enter the PIN, confirm their email or fill in the form first.' },
  { q: 'How do you know who watched?', a: 'Make a personal link for each prospect and their views are attributed to them. With email codes or a form, viewers are named by the address they gave. Everyone else is grouped by browser.' },
  { q: 'Will my prospect know they’re being tracked?', a: 'Yes. The share page says that you can see how the video is watched. Browsers with Global Privacy Control or Do Not Track turned on aren’t tracked at all.' },
  { q: 'Can a form send leads to HubSpot or my CRM?', a: 'Yes. A form can post to a HubSpot form or any URL (Salesforce Web-to-Lead, Pardot, Zapier), with hidden fields like UTM source filled in for you.' },
  { q: 'Is it free?', a: 'You can start free with five hosted videos, the full analytics, forms, protection and alerts. Paid plans host more videos, and longer ones.' },
];

function Section({ n, name, id, children, className = '' }: { n: string; name: string; id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-6xl scroll-mt-24 px-5 py-24 sm:px-8 ${className}`}>
      <div className="mb-12 flex items-center gap-4">
        <span className={label}>{n} — {name}</span>
        <span className="h-px flex-1 bg-[#15120F]/10" />
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const session = await getMarketingSession();
  const primaryHref = session.isLoggedIn ? '/studio' : '/signup';

  return (
    <MarketingShell current="home" session={session}>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-28 pt-14 sm:px-8 sm:pt-20">
        <p className="mk-rise inline-flex items-center gap-2 text-[13px] text-[#15120F]/60" style={{ '--d': 0 } as CSSProperties}>
          <span className="relative flex h-2 w-2"><span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-[#0E9F6E]" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#0E9F6E]" /></span>
          Video for sales and outreach
        </p>
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
          <h1 className={`mk-rise ${D} text-[3.1rem] font-bold leading-[0.94] tracking-[-0.045em] sm:text-7xl lg:text-[6.2rem]`} style={{ '--d': 1 } as CSSProperties}>
            Send a video.
            <br />
            Know <span className={`${serif} text-[#5B3DF5]`}>who watched.</span>
          </h1>
          <div className="mk-rise lg:pb-3" style={{ '--d': 2 } as CSSProperties}>
            <p className="text-[17px] leading-7 text-[#15120F]/65">
              Record a short walkthrough for each prospect, send one link, and get a message the moment they press play. Then see how far they got, what they went back to, and whether they booked.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href={primaryHref} className={btnPrimary}>
                {session.isLoggedIn ? 'Open your studio' : 'Start free'} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/demo" className={btnGhost}>See a demo</Link>
            </div>
            <p className="mt-4 text-[13px] text-[#15120F]/45">No card. No install. Your prospect doesn’t need an account.</p>
          </div>
        </div>

        <div className="mk-rise mt-16" style={{ '--d': 3 } as CSSProperties}>
          <HeroStage />
        </div>

        <p className="mt-24 text-[15px] leading-8 text-[#15120F]/45">
          <span className="text-[#15120F]/70">People send Cliprame videos for</span>{' '}
          {usedFor.map((item, i) => (
            <span key={item}><span className={`${serif} text-[1.2rem] text-[#15120F]/80`}>{item}</span>{i < usedFor.length - 1 && <span className="mx-2 text-[#15120F]/25">/</span>}</span>
          ))}
        </p>
      </section>

      {/* How it works */}
      <Section n="01" name="How it works" id="how-it-works" className="border-t border-[#15120F]/10">
        <div className="grid gap-12 lg:grid-cols-[.9fr_1.1fr]">
          <h2 className={h2}>Stop wondering if they <span className={`${serif} text-[#5B3DF5]`}>opened it.</span></h2>
          <ol className="divide-y divide-[#15120F]/10 border-y border-[#15120F]/10">
            {steps.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[3.5rem_1fr] gap-4 py-7">
                <span className={`${serif} text-[2.6rem] leading-none text-[#15120F]/30`}>{i + 1}</span>
                <div>
                  <h3 className={`${D} text-xl font-bold tracking-tight`}>{step.title}</h3>
                  <p className="mt-2 max-w-lg text-[15.5px] leading-7 text-[#15120F]/62">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* Analytics */}
      <Section n="02" name="Analytics" id="analytics">
        <div className="grid items-center gap-14 lg:grid-cols-[.85fr_1.15fr]">
          <div>
            <h2 className={h2}>See where your pitch <span className={`${serif} text-[#5B3DF5]`}>landed.</span></h2>
            <p className="mt-5 max-w-md text-[16px] leading-7 text-[#15120F]/62">“Viewed” tells you nothing. Cliprame shows who watched, how much, what they replayed and where they gave up, so the follow-up talks about the thing they cared about.</p>
            <ul className="mt-7 space-y-2.5 text-[15px] text-[#15120F]/75">
              {['Every viewer, by name, from personal links and forms', 'A heatmap of re-watches, skips and drop-offs', 'Which chapters each person actually watched', 'Who clicked your button, and when'].map((point) => (
                <li key={point} className="flex gap-3"><span className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B3DF5]" />{point}</li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <Window url="cliprame.com/studio/videos/q4-pricing">
              <div className="p-5">
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold">Q4 pricing walkthrough</p>
                  <p className="text-[12px] tabular-nums text-[#15120F]/45">12 plays · 9 viewers</p>
                </div>
                <div className="mt-5"><Heatmap /></div>
                <table className="mt-6 w-full text-left text-[13px]">
                  <thead className="text-[11px] uppercase tracking-wider text-[#15120F]/40"><tr><th className="pb-2 font-medium">Viewer</th><th className="pb-2 font-medium">Watched</th><th className="hidden pb-2 font-medium sm:table-cell">Note</th></tr></thead>
                  <tbody className="divide-y divide-[#15120F]/[0.07]">
                    {[
                      ['Ana Lopez · Acme', '100%', 'Rewatched pricing, clicked Book a call'],
                      ['Marcus Chen · Northwind', '64%', 'Skipped the intro'],
                      ['priya@globex.io', '22%', 'Left at 0:33'],
                    ].map(([who, share, note]) => (
                      <tr key={who}><td className="py-2.5 pr-3 font-medium">{who}</td><td className="py-2.5 pr-3 tabular-nums">{share}</td><td className="hidden py-2.5 text-[#15120F]/55 sm:table-cell">{note}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Window>
            <Note arrow="down" className="-top-12 right-[26%] hidden lg:flex">everyone stops here</Note>
          </div>
        </div>
      </Section>

      {/* Alerts */}
      <Section n="03" name="Alerts" id="alerts">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
          <div className="relative order-2 lg:order-1">
            <SlackPanel rows={4} />
            <Note arrow="up" className="-bottom-14 left-6 hidden lg:flex">call her now</Note>
          </div>
          <div className="order-1 lg:order-2">
            <h2 className={h2}>Follow up while it’s still <span className={`${serif} text-[#5B3DF5]`}>on their screen.</span></h2>
            <p className="mt-5 max-w-md text-[16px] leading-7 text-[#15120F]/62">The best time to call is two minutes after they watched. Cliprame tells Slack, HubSpot or your CRM when someone starts, finishes, clicks, fills in a form or books a call. Once per viewing, never twice.</p>
            <Link href="/features#connect" className={`mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold underline decoration-[#15120F]/25 underline-offset-4 hover:decoration-[#15120F] ${focus}`}>How alerts work <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </Section>

      {/* Forms, protection, recording */}
      <Section n="04" name="Capture & control" id="forms">
        <div className="grid gap-5 md:grid-cols-3">
          <article className={`${card} flex flex-col p-6`}>
            <h3 className={`${D} text-xl font-bold tracking-tight`}>A form before the video</h3>
            <p className="mt-2 text-[15px] leading-7 text-[#15120F]/62">Your fields, your HubSpot form, with UTM source and campaign passed along in hidden fields.</p>
            <div className="mt-6 flex-1"><GateForm /></div>
          </article>
          <article className={`${card} flex flex-col p-6`}>
            <h3 className={`${D} text-xl font-bold tracking-tight`}>Locked when it matters</h3>
            <p className="mt-2 text-[15px] leading-7 text-[#15120F]/62">A PIN, a password or an email code, limited to one company. The video isn’t even sent until they’re in.</p>
            <div className="mt-6 flex flex-1 flex-col justify-center rounded-xl border border-[#15120F]/10 bg-[#FBFAF7] p-5">
              <p className="text-[13px] font-semibold">Enter the PIN to watch</p>
              <div className="mt-3 flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={`flex h-11 flex-1 items-center justify-center rounded-lg border text-lg ${i < 4 ? 'border-[#15120F]/25 bg-white' : 'border-[#15120F]/10'}`}>{i < 4 ? '•' : ''}</span>)}
              </div>
              <p className="mt-3 text-[11.5px] text-[#15120F]/45">Wrong guesses are slowed down.</p>
            </div>
          </article>
          <article className={`${card} flex flex-col p-6`}>
            <h3 className={`${D} text-xl font-bold tracking-tight`}>Sound prepared, not scripted</h3>
            <p className="mt-2 text-[15px] leading-7 text-[#15120F]/62">Your notes on screen while you record. Edit by deleting words, like a doc.</p>
            <div className="mt-6 flex-1 space-y-3">
              <Teleprompter lines={['Hi Marcus, quick one for you', 'You asked about the rollout', 'Here’s what week one looks like']} />
              <p className="rounded-xl border border-[#15120F]/10 bg-[#FBFAF7] p-3.5 text-[13.5px] leading-6">
                Hi Marcus, <span className="text-[#E5484D] line-through decoration-2">so um, basically</span> here’s the plan for week one.
              </p>
            </div>
          </article>
        </div>
      </Section>

      {/* Integrations */}
      <Section n="05" name="Works with" id="integrations">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <h2 className={h2}>Plugs into what your team <span className={`${serif} text-[#5B3DF5]`}>already uses.</span></h2>
            <p className="mt-5 max-w-sm text-[16px] leading-7 text-[#15120F]/62">Nothing to install, nothing to code. Paste a link or a token and send a test.</p>
          </div>
          <dl className="divide-y divide-[#15120F]/10 border-y border-[#15120F]/10">
            {integrations.map((item) => (
              <div key={item.name} className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr_6rem] sm:gap-6">
                <dt className={`${D} text-lg font-bold tracking-tight`}>{item.name}</dt>
                <dd className="text-[15px] leading-7 text-[#15120F]/62">{item.what}</dd>
                <dd className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#15120F]/40 sm:text-right">{item.how}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {/* Use cases */}
      <Section n="06" name="Who it’s for">
        <div className="grid gap-10 md:grid-cols-3">
          {useCases.map((useCase) => (
            <article key={useCase.who} className="border-t-2 border-[#15120F] pt-5">
              <h3 className={`${D} text-2xl font-bold tracking-tight`}>{useCase.who}</h3>
              <p className="mt-3 text-[15.5px] leading-7 text-[#15120F]/62">{useCase.text}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section n="07" name="Questions" id="faq">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <h2 className={h2}>Good <span className={`${serif} text-[#5B3DF5]`}>questions.</span></h2>
            <p className="mt-5 text-[15px] text-[#15120F]/55">More on <Link href="/pricing#faq" className="font-semibold text-[#15120F] underline decoration-[#15120F]/25 underline-offset-4 hover:decoration-[#15120F]">pricing</Link>.</p>
          </div>
          <div className="divide-y divide-[#15120F]/10 border-y border-[#15120F]/10">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded ${D} text-lg font-bold tracking-tight ${focus}`}>
                  {faq.q}
                  <Plus className="h-5 w-5 shrink-0 text-[#15120F]/40 transition group-open:rotate-45" />
                </summary>
                <p className="mt-3 max-w-2xl text-[15.5px] leading-7 text-[#15120F]/62">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* Closing */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-[#15120F] px-7 py-16 text-[#F6F4EF] sm:px-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_.7fr] lg:items-end">
            <h2 className={`${D} text-4xl font-bold leading-[1.02] tracking-[-0.04em] sm:text-6xl`}>
              Your next follow-up could be the one they <span className={`${serif} text-[#B6A6FF]`}>watch twice.</span>
            </h2>
            <div>
              <p className="text-[16px] leading-7 text-[#F6F4EF]/65">Record it in one take, send one link, and know the moment it lands.</p>
              <Link href={primaryHref} className={`mt-6 inline-flex items-center gap-2 rounded-xl bg-[#F6F4EF] px-5 py-3 text-[15px] font-semibold text-[#15120F] transition hover:bg-white ${focus}`}>
                {session.isLoggedIn ? 'Open your studio' : 'Start free'} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
