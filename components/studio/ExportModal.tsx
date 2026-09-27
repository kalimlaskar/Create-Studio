'use client';

import React from 'react';
import { Download, RefreshCw, Pencil } from 'lucide-react';

interface ExportModalProps {
    videoUrl: string;
    onReset: () => void;
    onEdit: () => void;
}

export function ExportModal({ videoUrl, onReset, onEdit }: ExportModalProps) {
    return (
        <div className="absolute inset-0 bg-neutral-950/90 z-40 flex flex-col items-center justify-center p-6">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-xl w-full flex flex-col items-center shadow-2xl">
                <h2 className="text-lg font-bold mb-4">Your Video is Ready! 🎉</h2>
                <video src={videoUrl} controls className="w-full rounded-xl mb-6 max-h-75 object-cover" />
                <p className="text-xs text-neutral-400 text-center mb-5">
                    To include filters and text overlays, open Edit Video and download from the editor.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                    <button
                        onClick={onEdit}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-emerald-600/20">
                        <Pencil className="w-4 h-4" /> Edit Video (filters & text)
                    </button>
                    <a
                        href={videoUrl}
                        download="creator-studio-recording.webm"
                        className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all">
                        <Download className="w-4 h-4" /> Download Original (Unedited)
                    </a>
                    <button
                        onClick={onReset}
                        className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all">
                        <RefreshCw className="w-4 h-4" /> Record Again
                    </button>
                </div>
            </div>
        </div>
    );
}