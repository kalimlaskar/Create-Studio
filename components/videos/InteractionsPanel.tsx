'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    AlertTriangle, ArrowDown, ArrowUp, CalendarCheck, ClipboardList, EyeOff, LoaderCircle, Lock, MousePointerClick, Pencil, Plus, Trash2, X,
} from 'lucide-react';
import {
    DEFAULT_CONSENT, FIELD_TYPES, HIDDEN_TOKENS, MAX_FIELDS, MAX_HIDDEN, newInteractionId, normalizeInteractions,
    type FieldType, type FormField, type HiddenField, type Interaction, type InteractionType, type Placement,
} from '@/lib/videos/interactions';
import { formatClock, parseClock } from '@/lib/videos/types';
import { focus } from './ui';

const inputClass = 'w-full rounded-xl border border-[#14121F]/12 bg-[#F7F6FB] px-3 py-2 text-sm outline-none transition focus:border-[#6A4CFF] focus:bg-white focus:ring-4 focus:ring-[#6A4CFF]/10';
const label = 'text-xs font-semibold text-[#14121F]/60';

const KIND: Record<InteractionType, { name: string; icon: typeof ClipboardList; hint: string }> = {
    form: { name: 'Form', icon: ClipboardList, hint: 'Collect details, before or during the video' },
    button: { name: 'Button', icon: MousePointerClick, hint: 'A link at a moment or at the end' },
    booking: { name: 'Booking', icon: CalendarCheck, hint: 'Calendly, Cal.com or HubSpot meetings' },
};

/** HubSpot's default property names, so forms map straight onto contacts. */
const FIELD_PRESETS: FormField[] = [
    { name: 'email', label: 'Work email', type: 'email', required: true },
    { name: 'firstname', label: 'First name', type: 'text', required: false },
    { name: 'lastname', label: 'Last name', type: 'text', required: false },
    { name: 'company', label: 'Company', type: 'text', required: false },
    { name: 'jobtitle', label: 'Job title', type: 'text', required: false },
    { name: 'phone', label: 'Phone', type: 'tel', required: false },
];

const UTM_FIELDS: HiddenField[] = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].map((name) => ({ name, value: `{${name}}` }));

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

function blank(type: InteractionType, hasGate: boolean): Interaction {
    const base = { id: newInteractionId(), atMs: null, skippable: true, text: '' };
    if (type === 'button') return { ...base, type, placement: 'end', title: 'Liked what you saw?', label: 'Book a demo', url: '' };
    if (type === 'booking') return { ...base, type, placement: 'end', title: 'Book a time with me', url: '' };
    return {
        ...base,
        type,
        placement: hasGate ? 'end' : 'start',
        title: hasGate ? 'Want the full proposal?' : 'Before you watch',
        text: hasGate ? '' : 'Tell us who you are and the video starts right away.',
        fields: FIELD_PRESETS.slice(0, 2).concat(FIELD_PRESETS[3]),
        hidden: [],
        submitLabel: hasGate ? 'Send' : 'Watch the video',
        consent: DEFAULT_CONSENT,
        destination: { kind: 'none' },
    };
}

function placementText(item: Interaction) {
    if (item.placement === 'start') return 'Before the video · required';
    if (item.placement === 'end') return 'At the end';
    return `At ${formatClock(item.atMs ?? 0)}${item.type === 'form' ? (item.skippable ? ' · can skip' : ' · required') : ''}`;
}

/* --------------------------------- Panel -------------------------------- */

