import type { CSSProperties, ReactNode } from 'react';
import { EyeOff, Hash, Lock, Mail, Play } from 'lucide-react';
import { LiveFeed } from './LiveFeed';
import { serif } from './theme';

// Product moments drawn in HTML, like annotated screenshots: realistic, quiet UI
// with a designer's hand-written notes on top.

/** A hand-written note with a drawn arrow, pointing at something in a scene. */
export function Note({ children, arrow = 'left', className = '', style }: { children: ReactNode; arrow?: 'left' | 'down' | 'up' | 'right'; className?: string; style?: CSSProperties }) {
    const paths = {
        left: 'M58 8 C 40 4, 20 10, 6 26 M6 26 L 9 14 M6 26 L 18 23',
        right: 'M4 8 C 22 4, 42 10, 56 26 M56 26 L 53 14 M56 26 L 44 23',
        down: 'M10 4 C 6 18, 12 30, 26 40 M26 40 L 14 38 M26 40 L 22 28',
        up: 'M26 40 C 30 26, 24 14, 10 4 M10 4 L 22 6 M10 4 L 14 16',
    };
    return (
        <div aria-hidden="true" className={`pointer-events-none absolute flex items-start gap-1 text-[#5B3DF5] ${className}`} style={style}>
            {(arrow === 'left' || arrow === 'up') && <svg viewBox="0 0 62 44" className="h-9 w-12 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[arrow]} /></svg>}
            <span className={`${serif} whitespace-nowrap text-[1.15rem] leading-tight`}>{children}</span>
            {(arrow === 'right' || arrow === 'down') && <svg viewBox="0 0 62 44" className="h-9 w-12 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[arrow]} /></svg>}
        </div>
    );
}

const HEAT = {
    rewatched: [0, 0, 1, 0, 0, 1, 0, 0, 2, 4, 4, 3, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    skipped: [0, 0, 0, 0, 2, 3, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    dropped: [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 3],
};
const RAMP = ['#EFEDF6', '#DCD5FB', '#BBAEF8', '#8C77F3', '#5B3DF5'];

export function Heatmap() {
    return (
        <div aria-label="Example heatmap: most viewers rewatched the pricing section">
            <div className="space-y-1">
                {([['Re-watched', HEAT.rewatched], ['Skipped', HEAT.skipped], ['Dropped off', HEAT.dropped]] as const).map(([name, cells]) => (
                    <div key={name} className="flex items-center gap-3">
                        <span className="w-[4.6rem] shrink-0 text-right text-[11px] text-[#15120F]/50">{name}</span>
                        <div className="grid flex-1 grid-cols-24 gap-[2px]">
                            {cells.map((level, i) => <span key={i} className="h-[18px] rounded-[2px]" style={{ background: RAMP[level] }} />)}
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-1.5 flex gap-3 text-[10.5px] tabular-nums text-[#15120F]/40">
                <span className="w-[4.6rem] shrink-0" />
                <span className="flex flex-1 justify-between"><span>0:00</span><span>1:15</span><span>2:30</span></span>
            </div>
        </div>
    );
}

export function Teleprompter({ lines }: { lines: string[] }) {
    return (
        <div className="rounded-xl bg-[#15120F] p-3 text-[#F6F4EF] shadow-[0_18px_40px_-16px_rgba(21,18,15,0.6)]">
            <div className="mb-2 flex items-center justify-between text-[10px] font-medium text-[#F6F4EF]/50">
                <span>Teleprompter</span>
                <span className="inline-flex items-center gap-1"><EyeOff className="h-2.5 w-2.5" />only you</span>
            </div>
            <div className="prompter-mask h-[66px] overflow-hidden">
                <div className="prompter text-[12.5px] leading-4">
                    {[...lines, ...lines].map((line, i) => <p key={i} className="pb-1">{line}</p>)}
                </div>
            </div>
        </div>
    );
}

export function GateForm() {
    return (
        <div className="rounded-xl border border-[#15120F]/10 bg-white p-5 shadow-[0_24px_50px_-28px_rgba(21,18,15,0.35)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5B3DF5]/10 text-[#5B3DF5]"><Mail className="h-4 w-4" /></span>
            <p className="mt-3 font-semibold">Before you watch</p>
            <p className="text-xs text-[#15120F]/50">Proposal for Northwind · 3:12</p>
            <div className="mt-4 space-y-2 text-[12px]">
                <span className="block rounded-lg border border-[#15120F]/12 px-3 py-2.5 text-[#15120F]/70">marcus@northwind.com</span>
                <span className="block rounded-lg border border-[#15120F]/12 px-3 py-2.5 text-[#15120F]/35">Company</span>
            </div>
            <span className="mt-3 block rounded-lg bg-[#15120F] py-2.5 text-center text-sm font-semibold text-[#F6F4EF]">Watch the video</span>
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#15120F]/45"><Lock className="h-3 w-3" /> Only people at northwind.com</p>
        </div>
    );
}

/** A plain window frame, the way a screenshot would be cropped. */
export function Window({ url, children, className = '' }: { url: string; children: ReactNode; className?: string }) {
    return (
        <div className={`overflow-hidden rounded-xl border border-[#15120F]/12 bg-white shadow-[0_1px_0_rgba(21,18,15,0.04),0_40px_80px_-48px_rgba(21,18,15,0.45)] ${className}`}>
            <div className="flex items-center gap-2 border-b border-[#15120F]/[0.07] bg-[#FBFAF7] px-3.5 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                <span className="ml-3 truncate text-[11px] text-[#15120F]/40">{url}</span>
            </div>
            {children}
        </div>
    );
}

export function SlackPanel({ rows = 3 }: { rows?: number }) {
    return (
        <div className="overflow-hidden rounded-xl border border-[#15120F]/12 bg-white shadow-[0_40px_80px_-48px_rgba(21,18,15,0.45)]">
            <div className="flex items-center gap-2 bg-[#3F0E40] px-4 py-2.5 text-[12px] font-semibold text-white/90">
                <Hash className="h-3.5 w-3.5" /> sales-alerts
            </div>
            <div className="p-4"><LiveFeed rows={rows} /></div>
        </div>
    );
}

/** The home page's hero: the recorded video, with the prospect's activity beside it. */
export function HeroStage() {
    return (
        <div className="relative">
            <Window url="cliprame.com/v/q4-pricing-acme">
                <div className="grid lg:grid-cols-[1.6fr_1fr]">
                    <div className="border-[#15120F]/[0.07] lg:border-r">
                        <div className="relative aspect-[16/10] bg-[#F3F1EC]">
                            <div className="absolute inset-0 grid grid-cols-3 gap-[3%] p-[6%]">
                                {['Starter', 'Growth', 'Scale'].map((plan, i) => (
                                    <div key={plan} className={`flex flex-col rounded-lg border bg-white p-[9%] ${i === 1 ? 'border-[#5B3DF5]' : 'border-[#15120F]/8'}`}>
                                        <span className="text-[clamp(7px,1vw,11px)] font-semibold text-[#15120F]/55">{plan}</span>
                                        <span className="mt-[10%] text-[clamp(10px,1.7vw,20px)] font-bold tracking-tight">{['₹0', '₹2,400', '₹6,800'][i]}</span>
                                        <span className="mt-[14%] block h-1 w-full rounded bg-[#15120F]/8" />
                                        <span className="mt-[9%] block h-1 w-4/5 rounded bg-[#15120F]/8" />
                                        <span className="mt-[9%] block h-1 w-5/6 rounded bg-[#15120F]/8" />
                                        <span className={`mt-auto block h-[clamp(8px,1.4vw,16px)] w-full rounded ${i === 1 ? 'bg-[#5B3DF5]' : 'bg-[#15120F]/8'}`} />
                                    </div>
                                ))}
                            </div>
                            <svg viewBox="0 0 400 250" className="pointer-events-none absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
                                <ellipse className="draw" pathLength={1} cx="200" cy="66" rx="58" ry="26" stroke="#E5484D" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                            <span className="absolute bottom-3 right-3 aspect-[4/3] w-[22%] overflow-hidden rounded-lg bg-[linear-gradient(160deg,#E8C9A8,#C98B6B)] ring-2 ring-white">
                                <span className="absolute left-1/2 top-[22%] h-[34%] w-[26%] -translate-x-1/2 rounded-full bg-[#F4DCC2]" />
                                <span className="absolute -bottom-[22%] left-1/2 h-[54%] w-[72%] -translate-x-1/2 rounded-[50%] bg-[#2F3B4C]" />
                            </span>
                        </div>
                        <div className="flex items-center gap-3 border-t border-[#15120F]/[0.07] px-4 py-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#15120F] text-[#F6F4EF]"><Play className="ml-0.5 h-3 w-3 fill-current" /></span>
                            <span className="relative h-1 flex-1 rounded-full bg-[#15120F]/10"><span className="absolute inset-y-0 left-0 w-[62%] rounded-full bg-[#15120F]" /><span className="absolute -top-1 left-[62%] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-[#15120F] shadow" /></span>
                            <span className="text-[11px] tabular-nums text-[#15120F]/50">1:42 / 2:30</span>
                        </div>
                    </div>

                    <div className="flex flex-col border-t border-[#15120F]/[0.07] lg:border-t-0">
                        <div className="flex items-center justify-between border-b border-[#15120F]/[0.07] px-4 py-3">
                            <p className="text-[12px] font-semibold"># sales-alerts</p>
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#0E9F6E]">
                                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-[#0E9F6E]" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#0E9F6E]" /></span>
                                live
                            </span>
                        </div>
                        <div className="flex-1 p-4"><LiveFeed rows={3} /></div>
                    </div>
                </div>
                <div className="border-t border-[#15120F]/[0.07] px-4 py-4"><Heatmap /></div>
            </Window>

            <Note arrow="down" className="-top-12 left-[34%] hidden lg:flex">she watched this part twice</Note>
            <Note arrow="up" className="-bottom-12 left-[44%] hidden lg:flex">pricing, every time</Note>
            <div className="absolute -left-10 top-16 hidden w-48 -rotate-2 xl:block">
                <Teleprompter lines={['Hi Ana, I made this for you', 'I looked at how Acme onboards', 'and found two quick wins', 'Let me show you, two minutes']} />
            </div>
        </div>
    );
}
