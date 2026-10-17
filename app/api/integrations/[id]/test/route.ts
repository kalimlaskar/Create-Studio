import { getStudioUser } from '@/lib/videos/server';
import { decrypt, deliver, INTEGRATION_COLUMNS, prepareTarget, toIntegration, type IntegrationRow } from '@/lib/integrations/server';
import { buildPayload, siteUrlFor } from '@/lib/integrations/notify';

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Sends a sample "watched to the end" notification so the creator can see it arrive. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const { data } = await user.supabase.from('integrations').select('*').eq('id', id).maybeSingle();
    if (!data) return fail('Integration not found.', 404);
    const row = data as IntegrationRow;

    // A test must not add a made-up contact to the creator's CRM, so for HubSpot it only checks the token.
    if (row.kind === 'hubspot') {
        const check = await prepareTarget('hubspot', decrypt(row.target_encrypted));
        const ok = !('error' in check);
        const { data: updated } = await user.supabase.from('integrations').update({ last_status: ok ? 'ok' : 'failed', last_error: ok ? null : check.error.slice(0, 300), last_delivered_at: new Date().toISOString() })
            .eq('id', id).select(INTEGRATION_COLUMNS).single();
        return Response.json({ ok, error: ok ? null : check.error, integration: updated ? toIntegration(updated as unknown as IntegrationRow) : null });
    }

    const { data: video } = await user.supabase.from('videos').select('id,title,duration_ms').eq('status', 'ready').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const payload = buildPayload('video.completed', {
        video: video ?? { id: '00000000-0000-4000-8000-000000000000', title: 'Sample video', duration_ms: 90_000 },
        link: { slug: 'sample-link', recipient_name: 'Ana Lopez', recipient_email: 'ana@example.com', recipient_company: 'Acme' },
        session: { watched_ms: 90_000, completed: true, cta_clicked: false, seconds_watched: new Array(90).fill(1), device: 'desktop', country: 'IN', source: 'share', referrer_host: null, viewer_email: null },
        siteUrl: siteUrlFor(request),
        test: true,
    });
    const result = await deliver(user.supabase, row, payload);
    const { data: updated } = await user.supabase.from('integrations').select(INTEGRATION_COLUMNS).eq('id', id).single();
    const ok = 'ok' in result && result.ok;
    return Response.json({ ok, error: ok ? null : 'error' in result ? result.error : null, integration: updated ? toIntegration(updated as unknown as IntegrationRow) : null });
}
