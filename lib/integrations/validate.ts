import { NOTIFICATION_TYPES, type NotificationType } from './types';

const KNOWN = new Set(NOTIFICATION_TYPES.map((type) => type.id));

/** A clean list of event types, or null if anything in it is unknown. */
export function normalizeEvents(input: unknown): NotificationType[] | null {
    if (!Array.isArray(input) || input.length > NOTIFICATION_TYPES.length) return null;
    if (!input.every((item) => typeof item === 'string' && KNOWN.has(item as NotificationType))) return null;
    return NOTIFICATION_TYPES.map((type) => type.id).filter((id) => input.includes(id));
}

export const normalizeIntegrationName = (input: unknown) => (typeof input === 'string' ? input.trim().slice(0, 80) : '');
