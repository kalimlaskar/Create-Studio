'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
    AlertTriangle, ArrowRight, CalendarCheck, Check, ClipboardList, Contact, Copy, ExternalLink, Flag, Hash, LoaderCircle, MousePointerClick, Play,
    RefreshCw, Send, ShieldCheck, Sparkles, Trash2, Webhook, X,
} from 'lucide-react';
import { videoApi } from '@/lib/videos/upload';
import { NOTIFICATION_TYPES, type Integration, type IntegrationKind, type NotificationType } from '@/lib/integrations/types';
import { D, focus } from '@/components/videos/ui';

const inputClass = 'w-full rounded-xl border border-[#14121F]/12 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#14121F]/35 focus:border-[#6A4CFF] focus:ring-4 focus:ring-[#6A4CFF]/10';

/* ------------------------------- Brands -------------------------------- */

interface Step { title: string; detail: string }

interface Brand {
    name: string;
    tagline: string;
    blurb: string;
    /** Tile colour (a CSS background). */
    tile: string;
    icon: typeof Webhook;
    field: string;
    placeholder: string;
    /** A quick format check while typing, so mistakes show before the server is asked. */
    looksRight: (value: string) => boolean;
    formatHint: string;
    setup?: { url: string; label: string };
    steps: Step[];
    caution: string;
    worksWith?: string;
}

const BRANDS: Record<IntegrationKind, Brand> = {
    slack: {
        name: 'Slack',
        tagline: 'Alerts in a channel',
        blurb: 'Your team sees who watched, how far they got and what they clicked, right where you talk.',
        tile: '#4A154B',
        icon: Hash,
        field: 'Slack webhook URL',
        placeholder: 'https://hooks.slack.com/services/…',
        looksRight: (value) => /^https:\/\/hooks\.slack\.com\/services\/\S+$/.test(value.trim()),
        formatHint: 'It starts with https://hooks.slack.com/services/',
        setup: { url: 'https://api.slack.com/apps', label: 'Open Slack apps' },
        steps: [
            { title: 'Create a new app', detail: 'Open Slack apps, sign in, and click Create New App.' },
            { title: 'Choose “Blank app”', detail: 'Skip the templates. Name it “Cliprame”, pick your workspace and continue.' },
            { title: 'Add one permission', detail: 'On “What it can do in Slack?”, click Add Bot Scopes, search for incoming-webhook and add it. Leave User scopes empty.' },
            { title: 'Skip events', detail: 'On “What it can respond to in Slack?”, add nothing. Click Continue and finish the last step.' },
            { title: 'Turn on Incoming Webhooks', detail: 'You’ll land on Basic Information. Ignore the credentials there. In the sidebar under Features, click Incoming Webhooks and switch it On.' },
            { title: 'Pick a channel', detail: 'Scroll down, click Add New Webhook, choose a channel such as #sales-alerts and click Allow.' },
            { title: 'Copy the Webhook URL', detail: 'Copy it from the table at the bottom and paste it below.' },
        ],
        caution: 'Keep the URL private: anyone who has it can post in that channel.',
    },
    hubspot: {
        name: 'HubSpot',
        tagline: 'Notes on contacts',
        blurb: 'Every watch is logged on the contact’s timeline, so your CRM shows who’s warming up.',
        tile: '#FF7A59',
        icon: Contact,
        field: 'HubSpot access token',
        placeholder: 'pat-na1-…',
        looksRight: (value) => /^pat-[a-z0-9-]{10,}$/i.test(value.trim()),
        formatHint: 'It starts with pat-',
        steps: [
            { title: 'Open Private Apps', detail: 'In HubSpot, click the settings (gear) icon, then Integrations → Private Apps. You need to be a super admin.' },
            { title: 'Create a private app', detail: 'Click Create a private app and name it “Cliprame”.' },
            { title: 'Allow contacts', detail: 'On the Scopes tab, search for contacts and tick crm.objects.contacts.read and crm.objects.contacts.write.' },
            { title: 'Copy the access token', detail: 'Click Create app, then Show token and Copy. Paste it below.' },
        ],
        caution: 'Only named viewers are logged: people on personal links or who unlocked with an email code.',
    },
    webhook: {
        name: 'Webhook',
        tagline: 'Any tool, any CRM',
        blurb: 'Signed JSON to Salesforce, Pipedrive, Zapier, Make, n8n or your own code.',
        tile: 'linear-gradient(135deg, #6A4CFF, #C04CFF)',
        icon: Webhook,
        field: 'Endpoint URL',
        placeholder: 'https://hooks.zapier.com/hooks/catch/…',
        looksRight: (value) => /^https:\/\/[^\s/]+\.[^\s/]+/.test(value.trim()),
        formatHint: 'Use a public https:// address',
        steps: [
            { title: 'Get a URL that catches webhooks', detail: 'In Zapier, start a Zap with “Webhooks by Zapier → Catch Hook”. In Make, add a “Custom webhook”. Developers can use their own https endpoint.' },
            { title: 'Paste it below and connect', detail: 'You’ll get a signing secret once. Save it if your code checks the Cliprame-Signature header.' },
            { title: 'Send a test, then map fields', detail: 'The test gives Zapier or Make a sample to map: viewer email, video title, percent watched.' },
        ],
        caution: 'Each request is signed, so your endpoint can reject anything that didn’t come from Cliprame.',
        worksWith: 'Salesforce · Pipedrive · Zapier · Make',
    },
};

const KIND_ORDER: IntegrationKind[] = ['slack', 'hubspot', 'webhook'];

/** What a second connection of the same tool would be for. HubSpot is one account per company, so it has none. */
const ANOTHER: Partial<Record<IntegrationKind, string>> = { slack: 'Add another channel', webhook: 'Add another endpoint' };

