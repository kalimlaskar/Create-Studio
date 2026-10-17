import { getStudioUser } from '@/lib/videos/server';
import { encrypt, findDuplicate, INTEGRATION_COLUMNS, newWebhookSecret, prepareTarget, toIntegration, type IntegrationRow } from '@/lib/integrations/server';
import { normalizeEvents, normalizeIntegrationName } from '@/lib/integrations/validate';

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Renames, pauses, changes events or target, or rotates a webhook's signing secret. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const { data: row } = await user.supabase.from('integrations').select('id,kind,workspace_id').eq('id', id).maybeSingle();
    if (!row) return fail('Integration not found.', 404);

    const body = await request.json().catch(() => null) as { name?: unknown; events?: unknown; identifiedOnly?: unknown; enabled?: unknown; target?: unknown; rotateSecret?: unknown } | null;
    const update: Record<string, unknown> = {};
    let signingSecret: string | null = null;

    if (body?.name !== undefined) {
        const name = normalizeIntegrationName(body.name);
        if (!name) return fail('Give it a name.');
        update.name = name;
    }
    if (body?.events !== undefined) {
        const events = normalizeEvents(body.events);
        if (!events) return fail('Choose which moments to send.');
        update.events = events;
    }
    if (body?.identifiedOnly !== undefined && row.kind !== 'hubspot') update.identified_only = body.identifiedOnly === true;
    if (body?.enabled !== undefined) update.enabled = body.enabled === true;
    if (body?.target !== undefined) {
        const prepared = await prepareTarget(row.kind, body.target);
        if ('error' in prepared) return fail(prepared.error);
        const duplicate = await findDuplicate(user.supabase, row.kind, prepared.target, id, row.workspace_id);
        if (duplicate) return fail(`This is already connected as “${duplicate.name}”.`, 409);
        update.target_encrypted = encrypt(prepared.target);
        update.target_hint = prepared.hint;
        update.last_status = null;
        update.last_error = null;
    }
    if (body?.rotateSecret === true && row.kind === 'webhook') {
        signingSecret = newWebhookSecret();
        update.secret_encrypted = encrypt(signingSecret);
    }

    const { data, error } = await user.supabase.from('integrations').update(update).eq('id', id).select(INTEGRATION_COLUMNS).single();
    if (error || !data) return fail('Could not save your changes.', 500);
    return Response.json({ integration: toIntegration(data as unknown as IntegrationRow), signingSecret });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const { error } = await user.supabase.from('integrations').delete().eq('id', id);
    if (error) return fail('Could not remove the integration.', 500);
    return Response.json({ ok: true });
}
