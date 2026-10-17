import 'server-only';
import { DEFAULT_CATALOG, PLAN_LIMITS, type CatalogPlan, type PlanLimit } from '@/components/pricing/planLimits';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// The list of packages, from public.plans (edited at /admin/plans). Cached briefly per
// server instance; admin saves clear it. Falls back to the built-in packages if the
// table isn't there yet, so the app never breaks on a missing migration.

const TTL_MS = 30_000;
let cache: { at: number; plans: CatalogPlan[] } | null = null;

type PlanRow = {
    id: string; name: string; description: string | null; price_usd: number | string; price_inr: number;
    razorpay_plan_id: string | null; legacy_razorpay_plan_ids: string[] | null; is_public: boolean; archived: boolean;
    sort_order: number; limits: Partial<PlanLimit> | null;
};

export const PLAN_COLUMNS = 'id,name,description,price_usd,price_inr,razorpay_plan_id,legacy_razorpay_plan_ids,is_public,archived,sort_order,limits';

export function toCatalogPlan(row: PlanRow): CatalogPlan {
    // Missing keys (limits added after the row was saved) take the defaults.
    const base = PLAN_LIMITS[row.id] ?? PLAN_LIMITS.creator;
    return {
        ...base,
        ...(row.limits ?? {}),
        id: row.id,
        name: row.name,
        priceUsd: Number(row.price_usd),
        priceInr: row.price_inr,
        description: row.description,
        isPublic: row.is_public,
        archived: row.archived,
        sortOrder: row.sort_order,
        razorpayPlanId: row.razorpay_plan_id,
        legacyRazorpayPlanIds: row.legacy_razorpay_plan_ids ?? [],
    };
}

export async function getCatalog(): Promise<CatalogPlan[]> {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.plans;
    const db = createSupabaseAdminClient();
    if (!db) return DEFAULT_CATALOG;
    const { data, error } = await db.from('plans').select(PLAN_COLUMNS).order('sort_order').order('created_at');
    // Before the plans migration runs (or if the database is unreachable): built-in packages.
    const plans = error || !data?.length ? DEFAULT_CATALOG : (data as PlanRow[]).map(toCatalogPlan);
    if (error && error.code !== 'PGRST205') console.error('[plans] Could not load packages:', error.message);
    cache = { at: Date.now(), plans };
    return plans;
}

export function invalidateCatalog() {
    cache = null;
}

/** A package by id; unknown ids get Free so limits always exist. */
export async function getCatalogPlan(id: string) {
    const plans = await getCatalog();
    return plans.find((plan) => plan.id === id) ?? plans.find((plan) => plan.id === 'free') ?? DEFAULT_CATALOG[0];
}

/** Which package a Razorpay plan id belongs to, including plans from before a price change. */
export function planForRazorpayId(plans: CatalogPlan[], razorpayPlanId: string | null) {
    if (!razorpayPlanId) return null;
    const direct = plans.find((plan) => plan.razorpayPlanId === razorpayPlanId || plan.legacyRazorpayPlanIds.includes(razorpayPlanId));
    if (direct) return direct.id;
    // Creator and Studio as configured in the environment, before an admin linked them.
    if (razorpayPlanId === (process.env.RAZORPAY_PLAN_ID_STUDIO ?? '')) return 'studio';
    if (razorpayPlanId === (process.env.RAZORPAY_PLAN_ID_CREATOR ?? process.env.RAZORPAY_PLAN_ID ?? '')) return 'creator';
    return null;
}

/** The Razorpay plan new subscriptions to this package should use. */
export function razorpayIdForPlan(plan: CatalogPlan) {
    if (plan.razorpayPlanId) return plan.razorpayPlanId;
    if (plan.id === 'studio') return process.env.RAZORPAY_PLAN_ID_STUDIO ?? null;
    if (plan.id === 'creator') return process.env.RAZORPAY_PLAN_ID_CREATOR ?? process.env.RAZORPAY_PLAN_ID ?? null;
    return null;
}
