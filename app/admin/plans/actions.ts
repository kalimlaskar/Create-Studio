'use server';

import { revalidatePath } from 'next/cache';
import { audit, getAdmin } from '@/lib/admin/auth';
import { invalidateCatalog, PLAN_COLUMNS, razorpayIdForPlan, toCatalogPlan } from '@/lib/plans/catalog';
import { normalizePlanInput, planIdFrom, reducedLimits } from '@/lib/plans/validate';
import { razorpayApi } from '@/lib/billing/razorpay';

// Creating and editing packages. Every action re-checks admin access, clears the
// package cache so the whole app sees the change, and writes the audit log.

type Result = { error?: string; notice?: string };

const MISSING_TABLE = 'Run supabase/migrations/20261017000800_plans.sql in the Supabase SQL Editor first.';

const razorpayReady = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

/** A monthly Razorpay plan charging this many rupees. Razorpay can't change a plan's price later. */
async function createRazorpayPlan(name: string, priceInr: number, description: string, packageId: string) {
    const plan = await razorpayApi<{ id: string }>('plans', {
        period: 'monthly',
        interval: 1,
        item: { name: `Cliprame ${name}`.slice(0, 80), amount: priceInr * 100, currency: 'INR', description: description.slice(0, 200) || undefined },
        notes: { cliprame_package: packageId },
    });
    return plan.id;
}

function done() {
    invalidateCatalog();
    revalidatePath('/admin', 'layout');
    revalidatePath('/pricing');
}

export async function savePlanAction(id: string | null, input: unknown): Promise<Result> {
    const admin = await getAdmin();
    if (!admin) return { error: 'Not allowed.' };

    const { data: existingRow, error: loadError } = id ? await admin.db.from('plans').select(PLAN_COLUMNS).eq('id', id).maybeSingle() : { data: null, error: null };
    if (loadError?.code === 'PGRST205') return { error: MISSING_TABLE };
    if (id && !existingRow) return { error: 'Package not found.' };
    const existing = existingRow ? toCatalogPlan(existingRow) : null;

    const checked = normalizePlanInput(input, { isFree: id === 'free' });
    if (!checked.ok) return { error: checked.error };
    const next = checked.plan;
    const notices: string[] = [];

    // Which Razorpay plan new subscribers should use.
    let razorpayPlanId = existing?.razorpayPlanId ?? null;
    const legacy = new Set(existing?.legacyRazorpayPlanIds ?? []);
    const currentEffective = existing ? razorpayIdForPlan(existing) : null;
    const priceChanged = Boolean(existing && existing.priceInr !== next.priceInr);
    const packageId = id ?? planIdFrom(next.name);

    if (next.razorpayPlanId && next.razorpayPlanId !== currentEffective) {
        // The admin linked a plan they made in Razorpay themselves.
        razorpayPlanId = next.razorpayPlanId;
    } else if (next.priceInr > 0 && (!currentEffective || priceChanged)) {
        if (razorpayReady()) {
            try {
                razorpayPlanId = await createRazorpayPlan(next.name, next.priceInr, next.description, packageId);
                notices.push(priceChanged ? 'New price saved. New subscribers pay it; existing subscribers keep their current price.' : 'Created the matching plan in Razorpay.');
            } catch (error) {
                return { error: `Razorpay couldn’t create the plan: ${(error as Error).message}` };
            }
        } else {
            razorpayPlanId = null;
            notices.push('Saved, but it can’t be bought yet: Razorpay keys aren’t set on this server. Add them, or paste a Razorpay plan ID.');
        }
    }
    // Subscribers on the previous Razorpay plan stay on this package.
    if (currentEffective && razorpayPlanId !== currentEffective) legacy.add(currentEffective);
    if (razorpayPlanId) legacy.delete(razorpayPlanId);

    const row = {
        name: next.name,
        description: next.description || null,
        price_usd: next.priceUsd,
        price_inr: next.priceInr,
        is_public: id === 'free' ? true : next.isPublic,
        razorpay_plan_id: razorpayPlanId,
        legacy_razorpay_plan_ids: [...legacy],
        limits: next.limits,
        updated_at: new Date().toISOString(),
    };

    if (existing) {
        const { error } = await admin.db.from('plans').update(row).eq('id', existing.id);
        if (error) return { error: error.code === '23505' ? 'That Razorpay plan is already linked to another package.' : 'Could not save the package.' };
        await audit(admin, 'plan.updated', { type: 'plan', id: existing.id }, {
            name: next.name,
            ...(priceChanged ? { price: `₹${existing.priceInr} → ₹${next.priceInr}` } : {}),
            reduced: reducedLimits(existing, next.limits),
        });
    } else {
        const { data: taken, error: takenError } = await admin.db.from('plans').select('id').eq('id', packageId).maybeSingle();
        if (takenError?.code === 'PGRST205') return { error: MISSING_TABLE };
        if (taken) return { error: `A package with the id “${packageId}” already exists. Choose a different name.` };
        const { count } = await admin.db.from('plans').select('id', { count: 'exact', head: true });
        const { error } = await admin.db.from('plans').insert({ ...row, id: packageId, sort_order: count ?? 0 });
        if (error) return { error: error.code === '23505' ? 'That Razorpay plan is already linked to another package.' : 'Could not create the package.' };
        await audit(admin, 'plan.created', { type: 'plan', id: packageId }, { name: next.name, price: `₹${next.priceInr}` });
    }

    done();
    return { notice: notices.join(' ') || 'Saved.' };
}

export async function setPlanStatusAction(id: string, change: { isPublic?: boolean; archived?: boolean }): Promise<Result> {
    const admin = await getAdmin();
    if (!admin) return { error: 'Not allowed.' };
    if (id === 'free' && (change.archived || change.isPublic === false)) return { error: 'The Free package always stays available.' };
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (change.isPublic !== undefined) update.is_public = change.isPublic;
    if (change.archived !== undefined) update.archived = change.archived;
    const { error } = await admin.db.from('plans').update(update).eq('id', id);
    if (error) return { error: error.code === 'PGRST205' ? MISSING_TABLE : 'Could not update the package.' };
    await audit(admin, change.archived !== undefined ? (change.archived ? 'plan.archived' : 'plan.restored') : (change.isPublic ? 'plan.shown' : 'plan.hidden'), { type: 'plan', id });
    done();
    return {};
}

/** Moves a package one place earlier or later on the pricing page. */
export async function movePlanAction(id: string, direction: -1 | 1): Promise<Result> {
    const admin = await getAdmin();
    if (!admin) return { error: 'Not allowed.' };
    const { data, error } = await admin.db.from('plans').select('id').order('sort_order').order('created_at');
    if (error) return { error: error.code === 'PGRST205' ? MISSING_TABLE : 'Could not move the package.' };
    const ids = (data ?? []).map((row) => row.id as string);
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return {};
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await Promise.all(ids.map((planId, order) => admin.db.from('plans').update({ sort_order: order }).eq('id', planId)));
    done();
    return {};
}
