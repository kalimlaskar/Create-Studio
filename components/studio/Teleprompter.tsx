'use client';

import React from 'react';

interface TeleprompterProps {
    scriptText: string;
    onScriptChange: (text: string) => void;
}

export function Teleprompter({ scriptText, onScriptChange }: TeleprompterProps) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Teleprompter</label>
            <textarea
                value={scriptText}
                onChange={(e) => onScriptChange(e.target.value)}
                placeholder="Write or paste your script here..."
                aria-label="Teleprompter script"
                className="w-full h-40 bg-neutral-800/60 border border-neutral-700 rounded-lg p-3 text-xs text-neutral-200 resize-y focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] leading-relaxed text-neutral-500">Your script appears over the camera preview. Start scrolling from the overlay when you’re ready.</p>
        </div>
    );
}