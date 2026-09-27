'use client';

import React, { useRef } from 'react';
import { Upload, X, Music } from 'lucide-react';
import { AudioTrackClip } from '@/types/editor';

interface MusicPanelProps {
    audioTracks: AudioTrackClip[];
    durationMs: number;
    onSet: (tracks: AudioTrackClip[]) => void;
}

export function MusicPanel({ audioTracks, durationMs, onSet }: MusicPanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const current = audioTracks[0] ?? null;

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (current) URL.revokeObjectURL(current.url);
        const url = URL.createObjectURL(file);
        onSet([{
            id: 'bg-music',
            url,
            startMs: 0,
            endMs: durationMs,
            volume: 0.3,
        }]);
        e.target.value = '';
    };

    const clear = () => {
        if (current) URL.revokeObjectURL(current.url);
        onSet([]);
    };

    return (
        <div className="space-y-4">
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Background Music</label>

            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFile} className="hidden" />

            {current ? (
                <div className="border border-neutral-800 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm text-neutral-300">
                            <Music className="w-4 h-4" /> Track added
                        </span>
                        <button onClick={clear} className="text-neutral-500 hover:text-red-400">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-neutral-400 mb-1">
                            <span>Volume</span><span>{Math.round(current.volume * 100)}%</span>
                        </div>
                        <input
                            type="range" min={0} max={100} value={current.volume * 100}
                            onChange={(e) => onSet([{ ...current, volume: Number(e.target.value) / 100 }])}
                            className="w-full accent-indigo-500 h-1"
                        />
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-neutral-700 rounded-lg py-3 text-xs text-neutral-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors">
                    <Upload className="w-3.5 h-3.5" /> Upload background music
                </button>
            )}
        </div>
    );
}