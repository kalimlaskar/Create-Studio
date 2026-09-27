'use client';

import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { EditorProject, OverlayClip, ColorGradeSettings, AudioTrackClip, ZoomKeyframe, SpeedSegment } from '@/types/editor';
import { ColorGradePanel } from './ColorGradePanel';
import { TextOverlayPanel } from './TextOverlayPanel';
import { MusicPanel } from './MusicPanel';
import { ZoomPanel } from './ZoomPanel';
import { SpeedPanel } from './SpeedPanel';

type Tab = 'color' | 'text' | 'music' | 'zoom' | 'speed';

interface EditorSidebarProps {
    project: EditorProject;
    playheadMs: number;
    onBack: () => void;
    onColorGradeChange: (patch: Partial<ColorGradeSettings>) => void;
    onAddOverlay: (clip: Omit<OverlayClip, 'id'>) => void;
    onUpdateOverlay: (id: string, patch: Partial<OverlayClip>) => void;
    onRemoveOverlay: (id: string) => void;
    onSetAudioTracks: (tracks: AudioTrackClip[]) => void;
    onAddZoomKeyframe: (atMs: number, scale: number) => void;
    onUpdateZoomKeyframe: (id: string, patch: Partial<ZoomKeyframe>) => void;
    onRemoveZoomKeyframe: (id: string) => void;
    onAddSpeedSegment: (segment: Omit<SpeedSegment, 'id'>) => void;
    onUpdateSpeedSegment: (id: string, patch: Partial<SpeedSegment>) => void;
    onRemoveSpeedSegment: (id: string) => void;
}

export function EditorSidebar({
    project, playheadMs, onBack,
    onColorGradeChange, onAddOverlay, onUpdateOverlay, onRemoveOverlay, onSetAudioTracks,
    onAddZoomKeyframe, onUpdateZoomKeyframe, onRemoveZoomKeyframe,
    onAddSpeedSegment, onUpdateSpeedSegment, onRemoveSpeedSegment
}: EditorSidebarProps) {
    const [tab, setTab] = useState<Tab>('color');

    return (
        <aside className="w-80 border-r border-neutral-800 bg-neutral-900 p-4 flex flex-col overflow-y-auto">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-100 mb-4 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Recording
            </button>

            <div className="flex gap-1 mb-5 bg-neutral-800/50 p-1 rounded-lg">
                {([['color', 'Color'], ['text', 'Text'], ['zoom', 'Zoom'], ['speed', 'Speed'], ['music', 'Music']] as const).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex-1 text-xs py-2 rounded-md font-medium transition-colors ${tab === key ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
                            }`}>
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'color' && (
                <ColorGradePanel colorGrade={project.colorGrade} onChange={onColorGradeChange} />
            )}
            {tab === 'text' && (
                <TextOverlayPanel
                    overlays={project.tracks.overlays}
                    durationMs={project.durationMs}
                    playheadMs={playheadMs}
                    onAdd={onAddOverlay}
                    onUpdate={onUpdateOverlay}
                    onRemove={onRemoveOverlay}
                />
            )}
            {tab === 'music' && (
                <MusicPanel
                    audioTracks={project.tracks.audio}
                    durationMs={project.durationMs}
                    onSet={onSetAudioTracks}
                />
            )}
            {tab === 'zoom' && (
                <ZoomPanel
                    keyframes={project.tracks.zoom}
                    playheadMs={playheadMs}
                    onAdd={onAddZoomKeyframe}
                    onUpdate={onUpdateZoomKeyframe}
                    onRemove={onRemoveZoomKeyframe}
                />
            )}
            {tab === 'speed' && (
                <SpeedPanel
                    segments={project.tracks.speed}
                    durationMs={project.durationMs}
                    playheadMs={playheadMs}
                    onAdd={onAddSpeedSegment}
                    onUpdate={onUpdateSpeedSegment}
                    onRemove={onRemoveSpeedSegment}
                />
            )}
        </aside>
    );
}