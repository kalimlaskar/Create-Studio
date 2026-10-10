'use client';

import { useEffect, useState } from 'react';
import { PLAN_LIMITS, PlanId } from '@/components/pricing/planLimits';

interface PlanState {
    plan: PlanId;
    usage: { transcriptionMinutes: number; voiceoverMinutes: number };
    loading: boolean;
}

export function usePlan() {
    const [state, setState] = useState<PlanState>({
        plan: 'free',
        usage: { transcriptionMinutes: 0, voiceoverMinutes: 0 },
        loading: true,
    });

    useEffect(() => {
        let cancelled = false;
        fetch('/api/plan', { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                if (cancelled) return;
                if (data?.plan) setState({ plan: data.plan, usage: data.usage, loading: false });
                else setState((current) => ({ ...current, loading: false }));
            })
            .catch(() => { if (!cancelled) setState((current) => ({ ...current, loading: false })); });
        return () => { cancelled = true; };
    }, []);

    return { ...state, limits: PLAN_LIMITS[state.plan] };
}