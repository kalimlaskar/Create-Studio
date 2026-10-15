'use client';

import React, { useRef } from 'react';
import { ArrowLeft, FolderOpen, ImagePlus, Loader2, Mic, Music2, Save, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import type { TextOverlayStyle } from '@/types/editor';
import { isDepthMotion } from './depthEstimator';
import { BORDER_EFFECTS, BorderEffect, DEFAULT_TRACKS } from './photoReelExtras';
import { FX_LIST, FX_PRESETS, FxId } from './photoReelFx';
import type { PhotoReelDraftSummary } from './photoReelDrafts';
import type { LoadedFile } from './reelDraftData';
import { PRODUCT_TEMPLATES, ProductTemplate } from './reelTemplates';
import {
    CARD_CLASS, GHOST_BUTTON, MiniSlider, RangeField, SelectField,
} from './ReelUi';
import {
    Corner, FontKey, GRADIENTS, GradientPreset, MAX_IMAGES, NarrationLanguage, PlatformAspect, ReelImage,
    ReelSettings, ReelTemplate, TextPosition, VoiceGender, getDefaultTextColor,
} from './reelTypes';

const DEFAULT_RIPPLE = '#f97316';

export interface SidebarProps {
    onBack: () => void;
    settings: ReelSettings;
    set: <K extends keyof ReelSettings>(key: K, value: ReelSettings[K]) => void;

    productTemplate: ProductTemplate | null;
    onPickProductTemplate: (id: string | null) => void;
    showAdvanced: boolean;
    setShowAdvanced: (value: boolean) => void;
    onApplyReelPreset: (template: ReelTemplate) => void;

    images: ReelImage[];
    selectedImage: ReelImage | null;
    durationLabel: string;
    onAddClick: () => void;
    onSelectShot: (index: number) => void;
    updateSelected: (patch: Partial<ReelImage>) => void;
    updateAllClips: (patch: Partial<ReelImage>) => void;
    onMotionChange: (value: string) => void;
    onMatchBackground: () => void;
    depthStatus: Record<string, 'ready' | 'failed'>;

    toggleFx: (id: FxId) => void;
    applyFxPreset: (fx: FxId[], allClips: boolean) => void;

    drafts: PhotoReelDraftSummary[];
    currentDraftId: string | null;
    isSavingDraft: boolean;
    isLoadingDraft: boolean;
    isExporting: boolean;
    onSaveDraft: () => void;
    onOpenDraft: (id: string) => void;
    onRemoveDraft: (id: string) => void;

    logo: LoadedFile | null;
    onPickLogo: (file: File) => void;
    onRemoveLogo: () => void;

    music: LoadedFile | null;
    musicAudioRef: React.RefObject<HTMLAudioElement | null>;
    loadingTrack: string | null;
    onPickDefaultTrack: (id: string) => void;
    onPickMusicFile: (file: File) => void;
    onRemoveMusic: () => void;

    voiceover: LoadedFile | null;
    voiceAudioRef: React.RefObject<HTMLAudioElement | null>;
    isGeneratingVoice: boolean;
    onGenerateVoice: () => void;
    onPickVoiceFile: (file: File) => void;
    onRemoveVoice: () => void;
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">{children}</h2>
);

const EmptyHint = ({ children }: { children: React.ReactNode }) => (
    <p className="rounded-xl border border-dashed border-[#14121F]/20 px-3.5 py-4 text-center text-xs font-medium text-[#14121F]/50">{children}</p>
);

const TEXT_INPUT = 'w-full rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3.5 py-2.5 text-xs text-[#14121F] shadow-xs placeholder:text-[#14121F]/40 focus:border-[#6A4CFF] focus:outline-none';
const FILE_BUTTON = 'w-full rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3.5 py-2.5 text-left text-xs font-semibold text-[#14121F] shadow-xs transition hover:border-[#6A4CFF]';

const CornerOptions = () => (
    <>
        <option value="tl">Top left</option>
        <option value="tr">Top right</option>
        <option value="bl">Bottom left</option>
        <option value="br">Bottom right</option>
    </>
);

function FileInput({ accept, onFile, children, className }: { accept: string; onFile: (file: File) => void; children: React.ReactNode; className?: string }) {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <>
            <input
                ref={ref}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) onFile(file);
                }}
            />
            <button type="button" onClick={() => ref.current?.click()} className={className ?? FILE_BUTTON}>{children}</button>
        </>
    );
}

