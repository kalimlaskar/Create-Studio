// In-video forms, buttons and booking embeds. Shared by the studio editor, the
// server and the players. Pure functions, so they can be unit-tested.
import { normalizeCtaUrl } from './types';

export type InteractionType = 'form' | 'button' | 'booking';
/** Before the video (a gate, forms only), at a moment while it plays, or when it ends. */
export type Placement = 'start' | 'time' | 'end';
export type FieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';

export interface FormField {
    /** The key sent on submission, e.g. "email" or a HubSpot property like "firstname". */
    name: string;
    label: string;
    type: FieldType;
    required: boolean;
    options?: string[];
}

/** A value sent with every submission without the viewer seeing it, e.g. { name: "utm_source", value: "{utm_source}" }. */
export interface HiddenField { name: string; value: string }

export type FormDestination =
    | { kind: 'none' }
    | { kind: 'hubspot'; portalId: string; formId: string }
    | { kind: 'url'; url: string; format: 'json' | 'form' };

interface Base {
    id: string;
    placement: Placement;
    /** For "time": when it appears, in ms. */
    atMs: number | null;
    /** For "time": whether viewers can carry on without acting. */
    skippable: boolean;
    title: string;
    text: string;
}

export interface FormInteraction extends Base {
    type: 'form';
    fields: FormField[];
    hidden: HiddenField[];
    submitLabel: string;
    consent: string;
    destination: FormDestination;
}
export interface ButtonInteraction extends Base { type: 'button'; label: string; url: string }
export interface BookingInteraction extends Base { type: 'booking'; url: string }
export type Interaction = FormInteraction | ButtonInteraction | BookingInteraction;

/** What a viewer's browser may see: no hidden-field templates, no destinations. */
export type PublicFormInteraction = Omit<FormInteraction, 'hidden' | 'destination'>;
export type PublicInteraction = PublicFormInteraction | ButtonInteraction | BookingInteraction;

export const MAX_INTERACTIONS = 10;
export const MAX_FIELDS = 12;
export const MAX_HIDDEN = 15;
export const FIELD_TYPES: Array<{ id: FieldType; label: string }> = [
    { id: 'text', label: 'Text' },
    { id: 'email', label: 'Email' },
    { id: 'tel', label: 'Phone' },
    { id: 'textarea', label: 'Long text' },
    { id: 'select', label: 'Dropdown' },
    { id: 'checkbox', label: 'Checkbox' },
];
export const DEFAULT_CONSENT = 'By submitting, you agree that the sender can contact you about this.';

/** Tokens a hidden field's value can use. Filled in on the server at submission time. */
export const HIDDEN_TOKENS: Array<{ token: string; label: string }> = [
    { token: '{utm_source}', label: 'UTM source' },
    { token: '{utm_medium}', label: 'UTM medium' },
    { token: '{utm_campaign}', label: 'UTM campaign' },
    { token: '{utm_term}', label: 'UTM term' },
    { token: '{utm_content}', label: 'UTM content' },
    { token: '{param:name}', label: 'Any link parameter' },
    { token: '{referrer}', label: 'Referrer' },
    { token: '{page_url}', label: 'Page URL' },
    { token: '{video_title}', label: 'Video title' },
    { token: '{video_id}', label: 'Video ID' },
    { token: '{link_name}', label: 'Recipient name' },
    { token: '{link_email}', label: 'Recipient email' },
    { token: '{link_company}', label: 'Recipient company' },
    { token: '{source}', label: 'Share page or embed' },
    { token: '{date}', label: 'Submitted at' },
];

export interface TokenContext {
    /** Query parameters of the page the viewer opened (UTM tags and others). */
    query: Record<string, string>;
    referrer: string;
    pageUrl: string;
    videoTitle: string;
    videoId: string;
    linkName: string;
    linkEmail: string;
    linkCompany: string;
    source: 'share' | 'embed';
    now: Date;
}

/** Replaces {tokens} in a hidden field's value. Unknown tokens become empty. */
export function resolveTemplate(template: string, context: TokenContext) {
    return template.replace(/\{([a-z_]+)(?::([A-Za-z0-9_.-]{1,60}))?\}/g, (_match, key: string, param?: string) => {
        if (key === 'param') return param ? context.query[param] ?? '' : '';
        if (key.startsWith('utm_')) return context.query[key] ?? '';
        switch (key) {
            case 'referrer': return context.referrer;
            case 'page_url': return context.pageUrl;
            case 'video_title': return context.videoTitle;
            case 'video_id': return context.videoId;
            case 'link_name': return context.linkName;
            case 'link_email': return context.linkEmail;
            case 'link_company': return context.linkCompany;
            case 'source': return context.source;
            case 'date': return context.now.toISOString();
            default: return '';
        }
    }).slice(0, 500);
}

