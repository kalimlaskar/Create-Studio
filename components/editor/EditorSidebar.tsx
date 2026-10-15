'use client';

import React, { useState } from 'react';
import { ArrowLeft, Captions, Gauge, Mic, Music, Palette, RotateCcw, Scissors, Sparkles, Type, Undo2, X, ZoomIn, type LucideIcon } from 'lucide-react';
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

/* ------------------------------ tab config ------------------------------ */
interface TabConfig {
    id: Tab;
    label: string;
    title: string;
    hint: string;
    icon: LucideIcon;
    /** Draws a divider before this tab to separate groups (Look / Edit / Audio). */
    groupStart?: boolean;
}

const TABS: TabConfig[] = [
    { id: 'style', label: 'Styles', title: 'One-click style', hint: 'Apply a complete look in one tap', icon: Sparkles },
    { id: 'color', label: 'Color', title: 'Color grade', hint: 'Tune light, tone and mood', icon: Palette },
    { id: 'text', label: 'Text', title: 'Text + hook builder', hint: 'Titles and hooks on screen', icon: Type },
    { id: 'captions', label: 'Captions', title: 'Captions', hint: 'Generate, style and fix subtitles', icon: Captions },
    { id: 'clip', label: 'Trim', title: 'Video clip', hint: 'Cut the start, end and splits', icon: Scissors, groupStart: true },
    { id: 'zoom', label: 'Zoom', title: 'Zoom', hint: 'Punch in on key moments', icon: ZoomIn },
    { id: 'speed', label: 'Speed', title: 'Speed', hint: 'Slow-mo and fast-forward segments', icon: Gauge },
    { id: 'music', label: 'Music', title: 'Music & audio', hint: 'Soundtrack and source audio', icon: Music, groupStart: true },
    { id: 'coach', label: 'Coach', title: 'Delivery coach', hint: 'Tighten pauses and filler', icon: Mic },
];

/* ------------------------------ dirty state ----------------------------- */
function isTabDirty(project: EditorProject, tab: Tab): boolean {
    const gradeChanged = () =>
        (Object.keys(DEFAULT_COLOR_GRADE) as Array<keyof ColorGradeSettings>).some((key) => project.colorGrade[key] !== DEFAULT_COLOR_GRADE[key]);

    switch (tab) {
        case 'coach': return false;
        case 'color': return gradeChanged();
        case 'text': return project.tracks.overlays.length > 0;
        case 'captions': return project.tracks.captions.length > 0 || project.captionStyle !== 'classic';
        case 'zoom': return project.tracks.zoom.length > 0;
        case 'speed': return project.tracks.speed.length > 0;
        case 'music': return project.tracks.audio.length > 0;
        case 'style': return gradeChanged() || project.captionStyle !== 'classic' || project.tracks.zoom.length > 0;
        default: // clip
            return project.videoEdit.trimStartMs > 0 || project.videoEdit.trimEndMs < project.durationMs || project.videoEdit.splitPointsMs.length > 0;
    }
}

/* ------------------------------- subviews ------------------------------- */
function StatTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-[#14121F]/8 bg-white p-3 shadow-[0_1px_2px_rgba(20,18,31,0.04)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#14121F]/45">{label}</p>
            <p className="mt-1 font-mono text-base font-bold text-[#14121F]">{value}</p>
        </div>
    );
}

function ClipPanel({ project }: { project: EditorProject }) {
    const { trimStartMs, trimEndMs, splitPointsMs } = project.videoEdit;
    const keptMs = Math.max(0, trimEndMs - trimStartMs);
    const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
                <StatTile label="Trim in" value={seconds(trimStartMs)} />
                <StatTile label="Trim out" value={seconds(trimEndMs)} />
                <StatTile label="Kept length" value={seconds(keptMs)} />
                <StatTile label="Splits" value={String(splitPointsMs.length)} />
            </div>
            <div className="space-y-1.5 rounded-2xl border border-[#6A4CFF]/20 bg-[#6A4CFF]/5 p-3.5 text-xs leading-relaxed text-[#14121F]/70">
                <p>Drag the violet handles or split at the playhead using the video lane below the preview.</p>
                <p className="text-[#14121F]/50">Reset restores the full source clip and removes split markers. Other tabs are unchanged.</p>
            </div>
        </div>
    );
}