/* -------------------------------------------------------------------------- */

function TemplateSection(p: SidebarProps) {
    return (
        <section className={CARD_CLASS}>
            <div className="flex items-center justify-between">
                <SectionTitle>Start from a template</SectionTitle>
                {p.productTemplate && <button type="button" onClick={() => p.onPickProductTemplate(null)} className="text-xs font-semibold text-[#14121F]/50 hover:text-red-600">Clear</button>}
            </div>
            <div className="grid grid-cols-2 gap-2">
                {PRODUCT_TEMPLATES.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => { p.onPickProductTemplate(item.id); p.setShowAdvanced(false); }}
                        className={`rounded-xl border p-3 text-left transition ${p.settings.productTemplateId === item.id ? 'border-[#6A4CFF] bg-[#6A4CFF]/5' : 'border-[#14121F]/10 bg-[#F7F6FB] hover:border-[#6A4CFF]/50'}`}
                    >
                        <span className="block text-lg">{item.emoji}</span>
                        <span className="mt-1 block text-xs font-bold text-[#14121F]">{item.label}</span>
                        <span className="mt-0.5 block text-[10px] font-medium leading-snug text-[#14121F]/55">{item.blurb}</span>
                    </button>
                ))}
            </div>
            {p.productTemplate ? (
                <>
                    <p className="text-[11px] leading-relaxed text-[#14121F]/60"><span className="font-semibold text-[#14121F]/80">Best upload:</span> {p.productTemplate.spec}</p>
                    <button type="button" onClick={() => p.setShowAdvanced(!p.showAdvanced)} className={`w-full ${GHOST_BUTTON}`}>
                        {p.showAdvanced ? 'Hide advanced controls' : 'Show advanced controls'}
                    </button>
                </>
            ) : (
                <p className="text-[11px] leading-relaxed text-[#14121F]/60">Pick a category, then add your photos. Format, motion, colors and captions are set for you.</p>
            )}
        </section>
    );
}

