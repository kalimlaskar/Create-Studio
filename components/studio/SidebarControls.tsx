'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import {
    Camera, Circle, Droplets, ImageIcon, Leaf, Monitor, PenTool, RotateCcw, Scissors, ScrollText,
    SlidersHorizontal, Smartphone, Sparkles, Square, Sun, Upload, X,
} from 'lucide-react';
import { AirWritingFont, AirWritingLanguage, AspectRatioType, CameraArtEffect, FilterPresetType, StudioSettings } from '@/types/studio';
import { Teleprompter } from './Teleprompter';
import { AIR_FONTS } from './airDrawing';
import { WRITING_LANGUAGES } from './handwriting';
import { ACCENT, Card, Hint, PINK, SelectField, Segmented, Slider, TextInput, Toggle, ToggleRow } from './SidebarPrimitives';

interface SidebarControlsProps {
    settings: StudioSettings;
    onUpdateSettings: (newSettings: Partial<StudioSettings>) => void;
    onCameraArtEffectChange: (effect: CameraArtEffect) => void;
    cameraSwitchDisabled?: boolean;
}

/* ------------------------------ config ------------------------------ */
type TabId = 'setup' | 'look' | 'effects' | 'script';

const TABS: Array<{ id: TabId; label: string; icon: typeof Camera }> = [
    { id: 'setup', label: 'Setup', icon: Camera },
    { id: 'look', label: 'Look', icon: SlidersHorizontal },
    { id: 'effects', label: 'Effects', icon: Sparkles },
    { id: 'script', label: 'Script', icon: ScrollText },
];

const ASPECTS = [
    { value: '16:9', label: 'Landscape', hint: 'YouTube', icon: Monitor },
    { value: '9:16', label: 'Vertical', hint: 'Reels', icon: Smartphone },
    { value: '1:1', label: 'Square', hint: 'Feed', icon: Square },
] as const;

const BACKGROUNDS: Array<{ value: StudioSettings['backgroundMode']; label: string; icon: typeof Circle; swatch: string }> = [
    { value: 'none', label: 'Normal', icon: Circle, swatch: 'bg-gradient-to-br from-slate-100 to-slate-200' },
    { value: 'blur', label: 'Blur', icon: Droplets, swatch: 'bg-gradient-to-br from-sky-100 to-indigo-200' },
    { value: 'green', label: 'Green', icon: Leaf, swatch: 'bg-gradient-to-br from-emerald-300 to-emerald-500' },
    { value: 'transparent', label: 'Cutout', icon: Scissors, swatch: 'bg-[conic-gradient(#e5e7eb_25%,#fff_0_50%,#e5e7eb_0_75%,#fff_0)] bg-[length:12px_12px]' },
    { value: 'image', label: 'Image', icon: ImageIcon, swatch: 'bg-gradient-to-br from-violet-200 to-pink-200' },
];

const FILTERS: Array<{ value: FilterPresetType; label: string; swatch: string }> = [
    { value: 'none', label: 'Normal', swatch: 'from-slate-100 to-slate-300' },
    { value: 'cinematic', label: 'Cinematic', swatch: 'from-teal-300 to-orange-300' },
    { value: 'warm', label: 'Warm', swatch: 'from-amber-200 to-rose-300' },
    { value: 'mono', label: 'B&W', swatch: 'from-zinc-200 to-zinc-600' },
];

const ART_EFFECTS: Array<{ value: CameraArtEffect; label: string }> = [
    { value: 'none', label: 'Original' },
    { value: 'comic', label: 'Comic ink' },
    { value: 'sketch', label: 'Pencil' },
    { value: 'pixel', label: 'Pixel art' },
    { value: 'anime', label: 'Anime' },
    { value: 'avatar', label: 'Tracked avatar' },
    { value: 'photo-avatar', label: 'Photo avatar' },
];

const HOLOGRAM_COLORS = [
    { value: 'cyan', label: 'Cyan', dot: 'bg-cyan-500' },
    { value: 'purple', label: 'Purple', dot: 'bg-[#6A4CFF]' },
    { value: 'green', label: 'Green', dot: 'bg-emerald-500' },
] as const;