/* ------------------------------- component ------------------------------ */
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

    const active = TABS.find((item) => item.id === tab) ?? TABS[0];
    const activeTabIsDirty = isTabDirty(project, tab);
    const undoCount = undoCounts[tab] ?? 0;

    const selectTab = (next: Tab) => {
        if (tab === next && panelOpen) setPanelOpen(false);
        else { setTab(next); setPanelOpen(true); }
    };

    return (
        <aside className="order-2 flex w-full shrink-0 flex-col-reverse border-t border-[#14121F]/10 bg-white font-[family-name:var(--font-body)] text-[#14121F] md:order-1 md:h-full md:w-[22.5rem] md:flex-row md:overflow-hidden md:border-r md:border-t-0">
            {/* ---------------- Tab rail (bottom bar on mobile, left rail on desktop) ---------------- */}
            <nav
                role="tablist"
                aria-label="Editor tools"
                className="flex shrink-0 items-center gap-1 overflow-x-auto bg-white px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] [scrollbar-width:none] md:w-[4.5rem] md:flex-col md:items-stretch md:gap-1 md:overflow-y-auto md:border-r md:border-[#14121F]/8 md:bg-[#F7F6FB] md:px-2 md:py-3">
                <button
                    type="button"
                    onClick={onBack}
                    title="Back to recording"
                    aria-label="Back to recording"
                    className="hidden items-center justify-center rounded-2xl p-2.5 text-[#14121F]/55 transition hover:bg-white hover:text-[#14121F] hover:shadow-sm md:flex">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <span aria-hidden="true" className="mx-auto hidden h-px w-8 bg-[#14121F]/10 md:block" />

                {TABS.map(({ id, label, icon: Icon, groupStart }) => {
                    const selected = tab === id;
                    const dirty = isTabDirty(project, id);
                    return (
                        <React.Fragment key={id}>
                            {groupStart && <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-[#14121F]/10 md:mx-auto md:my-1 md:h-px md:w-8" />}
                            <button
                                type="button"
                                role="tab"
                                id={`editor-tab-${id}`}
                                aria-selected={selected}
                                aria-controls="editor-tabpanel"
                                onClick={() => selectTab(id)}
                                className={`group relative flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all md:flex-col md:gap-1 md:rounded-2xl md:px-1 md:py-2.5 md:text-[10px] ${selected
                                    ? 'bg-[#6A4CFF] text-white shadow-md shadow-[#6A4CFF]/25 md:bg-white md:text-[#6A4CFF] md:shadow-sm md:ring-1 md:ring-[#6A4CFF]/20'
                                    : 'text-[#14121F]/60 hover:bg-[#14121F]/5 hover:text-[#14121F] md:hover:bg-white'}`}>
                                <span className="relative">
                                    <Icon className="h-4 w-4 md:h-5 md:w-5" />
                                    {dirty && (
                                        <span
                                            aria-label="Has edits"
                                            className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ${selected ? 'bg-white ring-[#6A4CFF] md:bg-[#6A4CFF] md:ring-white' : 'bg-[#FF3D81] ring-white md:ring-[#F7F6FB] md:group-hover:ring-white'}`}
                                        />
                                    )}
                                </span>
                                {label}
                            </button>
                        </React.Fragment>
                    );
                })}
            </nav>

            {/* ------------------------------- Panel ------------------------------- */}
            <div
                id="editor-tabpanel"
                role="tabpanel"
                aria-labelledby={`editor-tab-${tab}`}
                className={`${panelOpen ? 'flex' : 'hidden'} max-h-[42dvh] min-h-0 flex-col overflow-y-auto overscroll-contain border-b border-[#14121F]/8 bg-white md:flex md:max-h-none md:min-w-0 md:flex-1 md:border-b-0`}>
                {/* Sticky header */}
                <header className="sticky top-0 z-10 border-b border-[#14121F]/8 bg-white/90 px-4 py-3 backdrop-blur md:px-5 md:py-4">
                    <div className="mb-1 flex justify-center md:hidden" aria-hidden="true">
                        <span className="h-1 w-9 rounded-full bg-[#14121F]/15" />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="font-[family-name:var(--font-display)] text-[15px] font-bold leading-tight tracking-tight">{active.title}</h2>
                            <p className="mt-0.5 text-[11px] leading-snug text-[#14121F]/50">{active.hint}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => onUndoTab(tab)}
                                disabled={undoCount === 0}
                                title={`Undo ${active.label.toLowerCase()} change`}
                                aria-label={`Undo ${active.label.toLowerCase()} change`}
                                className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-[#14121F]/10 bg-[#F7F6FB] text-[#14121F] transition hover:bg-[#14121F] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-[#F7F6FB] disabled:hover:text-[#14121F]">
                                <Undo2 className="h-3.5 w-3.5" />
                                {undoCount > 0 && (
                                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#6A4CFF] px-1 text-[9px] font-bold text-white">{undoCount}</span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => onResetTab(tab)}
                                disabled={!activeTabIsDirty}
                                title={`Reset ${active.label.toLowerCase()} tab`}
                                aria-label={`Reset ${active.label.toLowerCase()} tab`}
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#14121F]/10 bg-[#F7F6FB] text-[#14121F] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[#14121F]/10 disabled:hover:bg-[#F7F6FB] disabled:hover:text-[#14121F]">
                                <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPanelOpen(false)}
                                aria-label="Close panel"
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#14121F]/50 transition hover:bg-[#14121F]/5 hover:text-[#14121F] md:hidden">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Body */}
                <div className="min-h-0 flex-1 p-4 md:overflow-y-auto md:p-5">
                    {tab === 'color' && <ColorGradePanel colorGrade={project.colorGrade} onChange={onColorGradeChange} />}
                    {tab === 'style' && <StylePresetsPanel onApply={onApplyStylePreset} />}
                    {tab === 'clip' && <ClipPanel project={project} />}
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
            </div>
        </aside>
    );
}