/** Only the parts of the page context worth keeping: short strings, capped in number. */
export function cleanQuery(input: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (!input || typeof input !== 'object') return out;
    for (const [key, value] of Object.entries(input as Record<string, unknown>).slice(0, 30)) {
        if (/^[A-Za-z0-9_.-]{1,60}$/.test(key) && typeof value === 'string') out[key] = value.slice(0, 300);
    }
    return out;
}

/* ----------------------------- Validation ------------------------------ */

const FIELD_NAME = /^[A-Za-z0-9_.-]{1,60}$/;
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const httpsUrl = (value: unknown) => {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' ? url.href.slice(0, 500) : null;
    } catch {
        return null;
    }
};

type Result = { ok: true; interactions: Interaction[] } | { ok: false; error: string };

/** Cleans what the studio editor sends. Every problem is reported in words a creator understands. */
export function normalizeInteractions(input: unknown, durationMs: number): Result {
    if (!Array.isArray(input)) return { ok: false, error: 'Bad request.' };
    if (input.length > MAX_INTERACTIONS) return { ok: false, error: `A video can have up to ${MAX_INTERACTIONS} forms, buttons and booking embeds.` };

    const interactions: Interaction[] = [];
    const ids = new Set<string>();
    for (const raw of input as Array<Record<string, unknown>>) {
        const type = raw?.type;
        if (type !== 'form' && type !== 'button' && type !== 'booking') return { ok: false, error: 'Bad request.' };
        const what = type === 'form' ? 'form' : type === 'button' ? 'button' : 'booking embed';

        const id = text(raw.id, 40);
        if (!/^[A-Za-z0-9_-]{4,40}$/.test(id) || ids.has(id)) return { ok: false, error: 'Bad request.' };
        ids.add(id);

        const placement = raw.placement;
        if (placement !== 'start' && placement !== 'time' && placement !== 'end') return { ok: false, error: 'Bad request.' };
        if (placement === 'start' && type !== 'form') return { ok: false, error: 'Only a form can appear before the video.' };
        let atMs: number | null = null;
        if (placement === 'time') {
            atMs = Math.round(Number(raw.atMs));
            if (!Number.isFinite(atMs) || atMs < 0 || (durationMs > 0 && atMs >= durationMs)) return { ok: false, error: `Choose a time inside the video for the ${what}.` };
        }
        const base = {
            id,
            placement,
            atMs,
            skippable: placement === 'time' ? raw.skippable !== false : placement === 'end',
            title: text(raw.title, 100),
            text: text(raw.text, 300),
        } satisfies Omit<Base, 'id'> & { id: string };

        if (type === 'button') {
            const url = normalizeCtaUrl(raw.url);
            const label = text(raw.label, 40);
            if (!label) return { ok: false, error: 'Give the button a label.' };
            if (!url) return { ok: false, error: 'Enter a full link for the button, starting with https://' };
            interactions.push({ ...base, type, label, url });
            continue;
        }
        if (type === 'booking') {
            const url = httpsUrl(raw.url);
            if (!url) return { ok: false, error: 'Paste your booking page link, e.g. https://calendly.com/you/30min' };
            interactions.push({ ...base, type, url });
            continue;
        }

        // Forms
        const rawFields = Array.isArray(raw.fields) ? raw.fields : [];
        if (!rawFields.length) return { ok: false, error: 'Add at least one field to the form.' };
        if (rawFields.length > MAX_FIELDS) return { ok: false, error: `A form can have up to ${MAX_FIELDS} fields.` };
        const names = new Set<string>();
        const fields: FormField[] = [];
        for (const field of rawFields as Array<Record<string, unknown>>) {
            const name = text(field?.name, 60);
            const label = text(field?.label, 80);
            const fieldType = FIELD_TYPES.some((option) => option.id === field?.type) ? field.type as FieldType : null;
            if (!label) return { ok: false, error: 'Every field needs a label.' };
            if (!FIELD_NAME.test(name)) return { ok: false, error: `“${label}” needs a field name of letters, numbers, dots, dashes or underscores.` };
            if (names.has(name.toLowerCase())) return { ok: false, error: `Two fields are named “${name}”. Each field name must be unique.` };
            if (!fieldType) return { ok: false, error: 'Bad request.' };
            names.add(name.toLowerCase());
            const options = fieldType === 'select' ? (Array.isArray(field.options) ? field.options : []).map((option) => text(option, 80)).filter(Boolean).slice(0, 20) : undefined;
            if (fieldType === 'select' && !options?.length) return { ok: false, error: `Add at least one choice to “${label}”.` };
            fields.push({ name, label, type: fieldType, required: field.required === true, ...(options ? { options } : {}) });
        }

        const rawHidden = Array.isArray(raw.hidden) ? raw.hidden : [];
        if (rawHidden.length > MAX_HIDDEN) return { ok: false, error: `A form can have up to ${MAX_HIDDEN} hidden fields.` };
        const hidden: HiddenField[] = [];
        for (const item of rawHidden as Array<Record<string, unknown>>) {
            const name = text(item?.name, 60);
            const value = typeof item?.value === 'string' ? item.value.slice(0, 300) : '';
            if (!name && !value) continue;
            if (!FIELD_NAME.test(name)) return { ok: false, error: 'Each hidden field needs a name of letters, numbers, dots, dashes or underscores.' };
            if (names.has(name.toLowerCase())) return { ok: false, error: `“${name}” is used twice. Hidden field names must differ from the visible ones.` };
            names.add(name.toLowerCase());
            hidden.push({ name, value });
        }

        const rawDestination = (raw.destination ?? { kind: 'none' }) as Record<string, unknown>;
        let destination: FormDestination = { kind: 'none' };
        if (rawDestination.kind === 'hubspot') {
            const portalId = text(rawDestination.portalId, 20);
            const formId = text(rawDestination.formId, 40).toLowerCase();
            if (!/^\d{3,12}$/.test(portalId)) return { ok: false, error: 'Enter your HubSpot portal ID (Hub ID): only numbers.' };
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(formId)) return { ok: false, error: 'Enter the HubSpot form ID. It looks like 1a2b3c4d-1234-…' };
            destination = { kind: 'hubspot', portalId, formId };
        } else if (rawDestination.kind === 'url') {
            const url = httpsUrl(rawDestination.url);
            if (!url) return { ok: false, error: 'Enter the https:// address your form posts to.' };
            destination = { kind: 'url', url, format: rawDestination.format === 'form' ? 'form' : 'json' };
        }

        interactions.push({
            ...base,
            type,
            title: base.title || 'Before you watch',
            fields,
            hidden,
            submitLabel: text(raw.submitLabel, 40) || (placement === 'start' ? 'Watch the video' : 'Submit'),
            consent: typeof raw.consent === 'string' ? raw.consent.trim().slice(0, 300) : DEFAULT_CONSENT,
            destination,
        });
    }

    if (interactions.filter((item) => item.placement === 'start').length > 1) return { ok: false, error: 'Only one form can appear before the video.' };
    interactions.sort((a, b) => order(a) - order(b));
    return { ok: true, interactions };
}

