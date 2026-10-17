import 'server-only';
import { notFound } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { adminEmailList, isAdminEmail } from './emails';

export interface AdminContext {
    id: string;
    email: string;
    /** Service-role client: bypasses row-level security. Only ever used behind this check. */
    db: SupabaseClient;
}

/** The signed-in super admin, or null for everyone else. The user is checked with the auth server, not just the cookie. */
export async function getAdmin(): Promise<AdminContext | null> {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return denied('Supabase URL or publishable key is not set');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return denied('not signed in on this domain');
    if (!adminEmailList().includes(user.email?.toLowerCase() ?? '')) return denied(`signed-in email is not in ADMIN_EMAILS (${adminEmailList().length} valid address(es) configured)`);
    if (!isAdminEmail(user.email, Boolean(user.email_confirmed_at))) return denied('email is listed but not confirmed in Supabase');
    const db = createSupabaseAdminClient();
    if (!db) return denied('SUPABASE_SERVICE_ROLE_KEY is not set');
    return { id: user.id, email: user.email!.toLowerCase(), db };
}

/** Logs why someone was refused (server logs only; visitors still just see a 404). */
function denied(reason: string) {
    console.warn(`Admin access refused: ${reason}.`);
    return null;
}

/** For admin pages: anyone else gets an ordinary 404, so the page doesn't reveal it exists. */
export async function requireAdmin() {
    const admin = await getAdmin();
    if (!admin) notFound();
    return admin;
}

/** Records an admin action. Never throws: the action itself has already happened. */
export async function audit(admin: AdminContext, action: string, target: { type: string; id: string } | null, details: Record<string, unknown> = {}) {
    const { error } = await admin.db.from('admin_audit_log').insert({
        admin_id: admin.id,
        admin_email: admin.email,
        action,
        target_type: target?.type ?? null,
        target_id: target?.id ?? null,
        details,
    });
    if (error) console.error('Could not write the admin audit log:', error);
}