const MOMENT_ICONS: Record<NotificationType, typeof Play> = { 'video.viewed': Play, 'video.completed': Flag, 'cta.clicked': MousePointerClick, 'form.submitted': ClipboardList, 'call.booked': CalendarCheck };

/** Sample viewer used in previews and the hero feed. */
const SAMPLE = { name: 'Ana Lopez', company: 'Acme', email: 'ana@acme.com', video: 'Q4 pricing walkthrough' };

function BrandTile({ kind, size = 'md' }: { kind: IntegrationKind; size?: 'sm' | 'md' | 'lg' }) {
    const { tile, icon: Icon } = BRANDS[kind];
    const box = size === 'lg' ? 'h-14 w-14 rounded-2xl' : size === 'sm' ? 'h-8 w-8 rounded-[10px]' : 'h-11 w-11 rounded-[14px]';
    const glyph = size === 'lg' ? 'h-7 w-7' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
    return (
        <span aria-hidden="true" className={`flex shrink-0 items-center justify-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_18px_-10px_rgba(20,18,31,0.6)] ${box}`} style={{ background: tile }}>
            <Icon className={glyph} strokeWidth={2.4} />
        </span>
    );
}

function timeAgo(iso: string) {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* -------------------------------- Page --------------------------------- */

export function IntegrationsManager({ initialIntegrations, setupMessage }: { initialIntegrations: Integration[]; setupMessage: string | null }) {
    const [integrations, setIntegrations] = useState(initialIntegrations);
    const [connecting, setConnecting] = useState<IntegrationKind | null>(null);
    const [secret, setSecret] = useState<{ name: string; value: string } | null>(null);
    const [highlighted, setHighlighted] = useState<string | null>(null);

    /** Takes the creator to an existing connection instead of starting a new one. */
    const showConnection = (id: string) => {
        document.getElementById(`integration-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlighted(id);
        window.setTimeout(() => setHighlighted((current) => (current === id ? null : current)), 1800);
    };
    const manage = (kind: IntegrationKind) => {
        const first = integrations.find((item) => item.kind === kind);
        if (first) showConnection(first.id);
    };

    const replace = (updated: Integration) => setIntegrations((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    const countOf = (kind: IntegrationKind) => integrations.filter((item) => item.kind === kind).length;

    if (setupMessage) return <p className="rounded-3xl border border-[#14121F]/8 bg-white px-6 py-10 text-center text-sm text-[#14121F]/65">{setupMessage}</p>;

    return (
        <div className="space-y-10">
            <Hero connected={integrations.filter((item) => item.enabled).length} onStart={() => setConnecting('slack')} />

            <section aria-labelledby="add-title">
                <div className="flex items-end justify-between gap-3">
                    <div>
                        <h2 id="add-title" className={`${D} text-xl font-bold tracking-tight`}>Your tools</h2>
                        <p className="mt-0.5 text-sm text-[#14121F]/55">Connect once, in about two minutes. No code needed.</p>
                    </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {KIND_ORDER.map((kind) => {
                        const brand = BRANDS[kind];
                        const count = countOf(kind);
                        return (
                            <div
                                key={kind}
                                className={`group relative flex flex-col overflow-hidden rounded-3xl border bg-white p-5 transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_48px_-28px_rgba(20,18,31,0.45)] ${count > 0 ? 'border-emerald-200' : 'border-[#14121F]/8 hover:border-[#14121F]/15'}`}
                            >
                                <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition duration-300 group-hover:opacity-25" style={{ background: brand.tile }} />
                                <span className="flex items-start justify-between gap-3">
                                    <BrandTile kind={kind} />
                                    {count > 0 && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                            <Check className="h-3 w-3" strokeWidth={3} /> {count > 1 ? `${count} connected` : 'Connected'}
                                        </span>
                                    )}
                                </span>
                                <span className="mt-4 block text-base font-semibold">{brand.name}</span>
                                <span className="block text-xs font-medium text-[#14121F]/45">{brand.tagline}</span>
                                <span className="mt-2 block flex-1 text-sm leading-6 text-[#14121F]/65">{brand.blurb}</span>
                                {brand.worksWith && <span className="mt-2 block text-[11px] font-medium text-[#14121F]/45">{brand.worksWith}</span>}

                                {count > 0 ? (
                                    <span className="mt-5 flex items-center justify-between gap-3 border-t border-[#14121F]/6 pt-4">
                                        <button type="button" onClick={() => manage(kind)} className={`inline-flex items-center gap-1.5 rounded-full text-sm font-semibold ${focus}`}>
                                            Manage <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                                        </button>
                                        {ANOTHER[kind] && (
                                            <button type="button" onClick={() => setConnecting(kind)} className={`rounded-full px-2 py-1 text-xs font-semibold text-[#14121F]/45 hover:bg-[#14121F]/[0.05] hover:text-[#14121F] ${focus}`}>
                                                + {ANOTHER[kind]}
                                            </button>
                                        )}
                                    </span>
                                ) : (
                                    <button type="button" onClick={() => setConnecting(kind)} className={`mt-5 flex items-center justify-between border-t border-[#14121F]/6 pt-4 text-left text-sm font-semibold after:absolute after:inset-0 after:content-[''] ${focus}`}>
                                        Connect {brand.name}
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#14121F] text-white transition duration-200 group-hover:translate-x-0.5 group-hover:bg-[#6A4CFF]"><ArrowRight className="h-4 w-4" /></span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {secret && <SecretBox name={secret.name} value={secret.value} onClose={() => setSecret(null)} />}

            <section aria-labelledby="connected-title">
                <h2 id="connected-title" className={`${D} text-xl font-bold tracking-tight`}>
                    Your connections {integrations.length > 0 && <span className="ml-1 align-middle text-sm font-semibold text-[#14121F]/40">{integrations.length}</span>}
                </h2>
                {integrations.length === 0 ? (
                    <div className="mt-4 flex flex-col items-center rounded-3xl border border-dashed border-[#14121F]/15 bg-white/60 px-6 py-12 text-center">
                        <div className="flex -space-x-2">{KIND_ORDER.map((kind) => <span key={kind} className="rounded-[16px] ring-4 ring-[#F7F6FB]"><BrandTile kind={kind} /></span>)}</div>
                        <p className="mt-4 font-semibold">Nothing connected yet</p>
                        <p className="mt-1 max-w-sm text-sm text-[#14121F]/55">Most people start with Slack, so their team hears about hot prospects in real time.</p>
                        <button type="button" onClick={() => setConnecting('slack')} className={`mt-5 inline-flex items-center gap-2 rounded-full bg-[#14121F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742] ${focus}`}>Connect Slack <ArrowRight className="h-4 w-4" /></button>
                    </div>
                ) : (
                    <ul className="mt-4 space-y-3">
                        {integrations.map((integration) => (
                            <ConnectionCard
                                key={integration.id}
                                integration={integration}
                                highlighted={highlighted === integration.id}
                                onChange={replace}
                                onRemoved={() => setIntegrations((list) => list.filter((item) => item.id !== integration.id))}
                                onSecret={(value) => setSecret({ name: integration.name, value })}
                            />
                        ))}
                    </ul>
                )}
            </section>

            {connecting && (
                <ConnectDialog
                    kind={connecting}
                    existing={integrations.filter((item) => item.kind === connecting)}
                    onShowExisting={(id) => { setConnecting(null); window.setTimeout(() => showConnection(id), 50); }}
                    onClose={() => setConnecting(null)}
                    onConnected={(integration) => setIntegrations((list) => [...list, integration])}
                    onUpdated={replace}
                />
            )}
        </div>
    );
}

