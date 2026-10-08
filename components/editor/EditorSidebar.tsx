'use client';

import React, { useState } from 'react';
import { ArrowLeft, RotateCcw, Undo2, Sparkles, Palette, Type, Captions, Scissors, Mic, ZoomIn, Gauge, Music } from 'lucide-react';
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
    isSourceMuted: boolean;
    onMuteSourceAudio: () => void;
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
    onColorGradeChange, onAddOverlay, onUpdateOverlay, onRemoveOverlay, onSetAudioTracks, isSourceMuted, onMuteSourceAudio,
    onAddZoomKeyframe, onUpdateZoomKeyframe, onRemoveZoomKeyframe,
    onAddSpeedSegment, onUpdateSpeedSegment, onRemoveSpeedSegment,
    onAddCaption, onUpdateCaption, onRemoveCaption, onCaptionStyleChange, onGenerateCaptions,
    onSeek, isTranscribing, transcriptionProgress, transcriptionError,
}: EditorSidebarProps) {
    const [tab, setTab] = useState<Tab>('color');
    const [panelOpen, setPanelOpen] = useState(false);
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
        <aside className="order-2 flex w-full shrink-0 flex-col border-t border-[#14121F]/10 bg-white pb-[env(safe-area-inset-bottom)] font-[family-name:var(--font-body)] text-[#14121F] md:order-1 md:h-full md:w-72 md:overflow-y-auto md:border-r md:border-t-0 md:p-5 md:pb-5">
            <button
                onClick={onBack}
                className="mb-4 hidden items-center gap-2 text-xs font-semibold text-[#14121F]/60 transition-colors hover:text-[#14121F] md:flex">
                <ArrowLeft className="w-4 h-4" /> Back to Recording
            </button>

            <div className="flex gap-1.5 overflow-x-auto p-2 [scrollbar-width:none] md:mb-5 md:grid md:grid-cols-3 md:overflow-visible md:rounded-2xl md:bg-[#F7F6FB] md:border md:border-[#14121F]/10 md:p-1.5">
                {([['style', 'Styles', Sparkles], ['color', 'Color', Palette], ['text', 'Text', Type], ['captions', 'Captions', Captions], ['clip', 'Trim', Scissors], ['coach', 'Coach', Mic], ['zoom', 'Zoom', ZoomIn], ['speed', 'Speed', Gauge], ['music', 'Music', Music]] as const).map(([key, label, Icon]) => (
                    <button
                        key={key}
                        onClick={() => { if (tab === key && panelOpen) setPanelOpen(false); else { setTab(key); setPanelOpen(true); } }}
                        className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-semibold transition-colors md:flex-1 md:rounded-xl md:px-0 md:py-2.5 ${tab === key && (panelOpen || false) ? 'bg-[#14121F] text-white shadow-sm' : tab === key ? 'bg-[#14121F] text-white shadow-sm md:bg-[#14121F]' : 'text-[#14121F]/70 hover:bg-[#14121F]/5 hover:text-[#14121F]'
                            }`}>
                        <span className="flex items-center justify-center gap-1.5 md:flex-col md:gap-1"><Icon className="h-4 w-4" />{label}</span>
                    </button>
                ))}
            </div>

            <div className={`${panelOpen ? 'flex' : 'hidden'} max-h-[42dvh] flex-col overflow-y-auto overscroll-contain border-t border-[#14121F]/10 p-4 md:block md:max-h-none md:overflow-visible md:border-0 md:p-0`}>
                <div className="mb-4 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">{tab === 'text' ? 'Text + Hook builder' : tab === 'style' ? 'One-click style' : tab === 'clip' ? 'Video clip' : tab === 'coach' ? 'Delivery coach' : tab}</span>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => onUndoTab(tab)}
                            disabled={undoCounts[tab] === 0}
                            title={`Undo ${tab} change`}
                            className="flex items-center gap-1 rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-2.5 py-1.5 text-xs font-semibold text-[#14121F] transition-colors hover:bg-[#14121F] hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                            <Undo2 className="h-3.5 w-3.5" /> Undo
                        </button>
                        <button
                            type="button"
                            onClick={() => onResetTab(tab)}
                            disabled={!activeTabIsDirty}
                            title={`Reset ${tab} tab`}
                            className="flex items-center gap-1 rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-2.5 py-1.5 text-xs font-semibold text-[#14121F] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40">
                            <RotateCcw className="h-3.5 w-3.5" /> Reset
                        </button>
                    </div>
                </div>

                {tab === 'color' && (
                    <ColorGradePanel colorGrade={project.colorGrade} onChange={onColorGradeChange} />
                )}
                {tab === 'style' && <StylePresetsPanel onApply={onApplyStylePreset} />}
                {tab === 'clip' && (
                    <div className="space-y-3 text-xs leading-relaxed text-[#14121F]/70 bg-[#F7F6FB] p-4 rounded-2xl border border-[#14121F]/10">
                        <p>Trim the blue handles or split at the playhead using the video lane below the preview.</p>
                        <p>Trim in: <span className="font-mono font-semibold text-[#14121F]">{(project.videoEdit.trimStartMs / 1000).toFixed(2)}s</span></p>
                        <p>Trim out: <span className="font-mono font-semibold text-[#14121F]">{(project.videoEdit.trimEndMs / 1000).toFixed(2)}s</span></p>
                        <p>Split points: <span className="font-mono font-semibold text-[#14121F]">{project.videoEdit.splitPointsMs.length}</span></p>
                        <p className="border-t border-[#14121F]/10 pt-3 text-[#14121F]/50">Reset restores the full source clip and removes its split markers. Other tabs are unchanged.</p>
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
                        scriptText={project.teleprompterScript}
                        isSourceMuted={isSourceMuted}
                        onMuteSourceAudio={onMuteSourceAudio}
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
            </div>
        </aside>
    );
}