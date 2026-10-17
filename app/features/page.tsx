import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import {
    BellRing, Captions, Code2, Contact, EyeOff, Flag, Hand, Hash, KeyRound, Link2, Lock, Mail, MonitorUp,
    MousePointerClick, Repeat, ScreenShare, Scissors, Send, ShieldCheck, Sparkles, UserRound, Webhook, type LucideIcon,
} from 'lucide-react';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { getMarketingSession } from '@/components/marketing/session';
import { GateForm, Heatmap, SlackPanel, Teleprompter, Window } from '@/components/marketing/Scenes';
import { D, focus, label, serif } from '@/components/marketing/theme';

export const metadata: Metadata = {
    title: 'Features | Cliprame',
    description: 'Record personal sales videos in one take, send tracked links, see who watched and where, gate them with forms, lock confidential pitches, and get alerts in Slack and HubSpot.',
};

type Feature = { icon: LucideIcon; title: string; text: string };
type Group = { id: string; eyebrow: string; icon: LucideIcon; title: string; intro: string; tone: string; features: Feature[] };

const groups: Group[] = [
    {
        id: 'record',
        eyebrow: 'Record',
        icon: ScreenShare,
        title: 'Look prepared on camera, in one take.',
        intro: 'Everything you need to record a personal walkthrough without a script sounding like a script.',
        tone: 'bg-[#6A4CFF]/10 text-[#6A4CFF]',
        features: [
            { icon: EyeOff, title: 'Private teleprompter', text: 'Your talking points scroll on screen while you record. They never appear in the video.' },
            { icon: ScreenShare, title: 'Screen and camera together', text: 'A floating camera card keeps your face next to the product, proposal or deck you’re walking through.' },
            { icon: Scissors, title: 'Edit by deleting words', text: 'Your take is transcribed word by word. Delete a stumble from the text and the video closes the gap.' },
            { icon: Sparkles, title: 'AI talking points', text: 'Describe who you’re writing to and get a script in seven languages, ready for the teleprompter.' },
            { icon: Hand, title: 'Point with your hand', text: 'Circle a number or underline a plan by drawing in the air while you talk.' },
            { icon: MonitorUp, title: 'Record from any tab', text: 'An optional Chrome extension records the tab you’re on, with your camera and teleprompter.' },
        ],
    },
    {
        id: 'send',
        eyebrow: 'Send',
        icon: Send,
        title: 'One link, made for one person.',
        intro: 'Send it the way you already reach people: email, LinkedIn, Slack or your own website.',
        tone: 'bg-[#FF3D81]/10 text-[#FF3D81]',
        features: [
            { icon: UserRound, title: 'Personal links', text: 'Create a link for each prospect. The page greets them by name, and their views are attributed to them.' },
            { icon: Mail, title: 'Email-ready thumbnail', text: 'Copy a clickable thumbnail with a play button that pastes straight into Gmail or Outlook.' },
            { icon: MousePointerClick, title: 'A button under the video', text: 'Add a call to action like “Book a call” that links to your calendar or checkout.' },
            { icon: Flag, title: 'Chapters', text: 'Split the video into chapters so busy viewers can jump to pricing, and you can see which parts they chose.' },
            { icon: Code2, title: 'Embed on your site', text: 'Put the same tracked player on a landing page or help centre. Limit it to your own domains on paid plans.' },
            { icon: Captions, title: 'Captions that follow your voice', text: 'Word-by-word captions in English, Hindi and Hinglish, so the video works on mute.' },
        ],
    },
    {
        id: 'analytics',
        eyebrow: 'See who watched',
        icon: Repeat,
        title: 'Know where your pitch landed.',
        intro: 'Go beyond “viewed”. See who watched, how far they got and what they cared about, so your follow-up hits the right point.',
        tone: 'bg-[#6A4CFF]/10 text-[#6A4CFF]',
        features: [
            { icon: UserRound, title: 'Viewer list and timelines', text: 'Every viewer with how much they watched, their device and country, and a timeline of what they did.' },
            { icon: Repeat, title: 'Drop-off heatmap', text: 'See where people rewatched, skipped ahead or stopped, and jump the player to that moment.' },
            { icon: Flag, title: 'Audience retention', text: 'A retention curve for every video, with chapters marked, so you can tighten the part where people leave.' },
            { icon: Code2, title: 'Where views came from', text: 'Plays on the share link and on each website the video is embedded on, side by side.' },
        ],
    },
    {
        id: 'protect',
        eyebrow: 'Protect',
        icon: ShieldCheck,
        title: 'Keep confidential pitches confidential.',
        intro: 'Lock any video before it plays. The video isn’t in the page until the viewer unlocks it.',
        tone: 'bg-[#14121F]/[0.07] text-[#14121F]',
        features: [
            { icon: KeyRound, title: 'PIN or password', text: 'Share it separately from the link. Wrong guesses are rate-limited.' },
            { icon: Mail, title: 'Email verification', text: 'Viewers confirm their address with a one-time code, and you see exactly who unlocked it.' },
            { icon: Lock, title: 'Only the right people', text: 'Limit email codes to named people or whole companies, like @northwind.com.' },
            { icon: Link2, title: 'Turn links off any time', text: 'Switch off a link instantly. Changing the lock signs out everyone who opened it before.' },
        ],
    },
    {
        id: 'connect',
        eyebrow: 'Connect',
        icon: BellRing,
        title: 'Alerts where your team already works.',
        intro: 'Hear about it the moment someone starts, finishes or clicks your button. Each moment is sent once per viewing.',
        tone: 'bg-[#FF3D81]/10 text-[#FF3D81]',
        features: [
            { icon: Hash, title: 'Slack', text: 'A message in your channel with who watched, how much, and a link to the analytics.' },
            { icon: Contact, title: 'HubSpot', text: 'A note on the contact’s timeline for every watch. Creates the contact if it doesn’t exist yet.' },
            { icon: Webhook, title: 'Signed webhooks', text: 'JSON to Salesforce, Pipedrive, Zapier, Make, n8n or your own code, signed so you can trust it.' },
            { icon: UserRound, title: 'Named viewers only', text: 'Skip anonymous views and only alert your team about people you can follow up with.' },
        ],
    },
];