/* -------------------------------- Hero --------------------------------- */

const FEED: Array<{ kind: IntegrationKind; who: string; text: string; meta: string }> = [
    { kind: 'slack', who: 'Ana Lopez (Acme)', text: 'watched Q4 pricing walkthrough to the end', meta: '100% watched · desktop · IN' },
    { kind: 'hubspot', who: 'Marcus Chen', text: 'note added: started watching Product tour', meta: 'Contact timeline · HubSpot' },
    { kind: 'slack', who: 'Priya Shah (Northwind)', text: 'clicked Book a demo', meta: '64% watched · mobile · GB' },
    { kind: 'webhook', who: 'jo@globex.io', text: 'video.completed → Salesforce', meta: 'Delivered via Zapier · 200 OK' },
    { kind: 'slack', who: 'Someone on acme.com', text: 'started watching Onboarding in 3 minutes', meta: 'Embedded · desktop · US' },
];

function Hero({ connected, onStart }: { connected: number; onStart: () => void }) {
    const [tick, setTick] = useState(2);
    useEffect(() => {
        if (prefersReducedMotion()) return;
        const timer = window.setInterval(() => setTick((value) => value + 1), 2600);
        return () => window.clearInterval(timer);
    }, []);
    // The newest three, newest first.
    const visible = [0, 1, 2].map((offset) => ({ ...FEED[(tick - offset + FEED.length * 10) % FEED.length], key: tick - offset }));

    return (
        <section className="relative overflow-hidden rounded-[2rem] bg-[#14121F] px-6 py-8 text-white sm:px-10 sm:py-10">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#6A4CFF]/45 blur-3xl" />
                <div className="absolute -bottom-32 right-10 h-80 w-80 rounded-full bg-[#C04CFF]/25 blur-3xl" />
                <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
            </div>

            <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
                <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/80">
                        <span className="relative flex h-2 w-2"><span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-emerald-400" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
                        Real-time viewer alerts
                    </span>
                    <h2 className={`${D} mt-4 max-w-xl text-3xl font-bold leading-[1.1] tracking-tight sm:text-[2.6rem]`}>
                        Know the moment a prospect <span className="bg-gradient-to-r from-[#B6A6FF] to-[#F0A6FF] bg-clip-text text-transparent">hits play.</span>
                    </h2>
                    <p className="mt-3 max-w-lg text-[15px] leading-7 text-white/65">
                        Send a ping to Slack, a note to HubSpot, or a signed webhook to any CRM. Follow up while your video is still on their screen.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                        {NOTIFICATION_TYPES.map(({ id, label }) => {
                            const Icon = MOMENT_ICONS[id];
                            return <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/80"><Icon className="h-3.5 w-3.5 text-[#B6A6FF]" />{label}</span>;
                        })}
                    </div>
                    <div className="mt-7 flex flex-wrap items-center gap-4">
                        {connected === 0 ? (
                            <button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#14121F] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#14121F]">
                                <Sparkles className="h-4 w-4 text-[#6A4CFF]" /> Set up your first alert
                            </button>
                        ) : (
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300"><Check className="h-4 w-4" /> {connected} {connected === 1 ? 'connection is' : 'connections are'} live</span>
                        )}
                        <span className="text-xs text-white/45">Each moment is sent once per viewing.</span>
                    </div>
                </div>

                <div aria-hidden="true" className="animate-float-soft relative hidden h-[19rem] sm:block">
                    {visible.map((item, index) => (
                        <div
                            key={item.key}
                            className={`${index === 0 ? 'animate-feed-in' : ''} absolute inset-x-0 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-md transition-all duration-500`}
                            style={{ top: index * 96, opacity: 1 - index * 0.28, transform: `scale(${1 - index * 0.03})` }}
                        >
                            <BrandTile kind={item.kind} size="sm" />
                            <div className="min-w-0 text-sm">
                                <p className="leading-5"><span className="font-semibold">{item.who}</span> <span className="text-white/70">{item.text}</span></p>
                                <p className="mt-1 text-[11px] text-white/45">{item.meta} · just now</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ------------------------------ Controls ------------------------------- */

function MomentPicker({ value, onChange, disabled, compact }: { value: NotificationType[]; onChange: (events: NotificationType[]) => void; disabled?: boolean; compact?: boolean }) {
    return (
        <fieldset className="flex flex-wrap gap-2" disabled={disabled}>
            <legend className="sr-only">Moments to send</legend>
            {NOTIFICATION_TYPES.map((type) => {
                const on = value.includes(type.id);
                const Icon = MOMENT_ICONS[type.id];
                return (
                    <label key={type.id} title={type.hint} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#6A4CFF]/70 has-[:disabled]:cursor-default ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} ${on ? 'border-[#6A4CFF]/40 bg-[#6A4CFF]/10 text-[#3B26B8]' : 'border-[#14121F]/10 bg-white text-[#14121F]/50 hover:border-[#14121F]/25 hover:text-[#14121F]/75'}`}>
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? value.filter((id) => id !== type.id) : [...value, type.id])} />
                        {on ? <Check className="h-3 w-3" strokeWidth={3} /> : <Icon className="h-3 w-3" />}{type.label}
                    </label>
                );
            })}
        </fieldset>
    );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
    return (
        <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#6A4CFF]' : 'bg-[#14121F]/20'} ${focus}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.375rem]' : 'left-0.5'}`} />
        </button>
    );
}

/* --------------------------- Connect dialog ---------------------------- */

/** The same preview the server stores ("hooks.slack.com/…/iZRL"), to spot a paste that's already connected. */
function hintOf(kind: IntegrationKind, value: string) {
    if (kind === 'hubspot') return `pat-…${value.slice(-4)}`;
    try {
        const url = new URL(value);
        return `${url.hostname}/…/${url.pathname.replace(/\/+$/, '').slice(-4)}`;
    } catch {
        return null;
    }
}

function ConnectDialog({ kind, existing, onShowExisting, onClose, onConnected, onUpdated }: {
    kind: IntegrationKind;
    existing: Integration[];
    onShowExisting: (id: string) => void;
    onClose: () => void;
    onConnected: (integration: Integration) => void;
    onUpdated: (integration: Integration) => void;
}) {
    const brand = BRANDS[kind];
    const panelRef = useRef<HTMLDivElement>(null);
    const [openStep, setOpenStep] = useState(0);
    const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
    const [target, setTarget] = useState('');
    const [name, setName] = useState('');
    const [events, setEvents] = useState<NotificationType[]>(NOTIFICATION_TYPES.map((type) => type.id));
    const [identifiedOnly, setIdentifiedOnly] = useState(kind === 'hubspot');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [duplicateId, setDuplicateId] = useState<string | null>(null);
    const [connected, setConnected] = useState<{ integration: Integration; signingSecret: string | null } | null>(null);

    // Latest onClose without re-running the setup below on every parent render.
    const closeRef = useRef(onClose);
    useEffect(() => { closeRef.current = onClose; }, [onClose]);

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        panelRef.current?.focus();
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current(); };
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
    }, []);

    const finishStep = (index: number) => {
        setDoneSteps((set) => new Set(set).add(index));
        setOpenStep(index + 1 < brand.steps.length ? index + 1 : -1);
    };

    const trimmed = target.trim();
    const formatOk = trimmed ? brand.looksRight(trimmed) : null;
    const likelyDuplicate = formatOk ? existing.find((item) => item.targetHint === hintOf(kind, trimmed)) : undefined;
    const sameAs = duplicateId ? existing.find((item) => item.id === duplicateId) : likelyDuplicate;

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setDuplicateId(null);
        try {
            const response = await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, name, target: trimmed, events, identifiedOnly }) });
            const data = await response.json().catch(() => ({})) as { integration?: Integration; signingSecret?: string | null; error?: string; duplicateId?: string };
            if (!response.ok || !data.integration) {
                if (data.duplicateId) setDuplicateId(data.duplicateId);
                else setError(data.error ?? `Request failed (${response.status}).`);
                return;
            }
            onConnected(data.integration);
            setConnected({ integration: data.integration, signingSecret: data.signingSecret ?? null });
        } catch {
            setError('Couldn’t reach the server. Try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#14121F]/55 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="connect-title" className="animate-dialog-in relative flex w-full max-w-5xl flex-col overflow-hidden bg-white outline-none sm:max-h-[min(52rem,92vh)] sm:rounded-[1.75rem] sm:shadow-[0_40px_120px_-30px_rgba(20,18,31,0.6)]">
                <button type="button" onClick={onClose} aria-label="Close" className={`absolute right-4 top-4 z-10 rounded-full bg-white/80 p-2 text-[#14121F]/55 backdrop-blur hover:bg-[#14121F]/[0.06] hover:text-[#14121F] ${focus}`}><X className="h-4 w-4" /></button>

                {connected ? (
                    <ConnectedView kind={kind} result={connected} onDone={onClose} onUpdated={onUpdated} />
                ) : (
                    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                        {/* Left: guided steps and the form. */}
                        <form onSubmit={submit} className="flex min-h-0 flex-col overflow-y-auto">
                            <div className="px-6 pb-2 pt-6 sm:px-8 sm:pt-8">
                                <div className="flex items-center gap-3.5 pr-10">
                                    <BrandTile kind={kind} size="lg" />
                                    <div>
                                        <h2 id="connect-title" className={`${D} text-2xl font-bold tracking-tight`}>Connect {brand.name}</h2>
                                        <p className="text-sm text-[#14121F]/55">About 2 minutes · no code</p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 sm:px-8">
                                <div className="mt-4 flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold text-[#14121F]/55">{doneSteps.size} of {brand.steps.length} steps done</p>
                                    {brand.setup && (
                                        <a href={brand.setup.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 rounded-full bg-[#6A4CFF]/10 px-3 py-1.5 text-xs font-semibold text-[#4B30D9] hover:bg-[#6A4CFF]/15 ${focus}`}>
                                            {brand.setup.label} <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    )}
                                </div>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#14121F]/[0.06]">
                                    <div className="h-full rounded-full bg-gradient-to-r from-[#6A4CFF] to-[#C04CFF] transition-all duration-500" style={{ width: `${(doneSteps.size / brand.steps.length) * 100}%` }} />
                                </div>

                                <ol className="mt-4 space-y-1.5">
                                    {brand.steps.map((step, index) => {
                                        const done = doneSteps.has(index);
                                        const open = openStep === index;
                                        return (
                                            <li key={step.title} className={`rounded-2xl border transition ${open ? 'border-[#6A4CFF]/30 bg-[#6A4CFF]/[0.04]' : 'border-transparent'}`}>
                                                <button type="button" onClick={() => setOpenStep(open ? -1 : index)} aria-expanded={open} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${focus}`}>
                                                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition ${done ? 'animate-pop-in bg-emerald-500 text-white' : open ? 'bg-[#6A4CFF] text-white' : 'bg-[#14121F]/[0.07] text-[#14121F]/55'}`}>
                                                        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                                                    </span>
                                                    <span className={`text-sm font-semibold ${done && !open ? 'text-[#14121F]/45 line-through decoration-[#14121F]/25' : ''}`}>{step.title}</span>
                                                </button>
                                                {open && (
                                                    <div className="pb-3 pl-12 pr-4">
                                                        <p className="text-sm leading-6 text-[#14121F]/65">{step.detail}</p>
                                                        <button type="button" onClick={() => finishStep(index)} className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#14121F] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2c2742] ${focus}`}>
                                                            <Check className="h-3.5 w-3.5" /> {index + 1 < brand.steps.length ? 'Done, next step' : 'Done'}
                                                        </button>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ol>
                            </div>

                            {/* The form stays in view at the bottom, ready for the paste. */}
                            <div className="sticky bottom-0 mt-auto border-t border-[#14121F]/8 bg-white/95 px-6 pb-6 pt-5 backdrop-blur sm:px-8">
                                <label className="block">
                                    <span className="text-xs font-semibold text-[#14121F]/60">{brand.field}</span>
                                    <span className="relative mt-1.5 block">
                                        <input
                                            value={target}
                                            onChange={(event) => { setTarget(event.target.value); setError(''); setDuplicateId(null); }}
                                            type={kind === 'hubspot' ? 'password' : 'url'}
                                            placeholder={brand.placeholder}
                                            autoComplete="off"
                                            spellCheck={false}
                                            aria-invalid={formatOk === false}
                                            aria-describedby="target-hint"
                                            className={`${inputClass} pr-10 font-mono text-[13px] ${formatOk === false ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500/10' : formatOk ? 'border-emerald-400' : ''}`}
                                        />
                                        {formatOk && <Check aria-hidden="true" className="animate-pop-in absolute right-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-emerald-500" strokeWidth={3} />}
                                    </span>
                                    <span id="target-hint" className={`mt-1 block text-[11px] ${formatOk === false ? 'font-medium text-amber-700' : 'text-[#14121F]/45'}`}>{formatOk ? 'Looks right.' : brand.formatHint}</span>
                                </label>

                                <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                                    <div>
                                        <p className="text-xs font-semibold text-[#14121F]/60">Send when someone…</p>
                                        <div className="mt-1.5"><MomentPicker value={events} onChange={setEvents} /></div>
                                    </div>
                                    {kind !== 'hubspot' && (
                                        <label className="flex items-center gap-2.5 text-xs font-medium text-[#14121F]/65">
                                            Named viewers only
                                            <Switch checked={identifiedOnly} onChange={setIdentifiedOnly} label="Only named viewers" />
                                        </label>
                                    )}
                                </div>

                                <details className="group mt-3">
                                    <summary className="cursor-pointer list-none text-xs font-semibold text-[#14121F]/50 hover:text-[#14121F]/75">+ Give it a name <span className="font-normal">(optional)</span></summary>
                                    <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder={kind === 'slack' ? '#sales-alerts' : `${brand.name} for sales`} className={`${inputClass} mt-2`} />
                                </details>

                                {sameAs && (
                                    <div role="alert" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                        <span className="min-w-0 flex-1">
                                            <span className="font-semibold">Already connected as “{sameAs.name}”.</span> Adding it again would send every alert twice.
                                        </span>
                                        <button type="button" onClick={() => onShowExisting(sameAs.id)} className={`rounded-full bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950 ${focus}`}>Go to it</button>
                                    </div>
                                )}

                                {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

                                <button type="submit" disabled={busy || !trimmed || !events.length || Boolean(sameAs)} className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#14121F] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-16px_rgba(20,18,31,0.8)] transition hover:bg-[#2c2742] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${focus}`}>
                                    {busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Connecting…</> : <>Connect {brand.name} <ArrowRight className="h-4 w-4" /></>}
                                </button>
                                <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-4 text-[#14121F]/45"><ShieldCheck className="h-3.5 w-3.5 shrink-0" />{brand.caution} Stored encrypted.</p>
                            </div>
                        </form>

                        {/* Right: what it will look like, updated as the choices change. */}
                        <aside aria-label="Preview" className="relative hidden min-h-0 overflow-y-auto border-l border-[#14121F]/8 bg-[#F7F6FB] p-8 lg:block">
                            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: brand.tile }} />
                            <p className="relative text-xs font-bold uppercase tracking-wider text-[#14121F]/45">Live preview</p>
                            <p className="relative mt-1 text-sm text-[#14121F]/60">What you’ll get when {SAMPLE.name} from {SAMPLE.company} watches.</p>
                            <div className="relative mt-5">
                                {kind === 'slack' && <SlackPreview events={events} channel={name.trim() || '#sales-alerts'} identifiedOnly={identifiedOnly} />}
                                {kind === 'hubspot' && <HubSpotPreview events={events} />}
                                {kind === 'webhook' && <WebhookPreview event={events[0] ?? 'video.viewed'} />}
                            </div>
                        </aside>
                    </div>
                )}
            </div>
        </div>
    );
}

const SAMPLE_LINES: Record<NotificationType, { action: ReactNode; meta: string }> = {
    'video.viewed': { action: <>started watching <span className="font-semibold text-[#1264A3]">{SAMPLE.video}</span></>, meta: '4% watched · desktop · IN' },
    'video.completed': { action: <>watched <span className="font-semibold text-[#1264A3]">{SAMPLE.video}</span> to the end</>, meta: '100% watched · desktop · IN' },
    'cta.clicked': { action: <>clicked the button on <span className="font-semibold text-[#1264A3]">{SAMPLE.video}</span></>, meta: '82% watched · desktop · IN' },
    'form.submitted': { action: <>filled in <span className="font-semibold">Book a walkthrough</span> on <span className="font-semibold text-[#1264A3]">{SAMPLE.video}</span></>, meta: 'company: Acme · team_size: 51–200' },
    'call.booked': { action: <>booked a call from <span className="font-semibold text-[#1264A3]">{SAMPLE.video}</span></>, meta: '91% watched · desktop · IN' },
};

function SlackPreview({ events, channel, identifiedOnly }: { events: NotificationType[]; channel: string; identifiedOnly: boolean }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-[#14121F]/10 bg-white shadow-[0_24px_50px_-30px_rgba(20,18,31,0.5)]">
            <div className="flex items-center gap-2 border-b border-[#14121F]/8 bg-[#3F0E40] px-4 py-2.5">
                <span className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-white/25" /><span className="h-2.5 w-2.5 rounded-full bg-white/25" /><span className="h-2.5 w-2.5 rounded-full bg-white/25" /></span>
                <span className="ml-2 truncate text-xs font-semibold text-white/90">{channel.startsWith('#') ? channel : `# ${channel}`}</span>
            </div>
            <div className="space-y-4 p-4">
                {events.length === 0 && <p className="py-6 text-center text-sm text-[#14121F]/45">Pick at least one moment to send.</p>}
                {events.map((type, index) => (
                    <div key={type} className="animate-feed-in flex gap-3" style={{ animationDelay: `${index * 80}ms` }}>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6A4CFF] to-[#C04CFF] text-xs font-bold text-white">C</span>
                        <div className="min-w-0 text-[13px] leading-5">
                            <p><span className="font-bold">Cliprame</span> <span className="rounded bg-[#14121F]/[0.07] px-1 text-[10px] font-semibold text-[#14121F]/55">APP</span> <span className="text-[11px] text-[#14121F]/45">10:4{index + 2} AM</span></p>
                            <p className="mt-0.5"><span className="font-bold">{SAMPLE.name} ({SAMPLE.company})</span> {SAMPLE_LINES[type].action}</p>
                            <p className="mt-0.5 text-[11px] text-[#14121F]/50">{SAMPLE_LINES[type].meta} · {SAMPLE.email}</p>
                            <span className="mt-1.5 inline-block rounded-md border border-[#14121F]/15 px-2.5 py-1 text-[11px] font-semibold">View analytics</span>
                        </div>
                    </div>
                ))}
                {!identifiedOnly && events.includes('video.viewed') && (
                    <div className="flex gap-3 opacity-55">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6A4CFF] to-[#C04CFF] text-xs font-bold text-white">C</span>
                        <p className="text-[13px] leading-5"><span className="font-bold">Someone</span> started watching <span className="font-semibold text-[#1264A3]">{SAMPLE.video}</span><br /><span className="text-[11px] text-[#14121F]/50">Anonymous viewer · turn on “Named viewers only” to skip these</span></p>
                    </div>
                )}
            </div>
        </div>
    );
}

function HubSpotPreview({ events }: { events: NotificationType[] }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-[#14121F]/10 bg-white shadow-[0_24px_50px_-30px_rgba(20,18,31,0.5)]">
            <div className="flex items-center gap-3 border-b border-[#14121F]/8 p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF7A59]/15 text-sm font-bold text-[#C2462A]">AL</span>
                <div>
                    <p className="text-sm font-bold">{SAMPLE.name}</p>
                    <p className="text-xs text-[#14121F]/50">{SAMPLE.email} · {SAMPLE.company}</p>
                </div>
            </div>
            <div className="p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#14121F]/40">Activity</p>
                <ol className="mt-3 space-y-3 border-l-2 border-[#14121F]/8 pl-4">
                    {events.length === 0 && <li className="text-sm text-[#14121F]/45">Pick at least one moment to log.</li>}
                    {[...events].reverse().map((type, index) => (
                        <li key={type} className="animate-feed-in relative" style={{ animationDelay: `${index * 80}ms` }}>
                            <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#FF7A59]" />
                            <p className="text-[11px] font-semibold text-[#14121F]/45">Note · by Cliprame</p>
                            <p className="mt-0.5 text-[13px] leading-5"><span className="font-semibold">{SAMPLE.name} ({SAMPLE.company})</span> {SAMPLE_LINES[type].action}</p>
                            <p className="text-[11px] text-[#14121F]/50">{SAMPLE_LINES[type].meta.split(' · ')[0]} · View analytics in Cliprame</p>
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
}

function WebhookPreview({ event }: { event: NotificationType }) {
    const json = JSON.stringify({
        id: 'evt_7f3a…',
        type: event,
        video: { title: SAMPLE.video, shareUrl: 'https://…/v/…' },
        viewer: { name: SAMPLE.name, email: SAMPLE.email, company: SAMPLE.company, identified: true, device: 'desktop', country: 'IN' },
        watch: { percentWatched: event === 'video.completed' ? 1 : event === 'cta.clicked' ? 0.82 : 0.04, completed: event === 'video.completed', ctaClicked: event === 'cta.clicked' },
    }, null, 2);
    return (
        <div className="overflow-hidden rounded-2xl bg-[#14121F] shadow-[0_24px_50px_-30px_rgba(20,18,31,0.7)]">
            <div className="border-b border-white/10 px-4 py-3 font-mono text-[11px] leading-5 text-white/55">
                <p><span className="text-[#B6A6FF]">POST</span> your-endpoint</p>
                <p>Cliprame-Event: <span className="text-white/80">{event}</span></p>
                <p>Cliprame-Signature: <span className="text-white/80">t=…,v1=…</span></p>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[11.5px] leading-5 text-[#E9E5FF]">{json}</pre>
        </div>
    );
}

function ConnectedView({ kind, result, onDone, onUpdated }: { kind: IntegrationKind; result: { integration: Integration; signingSecret: string | null }; onDone: () => void; onUpdated: (integration: Integration) => void }) {
    const brand = BRANDS[kind];
    const [testing, setTesting] = useState(false);
    const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);

    const test = async () => {
        setTesting(true);
        setOutcome(null);
        try {
            const data = await videoApi<{ ok: boolean; error: string | null; integration: Integration | null }>(`/api/integrations/${result.integration.id}/test`, { method: 'POST' });
            if (data.integration) onUpdated(data.integration);
            setOutcome(data.ok
                ? { ok: true, text: kind === 'slack' ? 'Sent! Check your Slack channel.' : kind === 'hubspot' ? 'HubSpot accepted the token. You’re all set.' : 'Sent! Check your endpoint.' }
                : { ok: false, text: data.error ?? 'The test didn’t go through.' });
        } catch (cause) {
            setOutcome({ ok: false, text: (cause as Error).message });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="relative overflow-y-auto px-6 py-12 text-center sm:px-12">
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-64 w-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl" style={{ background: brand.tile }} />
            <div className="relative mx-auto flex w-fit items-center gap-3">
                <BrandTile kind={kind} size="lg" />
                <span className="h-px w-8 bg-gradient-to-r from-[#14121F]/20 to-emerald-400" />
                <span className="animate-pop-in flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_12px_30px_-10px_rgba(16,185,129,0.8)]"><Check className="h-7 w-7" strokeWidth={3} /></span>
            </div>
            <h2 id="connect-title" className={`${D} relative mt-6 text-3xl font-bold tracking-tight`}>{brand.name} is connected</h2>
            <p className="relative mx-auto mt-2 max-w-md text-[15px] leading-7 text-[#14121F]/60">
                {kind === 'slack' ? 'You’ll get a message in your channel the moment someone watches.' : kind === 'hubspot' ? 'Watches by named viewers will appear as notes on their contacts.' : 'We’ll POST signed JSON to your endpoint for each moment you chose.'}
            </p>

            {result.signingSecret && (
                <div className="relative mx-auto mt-6 max-w-lg text-left"><SecretBox name={result.integration.name} value={result.signingSecret} /></div>
            )}

            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={() => void test()} disabled={testing} className={`inline-flex items-center gap-2 rounded-full bg-[#14121F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742] disabled:opacity-60 ${focus}`}>
                    {testing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {kind === 'hubspot' ? 'Check connection' : 'Send a test message'}
                </button>
                <button type="button" onClick={onDone} className={`rounded-full px-5 py-2.5 text-sm font-semibold text-[#14121F]/65 hover:bg-[#14121F]/[0.05] hover:text-[#14121F] ${focus}`}>Done</button>
            </div>
            {outcome && <p role={outcome.ok ? 'status' : 'alert'} className={`animate-feed-in relative mt-4 text-sm font-medium ${outcome.ok ? 'text-emerald-700' : 'text-red-600'}`}>{outcome.text}</p>}
        </div>
    );
}

function SecretBox({ name, value, onClose }: { name: string; value: string; onClose?: () => void }) {
    const [copied, setCopied] = useState(false);
    return (
        <section role="status" className="rounded-2xl border border-[#6A4CFF]/25 bg-[#6A4CFF]/[0.05] p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold">Signing secret for {name}</p>
                    <p className="mt-0.5 text-xs leading-5 text-[#14121F]/60">Copy it now; it won’t be shown again. Use it to check the Cliprame-Signature header.</p>
                </div>
                {onClose && <button type="button" onClick={onClose} aria-label="Close" className={`rounded-full p-1 text-[#14121F]/50 hover:text-[#14121F] ${focus}`}><X className="h-4 w-4" /></button>}
            </div>
            <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2 font-mono text-[13px]">{value}</code>
                <button type="button" onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); }} className={`inline-flex items-center gap-1.5 rounded-xl bg-[#14121F] px-3 py-2 text-sm font-semibold text-white ${focus}`}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <details className="mt-3 text-xs text-[#14121F]/65">
                <summary className="cursor-pointer font-semibold">How to check a request</summary>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-white p-3 font-mono text-[11px] leading-5">{`// Header: Cliprame-Signature: t=1760000000,v1=<hex>
const [t, v1] = header.split(',').map((part) => part.split('=')[1]);
const expected = crypto.createHmac('sha256', SECRET).update(\`\${t}.\${rawBody}\`).digest('hex');
const valid = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))
    && Math.abs(Date.now() / 1000 - Number(t)) < 300;`}</pre>
            </details>
        </section>
    );
}

/* --------------------------- Connection card --------------------------- */

function StatusBadge({ integration }: { integration: Integration }) {
    if (!integration.enabled) return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#14121F]/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#14121F]/55"><span className="h-1.5 w-1.5 rounded-full bg-[#14121F]/35" />Paused</span>;
    if (integration.lastStatus === 'failed') return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700"><AlertTriangle className="h-3 w-3" />Needs attention</span>;
    if (integration.lastStatus === 'ok') {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-emerald-500" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>Live
            </span>
        );
    }
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6A4CFF]/10 px-2.5 py-1 text-[11px] font-semibold text-[#4B30D9]"><span className="h-1.5 w-1.5 rounded-full bg-[#6A4CFF]" />Waiting for the first view</span>;
}

function ConnectionCard({ integration, highlighted, onChange, onRemoved, onSecret }: { integration: Integration; highlighted: boolean; onChange: (integration: Integration) => void; onRemoved: () => void; onSecret: (value: string) => void }) {
    const brand = BRANDS[integration.kind];
    const [busy, setBusy] = useState<'test' | 'save' | 'remove' | null>(null);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [confirming, setConfirming] = useState(false);

    const patch = async (change: Record<string, unknown>) => {
        setBusy('save');
        setMessage(null);
        try {
            const data = await videoApi<{ integration: Integration; signingSecret: string | null }>(`/api/integrations/${integration.id}`, { method: 'PATCH', body: JSON.stringify(change) });
            onChange(data.integration);
            if (data.signingSecret) onSecret(data.signingSecret);
        } catch (cause) {
            setMessage({ ok: false, text: (cause as Error).message });
        } finally {
            setBusy(null);
        }
    };

    const test = async () => {
        setBusy('test');
        setMessage(null);
        try {
            const data = await videoApi<{ ok: boolean; error: string | null; integration: Integration | null }>(`/api/integrations/${integration.id}/test`, { method: 'POST' });
            if (data.integration) onChange(data.integration);
            setMessage(data.ok
                ? { ok: true, text: integration.kind === 'hubspot' ? 'HubSpot accepted the token.' : 'Test sent. Check that it arrived.' }
                : { ok: false, text: data.error ?? 'The test didn’t go through.' });
        } catch (cause) {
            setMessage({ ok: false, text: (cause as Error).message });
        } finally {
            setBusy(null);
        }
    };

    const remove = async () => {
        setBusy('remove');
        try {
            await videoApi(`/api/integrations/${integration.id}`, { method: 'DELETE' });
            onRemoved();
        } catch (cause) {
            setMessage({ ok: false, text: (cause as Error).message });
            setBusy(null);
        }
    };

    const ghost = `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${focus}`;

    return (
        <li id={`integration-${integration.id}`} className={`group scroll-mt-24 rounded-3xl border bg-white p-5 transition duration-500 hover:shadow-[0_18px_40px_-30px_rgba(20,18,31,0.45)] ${highlighted ? 'border-[#6A4CFF] ring-4 ring-[#6A4CFF]/15' : integration.lastStatus === 'failed' && integration.enabled ? 'border-red-200' : 'border-[#14121F]/8'}`}>
            <div className="flex flex-wrap items-start gap-4">
                <div className={integration.enabled ? '' : 'opacity-50 grayscale'}><BrandTile kind={integration.kind} /></div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold">{integration.name}</p>
                        <StatusBadge integration={integration} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#14121F]/50">
                        {brand.name} · <span className="font-mono">{integration.targetHint}</span>
                        {integration.lastDeliveredAt && <> · last sent {timeAgo(integration.lastDeliveredAt)}</>}
                    </p>
                    {integration.lastStatus === 'failed' && integration.lastError && <p className="mt-1.5 text-xs font-medium text-red-600">{integration.lastError}</p>}
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-[#14121F]/55">
                    {integration.enabled ? 'On' : 'Off'}
                    <Switch checked={integration.enabled} onChange={(enabled) => void patch({ enabled })} label={integration.enabled ? `Pause ${integration.name}` : `Turn on ${integration.name}`} />
                </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-[#F7F6FB] px-4 py-3">
                <MomentPicker compact value={integration.events} disabled={busy !== null} onChange={(events) => { if (events.length) void patch({ events }); }} />
                {integration.kind !== 'hubspot' && (
                    <label className="ml-auto flex items-center gap-2 text-[11px] font-medium text-[#14121F]/60">
                        Named viewers only
                        <Switch checked={integration.identifiedOnly} onChange={(identifiedOnly) => void patch({ identifiedOnly })} label="Only named viewers" />
                    </label>
                )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1">
                <button type="button" onClick={() => void test()} disabled={busy !== null} className={`${ghost} bg-[#14121F] text-white hover:bg-[#2c2742]`}>
                    {busy === 'test' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {integration.kind === 'hubspot' ? 'Check connection' : 'Send test'}
                </button>
                {integration.kind === 'webhook' && (
                    <button type="button" onClick={() => void patch({ rotateSecret: true })} disabled={busy !== null} className={`${ghost} text-[#14121F]/65 hover:bg-[#14121F]/[0.05] hover:text-[#14121F]`}>
                        <RefreshCw className="h-3.5 w-3.5" /> New signing secret
                    </button>
                )}
                {message && <p role={message.ok ? 'status' : 'alert'} className={`animate-feed-in ml-2 text-xs font-medium ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>}
                {confirming ? (
                    <span className="ml-auto inline-flex items-center gap-2 text-xs">
                        Remove {integration.name}?
                        <button type="button" onClick={() => void remove()} disabled={busy !== null} className={`rounded-full bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50 ${focus}`}>Remove</button>
                        <button type="button" onClick={() => setConfirming(false)} className={`rounded-full px-2 py-1.5 font-semibold text-[#14121F]/60 ${focus}`}>Cancel</button>
                    </span>
                ) : (
                    <button type="button" onClick={() => setConfirming(true)} className={`${ghost} ml-auto text-[#14121F]/45 hover:bg-red-50 hover:text-red-600`}><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                )}
            </div>
        </li>
    );
}
