'use client';

import { useId, useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { PublicFormInteraction } from '@/lib/videos/interactions';

/** Where the viewer is: link parameters (UTM tags), referrer and address. Embeds pass the host page's. */
export interface PageContext {
    query: Record<string, string>;
    referrer: string;
    pageUrl: string;
    source: 'share' | 'embed';
}

/** The page an embedded video sits on, passed in by embed.js (the iframe can't see it). */
export interface HostPage { query: string; pageUrl: string; referrer: string }

/** Reads the context in the browser. For embeds, `host` carries the page the video is embedded on. */
export function readPageContext(source: 'share' | 'embed', host?: HostPage | null): PageContext {
    if (host) return { query: Object.fromEntries(new URLSearchParams(host.query)), referrer: host.referrer, pageUrl: host.pageUrl, source };
    return { query: Object.fromEntries(new URLSearchParams(window.location.search)), referrer: document.referrer, pageUrl: window.location.href, source };
}

const viewerKey = () => {
    try { return localStorage.getItem('cliprame-viewer'); } catch { return null; }
};

interface Props {
    form: PublicFormInteraction;
    slug: string;
    source: 'share' | 'embed';
    host?: HostPage | null;
    accessToken?: string | null;
    tone: 'light' | 'dark';
    /** Recipient's email for personal links, to save them typing it. */
    prefillEmail?: string | null;
    onDone: (result: { playbackUrl?: string; posterUrl?: string | null }) => void;
    onSkip?: () => void;
}

export function LeadForm({ form, slug, source, host = null, accessToken = null, tone, prefillEmail = null, onDone, onSkip }: Props) {
    const uid = useId();
    const [values, setValues] = useState<Record<string, string | boolean>>(() => {
        const first = form.fields.find((field) => field.type === 'email');
        return first && prefillEmail ? { [first.name]: prefillEmail } : {};
    });
    const [honeypot, setHoneypot] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const dark = tone === 'dark';

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, interactionId: form.id, answers: values, context: readPageContext(source, host), viewerKey: viewerKey(), accessToken, website: honeypot }),
            });
            const data = await response.json().catch(() => ({})) as { error?: string; playbackUrl?: string; posterUrl?: string | null };
            if (!response.ok) { setError(data.error ?? 'Something went wrong. Please try again.'); return; }
            onDone(data);
        } catch {
            setError('Couldn’t reach the server. Check your connection and try again.');
        } finally {
            setBusy(false);
        }
    };

    const input = `w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none transition ${dark ? 'border-white/15 bg-white/10 text-white placeholder:text-white/40 focus:border-white/50' : 'border-[#14121F]/12 bg-[#F7F6FB] text-[#14121F] focus:border-[#6A4CFF] focus:bg-white focus:ring-4 focus:ring-[#6A4CFF]/10'}`;
    const label = `text-xs font-semibold ${dark ? 'text-white/70' : 'text-[#14121F]/65'}`;

    return (
        <form onSubmit={submit} className="w-full">
            {form.title && <h2 className={`text-lg font-semibold ${dark ? 'text-white' : 'text-[#14121F]'}`}>{form.title}</h2>}
            {form.text && <p className={`mt-0.5 text-sm ${dark ? 'text-white/65' : 'text-[#14121F]/60'}`}>{form.text}</p>}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {form.fields.map((field) => {
                    const id = `${uid}-${field.name}`;
                    const wide = field.type === 'textarea' || field.type === 'checkbox' || form.fields.length < 3;
                    const value = values[field.name];
                    const set = (next: string | boolean) => setValues((current) => ({ ...current, [field.name]: next }));
                    if (field.type === 'checkbox') {
                        return (
                            <label key={field.name} htmlFor={id} className={`flex items-start gap-2.5 text-sm sm:col-span-2 ${dark ? 'text-white/80' : 'text-[#14121F]/80'}`}>
                                <input id={id} type="checkbox" checked={value === true} required={field.required} onChange={(event) => set(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#6A4CFF]" />
                                {field.label}{field.required && ' *'}
                            </label>
                        );
                    }
                    return (
                        <label key={field.name} htmlFor={id} className={`block ${wide ? 'sm:col-span-2' : ''}`}>
                            <span className={label}>{field.label}{field.required && ' *'}</span>
                            {field.type === 'textarea' ? (
                                <textarea id={id} rows={3} required={field.required} value={typeof value === 'string' ? value : ''} onChange={(event) => set(event.target.value)} className={`${input} mt-1 resize-y`} />
                            ) : field.type === 'select' ? (
                                <select id={id} required={field.required} value={typeof value === 'string' ? value : ''} onChange={(event) => set(event.target.value)} className={`${input} mt-1`}>
                                    <option value="" disabled>Choose…</option>
                                    {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                            ) : (
                                <input
                                    id={id}
                                    type={field.type}
                                    required={field.required}
                                    value={typeof value === 'string' ? value : ''}
                                    onChange={(event) => set(event.target.value)}
                                    autoComplete={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : /first/i.test(field.name) ? 'given-name' : /last/i.test(field.name) ? 'family-name' : /company|org/i.test(field.name) ? 'organization' : /name/i.test(field.name) ? 'name' : 'on'}
                                    className={`${input} mt-1`}
                                />
                            )}
                        </label>
                    );
                })}
            </div>

            {/* Hidden from people, irresistible to bots. */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />

            {error && <p role="alert" className={`mt-3 text-sm font-medium ${dark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="submit" disabled={busy} className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${onSkip ? '' : 'w-full'} ${dark ? 'bg-white text-[#14121F] hover:bg-white/90' : 'bg-[#6A4CFF] text-white hover:bg-[#5839e0]'}`}>
                    {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{form.submitLabel}
                </button>
                {onSkip && <button type="button" onClick={onSkip} className={`text-sm font-semibold ${dark ? 'text-white/65 hover:text-white' : 'text-[#14121F]/55 hover:text-[#14121F]'}`}>Skip and keep watching</button>}
            </div>
            {form.consent && <p className={`mt-3 text-[11px] leading-4 ${dark ? 'text-white/45' : 'text-[#14121F]/45'}`}>{form.consent}</p>}
        </form>
    );
}
