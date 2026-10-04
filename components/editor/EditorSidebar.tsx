'use client';

import React, { useState } from 'react';
import { ArrowLeft, RotateCcw, Undo2 } from 'lucide-react';
import { EditorProject, OverlayClip, ColorGradeSettings, AudioTrackClip, ZoomKeyframe, SpeedSegment, CaptionCue, CaptionStyle, EditorTabId, DEFAULT_COLOR_GRADE } from '@/types/editor';
import { ColorGradePanel } from './ColorGradePanel';
import { TextOverlayPanel } from './TextOverlayPanel';
import { MusicPanel } from './MusicPanel';
import { ZoomPanel } from './ZoomPanel';
import { SpeedPanel } from './SpeedPanel';
import { CaptionsPanel, TranscriptionLanguage } from './CaptionsPanel';
import { StylePresetsPanel } from './StylePresetsPanel';
import { DeliveryCoachPanel } from './DeliveryCoachPanel';

type Tab = EditorTabId;

interface EditorSidebarProps {
    project: EditorProject;
    undoCounts: Record<EditorTabId, number>;
    onUndoTab: (tab: EditorTabId) => void;
    onResetTab: (tab: EditorTabId) => void;
    onApplyStylePreset: (presetId: string) => void;
    onTightenToSpeech: (startMs: number, endMs: number) => void;
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
    onAddCaption: (cue: Omit<CaptionCue, 'id'>) => void;
    onUpdateCaption: (id: string, patch: Partial<CaptionCue>) => void;
    onRemoveCaption: (id: string) => void;
    onCaptionStyleChange: (style: CaptionStyle) => void;
    onGenerateCaptions: (language: TranscriptionLanguage) => void;
    onSeek: (timeMs: number) => void;
    isTranscribing: boolean;
    transcriptionProgress: number;
    transcriptionError: string | null;
}

export function EditorSidebar({
    project, undoCounts, onUndoTab, onResetTab, onApplyStylePreset, onTightenToSpeech, playheadMs, onBack,
    onColorGradeChange, onAddOverlay, onUpdateOverlay, onRemoveOverlay, onSetAudioTracks,
    onAddZoomKeyframe, onUpdateZoomKeyframe, onRemoveZoomKeyframe,
    onAddSpeedSegment, onUpdateSpeedSegment, onRemoveSpeedSegment,
    onAddCaption, onUpdateCaption, onRemoveCaption, onCaptionStyleChange, onGenerateCaptions,
    onSeek, isTranscribing, transcriptionProgress, transcriptionError,
}: EditorSidebarProps) {
    const [tab, setTab] = useState<Tab>('color');
    const activeTabIsDirty = tab === 'coach' ? false : tab === 'color'
        ? Object.keys(DEFAULT_COLOR_GRADE).some((key) => project.colorGrade[key as keyof ColorGradeSettings] !== DEFAULT_COLOR_GRADE[key as keyof ColorGradeSettings])
        : tab === 'text' ? project.tracks.overlays.length > 0
                : tab === 'captions' ? project.tracks.captions.length > 0 || project.captionStyle !== 'classic'
                : tab === 'zoom' ? project.tracks.zoom.length > 0
                    : tab === 'speed' ? project.tracks.speed.length > 0
                            : tab === 'music' ? project.tracks.audio.length > 0
                                : tab === 'style' ? Object.keys(DEFAULT_COLOR_GRADE).some((key) => project.colorGrade[key as keyof ColorGradeSettings] !== DEFAULT_COLOR_GRADE[key as keyof ColorGradeSettings]) || project.captionStyle !== 'classic' || project.tracks.zoom.length > 0
                                    : project.videoEdit.trimStartMs > 0 || project.videoEdit.trimEndMs < project.durationMs || project.videoEdit.splitPointsMs.length > 0;

    return (
        <aside className="max-h-[38dvh] w-full shrink-0 border-b border-neutral-800 bg-neutral-900 p-3 flex flex-col overflow-y-auto md:max-h-full md:w-72 md:border-b-0 md:border-r md:p-4">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-100 mb-4 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Recording
            </button>

            <div className="mb-5 grid grid-cols-4 gap-1 rounded-lg bg-neutral-800/50 p-1">
                {([['style', 'Styles'], ['color', 'Color'], ['text', 'Text + Hook'], ['captions', 'Captions'], ['clip', 'Clip'], ['coach', 'Coach'], ['zoom', 'Zoom'], ['speed', 'Speed'], ['music', 'Music']] as const).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex-1 text-xs py-2 rounded-md font-medium transition-colors ${tab === key ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
                            }`}>
                        {label}
                    </button>
                ))}
            </div>

            <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold capitalize text-neutral-300">{tab === 'text' ? 'Text + Hook builder' : tab === 'style' ? 'One-click style' : tab === 'clip' ? 'Video clip' : tab === 'coach' ? 'Delivery coach' : tab}</span>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => onUndoTab(tab)}
                        disabled={undoCounts[tab] === 0}
                        title={`Undo ${tab} change`}
                        className="flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1.5 text-[11px] text-neutral-300 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40">
                        <Undo2 className="h-3.5 w-3.5" /> Undo
                    </button>
                    <button
                        type="button"
                        onClick={() => onResetTab(tab)}
                        disabled={!activeTabIsDirty}
                        title={`Reset ${tab} tab`}
                        className="flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1.5 text-[11px] text-neutral-300 transition-colors hover:border-red-900/60 hover:bg-red-950/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40">
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                    </button>
                </div>
            </div>

            {tab === 'color' && (
                <ColorGradePanel colorGrade={project.colorGrade} onChange={onColorGradeChange} />
            )}
            {tab === 'style' && <StylePresetsPanel onApply={onApplyStylePreset} />}
            {tab === 'clip' && (
                <div className="space-y-3 text-xs leading-relaxed text-neutral-400">
                    <p>Trim the blue handles or split at the playhead using the video lane below the preview.</p>
                    <p>Trim in: <span className="font-mono text-neutral-200">{(project.videoEdit.trimStartMs / 1000).toFixed(2)}s</span></p>
                    <p>Trim out: <span className="font-mono text-neutral-200">{(project.videoEdit.trimEndMs / 1000).toFixed(2)}s</span></p>
                    <p>Split points: <span className="font-mono text-neutral-200">{project.videoEdit.splitPointsMs.length}</span></p>
                    <p className="border-t border-neutral-800 pt-3 text-neutral-500">Reset restores the full source clip and removes its split markers. Other tabs are unchanged.</p>
                </div>
            )}
            {tab === 'coach' && (
                <DeliveryCoachPanel
                    captions={project.tracks.captions}
                    durationMs={project.durationMs}
                    trimStartMs={project.videoEdit.trimStartMs}
                    trimEndMs={project.videoEdit.trimEndMs}
                    onTighten={onTightenToSpeech}
                />
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
            {tab === 'captions' && (
                <CaptionsPanel
                    captions={project.tracks.captions}
                    durationMs={project.durationMs}
                    playheadMs={playheadMs}
                    captionStyle={project.captionStyle}
                    isTranscribing={isTranscribing}
                    transcriptionProgress={transcriptionProgress}
                    error={transcriptionError}
                    onStyleChange={onCaptionStyleChange}
                    onAdd={onAddCaption}
                    onUpdate={onUpdateCaption}
                    onRemove={onRemoveCaption}
                    onSeek={onSeek}
                    onGenerate={onGenerateCaptions}
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