const order = (item: Interaction) => (item.placement === 'start' ? -1 : item.placement === 'end' ? Number.MAX_SAFE_INTEGER : item.atMs ?? 0);

/** Strips everything a viewer mustn't see. */
export function toPublicInteractions(interactions: Interaction[]): PublicInteraction[] {
    return interactions.map((item) => {
        if (item.type !== 'form') return item;
        return { id: item.id, type: item.type, placement: item.placement, atMs: item.atMs, skippable: item.skippable, title: item.title, text: item.text, fields: item.fields, submitLabel: item.submitLabel, consent: item.consent };
    });
}

/** Reads the column safely; rows written before this feature have none. */
export const readInteractions = (value: unknown): Interaction[] => (Array.isArray(value) ? value as Interaction[] : []);

/** The gate form, if the video has one. */
export const gateForm = (interactions: Interaction[]) => interactions.find((item): item is FormInteraction => item.type === 'form' && item.placement === 'start') ?? null;

/** Checks a viewer's answers against the form. Returns cleaned values or the first problem. */
export function validateAnswers(form: Pick<FormInteraction, 'fields'>, input: unknown): { ok: true; values: Record<string, string> } | { ok: false; error: string } {
    const answers = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const field of form.fields) {
        const raw = answers[field.name];
        let value = field.type === 'checkbox' ? (raw === true || raw === 'true' || raw === 'on' ? 'true' : '') : typeof raw === 'string' ? raw.trim().slice(0, field.type === 'textarea' ? 2000 : 300) : '';
        if (!value) {
            if (field.required) return { ok: false, error: field.type === 'checkbox' ? `Please tick “${field.label}”.` : `Please fill in “${field.label}”.` };
            continue;
        }
        if (field.type === 'email') {
            value = value.toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) return { ok: false, error: `“${field.label}” needs a valid email address.` };
        }
        if (field.type === 'tel' && !/^[+\d][\d\s().-]{5,24}$/.test(value)) return { ok: false, error: `“${field.label}” needs a valid phone number.` };
        if (field.type === 'select' && !field.options?.includes(value)) return { ok: false, error: `Choose one of the options for “${field.label}”.` };
        values[field.name] = value;
    }
    return { ok: true, values };
}

/** The address to treat as the viewer's email: the first email field they filled in. */
export function emailFrom(form: Pick<FormInteraction, 'fields'>, values: Record<string, string>) {
    const field = form.fields.find((item) => item.type === 'email' && values[item.name]);
    return field ? values[field.name] : null;
}

/** A short random id for a new interaction. */
export const newInteractionId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
