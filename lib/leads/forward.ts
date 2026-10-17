import 'server-only';
import type { FormDestination } from '@/lib/videos/interactions';
import { publicHttpsUrl, resolvesPublic } from '@/lib/integrations/server';

// Sends a form submission on to the creator's own form backend: a HubSpot form,
// or any URL (Salesforce Web-to-Lead, Pardot, Zapier, Formspree...). Visible and
// hidden fields are sent together, flat, under their field names.

export type ForwardResult = { status: 'ok' | 'skipped' } | { status: 'failed'; error: string };

const TIMEOUT_MS = 8000;

/** HubSpot's form-submission body: every field by name, plus the page it came from. */
export function hubspotBody(values: Record<string, string>, context: { pageUrl: string; pageName: string; ipAddress?: string | null }) {
    return {
        fields: Object.entries(values).map(([name, value]) => ({ name, value })),
        context: { pageUri: context.pageUrl.slice(0, 500), pageName: context.pageName.slice(0, 200), ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}) },
    };
}

/** HubSpot explains rejections in `errors[].message`, e.g. a field that isn't on the form. */
async function hubspotError(response: Response) {
    const data = await response.json().catch(() => null) as { message?: string; errors?: Array<{ message?: string }> } | null;
    const detail = data?.errors?.map((item) => item.message).filter(Boolean).join('; ') || data?.message;
    return `HubSpot answered ${response.status}${detail ? `: ${detail}` : ''}`.slice(0, 300);
}

export async function forwardLead(destination: FormDestination, values: Record<string, string>, context: { pageUrl: string; pageName: string; ipAddress?: string | null }): Promise<ForwardResult> {
    if (destination.kind === 'none') return { status: 'skipped' };
    try {
        if (destination.kind === 'hubspot') {
            // HubSpot's public endpoint for forms; no token needed, the form ID is the permission.
            const response = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${destination.portalId}/${destination.formId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(hubspotBody(values, context)),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            return response.ok ? { status: 'ok' } : { status: 'failed', error: await hubspotError(response) };
        }

        if (!publicHttpsUrl(destination.url) || !(await resolvesPublic(destination.url))) return { status: 'failed', error: 'The form address points to a private network.' };
        const body = destination.format === 'form' ? new URLSearchParams(values).toString() : JSON.stringify(values);
        const response = await fetch(destination.url, {
            method: 'POST',
            headers: { 'Content-Type': destination.format === 'form' ? 'application/x-www-form-urlencoded' : 'application/json', 'User-Agent': 'Cliprame-Forms/1.0' },
            body,
            redirect: 'manual',
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        // Many form handlers answer with a redirect to a thank-you page; that's a success.
        if (response.ok || (response.status >= 300 && response.status < 400)) return { status: 'ok' };
        return { status: 'failed', error: `Answered ${response.status} ${response.statusText}`.trim().slice(0, 300) };
    } catch (error) {
        return { status: 'failed', error: (error as Error).name === 'TimeoutError' ? 'Timed out after 8 seconds' : 'Couldn’t connect' };
    }
}
