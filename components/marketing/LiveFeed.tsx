'use client';

import { useEffect, useState } from 'react';

// A Slack channel filling up as prospects watch. New messages arrive at the bottom,
// the way Slack shows them.

const MESSAGES = [
    { who: 'Ana Lopez', company: 'Acme', text: 'started watching *Q4 pricing walkthrough*', meta: 'desktop · Pune' },
    { who: 'Ana Lopez', company: 'Acme', text: 'rewatched *Pricing* twice', meta: '1:30 – 2:05' },
    { who: 'Marcus Chen', company: 'Northwind', text: 'filled in *Book a walkthrough*', meta: 'team_size: 51–200 · utm_source: linkedin' },
    { who: 'Ana Lopez', company: 'Acme', text: 'clicked *Book a call*', meta: '82% watched' },
    { who: 'Priya Shah', company: 'Globex', text: 'watched *Proposal for Globex* to the end', meta: 'mobile · London' },
    { who: 'Marcus Chen', company: 'Northwind', text: 'booked a call for *Tue, 11:30*', meta: 'via Calendly' },
];

const times = ['10:41', '10:43', '10:44', '10:44', '10:52', '10:58'];

/** Renders *word* as bold, the way Slack does. */
function Bold({ text }: { text: string }) {
    return <>{text.split(/(\*[^*]+\*)/).map((part, i) => (part.startsWith('*') ? <strong key={i} className="font-semibold text-[#1264A3]">{part.slice(1, -1)}</strong> : part))}</>;
}

export function LiveFeed({ rows = 3 }: { rows?: number }) {
    const [tick, setTick] = useState(rows - 1);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const timer = window.setInterval(() => setTick((value) => value + 1), 2800);
        return () => window.clearInterval(timer);
    }, []);

    const visible = Array.from({ length: rows }, (_, offset) => {
        const index = (tick - (rows - 1 - offset) + MESSAGES.length * 100) % MESSAGES.length;
        return { ...MESSAGES[index], time: times[index], key: tick - (rows - 1 - offset) };
    });

    return (
        <ul aria-hidden="true" className="space-y-3.5">
            {visible.map((message, index) => (
                <li key={message.key} className={`flex gap-2.5 ${index === rows - 1 ? 'animate-feed-in' : ''}`}>
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#15120F] text-[11px] font-bold text-[#F6F4EF]">C</span>
                    <div className="min-w-0 text-[13px] leading-[1.35rem] text-[#1D1C1D]">
                        <p><span className="font-bold">Cliprame</span> <span className="rounded bg-[#1D1C1D]/[0.07] px-1 text-[10px] font-semibold text-[#1D1C1D]/55">APP</span> <span className="text-[11px] text-[#1D1C1D]/45">{message.time}</span></p>
                        <p><span className="font-bold">{message.who}</span> <span className="text-[#1D1C1D]/60">({message.company})</span> <Bold text={message.text} /></p>
                        <p className="truncate text-[11.5px] text-[#1D1C1D]/50">{message.meta}</p>
                    </div>
                </li>
            ))}
        </ul>
    );
}