/** A small product moment beside each chapter, so the page isn't only words. */
const ILLUSTRATIONS: Record<string, React.ReactNode> = {
    record: (
        <div className="space-y-3">
            <Teleprompter lines={['Hi Ana, I made this for you', 'I looked at how Acme onboards', 'and found two quick wins']} />
            <p className="rounded-xl border border-[#15120F]/10 bg-white p-3.5 text-[13.5px] leading-6">Hi Ana, <span className="text-[#E5484D] line-through decoration-2">um, so basically</span> I looked at how Acme onboards new customers.</p>
        </div>
    ),
    send: (
        <Window url="cliprame.com/v/acme-onboarding">
            <div className="p-5">
                <p className="text-[12px] font-semibold text-[#5B3DF5]">Hi Ana, this video is for you</p>
                <p className={`${D} mt-0.5 text-lg font-bold tracking-tight`}>How Acme can onboard faster</p>
                <div className="mt-3 flex aspect-video items-center justify-center rounded-lg bg-[#F3F1EC]"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#15120F] text-[#F6F4EF]">▶</span></div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-[#15120F]/60">
                    {['0:00 Intro', '0:42 Your setup', '1:30 Pricing'].map((chapter) => <span key={chapter} className="rounded-md border border-[#15120F]/10 px-2 py-1">{chapter}</span>)}
                    <span className="ml-auto rounded-md bg-[#15120F] px-2.5 py-1 font-semibold text-[#F6F4EF]">Book a call</span>
                </div>
            </div>
        </Window>
    ),
    analytics: (
        <Window url="cliprame.com/studio/videos/q4-pricing">
            <div className="p-5"><Heatmap /></div>
        </Window>
    ),
    protect: <GateForm />,
    connect: <SlackPanel rows={3} />,
};

