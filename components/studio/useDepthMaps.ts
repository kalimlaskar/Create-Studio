'use client';

import { useCallback, useEffect, useState } from 'react';
import { getDepthMap, getPhotoCacheKey, isDepthMotion } from './depthEstimator';
import type { ReelAssets } from './reelAssets';
import type { ReelImage } from './reelTypes';

/**
 * Computes 3D depth maps for clips that use a depth camera motion.
 * `ensureDepth` returns the same in-flight promise for repeated calls, so the export can
 * safely `await` it (the old version returned immediately while the job was still running).
 */
export function useDepthMaps(clips: ReelImage[], assets: ReelAssets) {
    const [depthStatus, setDepthStatus] = useState<Record<string, 'ready' | 'failed'>>({});

    const ensureDepth = useCallback((clip: ReelImage): Promise<void> => {
        const key = getPhotoCacheKey(clip.file);
        const existing = assets.depthJobs.get(clip.id);
        if (existing && existing.key === key) return existing.promise;

        const promise = getDepthMap(clip.file)
            .then((depth) => {
                assets.depthMaps.set(clip.id, depth);
                setDepthStatus((current) => ({ ...current, [clip.id]: 'ready' }));
                assets.onChange?.();
            })
            .catch(() => {
                setDepthStatus((current) => ({ ...current, [clip.id]: 'failed' }));
            });
        assets.depthJobs.set(clip.id, { key, promise });
        return promise;
    }, [assets]);

    useEffect(() => {
        clips.forEach((clip) => {
            if (clip.type === 'image' && isDepthMotion(clip.motion)) void ensureDepth(clip);
        });
    }, [clips, ensureDepth]);

    const resetDepth = useCallback(() => setDepthStatus({}), []);

    return { depthStatus, ensureDepth, resetDepth };
}
