import { getEffectivePlan, getRequestUserId, getUsageThisMonth } from '@/lib/plans/server';

export async function GET() {
    const userId = await getRequestUserId();
    if (!userId) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    const [plan, usage] = await Promise.all([getEffectivePlan(userId), getUsageThisMonth(userId)]);
    return Response.json({ plan, usage }, { headers: { 'Cache-Control': 'no-store' } });
}