export function InteractionsPanel({ interactions, durationMs, currentMs, onSave }: { interactions: Interaction[]; durationMs: number; currentMs: number; onSave: (interactions: Interaction[]) => Promise<boolean> }) {
    const [editing, setEditing] = useState<Interaction | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const hasGate = interactions.some((item) => item.placement === 'start');

    const save = async (list: Interaction[]) => {
        const result = normalizeInteractions(list, durationMs);
        if (!result.ok) return result.error;
        return (await onSave(result.interactions)) ? null : 'Could not save. Check the message above and try again.';
    };

    const remove = async (id: string) => {
        setBusyId(id);
        await save(interactions.filter((item) => item.id !== id));
        setBusyId(null);
    };

    return (
        <div className="space-y-3">
            <div>
                <p className="text-sm font-semibold">Forms, buttons and bookings</p>
                <p className="mt-0.5 text-xs leading-5 text-[#14121F]/55">Show them before the video, at a moment, or at the end. The video pauses for them.</p>
            </div>

            {interactions.length > 0 && (
                <ul className="space-y-2">
                    {interactions.map((item) => {
                        const { icon: Icon, name } = KIND[item.type];
                        return (
                            <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-[#14121F]/8 bg-white p-3">
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.placement === 'start' ? 'bg-[#14121F] text-white' : 'bg-[#6A4CFF]/10 text-[#6A4CFF]'}`}>{item.placement === 'start' ? <Lock className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold">{item.type === 'button' ? item.label : item.title || name}</span>
                                    <span className="block truncate text-xs text-[#14121F]/50">
                                        {name} · {placementText(item)}
                                        {item.type === 'form' && item.destination.kind !== 'none' && ` · to ${item.destination.kind === 'hubspot' ? 'HubSpot' : 'your URL'}`}
                                    </span>
                                </span>
                                <button type="button" onClick={() => setEditing(item)} aria-label={`Edit ${name}`} className={`rounded-lg p-2 text-[#14121F]/50 hover:bg-[#14121F]/[0.05] hover:text-[#14121F] ${focus}`}><Pencil className="h-4 w-4" /></button>
                                <button type="button" onClick={() => void remove(item.id)} disabled={busyId === item.id} aria-label={`Remove ${name}`} className={`rounded-lg p-2 text-[#14121F]/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 ${focus}`}>
                                    {busyId === item.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="grid grid-cols-3 gap-2">
                {(Object.keys(KIND) as InteractionType[]).map((type) => {
                    const { icon: Icon, name } = KIND[type];
                    return (
                        <button key={type} type="button" onClick={() => setEditing(blank(type, hasGate))} title={KIND[type].hint} className={`flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-[#14121F]/15 px-2 py-3 text-xs font-semibold text-[#14121F]/65 transition hover:border-[#6A4CFF]/50 hover:bg-[#6A4CFF]/[0.04] hover:text-[#14121F] ${focus}`}>
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#6A4CFF]/10 text-[#6A4CFF]"><Icon className="h-4 w-4" /></span>
                            <span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" />{name}</span>
                        </button>
                    );
                })}
            </div>

            {editing && (
                <Editor
                    key={editing.id}
                    initial={editing}
                    isNew={!interactions.some((item) => item.id === editing.id)}
                    gateTaken={hasGate && editing.placement !== 'start'}
                    durationMs={durationMs}
                    currentMs={currentMs}
                    onClose={() => setEditing(null)}
                    onSave={async (draft) => {
                        const exists = interactions.some((item) => item.id === draft.id);
                        const error = await save(exists ? interactions.map((item) => (item.id === draft.id ? draft : item)) : [...interactions, draft]);
                        if (!error) setEditing(null);
                        return error;
                    }}
                />
            )}
        </div>
    );
}

/* -------------------------------- Editor -------------------------------- */

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
    return (
        <section className="border-t border-[#14121F]/[0.07] pt-5">
            <h3 className="text-sm font-semibold">{title}</h3>
            {hint && <p className="mt-0.5 text-xs leading-5 text-[#14121F]/55">{hint}</p>}
            <div className="mt-3">{children}</div>
        </section>
    );
}

function Editor({ initial, isNew, gateTaken, durationMs, currentMs, onClose, onSave }: {
    initial: Interaction;
    isNew: boolean;
    /** Another form already sits before the video. */
    gateTaken: boolean;
    durationMs: number;
    currentMs: number;
    onClose: () => void;
    onSave: (draft: Interaction) => Promise<string | null>;
}) {
    const [draft, setDraft] = useState<Interaction>(initial);
    const [time, setTime] = useState(formatClock(initial.atMs ?? currentMs));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const panelRef = useRef<HTMLDivElement>(null);
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

    const update = (change: Partial<Interaction>) => { setError(''); setDraft((current) => ({ ...current, ...change }) as Interaction); };
    const { icon: Icon, name } = KIND[draft.type];

    const submit = async () => {
        let atMs: number | null = null;
        if (draft.placement === 'time') {
            atMs = parseClock(time);
            if (atMs === null) { setError('Enter the time like 1:20.'); return; }
        }
        setBusy(true);
        const message = await onSave({ ...draft, atMs } as Interaction);
        setBusy(false);
        if (message) setError(message);
    };

    const placements: Array<{ id: Placement; label: string; hint: string; disabled?: boolean }> = [
        ...(draft.type === 'form' ? [{ id: 'start' as const, label: 'Before the video', hint: gateTaken ? 'Another form is already the gate' : 'A gate: no form, no video', disabled: gateTaken }] : []),
        { id: 'time', label: 'At a moment', hint: 'The video pauses for it' },
        { id: 'end', label: 'At the end', hint: 'When the video finishes' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#14121F]/55 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="editor-title" className="animate-dialog-in flex w-full max-w-2xl flex-col overflow-hidden bg-white outline-none sm:max-h-[min(54rem,92vh)] sm:rounded-[1.75rem] sm:shadow-[0_40px_120px_-30px_rgba(20,18,31,0.6)]">
                <div className="flex items-center gap-3 border-b border-[#14121F]/[0.07] px-6 py-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6A4CFF]/10 text-[#6A4CFF]"><Icon className="h-5 w-5" /></span>
                    <h2 id="editor-title" className="flex-1 text-lg font-semibold">{isNew ? `Add a ${name.toLowerCase()}` : `Edit ${name.toLowerCase()}`}</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className={`rounded-full p-2 text-[#14121F]/50 hover:bg-[#14121F]/[0.06] hover:text-[#14121F] ${focus}`}><X className="h-4 w-4" /></button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                    {/* When */}
                    <div>
                        <p className={label}>When it appears</p>
                        <div role="radiogroup" aria-label="When it appears" className={`mt-1.5 grid gap-2 ${placements.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                            {placements.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={draft.placement === option.id}
                                    disabled={option.disabled}
                                    onClick={() => update({ placement: option.id, ...(option.id === 'start' && draft.type === 'form' ? { submitLabel: draft.submitLabel === 'Send' ? 'Watch the video' : draft.submitLabel } : {}) })}
                                    className={`rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${draft.placement === option.id ? 'border-[#6A4CFF] bg-[#6A4CFF]/[0.06]' : 'border-[#14121F]/10 enabled:hover:border-[#14121F]/25'} ${focus}`}
                                >
                                    <span className="flex items-center gap-1.5 text-sm font-semibold">{option.id === 'start' && <Lock className="h-3.5 w-3.5" />}{option.label}</span>
                                    <span className="block text-[11px] text-[#14121F]/50">{option.hint}</span>
                                </button>
                            ))}
                        </div>
                        {draft.placement === 'time' && (
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-2 text-sm">
                                    <span className={label}>At</span>
                                    <input value={time} onChange={(event) => setTime(event.target.value)} className={`${inputClass} w-24 text-center tabular-nums`} aria-label="Time in the video" />
                                </label>
                                <button type="button" onClick={() => setTime(formatClock(currentMs))} className={`rounded-full border border-[#14121F]/12 px-3 py-1.5 text-xs font-semibold hover:border-[#14121F]/25 ${focus}`}>Use player time ({formatClock(currentMs)})</button>
                                <span className="text-xs text-[#14121F]/45">of {formatClock(durationMs)}</span>
                                {draft.type === 'form' && (
                                    <label className="ml-auto flex items-center gap-2 text-xs font-medium text-[#14121F]/65">
                                        <input type="checkbox" checked={draft.skippable} onChange={(event) => update({ skippable: event.target.checked })} className="h-4 w-4 accent-[#6A4CFF]" />
                                        Viewers can skip it
                                    </label>
                                )}
                            </div>
                        )}
                        {draft.placement === 'start' && <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-[#14121F]/55"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />The video isn’t sent to the viewer until they submit. Whoever fills it in shows up by name in your analytics.</p>}
                    </div>

                    {/* What it says */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className={label}>Heading</span>
                            <input value={draft.title} onChange={(event) => update({ title: event.target.value })} maxLength={100} className={`${inputClass} mt-1`} />
                        </label>
                        {draft.type === 'button' ? (
                            <label className="block">
                                <span className={label}>Button text</span>
                                <input value={draft.label} onChange={(event) => update({ label: event.target.value })} maxLength={40} className={`${inputClass} mt-1`} />
                            </label>
                        ) : draft.type === 'form' ? (
                            <label className="block">
                                <span className={label}>Submit button</span>
                                <input value={draft.submitLabel} onChange={(event) => update({ submitLabel: event.target.value })} maxLength={40} className={`${inputClass} mt-1`} />
                            </label>
                        ) : null}
                        <label className="block sm:col-span-2">
                            <span className={label}>Short message (optional)</span>
                            <input value={draft.text} onChange={(event) => update({ text: event.target.value })} maxLength={300} className={`${inputClass} mt-1`} />
                        </label>
                        {(draft.type === 'button' || draft.type === 'booking') && (
                            <label className="block sm:col-span-2">
                                <span className={label}>{draft.type === 'booking' ? 'Booking page link' : 'Link'}</span>
                                <input value={draft.url} onChange={(event) => update({ url: event.target.value })} type="url" placeholder={draft.type === 'booking' ? 'https://calendly.com/you/30min' : 'https://…'} className={`${inputClass} mt-1 font-mono text-[13px]`} />
                                {draft.type === 'booking' && <span className="mt-1 block text-[11px] leading-4 text-[#14121F]/45">Calendly, Cal.com and HubSpot meeting links open inside the player. With Calendly, bookings show up in analytics and alerts automatically.</span>}
                            </label>
                        )}
                    </div>

                    {draft.type === 'form' && <FormSections draft={draft} update={update} />}
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-[#14121F]/[0.07] px-6 py-4">
                    {error && <p role="alert" className="flex min-w-0 flex-1 items-start gap-2 text-sm font-medium text-red-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
                    <div className="ml-auto flex gap-2">
                        <button type="button" onClick={onClose} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-[#14121F]/60 hover:text-[#14121F] ${focus}`}>Cancel</button>
                        <button type="button" onClick={() => void submit()} disabled={busy} className={`inline-flex items-center gap-2 rounded-xl bg-[#14121F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742] disabled:opacity-50 ${focus}`}>
                            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{isNew ? `Add ${name.toLowerCase()}` : 'Save changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------------------------- Form sections ----------------------------- */

type FormDraft = Extract<Interaction, { type: 'form' }>;

function FormSections({ draft, update }: { draft: FormDraft; update: (change: Partial<FormDraft>) => void }) {
    const setField = (index: number, change: Partial<FormField>) => {
        const fields = draft.fields.map((field, i) => {
            if (i !== index) return field;
            // The field name follows the label until the creator types their own.
            const followsLabel = !field.name || field.name === slug(field.label);
            return { ...field, ...change, ...(change.label !== undefined && followsLabel && change.name === undefined ? { name: slug(change.label) } : {}) };
        });
        update({ fields });
    };
    const move = (index: number, by: number) => {
        const fields = [...draft.fields];
        const [field] = fields.splice(index, 1);
        fields.splice(index + by, 0, field);
        update({ fields });
    };
    const setHidden = (index: number, change: Partial<HiddenField>) => update({ hidden: draft.hidden.map((field, i) => (i === index ? { ...field, ...change } : field)) });
    const unusedPresets = FIELD_PRESETS.filter((preset) => !draft.fields.some((field) => field.name === preset.name));
    const destination = draft.destination;

    return (
        <>
            <Section title="Fields" hint="The field name is what’s sent on submission. For HubSpot, use the property’s internal name, like email, firstname or company.">
                <ul className="space-y-2">
                    {draft.fields.map((field, index) => (
                        <li key={index} className="rounded-2xl border border-[#14121F]/8 bg-[#F7F6FB]/60 p-3">
                            <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_0.8fr_auto]">
                                <input value={field.label} onChange={(event) => setField(index, { label: event.target.value })} placeholder="Label" aria-label="Label" maxLength={80} className={inputClass} />
                                <input value={field.name} onChange={(event) => setField(index, { name: event.target.value.replace(/[^A-Za-z0-9_.-]/g, '') })} placeholder="field_name" aria-label="Field name" maxLength={60} className={`${inputClass} font-mono text-[13px]`} />
                                <select value={field.type} onChange={(event) => setField(index, { type: event.target.value as FieldType, ...(event.target.value === 'select' && !field.options?.length ? { options: ['Option 1', 'Option 2'] } : {}) })} aria-label="Type" className={inputClass}>
                                    {FIELD_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                                </select>
                                <div className="flex items-center gap-0.5">
                                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up" className={`rounded-lg p-1.5 text-[#14121F]/45 hover:text-[#14121F] disabled:opacity-25 ${focus}`}><ArrowUp className="h-4 w-4" /></button>
                                    <button type="button" onClick={() => move(index, 1)} disabled={index === draft.fields.length - 1} aria-label="Move down" className={`rounded-lg p-1.5 text-[#14121F]/45 hover:text-[#14121F] disabled:opacity-25 ${focus}`}><ArrowDown className="h-4 w-4" /></button>
                                    <button type="button" onClick={() => update({ fields: draft.fields.filter((_, i) => i !== index) })} aria-label="Remove field" className={`rounded-lg p-1.5 text-[#14121F]/40 hover:text-red-600 ${focus}`}><Trash2 className="h-4 w-4" /></button>
                                </div>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-1.5 text-xs font-medium text-[#14121F]/65">
                                    <input type="checkbox" checked={field.required} onChange={(event) => setField(index, { required: event.target.checked })} className="h-3.5 w-3.5 accent-[#6A4CFF]" /> Required
                                </label>
                                {field.type === 'select' && (
                                    <input value={(field.options ?? []).join(', ')} onChange={(event) => setField(index, { options: event.target.value.split(',').map((option) => option.trimStart()) })} placeholder="Choices, separated by commas" aria-label="Choices" className={`${inputClass} min-w-0 flex-1 py-1.5 text-xs`} />
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <button type="button" disabled={draft.fields.length >= MAX_FIELDS} onClick={() => update({ fields: [...draft.fields, { name: '', label: '', type: 'text', required: false }] })} className={`inline-flex items-center gap-1 rounded-full bg-[#14121F] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 ${focus}`}><Plus className="h-3.5 w-3.5" /> Field</button>
                    {unusedPresets.map((preset) => (
                        <button key={preset.name} type="button" disabled={draft.fields.length >= MAX_FIELDS} onClick={() => update({ fields: [...draft.fields, preset] })} className={`rounded-full border border-[#14121F]/12 px-2.5 py-1 text-xs font-semibold text-[#14121F]/65 hover:border-[#14121F]/25 hover:text-[#14121F] disabled:opacity-40 ${focus}`}>+ {preset.label}</button>
                    ))}
                </div>
            </Section>

            <Section title="Hidden fields" hint="Sent with every submission but never shown, or visible in the page. Use them to track where a lead came from.">
                {draft.hidden.length > 0 && (
                    <ul className="space-y-2">
                        {draft.hidden.map((field, index) => (
                            <li key={index} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                                <input value={field.name} onChange={(event) => setHidden(index, { name: event.target.value.replace(/[^A-Za-z0-9_.-]/g, '') })} placeholder="field_name" aria-label="Hidden field name" maxLength={60} className={`${inputClass} font-mono text-[13px]`} />
                                <div className="flex gap-1.5">
                                    <input value={field.value} onChange={(event) => setHidden(index, { value: event.target.value })} placeholder="Value or {token}" aria-label="Hidden field value" maxLength={300} className={`${inputClass} min-w-0 font-mono text-[13px]`} />
                                    <select
                                        value=""
                                        onChange={(event) => { if (event.target.value) setHidden(index, { value: `${field.value}${event.target.value}` }); }}
                                        aria-label="Insert a token"
                                        className={`${inputClass} w-28 shrink-0 text-xs`}
                                    >
                                        <option value="">+ Token</option>
                                        {HIDDEN_TOKENS.map((token) => <option key={token.token} value={token.token}>{token.label}</option>)}
                                    </select>
                                </div>
                                <button type="button" onClick={() => update({ hidden: draft.hidden.filter((_, i) => i !== index) })} aria-label="Remove hidden field" className={`justify-self-start rounded-lg p-2 text-[#14121F]/40 hover:text-red-600 ${focus}`}><Trash2 className="h-4 w-4" /></button>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <button type="button" disabled={draft.hidden.length >= MAX_HIDDEN} onClick={() => update({ hidden: [...draft.hidden, { name: '', value: '' }] })} className={`inline-flex items-center gap-1 rounded-full bg-[#14121F] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 ${focus}`}><EyeOff className="h-3.5 w-3.5" /> Hidden field</button>
                    {!draft.hidden.some((field) => field.name === 'utm_source') && (
                        <button type="button" onClick={() => update({ hidden: [...draft.hidden, ...UTM_FIELDS].slice(0, MAX_HIDDEN) })} className={`rounded-full border border-[#14121F]/12 px-2.5 py-1 text-xs font-semibold text-[#14121F]/65 hover:border-[#14121F]/25 hover:text-[#14121F] ${focus}`}>+ UTM fields</button>
                    )}
                </div>
                <p className="mt-2 text-[11px] leading-4 text-[#14121F]/45">
                    Tokens are filled in when the form is sent. UTM tags come from the link the viewer opened, e.g. <span className="font-mono">…/v/abc?utm_source=linkedin</span>, or from the page your video is embedded on. <span className="font-mono">{'{param:ref}'}</span> reads any other link parameter.
                </p>
            </Section>

            <Section title="Where submissions go" hint="Every submission is saved here and sent to your Slack, HubSpot and webhook integrations. You can also send it to your own form.">
                <div role="radiogroup" aria-label="Where submissions go" className="grid gap-2 sm:grid-cols-3">
                    {([['none', 'Cliprame only'], ['hubspot', 'A HubSpot form'], ['url', 'Another form or URL']] as const).map(([kind, text]) => (
                        <button
                            key={kind}
                            type="button"
                            role="radio"
                            aria-checked={destination.kind === kind}
                            onClick={() => update({ destination: kind === 'hubspot' ? { kind, portalId: '', formId: '' } : kind === 'url' ? { kind, url: '', format: 'json' } : { kind } })}
                            className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${destination.kind === kind ? 'border-[#6A4CFF] bg-[#6A4CFF]/[0.06]' : 'border-[#14121F]/10 hover:border-[#14121F]/25'} ${focus}`}
                        >{text}</button>
                    ))}
                </div>
                {destination.kind === 'hubspot' && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.6fr]">
                        <label className="block">
                            <span className={label}>Portal ID (Hub ID)</span>
                            <input value={destination.portalId} onChange={(event) => update({ destination: { ...destination, portalId: event.target.value.replace(/\D/g, '') } })} placeholder="12345678" inputMode="numeric" className={`${inputClass} mt-1 font-mono text-[13px]`} />
                        </label>
                        <label className="block">
                            <span className={label}>Form ID</span>
                            <input value={destination.formId} onChange={(event) => update({ destination: { ...destination, formId: event.target.value.trim() } })} placeholder="1a2b3c4d-5e6f-…" className={`${inputClass} mt-1 font-mono text-[13px]`} />
                        </label>
                        <p className="text-[11px] leading-4 text-[#14121F]/50 sm:col-span-2">
                            Find both in HubSpot under Marketing → Forms → your form → Share → Embed code (<span className="font-mono">portalId</span> and <span className="font-mono">formId</span>). Every field name here, including hidden ones, must exist on that HubSpot form; add tracking fields there as hidden fields.
                        </p>
                    </div>
                )}
                {destination.kind === 'url' && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1.6fr_1fr]">
                        <label className="block">
                            <span className={label}>Post submissions to</span>
                            <input value={destination.url} onChange={(event) => update({ destination: { ...destination, url: event.target.value } })} type="url" placeholder="https://…" className={`${inputClass} mt-1 font-mono text-[13px]`} />
                        </label>
                        <label className="block">
                            <span className={label}>Send as</span>
                            <select value={destination.format} onChange={(event) => update({ destination: { ...destination, format: event.target.value === 'form' ? 'form' : 'json' } })} className={`${inputClass} mt-1`}>
                                <option value="json">JSON</option>
                                <option value="form">Form fields (urlencoded)</option>
                            </select>
                        </label>
                        <p className="text-[11px] leading-4 text-[#14121F]/50 sm:col-span-2">Each field is sent under its field name, hidden fields included. Use “Form fields” for Salesforce Web-to-Lead, Pardot form handlers and classic form backends; JSON for Zapier, Make and your own code.</p>
                    </div>
                )}
            </Section>

            <Section title="Consent text" hint="Shown under the form. Mention how you’ll use their details.">
                <textarea value={draft.consent} onChange={(event) => update({ consent: event.target.value })} rows={2} maxLength={300} className={`${inputClass} resize-y`} />
            </Section>
        </>
    );
}