function ClipsSection(p: SidebarProps) {
    return (
        <section className={CARD_CLASS}>
            <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Reel clips <span className="text-[#14121F]/40">({p.images.length}/{MAX_IMAGES})</span></h2>
                <span className="font-mono text-xs font-semibold text-[#14121F]/60">{p.durationLabel}</span>
            </div>

            <section className="space-y-2.5 rounded-xl border border-[#14121F]/10 bg-[#F7F6FB] p-3.5">
                <button type="button" onClick={p.onSaveDraft} disabled={p.isSavingDraft || p.isExporting} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#6A4CFF]/30 bg-[#6A4CFF]/10 px-3.5 py-2.5 text-xs font-semibold text-[#6A4CFF] shadow-xs transition hover:bg-[#6A4CFF]/20 disabled:cursor-not-allowed disabled:opacity-50">
                    {p.isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {p.isSavingDraft ? 'Saving draft…' : p.currentDraftId ? 'Update saved draft' : 'Save as draft'}
                </button>
                <details>
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-1 py-1 text-xs font-semibold text-[#14121F]/80 hover:text-[#14121F]">
                        <FolderOpen className="h-3.5 w-3.5 text-[#6A4CFF]" /> Saved reel drafts ({p.drafts.length})
                    </summary>
                    <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                        {p.drafts.map((draft) => (
                            <div key={draft.id} className="flex items-center gap-2 rounded-xl border border-[#14121F]/10 bg-white px-3 py-2 shadow-xs">
                                <button type="button" onClick={() => p.onOpenDraft(draft.id)} disabled={p.isLoadingDraft} className="min-w-0 flex-1 text-left text-xs text-[#14121F] disabled:opacity-50">
                                    <span className="block truncate font-semibold">{draft.title}</span>
                                    <span className="mt-0.5 block text-[10px] font-medium text-[#14121F]/50">{draft.clipCount} clips · {Math.round(draft.durationMs / 1000)} sec</span>
                                </button>
                                <button type="button" onClick={() => p.onRemoveDraft(draft.id)} aria-label={`Delete ${draft.title}`} className="rounded-lg p-1.5 text-[#14121F]/40 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                        ))}
                        {p.drafts.length === 0 && <p className="px-2 py-2 text-[11px] font-medium text-[#14121F]/50">No saved drafts yet.</p>}
                    </div>
                </details>
            </section>

            <button type="button" onClick={p.onAddClick} disabled={p.images.length >= MAX_IMAGES} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#14121F]/20 py-3.5 text-xs font-semibold text-[#14121F]/70 transition-colors hover:border-[#6A4CFF] hover:bg-[#6A4CFF]/5 hover:text-[#6A4CFF] disabled:opacity-40">
                <ImagePlus className="h-4 w-4" /> Add photos or videos
            </button>

            {p.productTemplate && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#14121F]/50">Shot list</p>
                    {p.productTemplate.shots.map((shot, index) => {
                        const filled = p.images[index];
                        return (
                            <button key={shot.title} type="button" onClick={() => p.onSelectShot(index)} className="flex w-full items-start gap-2 rounded-lg border border-[#14121F]/10 bg-[#F7F6FB] px-2.5 py-2 text-left transition hover:border-[#6A4CFF]/50">
                                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${filled ? 'bg-[#6A4CFF] text-white' : 'bg-[#14121F]/10 text-[#14121F]/50'}`}>{filled ? '✓' : index + 1}</span>
                                <span className="min-w-0">
                                    <span className="block text-xs font-semibold text-[#14121F]">{shot.title}</span>
                                    <span className="block text-[10px] text-[#14121F]/50">{shot.tip}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

function LookSection(p: SidebarProps) {
    const { settings, set, selectedImage } = p;
    return (
        <section className={`${CARD_CLASS} ${p.productTemplate && !p.showAdvanced ? 'hidden' : ''}`}>
            <SectionTitle>Image Look</SectionTitle>

            <SelectField label="Reel template" value={settings.template} onChange={(value) => p.onApplyReelPreset(value as ReelTemplate)}>
                <option value="custom">Custom look</option>
                <option value="product-demo">⚡ Product 3D Showcase Preset</option>
                <option value="travel">Travel diary</option>
                <option value="birthday">Birthday</option>
                <option value="product">Product launch</option>
                <option value="festival">Festival</option>
            </SelectField>

            <SelectField label="Frame format" value={settings.aspectRatio} onChange={(value) => set('aspectRatio', value as PlatformAspect)}>
                <option value="9:16">Reel · 9:16</option>
                <option value="1:1">Square · 1:1</option>
                <option value="4:5">Portrait · 4:5</option>
                <option value="16:9">Landscape · 16:9</option>
            </SelectField>

            <div className="flex items-center justify-between pt-1">
                <label className="text-xs font-semibold text-[#14121F]">Custom Background Color</label>
                <div className="flex items-center gap-2">
                    <input type="color" value={settings.backgroundColor} onChange={(event) => set('backgroundColor', event.target.value)} className="h-7 w-9 cursor-pointer rounded-lg border border-[#14121F]/20 bg-transparent p-0" />
                    <span className="font-mono text-[11px] text-[#14121F]/60">{settings.backgroundColor}</span>
                </div>
            </div>
            {selectedImage?.type === 'image' && (
                <button type="button" onClick={p.onMatchBackground} className={`w-full ${GHOST_BUTTON}`}>Match background to selected photo</button>
            )}

            <RangeField label="Seconds per photo" display={`${settings.secondsPerImage}s`} min={1} max={8} value={settings.secondsPerImage} onChange={(value) => set('secondsPerImage', value)} />

            <SelectField label="Gradient overlay" value={settings.gradient} onChange={(value) => set('gradient', value as GradientPreset)}>
                {GRADIENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </SelectField>

            <RangeField label="Gradient strength" display={`${settings.gradientStrength}%`} min={0} max={100} value={settings.gradientStrength} onChange={(value) => set('gradientStrength', value)} />
            <RangeField label="Brightness" display={`${settings.brightness}%`} min={50} max={150} value={settings.brightness} onChange={(value) => set('brightness', value)} />
            <RangeField label="Saturation" display={`${settings.saturation}%`} min={0} max={200} value={settings.saturation} onChange={(value) => set('saturation', value)} />

            {selectedImage && (
                <div className="space-y-3 border-t border-[#14121F]/10 pt-3">
                    <h3 className="text-xs font-bold text-[#6A4CFF]">Selected Clip Adjustments</h3>

                    <label className="block text-xs font-semibold text-[#14121F]">Image Zoom · {((selectedImage.scale ?? 1) * 100).toFixed(0)}%
                        <div className="mt-1 flex items-center gap-2">
                            <ZoomOut className="h-4 w-4 text-[#14121F]/50" />
                            <input type="range" min={0.5} max={2.5} step={0.05} value={selectedImage.scale ?? 1} onChange={(event) => p.updateSelected({ scale: Number(event.target.value) })} className="w-full accent-[#6A4CFF]" />
                            <ZoomIn className="h-4 w-4 text-[#14121F]/50" />
                        </div>
                    </label>

                    <div className="grid grid-cols-2 gap-2.5 pt-2">
                        <SelectField label="Entry transition" value={selectedImage.transition ?? 'fade'} onChange={(value) => p.updateSelected({ transition: value as ReelImage['transition'] })}>
                            <option value="cut">Cut</option>
                            <option value="fade">Fade</option>
                            <option value="slide">Slide</option>
                            <option value="zoom">Zoom</option>
                        </SelectField>

                        {selectedImage.type === 'image' && (
                            <div>
                                <SelectField label="3D Camera Motion" value={selectedImage.motion ?? 'none'} onChange={p.onMotionChange}>
                                    <option value="none">Still</option>
                                    <option value="zoom-in">Slow zoom in</option>
                                    <option value="zoom-out">Slow zoom out</option>
                                    <option value="depth-orbit">👑 🔄 Product Orbit (PRO)</option>
                                    <option value="depth-sway">👑 ↔️ Turntable Sway (PRO)</option>
                                    <option value="depth-dolly">👑 🔍 3D Dolly In (PRO)</option>
                                </SelectField>
                                {isDepthMotion(selectedImage.motion) && (
                                    <span className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-[#6A4CFF]">
                                        {p.depthStatus[selectedImage.id] === 'failed'
                                            ? 'Depth failed — showing a plain zoom.'
                                            : !p.depthStatus[selectedImage.id]
                                                ? <><Loader2 className="h-3 w-3 animate-spin" /> Computing 3D depth…</>
                                                : '3D Camera ready.'}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

function TextSection(p: SidebarProps) {
    const clip = p.selectedImage;
    return (
        <section className={CARD_CLASS}>
            <SectionTitle>Add text to a clip</SectionTitle>
            {clip ? (
                <>
                    <textarea
                        aria-label="Text overlay"
                        value={clip.overlayText}
                        onChange={(event) => p.updateSelected({ overlayText: event.target.value.slice(0, 120), autoCaption: false })}
                        maxLength={120}
                        rows={2}
                        placeholder="Type product highlight text…"
                        className={`${TEXT_INPUT} resize-y`}
                    />
                    <p className="text-[10px] italic text-[#14121F]/50">💡 Tip: Drag the caption on the preview to reposition it.</p>

                    <div className="grid grid-cols-2 gap-2.5">
                        <SelectField label="Design" value={clip.textStyle} onChange={(value) => p.updateSelected({ textStyle: value as TextOverlayStyle })}>
                            <option value="classic">Classic</option>
                            <option value="banner">Banner</option>
                            <option value="highlight">Highlight</option>
                            <option value="outline">Outline</option>
                        </SelectField>
                        <SelectField label="Position" value={clip.textPosition} onChange={(value) => p.updateSelected({ textPosition: value as TextPosition, textOffset: { x: 0, y: 0 } })}>
                            <option value="top">Top</option>
                            <option value="center">Center</option>
                            <option value="bottom">Bottom</option>
                        </SelectField>
                    </div>

                    <RangeField label="Font size" display={`${Math.round((clip.textSize ?? 1) * 100)}%`} min={0.5} max={2.5} step={0.05} value={clip.textSize ?? 1} onChange={(value) => p.updateSelected({ textSize: value })} />

                    <div className="grid grid-cols-2 gap-2.5">
                        <SelectField label="Font" value={clip.fontFamily ?? 'sans'} onChange={(value) => p.updateSelected({ fontFamily: value as FontKey })}>
                            <option value="sans">Sans</option>
                            <option value="serif">Serif</option>
                            <option value="mono">Mono</option>
                            <option value="display">Impact</option>
                        </SelectField>
                        <label className="block text-xs font-semibold text-[#14121F]">Color
                            <input type="color" value={clip.textColor ?? getDefaultTextColor(clip.textStyle)} onChange={(event) => p.updateSelected({ textColor: event.target.value })} className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-[#14121F]/20 p-0" />
                        </label>
                    </div>

                    <div className="flex gap-2">
                        <button type="button" onClick={() => p.updateSelected({ textOffset: { x: 0, y: 0 } })} className={`flex-1 ${GHOST_BUTTON}`}>Reset position</button>
                        <button type="button" onClick={() => p.updateSelected({ textSize: 1, textColor: undefined, fontFamily: 'sans' })} className={`flex-1 ${GHOST_BUTTON}`}>Reset style</button>
                    </div>
                </>
            ) : <EmptyHint>Select a clip to add text.</EmptyHint>}
        </section>
    );
}

function ProductEffectsSection(p: SidebarProps) {
    const clip = p.selectedImage;
    return (
        <section className={`${CARD_CLASS} ${p.productTemplate && !p.showAdvanced ? 'hidden' : ''}`}>
            <SectionTitle>Product effects</SectionTitle>
            {clip ? (
                <>
                    <label className="flex items-center justify-between text-xs font-semibold text-[#14121F]">
                        Shine sweep
                        <input type="checkbox" checked={!!clip.shine} onChange={(event) => p.updateSelected({ shine: event.target.checked })} className="h-4 w-4 accent-[#6A4CFF]" />
                    </label>
                    {clip.type === 'image' && isDepthMotion(clip.motion) && (
                        <label className="flex items-center justify-between text-xs font-semibold text-[#14121F]">
                            Soft edges when zoomed out
                            <input type="checkbox" checked={clip.softEdges !== false} onChange={(event) => p.updateSelected({ softEdges: event.target.checked })} className="h-4 w-4 accent-[#6A4CFF]" />
                        </label>
                    )}
                    <RangeField label="Vignette" display={`${clip.vignette ?? 0}%`} min={0} max={60} value={clip.vignette ?? 0} onChange={(value) => p.updateSelected({ vignette: value })} />

                    <SelectField label="Animated border" value={clip.borderEffect ?? 'none'} onChange={(value) => p.updateSelected({ borderEffect: value as BorderEffect })}>
                        {BORDER_EFFECTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </SelectField>
                    {clip.borderEffect && clip.borderEffect !== 'none' && (
                        <>
                            <label className="block text-xs font-semibold text-[#14121F]">Border color
                                <input type="color" value={clip.borderColor ?? '#6A4CFF'} onChange={(event) => p.updateSelected({ borderColor: event.target.value })} className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-[#14121F]/20 p-0" />
                            </label>
                            <button type="button" onClick={() => p.updateAllClips({ borderEffect: clip.borderEffect, borderColor: clip.borderColor })} className={`w-full ${GHOST_BUTTON}`}>Apply border to all clips</button>
                        </>
                    )}

                    <input aria-label="Badge text" value={clip.badgeText ?? ''} onChange={(event) => p.updateSelected({ badgeText: event.target.value.slice(0, 24) })} placeholder="Badge: NEW, 50% OFF, ₹999…" className={TEXT_INPUT} />
                    <div className="grid grid-cols-2 gap-2.5">
                        <SelectField label="Badge corner" value={clip.badgeCorner ?? 'tl'} onChange={(value) => p.updateSelected({ badgeCorner: value as Corner })}>
                            <CornerOptions />
                        </SelectField>
                        <label className="block text-xs font-semibold text-[#14121F]">Badge color
                            <input type="color" value={clip.badgeColor ?? '#ef4444'} onChange={(event) => p.updateSelected({ badgeColor: event.target.value })} className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-[#14121F]/20 p-0" />
                        </label>
                    </div>
                </>
            ) : <EmptyHint>Select a clip to add effects.</EmptyHint>}
        </section>
    );
}

const CURSOR_PRESETS = [
    { label: 'Left Card', x: 0.28, y: 0.58 },
    { label: 'Center Title', x: 0.5, y: 0.38 },
    { label: 'Right Card', x: 0.72, y: 0.58 },
];

function WowEffectsSection(p: SidebarProps) {
    const clip = p.selectedImage;
    return (
        <section className={CARD_CLASS}>
            <SectionTitle>✨ Wow effects</SectionTitle>
            {clip ? (
                <>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#14121F]/50">One-click packs</p>
                    <div className="grid grid-cols-2 gap-2">
                        {FX_PRESETS.map((preset) => (
                            <button key={preset.id} type="button" onClick={() => p.applyFxPreset(preset.fx, false)} className="rounded-xl border border-[#14121F]/10 bg-[#F7F6FB] p-2.5 text-left transition hover:border-[#6A4CFF]/60">
                                <span className="block text-sm">{preset.emoji}</span>
                                <span className="block text-xs font-bold text-[#14121F]">{preset.label}</span>
                                <span className="block text-[10px] leading-snug text-[#14121F]/55">{preset.blurb}</span>
                            </button>
                        ))}
                    </div>

                    {(['Motion', 'Hit', 'Particles', 'Look'] as const).map((group) => (
                        <div key={group} className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#14121F]/50">{group}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {FX_LIST.filter((item) => item.group === group).map((item) => {
                                    const on = (clip.fx ?? []).includes(item.id);
                                    return (
                                        <button key={item.id} type="button" onClick={() => p.toggleFx(item.id)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${on ? 'border-[#6A4CFF] bg-[#6A4CFF] text-white' : 'border-[#14121F]/15 bg-white text-[#14121F]/80 hover:border-[#6A4CFF]/60'}`}>
                                            {item.emoji} {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {clip.fx?.includes('cursor-click') && (
                        <div className="space-y-3 rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] p-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-[#14121F]">🖱️ Cursor Click Position & Color</label>
                                <input type="color" value={clip.cursorColor ?? '#6A4CFF'} onChange={(event) => p.updateSelected({ cursorColor: event.target.value })} className="h-6 w-8 cursor-pointer rounded-md border border-[#14121F]/20 bg-transparent p-0" title="Cursor Color" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {CURSOR_PRESETS.map((preset) => (
                                    <button key={preset.label} type="button" onClick={() => p.updateSelected({ cursorTargetX: preset.x, cursorTargetY: preset.y })} className="rounded-lg border border-[#14121F]/15 bg-white px-2 py-1.5 text-xs font-semibold text-[#14121F] hover:border-[#6A4CFF]">
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                            <MiniSlider label="X Position" display={`${Math.round((clip.cursorTargetX ?? 0.5) * 100)}%`} min={0.05} max={0.95} step={0.01} value={clip.cursorTargetX ?? 0.5} onChange={(value) => p.updateSelected({ cursorTargetX: value })} />
                            <MiniSlider label="Y Position" display={`${Math.round((clip.cursorTargetY ?? 0.4) * 100)}%`} min={0.05} max={0.95} step={0.01} value={clip.cursorTargetY ?? 0.4} onChange={(value) => p.updateSelected({ cursorTargetY: value })} />
                            <MiniSlider label="Cursor Click Radius Scale" display={`${(clip.cursorScale ?? 1).toFixed(1)}x`} min={0.2} max={2.5} step={0.1} value={clip.cursorScale ?? 1} onChange={(value) => p.updateSelected({ cursorScale: value })} />
                        </div>
                    )}

                    {clip.fx?.includes('ripple-effect') && (
                        <div className="mt-3 space-y-3 rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] p-3">
                            <label className="text-xs font-semibold text-[#14121F]">💧 Ripple Wave Settings</label>
                            <MiniSlider label="Ripple X Position" display={`${Math.round((clip.rippleTargetX ?? 0.5) * 100)}%`} min={0.05} max={0.95} step={0.01} value={clip.rippleTargetX ?? 0.5} onChange={(value) => p.updateSelected({ rippleTargetX: value })} />
                            <MiniSlider label="Ripple Y Position" display={`${Math.round((clip.rippleTargetY ?? 0.4) * 100)}%`} min={0.05} max={0.95} step={0.01} value={clip.rippleTargetY ?? 0.4} onChange={(value) => p.updateSelected({ rippleTargetY: value })} />
                            <MiniSlider label="Ripple Radius Scale" display={`${(clip.rippleScale ?? 0.5).toFixed(1)}x`} min={0.2} max={2} step={0.1} value={clip.rippleScale ?? 0.5} onChange={(value) => p.updateSelected({ rippleScale: value })} />
                            <div className="flex items-center justify-between pt-1">
                                <span className="text-xs font-semibold text-[#14121F]">Ripple Color</span>
                                <input type="color" value={clip.rippleColor ?? DEFAULT_RIPPLE} onChange={(event) => p.updateSelected({ rippleColor: event.target.value })} className="h-7 w-9 cursor-pointer rounded-lg border border-[#14121F]/20 bg-transparent p-0" />
                            </div>
                        </div>
                    )}

                    <RangeField label="Beat speed" display={`${p.settings.fxBpm} BPM`} min={60} max={180} value={p.settings.fxBpm} onChange={(value) => p.set('fxBpm', value)} />

                    <div className="flex gap-2">
                        <button type="button" onClick={() => p.applyFxPreset(clip.fx ?? [], true)} className={`flex-1 ${GHOST_BUTTON}`}>Apply to all clips</button>
                        <button type="button" onClick={() => p.applyFxPreset([], false)} className={`flex-1 ${GHOST_BUTTON} hover:!border-red-400 hover:text-red-600`}>Clear effects</button>
                    </div>
                </>
            ) : <EmptyHint>Select a clip to add wow effects.</EmptyHint>}
        </section>
    );
}

function LogoSection(p: SidebarProps) {
    return (
        <section className={CARD_CLASS}>
            <div className="flex items-center justify-between">
                <SectionTitle>Brand logo</SectionTitle>
                {p.logo && <button type="button" onClick={p.onRemoveLogo} className="text-xs font-semibold text-[#14121F]/50 hover:text-red-600">Remove</button>}
            </div>
            <FileInput accept="image/*" onFile={p.onPickLogo}>{p.logo ? p.logo.file.name : 'Upload logo (PNG works best)'}</FileInput>
            {p.logo && (
                <>
                    <SelectField label="Logo corner" value={p.settings.logoCorner} onChange={(value) => p.set('logoCorner', value as Corner)}>
                        <CornerOptions />
                    </SelectField>
                    <RangeField label="Logo size" display={`${p.settings.logoSize}%`} min={6} max={40} value={p.settings.logoSize} onChange={(value) => p.set('logoSize', value)} />
                </>
            )}
        </section>
    );
}

function MusicSection(p: SidebarProps) {
    return (
        <section className={CARD_CLASS}>
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#14121F]/70"><Music2 className="h-4 w-4 text-[#6A4CFF]" /> Background music</h2>
                {p.music && <button type="button" onClick={p.onRemoveMusic} className="text-xs font-semibold text-[#14121F]/50 hover:text-red-600">Remove</button>}
            </div>

            <div className="grid grid-cols-2 gap-2">
                {DEFAULT_TRACKS.map((track) => (
                    <button
                        key={track.id}
                        type="button"
                        onClick={() => p.onPickDefaultTrack(track.id)}
                        disabled={p.loadingTrack !== null}
                        className={`rounded-xl border p-2.5 text-left transition disabled:opacity-60 ${p.music?.file.name === `${track.label}.wav` ? 'border-[#6A4CFF] bg-[#6A4CFF]/5' : 'border-[#14121F]/10 bg-[#F7F6FB] hover:border-[#6A4CFF]/50'}`}
                    >
                        <span className="block text-sm">{p.loadingTrack === track.id ? '⏳' : track.emoji}</span>
                        <span className="block text-xs font-bold text-[#14121F]">{track.label}</span>
                        <span className="block text-[10px] text-[#14121F]/55">{track.mood}</span>
                    </button>
                ))}
            </div>

            <FileInput accept="audio/*" onFile={p.onPickMusicFile}>{p.music ? p.music.file.name : 'Or upload your own track'}</FileInput>
            {p.music && (
                <>
                    <audio ref={p.musicAudioRef} src={p.music.url} controls preload="auto" className="w-full accent-[#6A4CFF]" />
                    <RangeField label="Music volume" display={`${p.settings.musicVolume}%`} min={0} max={100} value={p.settings.musicVolume} onChange={(value) => p.set('musicVolume', value)} />
                </>
            )}
        </section>
    );
}

function VoiceoverSection(p: SidebarProps) {
    const { settings, set } = p;
    return (
        <section className={CARD_CLASS}>
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#14121F]/70"><Mic className="h-4 w-4 text-[#6A4CFF]" /> Voiceover</h2>
                {p.voiceover && <button type="button" onClick={p.onRemoveVoice} className="text-xs font-semibold text-[#14121F]/50 hover:text-red-600">Remove</button>}
            </div>

            <div className="space-y-2 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#14121F]/50">Option A: AI Text-to-Speech</p>
                <textarea
                    value={settings.narrationText}
                    onChange={(event) => set('narrationText', event.target.value)}
                    maxLength={1500}
                    rows={3}
                    placeholder={settings.narrationLanguage === 'en'
                        ? 'Write your script. It will be read exactly as written.'
                        : 'Write your script in English. It will be translated and spoken in the selected language.'}
                    className={`${TEXT_INPUT} resize-y`}
                />
                <div className="grid grid-cols-2 gap-2.5">
                    <SelectField label="Language" value={settings.narrationLanguage} onChange={(value) => set('narrationLanguage', value as NarrationLanguage)}>
                        <option value="en">English</option>
                        <option value="hi">Hindi</option>
                        <option value="bn">Bengali</option>
                        <option value="ta">Tamil</option>
                        <option value="te">Telugu</option>
                    </SelectField>
                    <SelectField label="Voice Gender" value={settings.narrationVoiceGender} onChange={(value) => set('narrationVoiceGender', value as VoiceGender)}>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                    </SelectField>
                </div>
                <button type="button" onClick={p.onGenerateVoice} disabled={p.isGeneratingVoice || !settings.narrationText.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6A4CFF] px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#5839e0] disabled:opacity-50">
                    {p.isGeneratingVoice && <Loader2 className="h-4 w-4 animate-spin" />}
                    {p.isGeneratingVoice ? 'Generating Voice...' : 'Generate AI Voiceover'}
                </button>
            </div>

            <div className="space-y-2 border-t border-[#14121F]/10 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#14121F]/50">Option B: Upload audio file</p>
                <FileInput accept="audio/*" onFile={p.onPickVoiceFile}>
                    {p.voiceover && !settings.narrationText ? p.voiceover.file.name : 'Upload voiceover from computer'}
                </FileInput>
            </div>

            {p.voiceover && (
                <div className="pt-2">
                    <p className="mb-1 text-[10px] font-semibold text-[#14121F]/60">Voiceover Preview:</p>
                    <audio ref={p.voiceAudioRef} src={p.voiceover.url} controls preload="auto" className="w-full accent-[#6A4CFF]" />
                </div>
            )}
        </section>
    );
}

/* -------------------------------------------------------------------------- */

export function ReelSidebar(props: SidebarProps) {
    return (
        <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-b border-[#14121F]/10 bg-[#F7F6FB] p-4 lg:max-h-full lg:w-92 lg:border-b-0 lg:border-r lg:p-5">
            <button type="button" onClick={props.onBack} className="flex w-fit items-center gap-2 rounded-xl border border-[#14121F]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#14121F]/80 shadow-xs transition hover:border-[#6A4CFF]/40 hover:bg-white">
                <ArrowLeft className="h-3.5 w-3.5 text-[#14121F]/60" /> All creation options
            </button>

            <header>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6A4CFF]">Product Reel Studio</p>
                <h1 className="mt-1 text-xl font-extrabold text-[#14121F]">3D Product Showcase</h1>
                <p className="mt-1 text-xs leading-relaxed text-[#14121F]/60">Create cinematic orbits, custom backgrounds, and platform-optimized formats.</p>
            </header>

            <TemplateSection {...props} />
            <ClipsSection {...props} />
            <LookSection {...props} />
            <TextSection {...props} />
            <ProductEffectsSection {...props} />
            <WowEffectsSection {...props} />
            <LogoSection {...props} />
            <MusicSection {...props} />
            <VoiceoverSection {...props} />
        </aside>
    );
}