const DRAW_TOOLS = [
    { value: 'pen', label: 'Pen' },
    { value: 'highlighter', label: 'Marker' },
    { value: 'arrow', label: 'Arrow' },
    { value: 'laser', label: 'Laser' },
] as const;

const MAX_AVATAR_BYTES = 12 * 1024 * 1024;

/* ----------------------------- component ---------------------------- */
export function SidebarControls({ settings, onUpdateSettings, onCameraArtEffectChange, cameraSwitchDisabled = false }: SidebarControlsProps) {
    const [tab, setTab] = useState<TabId>('setup');
    const bgInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const lightingChanged = settings.brightness !== 100 || settings.contrast !== 100;

    /* ---- background ---- */
    const handleBackgroundImage = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (settings.backgroundImageUrl) URL.revokeObjectURL(settings.backgroundImageUrl);
        onUpdateSettings({ backgroundMode: 'image', backgroundImageUrl: URL.createObjectURL(file) });
        event.target.value = '';
    };

    const clearBackgroundImage = () => {
        if (settings.backgroundImageUrl) URL.revokeObjectURL(settings.backgroundImageUrl);
        onUpdateSettings({ backgroundMode: 'none', backgroundImageUrl: null });
    };

    const pickBackground = (mode: StudioSettings['backgroundMode']) => {
        if (mode === 'image' && !settings.backgroundImageUrl) {
            bgInputRef.current?.click();
            return;
        }
        onUpdateSettings({ backgroundMode: mode });
    };

    /* ---- cartoon avatar ---- */
    const handleAvatarFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_AVATAR_BYTES) {
            window.alert('Choose an image smaller than 12 MB.');
            event.target.value = '';
            return;
        }
        if (settings.cameraAvatarImageUrl) URL.revokeObjectURL(settings.cameraAvatarImageUrl);
        onUpdateSettings({ cameraAvatarImageUrl: URL.createObjectURL(file) });
        event.target.value = '';
    };

    const pickArtEffect = (effect: CameraArtEffect) => {
        if (effect !== 'none') onUpdateSettings({ hologramEnabled: false });
        onCameraArtEffectChange(effect);
        if (effect === 'photo-avatar' && !settings.cameraAvatarImageUrl) avatarInputRef.current?.click();
    };

    const toggleHologram = (next: boolean) => {
        if (next && settings.cameraArtEffect !== 'none') onCameraArtEffectChange('none');
        onUpdateSettings({ hologramEnabled: next });
    };

    /* ------------------------------ render ----------------------------- */
    return (
        <aside className="flex min-h-0 w-full flex-1 flex-col bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F] md:h-full md:w-80 md:flex-none md:border-r md:border-[#14121F]/10">
            {/* Brand + tabs (sticky) */}
            <div className="shrink-0 border-b border-[#14121F]/8 bg-white/80 px-4 pb-3 pt-4 backdrop-blur">
                <div className="mb-3.5 flex items-center gap-2.5">
                    <Image src="/cliprame-icon.svg" alt="" width={32} height={32} className="h-8 w-8" />
                    <h1 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">Cliprame</h1>
                </div>
                <nav role="tablist" aria-label="Studio controls" className="grid grid-cols-4 gap-1 rounded-2xl bg-[#14121F]/5 p-1">
                    {TABS.map(({ id, label, icon: Icon }) => {
                        const active = tab === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                id={`studio-tab-${id}`}
                                aria-selected={active}
                                aria-controls="studio-tabpanel"
                                onClick={() => setTab(id)}
                                className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-all ${active ? 'bg-white text-[#14121F] shadow-sm' : 'text-[#14121F]/50 hover:text-[#14121F]'}`}>
                                <Icon className="h-4 w-4" style={{ color: active ? ACCENT : undefined }} />
                                {label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Scrollable panel */}
            <div id="studio-tabpanel" role="tabpanel" aria-labelledby={`studio-tab-${tab}`} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {tab === 'setup' && (
                    <>
                        <Card title="Source" description="Where your video comes from" icon={Camera}>
                            <Segmented
                                ariaLabel="Studio source"
                                columns={2}
                                value={settings.inputMode === 'upload' ? 'upload' : 'camera'}
                                options={[{ value: 'camera', label: 'Live camera' }, { value: 'upload', label: 'Upload video' }]}
                                onChange={(inputMode) => onUpdateSettings({ inputMode })}
                            />
                            {settings.inputMode === 'upload' ? (
                                <input
                                    type="file"
                                    accept="video/*"
                                    aria-label="Upload a video"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) onUpdateSettings({ uploadedVideoUrl: URL.createObjectURL(file) });
                                    }}
                                    className="w-full cursor-pointer text-xs text-[#14121F]/60 file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-[#6A4CFF] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#5839e0]"
                                />
                            ) : (
                                <Segmented
                                    ariaLabel="Camera"
                                    columns={2}
                                    value={settings.cameraFacing}
                                    disabled={cameraSwitchDisabled}
                                    options={[{ value: 'user', label: 'Front', icon: Camera }, { value: 'environment', label: 'Back', icon: Camera }]}
                                    onChange={(cameraFacing) => onUpdateSettings({ cameraFacing })}
                                />
                            )}
                        </Card>

                        <Card title="Video format" description="Canvas size and layout" icon={Monitor}>
                            <Segmented
                                ariaLabel="Aspect ratio"
                                value={settings.aspectRatio}
                                options={ASPECTS}
                                onChange={(ratio) => onUpdateSettings({ aspectRatio: ratio as AspectRatioType })}
                            />
                        </Card>

                        <Card title="Screen share frame" description="Shown once you start sharing" icon={Monitor}>
                            <SelectField
                                id="screen-frame-style"
                                aria-label="Frame style"
                                value={settings.screenFrameStyle}
                                onChange={(event) => onUpdateSettings({ screenFrameStyle: event.target.value as StudioSettings['screenFrameStyle'] })}>
                                <option value="browser">Browser window</option>
                                <option value="macos">macOS window</option>
                                <option value="minimal">Minimal card</option>
                                <option value="off">No frame</option>
                            </SelectField>
                            {settings.screenFrameStyle !== 'off' && (
                                <>
                                    <SelectField
                                        id="screen-frame-bg"
                                        aria-label="Frame background"
                                        value={settings.screenFrameBackground}
                                        onChange={(event) => onUpdateSettings({ screenFrameBackground: event.target.value as StudioSettings['screenFrameBackground'] })}>
                                        <option value="aurora">Aurora</option>
                                        <option value="sunset">Sunset</option>
                                        <option value="midnight">Midnight</option>
                                        <option value="paper">Paper (light)</option>
                                    </SelectField>
                                    {settings.screenFrameStyle === 'browser' && (
                                        <TextInput
                                            value={settings.screenFrameLabel}
                                            maxLength={40}
                                            aria-label="Address bar text"
                                            placeholder="Address bar, e.g. yourproduct.com"
                                            onChange={(event) => onUpdateSettings({ screenFrameLabel: event.target.value })}
                                        />
                                    )}
                                </>
                            )}
                        </Card>
                    </>
                )}

                {tab === 'look' && (
                    <>
                        <Card title="Background" description="Replace or soften what's behind you" icon={ImageIcon}>
                            <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBackgroundImage} className="hidden" aria-label="Upload background image" />
                            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Background effect">
                                {BACKGROUNDS.map(({ value, label, icon: Icon, swatch }) => {
                                    const selected = settings.backgroundMode === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => pickBackground(value)}
                                            className={`group flex flex-col items-center gap-1.5 rounded-2xl border p-1.5 text-[11px] font-semibold transition-all ${selected ? 'border-[#6A4CFF] bg-[#6A4CFF]/5 ring-2 ring-[#6A4CFF]/20' : 'border-[#14121F]/10 bg-white hover:border-[#6A4CFF]/40'}`}>
                                            <span className={`flex h-10 w-full items-center justify-center rounded-xl ${swatch}`}>
                                                <Icon className="h-4 w-4 text-[#14121F]/60" />
                                            </span>
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                            {settings.backgroundImageUrl && (
                                <div className="group relative overflow-hidden rounded-2xl border border-[#14121F]/10">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={settings.backgroundImageUrl} alt="Selected background" className="h-20 w-full object-cover" />
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                                        <button type="button" onClick={() => bgInputRef.current?.click()} aria-label="Replace background image" className="rounded-xl bg-white/90 p-1.5 text-[#14121F] hover:bg-[#6A4CFF] hover:text-white">
                                            <Upload className="h-3.5 w-3.5" />
                                        </button>
                                        <button type="button" onClick={clearBackgroundImage} aria-label="Remove background image" className="rounded-xl bg-white/90 p-1.5 text-[#14121F] hover:bg-red-600 hover:text-white">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </Card>

                        <Card
                            title="Lighting & tone"
                            description="Virtual studio lights"
                            icon={Sun}
                            action={lightingChanged && (
                                <button
                                    type="button"
                                    onClick={() => onUpdateSettings({ brightness: 100, contrast: 100 })}
                                    className="flex items-center gap-1 rounded-full bg-[#14121F]/5 px-2.5 py-1 text-[11px] font-semibold text-[#14121F]/70 transition hover:bg-[#14121F] hover:text-white">
                                    <RotateCcw className="h-3 w-3" /> Reset
                                </button>
                            )}>
                            <Slider id="brightness" label="Brightness" min={50} max={150} suffix="%" value={settings.brightness} onChange={(brightness) => onUpdateSettings({ brightness })} />
                            <Slider id="contrast" label="Contrast" min={50} max={150} suffix="%" value={settings.contrast} onChange={(contrast) => onUpdateSettings({ contrast })} />
                        </Card>

                        <Card title="Color preset" description="One-tap grading" icon={Sparkles}>
                            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Color preset">
                                {FILTERS.map(({ value, label, swatch }) => {
                                    const selected = settings.filterPreset === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => onUpdateSettings({ filterPreset: value })}
                                            className={`flex items-center gap-2.5 rounded-2xl border p-2 text-xs font-semibold transition-all ${selected ? 'border-[#6A4CFF] bg-[#6A4CFF]/5 ring-2 ring-[#6A4CFF]/20' : 'border-[#14121F]/10 bg-white hover:border-[#6A4CFF]/40'}`}>
                                            <span className={`h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br ${swatch}`} />
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                    </>
                )}

                {tab === 'effects' && (
                    <>
                        <Card title="Cartoon & sketch" description="Runs locally, included in recordings" icon={Sparkles}>
                            <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Upload cartoon avatar photo" onChange={handleAvatarFile} />
                            <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Cartoon and sketch effect">
                                {ART_EFFECTS.map(({ value, label }) => {
                                    const selected = settings.cameraArtEffect === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => pickArtEffect(value)}
                                            className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all ${value === 'photo-avatar' ? 'col-span-2' : ''} ${selected ? 'border-[#6A4CFF] bg-[#6A4CFF] text-white shadow-md shadow-[#6A4CFF]/20' : 'border-[#14121F]/10 bg-white text-[#14121F]/75 hover:border-[#6A4CFF]/40'}`}>
                                            {value === 'photo-avatar' ? 'My cartoon photo · voice mouth' : label}
                                        </button>
                                    );
                                })}
                            </div>

                            {settings.cameraArtEffect === 'photo-avatar' && (
                                <div className="space-y-3 rounded-2xl bg-[#F7F6FB] p-3">
                                    {settings.cameraAvatarImageUrl ? (
                                        <div className="flex items-center gap-2">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={settings.cameraAvatarImageUrl} alt="Selected cartoon avatar" className="h-14 w-12 rounded-xl border border-[#14121F]/10 object-cover" />
                                            <button type="button" onClick={() => avatarInputRef.current?.click()} className="flex-1 rounded-xl border border-[#14121F]/15 bg-white px-3 py-2 text-xs font-semibold transition hover:bg-[#14121F] hover:text-white">Change photo</button>
                                            <button
                                                type="button"
                                                aria-label="Remove avatar photo"
                                                onClick={() => {
                                                    if (settings.cameraAvatarImageUrl) URL.revokeObjectURL(settings.cameraAvatarImageUrl);
                                                    onUpdateSettings({ cameraAvatarImageUrl: null });
                                                }}
                                                className="rounded-xl px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
                                                Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <button type="button" onClick={() => avatarInputRef.current?.click()} className="w-full rounded-xl border border-dashed border-[#6A4CFF]/60 px-3 py-3 text-xs font-semibold text-[#6A4CFF] hover:bg-[#6A4CFF]/10">
                                            Choose a cartoon portrait
                                        </button>
                                    )}
                                    <Hint tone="info">Tap the mouth position on the large preview. The crosshair shows where the voice animation is drawn.</Hint>
                                    <Slider id="avatar-mouth-y" label="Mouth height" min={35} max={90} suffix="%" value={Math.round(settings.cameraAvatarMouthY * 100)} onChange={(v) => onUpdateSettings({ cameraAvatarMouthY: v / 100 })} />
                                    <Slider id="avatar-mouth-x" label="Mouth position" min={15} max={85} suffix="%" value={Math.round(settings.cameraAvatarMouthX * 100)} onChange={(v) => onUpdateSettings({ cameraAvatarMouthX: v / 100 })} />
                                    <Slider id="avatar-mouth-width" label="Mouth width" min={4} max={18} suffix="%" value={Math.round(settings.cameraAvatarMouthWidth * 100)} onChange={(v) => onUpdateSettings({ cameraAvatarMouthWidth: v / 100 })} />
                                    <Hint>The mouth opens with your voice volume. It&apos;s a lightweight live animation, not phoneme-perfect lip sync. Your photo stays on this device.</Hint>
                                </div>
                            )}
                        </Card>

                        <Card title="Hologram" description="Glowing projection of you" icon={Sparkles} action={
                            <Toggle checked={settings.hologramEnabled} onChange={toggleHologram} label="Hologram effect" accent={ACCENT} />
                        }>
                            {settings.hologramEnabled && (
                                <>
                                    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Hologram color">
                                        {HOLOGRAM_COLORS.map(({ value, label, dot }) => {
                                            const selected = settings.hologramColor === value;
                                            return (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    aria-pressed={selected}
                                                    onClick={() => onUpdateSettings({ hologramColor: value })}
                                                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition-all ${selected ? 'border-[#6A4CFF] bg-white shadow-sm' : 'border-[#14121F]/10 text-[#14121F]/65 hover:text-[#14121F]'}`}>
                                                    <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />{label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <Slider id="hologram-intensity" label="Intensity" min={0} max={100} suffix="%" value={settings.hologramIntensity} onChange={(hologramIntensity) => onUpdateSettings({ hologramIntensity })} />
                                    <Slider id="hologram-flicker" label="Flicker" min={0} max={100} suffix="%" value={settings.hologramFlicker} onChange={(hologramFlicker) => onUpdateSettings({ hologramFlicker })} />
                                    <Hint>Works with your background choice and is included in recordings and exports.</Hint>
                                </>
                            )}
                        </Card>

                        <Card title="Air drawing" description="Draw with your index finger" icon={PenTool} accent={PINK} action={
                            <Toggle accent={PINK} checked={settings.airDrawingEnabled} onChange={(airDrawingEnabled) => onUpdateSettings({ airDrawingEnabled })} label="Air drawing" />
                        }>
                            {settings.airDrawingEnabled && (
                                <>
                                    <Segmented
                                        ariaLabel="Drawing tool"
                                        columns={4}
                                        accent={PINK}
                                        disabled={settings.airWriteMode}
                                        value={settings.airDrawingTool}
                                        options={DRAW_TOOLS}
                                        onChange={(airDrawingTool) => onUpdateSettings({ airDrawingTool })}
                                    />
                                    <div className="flex items-center justify-between text-xs font-medium text-[#14121F]/70">
                                        <label htmlFor="air-color">Color</label>
                                        <input id="air-color" type="color" value={settings.airDrawingColor} onChange={(event) => onUpdateSettings({ airDrawingColor: event.target.value })} className="h-7 w-12 cursor-pointer rounded-lg border border-[#14121F]/10 bg-transparent" />
                                    </div>
                                    <Slider id="air-size" label="Brush size" min={2} max={30} accent={PINK} value={settings.airDrawingSize} onChange={(airDrawingSize) => onUpdateSettings({ airDrawingSize })} />
                                    <Slider id="air-glow" label="Glow" min={0} max={100} suffix="%" accent={PINK} value={settings.airDrawingGlow} onChange={(airDrawingGlow) => onUpdateSettings({ airDrawingGlow })} />

                                    <div className="space-y-3 border-t border-[#14121F]/8 pt-3.5">
                                        <ToggleRow accent={PINK} title="Fade out after 3s" description="Off keeps strokes pinned" checked={settings.airDrawingFade} onChange={(airDrawingFade) => onUpdateSettings({ airDrawingFade })} label="Fade out drawings" />
                                        <ToggleRow accent={PINK} title="Performance mode" description="Slower hand detection, lighter on CPU" checked={settings.airDrawingPerformanceMode} onChange={(airDrawingPerformanceMode) => onUpdateSettings({ airDrawingPerformanceMode })} label="Performance mode" />
                                        <ToggleRow accent={PINK} title="Write to text" description="Pinch to write words" checked={settings.airWriteMode} onChange={(airWriteMode) => onUpdateSettings({ airWriteMode })} label="Write to text" />
                                    </div>

                                    {settings.airWriteMode && (
                                        <div className="space-y-3 rounded-2xl bg-[#F7F6FB] p-3">
                                            <SelectField id="air-write-language" label="Language" value={settings.airWriteLanguage} onChange={(event) => onUpdateSettings({ airWriteLanguage: event.target.value as AirWritingLanguage })}>
                                                {WRITING_LANGUAGES.map((language) => (
                                                    <option key={language.value} value={language.value}>{language.label}{language.experimental ? ' — experimental' : ''}</option>
                                                ))}
                                            </SelectField>
                                            <SelectField id="air-write-font" label="Font" value={settings.airWriteFont} onChange={(event) => onUpdateSettings({ airWriteFont: event.target.value as AirWritingFont })}>
                                                {AIR_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
                                            </SelectField>
                                            <div className="flex items-center justify-between text-xs font-medium text-[#14121F]/70">
                                                <label htmlFor="air-write-color">Text color</label>
                                                <input id="air-write-color" type="color" value={settings.airWriteColor} onChange={(event) => onUpdateSettings({ airWriteColor: event.target.value })} className="h-7 w-12 cursor-pointer rounded-lg border border-[#14121F]/10 bg-transparent" />
                                            </div>
                                            {settings.airWriteLanguage === 'hi' && (
                                                <Hint tone="warn">Hindi is experimental and needs a browser with Hindi handwriting recognition. Otherwise, tap a word to type it.</Hint>
                                            )}
                                        </div>
                                    )}

                                    <Hint tone="info">
                                        {settings.airWriteMode
                                            ? '🤏 Pinch and move to write, release to lift · pause 0.8s to finish a word · tap a word on the preview to correct it · 🖐 hold palm 1s to clear · ✊ fist to undo.'
                                            : '☝️ Point to draw (laser: point to aim) · 🤏 pinch to pause · 🖐 hold open palm 1s to clear · ✊ fist to undo.'}
                                        {' '}Works over a shared screen and is included in recordings and exports.
                                    </Hint>
                                </>
                            )}
                        </Card>
                    </>
                )}

                {tab === 'script' && (
                    <Card title="Teleprompter" description="Read your script while recording" icon={ScrollText}>
                        <Teleprompter
                            scriptText={settings.scriptText}
                            language={settings.scriptLanguage}
                            onLanguageChange={(scriptLanguage) => onUpdateSettings({ scriptLanguage })}
                            onScriptChange={(scriptText) => onUpdateSettings({ scriptText })}
                        />
                    </Card>
                )}
            </div>

            {/* Footer status */}
            <footer className="shrink-0 border-t border-[#14121F]/8 bg-white/80 px-4 py-2.5 backdrop-blur">
                <div className="flex items-center justify-center gap-2 text-[11px] font-medium text-[#14121F]/55">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    AI noise suppression active
                </div>
            </footer>
        </aside>
    );
}