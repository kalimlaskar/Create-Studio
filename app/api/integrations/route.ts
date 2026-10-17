import { getStudioUser, isMissingTable } from '@/lib/videos/server';
import { encrypt, findDuplicate, INTEGRATION_COLUMNS, newWebhookSecret, prepareTarget, toIntegration, type IntegrationRow } from '@/lib/integrations/server';
import { MAX_INTEGRATIONS, type IntegrationKind } from '@/lib/integrations/types';
import { getPlanSummary } from '@/lib/plans/server';
import { normalizeEvents, normalizeIntegrationName } from '@/lib/integrations/validate';

const fail = (error: string, status = 400) => Response.json({ error }, { status });
const SETUP_MESSAGE = 'Integrations aren’t set up in the database yet. Run supabase/migrations/20261017000500_integrations.sql in the Supabase SQL Editor.';
const DEFAULT_NAMES: Record<IntegrationKind, string> = { webhook: 'Webhook', slack: 'Slack', hubspot: 'HubSpot' };

export async function GET() {
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const { data, error } = await user.supabase.from('integrations').select(INTEGRATION_COLUMNS).order('created_at');
    if (error) return fail(isMissingTable(error) ? SETUP_MESSAGE : 'Could not load integrations.', 500);
    return Response.json({ integrations: (data as unknown as IntegrationRow[]).map(toIntegration) });
}

/** Connects a webhook, Slack channel or HubSpot account. A webhook's signing secret is returned once, here. */
export async function POST(request: Request) {
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const body = await request.json().catch(() => null) as { kind?: unknown; name?: unknown; target?: unknown; events?: unknown; identifiedOnly?: unknown } | null;
    const kind = body?.kind;
    if (kind !== 'webhook' && kind !== 'slack' && kind !== 'hubspot') return fail('Choose what to connect.');

    const { count, error: countError } = await user.supabase.from('integrations').select('id', { count: 'exact', head: true });
    if (countError) return fail(isMissingTable(countError) ? SETUP_MESSAGE : 'Could not check your integrations.', 500);
    // The package sets how many connections are allowed (never more than the hard cap).
    const allowed = Math.min(MAX_INTEGRATIONS, (await getPlanSummary(user.id)).limits.maxIntegrations);
    if (allowed === 0) return Response.json({ error: 'Integrations aren’t included in your plan.', upgradeUrl: '/pricing' }, { status: 403 });
    if ((count ?? 0) >= allowed) return Response.json({ error: `Your plan allows ${allowed} ${allowed === 1 ? 'integration' : 'integrations'}. Remove one first, or upgrade for more.`, upgradeUrl: '/pricing' }, { status: 403 });

    const events = body?.events === undefined ? ['video.viewed', 'video.completed', 'cta.clicked'] : normalizeEvents(body.events);
    if (!events) return fail('Choose which moments to send.');
    const prepared = await prepareTarget(kind, body?.target);
    if ('error' in prepared) return fail(prepared.error);
    // The same Slack channel or endpoint twice would send every alert twice.
    const duplicate = await findDuplicate(user.supabase, kind, prepared.target);
    if (duplicate) return Response.json({ error: `This is already connected as “${duplicate.name}”.`, duplicateId: duplicate.id }, { status: 409 });

    const secret = kind === 'webhook' ? newWebhookSecret() : null;
    try {
        const { data, error } = await user.supabase.from('integrations').insert({
            owner_id: user.id,
            kind,
            name: normalizeIntegrationName(body?.name) || DEFAULT_NAMES[kind],
            target_encrypted: encrypt(prepared.target),
            target_hint: prepared.hint,
            secret_encrypted: secret ? encrypt(secret) : null,
            events,
            // HubSpot can only log viewers it can match to a contact.
            identified_only: kind === 'hubspot' ? true : body?.identifiedOnly === true,
        }).select(INTEGRATION_COLUMNS).single();
        if (error || !data) throw error;
        return Response.json({ integration: toIntegration(data as unknown as IntegrationRow), signingSecret: secret });
    } catch (error) {
        console.error('Could not save integration:', error);
        return fail(isMissingTable(error) ? SETUP_MESSAGE : 'Could not save the integration.', 500);
    }
}
