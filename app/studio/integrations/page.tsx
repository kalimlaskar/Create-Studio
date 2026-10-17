import { redirect } from 'next/navigation';
import { VideosShell } from '@/components/videos/VideosShell';
import { IntegrationsManager } from '@/components/integrations/IntegrationsManager';
import { getStudioUser, isMissingTable } from '@/lib/videos/server';
import { INTEGRATION_COLUMNS, toIntegration, type IntegrationRow } from '@/lib/integrations/server';

export const metadata = { title: 'Integrations | Cliprame' };

export default async function IntegrationsPage() {
    const user = await getStudioUser();
    if (!user) redirect('/login?next=/studio/integrations');
    const { data, error } = await user.supabase.from('integrations').select(INTEGRATION_COLUMNS).order('created_at');
    if (error && !isMissingTable(error)) console.error('Could not load integrations:', error);
    return (
        <VideosShell title="Integrations" active="/studio/integrations">
            <IntegrationsManager
                initialIntegrations={((data ?? []) as unknown as IntegrationRow[]).map(toIntegration)}
                setupMessage={isMissingTable(error) ? 'Integrations aren’t set up in the database yet. Run supabase/migrations/20261017000500_integrations.sql in the Supabase SQL Editor.' : null}
            />
        </VideosShell>
    );
}
