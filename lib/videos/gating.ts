import 'server-only';
import type { AccessMode } from './types';
import type { VideoRow } from './server';
import { leadFromCookie, pageUnlock } from './access';
import { gateForm, readInteractions, toPublicInteractions, type PublicFormInteraction, type PublicInteraction } from './interactions';

/**
 * What stands between a viewer and the video on a share or embed page: the lock and/or
 * the gate form. `open` means the page may include the video's address right away.
 */
export async function resolveGate(video: VideoRow, viewerId: string | null) {
    const interactions = readInteractions(video.interactions);
    const gate = gateForm(interactions);
    const unlock = await pageUnlock(video, viewerId);
    const leadOk = !gate || viewerId === video.owner_id || Boolean(await leadFromCookie(video.id, gate.id));
    return {
        open: Boolean(unlock) && leadOk,
        token: unlock?.token ?? null,
        /** The lock still to pass, if any. */
        mode: unlock ? null : (video.access_mode as Exclude<AccessMode, 'public'>),
        /** The gate form still to fill in, if any (viewer-safe). */
        gate: gate && !leadOk ? (toPublicInteractions([gate])[0] as PublicFormInteraction) : null,
        /** Forms, buttons and booking embeds shown during or after the video (viewer-safe). */
        interactions: toPublicInteractions(interactions.filter((item) => item.placement !== 'start')) as PublicInteraction[],
    };
}