export default async function FeaturesPage() {
    const session = await getMarketingSession();

    return (
        <MarketingShell current="features" session={session}>
            <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pt-20">
                <p className={label}>Features</p>
                <h1 className={`mt-5 max-w-4xl ${D} text-[2.9rem] font-bold leading-[0.96] tracking-[-0.045em] sm:text-7xl`}>
                    From one take to <span className={`${serif} text-[#5B3DF5]`}>“they watched it twice.”</span>
                </h1>
                <p className="mt-6 max-w-2xl text-[17px] leading-7 text-[#15120F]/62">Everything for recording a personal video, sending it as a tracked link, learning how it was watched, and following up at the right moment. All in the browser.</p>
            </section>

            <div className="mx-auto grid max-w-6xl gap-12 border-t border-[#15120F]/10 px-5 pt-12 sm:px-8 lg:grid-cols-[13rem_1fr]">
                {/* Table of contents */}
                <nav aria-label="Chapters" className="lg:sticky lg:top-24 lg:self-start">
                    <ol className="flex flex-wrap gap-x-5 gap-y-2 lg:block lg:space-y-3">
                        {groups.map((group, i) => (
                            <li key={group.id}>
                                <a href={`#${group.id}`} className={`group flex items-baseline gap-3 rounded text-[15px] text-[#15120F]/60 hover:text-[#15120F] ${focus}`}>
                                    <span className="text-[12px] tabular-nums text-[#15120F]/35">0{i + 1}</span>{group.eyebrow}
                                </a>
                            </li>
                        ))}
                    </ol>
                </nav>

                <div className="space-y-24 pb-24">
                    {groups.map((group, i) => (
                        <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-24">
                            <div className="grid gap-10 xl:grid-cols-[1fr_22rem] xl:items-start">
                                <div>
                                    <p className={label}>0{i + 1} — {group.eyebrow}</p>
                                    <h2 id={`${group.id}-title`} className={`${D} mt-4 text-[2.1rem] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[2.6rem]`}>{group.title}</h2>
                                    <p className="mt-4 max-w-xl text-[16px] leading-7 text-[#15120F]/62">{group.intro}</p>
                                </div>
                                <div className="hidden xl:block">{ILLUSTRATIONS[group.id]}</div>
                            </div>
                            <dl className="mt-10 grid gap-x-10 border-t border-[#15120F]/10 sm:grid-cols-2">
                                {group.features.map((feature) => (
                                    <div key={feature.title} className="border-b border-[#15120F]/10 py-6">
                                        <dt className="flex items-center gap-2.5 font-semibold"><feature.icon className="h-[18px] w-[18px] text-[#5B3DF5]" strokeWidth={1.8} />{feature.title}</dt>
                                        <dd className="mt-2 text-[15px] leading-7 text-[#15120F]/62">{feature.text}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    ))}
                </div>
            </div>

            <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
                <div className="flex flex-col gap-8 rounded-2xl bg-[#15120F] px-7 py-14 text-[#F6F4EF] sm:px-14 lg:flex-row lg:items-end lg:justify-between">
                    <h2 className={`${D} max-w-2xl text-4xl font-bold leading-[1.04] tracking-[-0.04em] sm:text-5xl`}>Send your first tracked video <span className={`${serif} text-[#B6A6FF]`}>today.</span></h2>
                    <div className="flex flex-wrap gap-3">
                        <Link href={session.isLoggedIn ? '/studio' : '/signup'} className={`inline-flex items-center gap-2 rounded-xl bg-[#F6F4EF] px-5 py-3 text-[15px] font-semibold text-[#15120F] hover:bg-white ${focus}`}>
                            {session.isLoggedIn ? 'Open your studio' : 'Start free'} <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/pricing" className={`inline-flex items-center rounded-xl border border-[#F6F4EF]/25 px-5 py-3 text-[15px] font-semibold hover:border-[#F6F4EF]/60 ${focus}`}>See pricing</Link>
                    </div>
                </div>
            </section>
        </MarketingShell>
    );
}

