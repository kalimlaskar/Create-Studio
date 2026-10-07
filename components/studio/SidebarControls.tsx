'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { Sun, Smartphone, Monitor, Square, Upload, X, Camera } from 'lucide-react';
import { AirWritingFont, AirWritingLanguage, AspectRatioType, CameraArtEffect, FilterPresetType, StudioSettings } from '@/types/studio';
import { Teleprompter } from './Teleprompter';
import { AIR_FONTS } from './airDrawing';
import { WRITING_LANGUAGES } from './handwriting';

interface SidebarControlsProps {
    settings: StudioSettings;
    onUpdateSettings: (newSettings: Partial<StudioSettings>) => void;
    onCameraArtEffectChange: (effect: CameraArtEffect) => void;
    cameraSwitchDisabled?: boolean;
}

export function SidebarControls({ settings, onUpdateSettings, onCameraArtEffectChange, cameraSwitchDisabled = false }: SidebarControlsProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const setAspectRatio = (ratio: AspectRatioType) => onUpdateSettings({ aspectRatio: ratio });
    const setBrightness = (brightness: number) => onUpdateSettings({ brightness });
    const setContrast = (contrast: number) => onUpdateSettings({ contrast });
    const setFilterPreset = (filterPreset: FilterPresetType) => onUpdateSettings({ filterPreset });
    const setScriptText = (scriptText: string) => onUpdateSettings({ scriptText });

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Revoke the previous object URL to avoid leaking memory
        if (settings.backgroundImageUrl) {
            URL.revokeObjectURL(settings.backgroundImageUrl);
        }

        const url = URL.createObjectURL(file);
        onUpdateSettings({ backgroundMode: 'image', backgroundImageUrl: url });
        e.target.value = ''; // allow re-selecting the same file later
    };

    const clearImage = () => {
        if (settings.backgroundImageUrl) {
            URL.revokeObjectURL(settings.backgroundImageUrl);
        }
        onUpdateSettings({ backgroundMode: 'none', backgroundImageUrl: null });
    };

    return (
        <aside className="flex w-full min-h-0 flex-1 flex-col justify-between overflow-y-auto bg-neutral-900 p-4 md:h-full md:w-80 md:flex-none md:border-r md:border-neutral-800">
            <div>
                <div className="flex items-center gap-2 mb-6">
                    <Image src="/cliprame-icon.svg" alt="" width={32} height={32} className="h-8 w-8" />
                    <h1 className="text-lg font-bold tracking-tight">Cliprame</h1>
                </div>

                {/* Camera Selector */}
                <div className="mb-6">
                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 block">Camera</label>
                    <div className="grid grid-cols-2 gap-2">
                        {([['user', 'Selfie (front)'], ['environment', 'Back camera']] as const).map(([facing, label]) => (
                            <button
                                key={facing}
                                type="button"
                                disabled={cameraSwitchDisabled}
                                onClick={() => onUpdateSettings({ cameraFacing: facing })}
                                className={`flex items-center justify-center gap-1 rounded-lg border p-2 text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50 ${settings.cameraFacing === facing
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'border-neutral-800 bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800'
                                    }`}>
                                <Camera className="w-4 h-4" /> {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Aspect Ratio Selector */}
                <div className="mb-6">
                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 block">Device Frame</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['9:16', '16:9', '1:1'] as AspectRatioType[]).map((ratio) => {
                            const Icon = ratio === '9:16' ? Smartphone : ratio === '16:9' ? Monitor : Square;
                            const label = ratio === '9:16' ? 'Reels' : ratio === '16:9' ? 'YouTube' : 'Square';
                            return (
                                <button
                                    key={ratio}
                                    onClick={() => setAspectRatio(ratio)}
                                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs gap-1 transition-all ${settings.aspectRatio === ratio
                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                        : 'border-neutral-800 bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800'
                                        }`}>
                                    <Icon className="w-4 h-4" /> {label} ({ratio})
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Screen share frame (applies only while a screen is being shared) */}
                <div className="mb-6 space-y-2">
                    <label htmlFor="screen-frame-style" className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Screen share frame</label>
                    <select
                        id="screen-frame-style"
                        value={settings.screenFrameStyle}
                        onChange={(e) => onUpdateSettings({ screenFrameStyle: e.target.value as StudioSettings['screenFrameStyle'] })}
                        className="w-full bg-neutral-800 border border-neutral-700 text-xs rounded-lg p-2 text-neutral-200 focus:outline-none focus:border-indigo-500">
                        <option value="browser">Browser window</option>
                        <option value="macos">macOS window</option>
                        <option value="minimal">Minimal card</option>
                        <option value="off">No frame</option>
                    </select>
                    {settings.screenFrameStyle !== 'off' && (
                        <>
                            <select
                                aria-label="Frame background"
                                value={settings.screenFrameBackground}
                                onChange={(e) => onUpdateSettings({ screenFrameBackground: e.target.value as StudioSettings['screenFrameBackground'] })}
                                className="w-full bg-neutral-800 border border-neutral-700 text-xs rounded-lg p-2 text-neutral-200 focus:outline-none focus:border-indigo-500">
                                <option value="aurora">Aurora</option>
                                <option value="sunset">Sunset</option>
                                <option value="midnight">Midnight</option>
                                <option value="paper">Paper (light)</option>
                            </select>
                            {settings.screenFrameStyle === 'browser' && (
                                <input
                                    value={settings.screenFrameLabel}
                                    maxLength={40}
                                    aria-label="Address bar text"
                                    placeholder="Address bar text, e.g. yourproduct.com"
                                    onChange={(e) => onUpdateSettings({ screenFrameLabel: e.target.value })}
                                    className="w-full bg-neutral-800 border border-neutral-700 text-xs rounded-lg p-2 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500"
                                />
                            )}
                        </>
                    )}
                    <p className="text-[10px] leading-relaxed text-neutral-500">Shows the shared screen inside a styled window. Before you share, the studio looks normal.</p>
                </div>

                {/* Background Removal / Effects Module */}
                <div className="mb-6 space-y-2">
                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Background Effect</label>
                    <select
                        value={settings.backgroundMode}
                        onChange={(e) => {
                            const mode = e.target.value as StudioSettings['backgroundMode'];
                            // Selecting "image" with no image yet picked should open the file dialog
                            if (mode === 'image' && !settings.backgroundImageUrl) {
                                fileInputRef.current?.click();
                                return;
                            }
                            onUpdateSettings({ backgroundMode: mode });
                        }}
                        className="w-full bg-neutral-800 border border-neutral-700 text-xs rounded-lg p-2 text-neutral-200 focus:outline-none focus:border-indigo-500">
                        <option value="none">Normal Background</option>
                        <option value="blur">AI Background Blur</option>
                        <option value="green">Solid Green Screen (Chroma)</option>
                        <option value="transparent">Transparent / Clean Cutout</option>
                        <option value="image">Custom Image</option>
                    </select>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                    />

                    {settings.backgroundImageUrl ? (
                        <div className="relative rounded-lg overflow-hidden border border-neutral-700 group">
                            <img src={settings.backgroundImageUrl} alt="Background" className="w-full h-20 object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-1.5 bg-neutral-900/90 rounded-md hover:bg-indigo-600 text-white">
                                    <Upload className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={clearImage}
                                    className="p-1.5 bg-neutral-900/90 rounded-md hover:bg-red-600 text-white">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 border border-dashed border-neutral-700 rounded-lg py-3 text-xs text-neutral-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors">
                            <Upload className="w-3.5 h-3.5" /> Upload background image
                        </button>
                    )}
                </div>

                {/* Mode Selector (Live Camera vs Upload File) */}
                <div className="mb-6 space-y-2">
                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Studio Source</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => onUpdateSettings({ inputMode: 'camera' })}
                            className={`p-2 rounded-lg border text-xs font-medium transition-all ${settings.inputMode !== 'upload'
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'border-neutral-800 bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800'
                                }`}>
                            Live Camera
                        </button>
                        <button
                            onClick={() => onUpdateSettings({ inputMode: 'upload' })}
                            className={`p-2 rounded-lg border text-xs font-medium transition-all ${settings.inputMode === 'upload'
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'border-neutral-800 bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800'
                                }`}>
                            Upload Video
                        </button>
                    </div>

                    {settings.inputMode === 'upload' && (
                        <div className="mt-3">
                            <input
                                type="file"
                                accept="video/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const url = URL.createObjectURL(file);
                                        onUpdateSettings({ uploadedVideoUrl: url });
                                    }
                                }}
                                className="w-full text-xs text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                            />
                        </div>
                    )}
                </div>

                {/* Virtual Lighting & Filters */}
                <div className="mb-6 space-y-4">
                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                        <Sun className="w-3.5 h-3.5" /> Virtual Lighting & Tone
                    </label>
                    <div>
                        <div className="flex justify-between text-xs text-neutral-400 mb-1">
                            <span>Brightness</span><span>{settings.brightness}%</span>
                        </div>
                        <input
                            type="range" min="50" max="150" value={settings.brightness}
                            onChange={(e) => setBrightness(Number(e.target.value))}
                            className="w-full accent-indigo-500 bg-neutral-800 h-1 rounded cursor-pointer"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-neutral-400 mb-1">
                            <span>Contrast</span><span>{settings.contrast}%</span>
                        </div>
                        <input
                            type="range" min="50" max="150" value={settings.contrast}
                            onChange={(e) => setContrast(Number(e.target.value))}
                            className="w-full accent-indigo-500 bg-neutral-800 h-1 rounded cursor-pointer"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-neutral-400 mb-1 block">Color Preset</label>
                        <select
                            value={settings.filterPreset}
                            onChange={(e) => setFilterPreset(e.target.value as FilterPresetType)}
                            className="w-full bg-neutral-800 border border-neutral-700 text-xs rounded-lg p-2 text-neutral-200 focus:outline-none focus:border-indigo-500">
                            <option value="none">Normal Studio</option>
                            <option value="cinematic">Cinematic Teal/Orange</option>
                            <option value="warm">Warm Vibe</option>
                            <option value="mono">B&W Documentary</option>
                        </select>
                    </div>
                </div>

                <div className="mb-6 space-y-2">
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        aria-label="Upload cartoon avatar photo"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            if (file.size > 12 * 1024 * 1024) {
                                window.alert('Choose an image smaller than 12 MB.');
                                event.target.value = '';
                                return;
                            }
                            if (settings.cameraAvatarImageUrl) URL.revokeObjectURL(settings.cameraAvatarImageUrl);
                            onUpdateSettings({ cameraAvatarImageUrl: URL.createObjectURL(file) });
                            event.target.value = '';
                        }}
                    />
                    <label htmlFor="camera-art-effect" className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Cartoon & sketch</label>
                    <select
                        id="camera-art-effect"
                        value={settings.cameraArtEffect}
                        onChange={(event) => {
                            const effect = event.target.value as StudioSettings['cameraArtEffect'];
                            if (effect !== 'none') onUpdateSettings({ hologramEnabled: false });
                            onCameraArtEffectChange(effect);
                            if (effect === 'photo-avatar' && !settings.cameraAvatarImageUrl) avatarInputRef.current?.click();
                        }}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-xs text-neutral-200 focus:border-indigo-500 focus:outline-none">
                        <option value="none">Original camera</option>
                        <option value="comic">Comic ink</option>
                        <option value="sketch">Pencil sketch</option>
                        <option value="pixel">Pixel art</option>
                        <option value="anime">Anime color</option>
                        <option value="avatar">Tracked cartoon avatar</option>
                        <option value="photo-avatar">My cartoon photo · voice mouth</option>
                    </select>
                    {settings.cameraArtEffect === 'photo-avatar' && (
                        <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                            {settings.cameraAvatarImageUrl ? (
                                <div className="flex items-center gap-2">
                                    <img src={settings.cameraAvatarImageUrl} alt="Selected cartoon avatar" className="h-14 w-12 rounded-md border border-neutral-700 object-cover" />
                                    <button type="button" onClick={() => avatarInputRef.current?.click()} className="flex-1 rounded-lg border border-neutral-700 px-2 py-2 text-xs text-neutral-300 hover:bg-neutral-800">Change photo</button>
                                    <button type="button" onClick={() => { URL.revokeObjectURL(settings.cameraAvatarImageUrl!); onUpdateSettings({ cameraAvatarImageUrl: null }); }} aria-label="Remove avatar photo" className="rounded-lg px-2 py-2 text-xs text-red-300 hover:bg-red-950/30">Remove</button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => avatarInputRef.current?.click()} className="w-full rounded-lg border border-dashed border-indigo-500/60 px-3 py-3 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/10">Choose a cartoon portrait</button>
                            )}
                            <div className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/5 px-2.5 py-2 text-[10px] leading-relaxed text-neutral-300">
                                Tap the mouth position on the large preview. The crosshair shows where voice animation will be drawn.
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-neutral-400"><label htmlFor="avatar-mouth-y">Vertical mouth position</label><span>{Math.round(settings.cameraAvatarMouthY * 100)}%</span></div>
                                <input id="avatar-mouth-y" type="range" min="35" max="90" value={Math.round(settings.cameraAvatarMouthY * 100)} onChange={(event) => onUpdateSettings({ cameraAvatarMouthY: Number(event.target.value) / 100 })} className="w-full accent-indigo-500" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-neutral-400"><label htmlFor="avatar-mouth-x">Horizontal mouth position</label><span>{Math.round(settings.cameraAvatarMouthX * 100)}%</span></div>
                                <input id="avatar-mouth-x" type="range" min="15" max="85" value={Math.round(settings.cameraAvatarMouthX * 100)} onChange={(event) => onUpdateSettings({ cameraAvatarMouthX: Number(event.target.value) / 100 })} className="w-full accent-indigo-500" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-neutral-400"><label htmlFor="avatar-mouth-width">Mouth width</label><span>{Math.round(settings.cameraAvatarMouthWidth * 100)}%</span></div>
                                <input id="avatar-mouth-width" type="range" min="4" max="18" value={Math.round(settings.cameraAvatarMouthWidth * 100)} onChange={(event) => onUpdateSettings({ cameraAvatarMouthWidth: Number(event.target.value) / 100 })} className="w-full accent-indigo-500" />
                            </div>
                            <p className="text-[10px] leading-relaxed text-neutral-500">The mouth opens with your voice volume. This is lightweight live mouth animation, not phoneme-perfect lip sync. Photo stays on this device.</p>
                        </div>
                    )}
                    <p className="text-[10px] leading-relaxed text-neutral-500">
                        Cartoon and sketch effects run locally and are included in recordings.
                    </p>
                </div>

                <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Hologram</p>
                            <p className="text-[10px] text-neutral-500">Glowing projection of you</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={settings.hologramEnabled}
                            aria-label="Hologram effect"
                            onClick={() => {
                                const next = !settings.hologramEnabled;
                                if (next && settings.cameraArtEffect !== 'none') onCameraArtEffectChange('none');
                                onUpdateSettings({ hologramEnabled: next });
                            }}
                            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${settings.hologramEnabled ? 'bg-cyan-500' : 'bg-neutral-700'}`}>
                            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${settings.hologramEnabled ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>
                    {settings.hologramEnabled && (
                        <>
                            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Hologram color">
                                {([['cyan', 'Cyan', 'bg-cyan-400'], ['purple', 'Purple', 'bg-violet-400'], ['green', 'Green', 'bg-emerald-400']] as const).map(([value, label, swatch]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-pressed={settings.hologramColor === value}
                                        onClick={() => onUpdateSettings({ hologramColor: value })}
                                        className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${settings.hologramColor === value ? 'border-cyan-400/70 bg-neutral-800 text-white' : 'border-neutral-700 text-neutral-400 hover:text-neutral-200'}`}>
                                        <span className={`h-2.5 w-2.5 rounded-full ${swatch}`} />{label}
                                    </button>
                                ))}
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-neutral-400"><label htmlFor="hologram-intensity">Intensity</label><span>{settings.hologramIntensity}%</span></div>
                                <input id="hologram-intensity" type="range" min="0" max="100" value={settings.hologramIntensity} onChange={(event) => onUpdateSettings({ hologramIntensity: Number(event.target.value) })} className="w-full accent-cyan-400" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-neutral-400"><label htmlFor="hologram-flicker">Flicker</label><span>{settings.hologramFlicker}%</span></div>
                                <input id="hologram-flicker" type="range" min="0" max="100" value={settings.hologramFlicker} onChange={(event) => onUpdateSettings({ hologramFlicker: Number(event.target.value) })} className="w-full accent-cyan-400" />
                            </div>
                            <p className="text-[10px] leading-relaxed text-neutral-500">Works with your background choice and is included in recordings and exports.</p>
                        </>
                    )}
                </div>

                <div className="mt-6 space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Air Drawing</p>
                            <p className="text-[10px] text-neutral-500">Draw with your index finger</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={settings.airDrawingEnabled}
                            aria-label="Air drawing"
                            onClick={() => onUpdateSettings({ airDrawingEnabled: !settings.airDrawingEnabled })}
                            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${settings.airDrawingEnabled ? 'bg-fuchsia-500' : 'bg-neutral-700'}`}>
                            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${settings.airDrawingEnabled ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>
                    {settings.airDrawingEnabled && (
                        <>
                            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Drawing tool">
                                {([['pen', 'Pen'], ['highlighter', 'Marker'], ['arrow', 'Arrow'], ['laser', 'Laser']] as const).map(([tool, label]) => (
                                    <button
                                        key={tool}
                                        type="button"
                                        aria-pressed={settings.airDrawingTool === tool}
                                        disabled={settings.airWriteMode}
                                        onClick={() => onUpdateSettings({ airDrawingTool: tool })}
                                        className={`rounded-lg border px-1 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40 ${settings.airDrawingTool === tool ? 'border-fuchsia-400/70 bg-neutral-800 text-white' : 'border-neutral-700 text-neutral-400 hover:text-neutral-200'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-neutral-300">
                                <label htmlFor="air-color">Color</label>
                                <input id="air-color" type="color" value={settings.airDrawingColor} onChange={(event) => onUpdateSettings({ airDrawingColor: event.target.value })} className="h-7 w-12 cursor-pointer rounded border border-neutral-700 bg-transparent" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-neutral-400"><label htmlFor="air-size">Brush size</label><span>{settings.airDrawingSize}</span></div>
                                <input id="air-size" type="range" min="2" max="30" value={settings.airDrawingSize} onChange={(event) => onUpdateSettings({ airDrawingSize: Number(event.target.value) })} className="w-full accent-fuchsia-400" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-neutral-400"><label htmlFor="air-glow">Glow</label><span>{settings.airDrawingGlow}%</span></div>
                                <input id="air-glow" type="range" min="0" max="100" value={settings.airDrawingGlow} onChange={(event) => onUpdateSettings({ airDrawingGlow: Number(event.target.value) })} className="w-full accent-fuchsia-400" />
                            </div>
                            {([
                                ['airDrawingFade', 'Fade out after 3s (off = pinned)', settings.airDrawingFade],
                                ['airDrawingPerformanceMode', 'Performance mode (slower detection)', settings.airDrawingPerformanceMode],
                                ['airWriteMode', 'Write to Text (pinch to write)', settings.airWriteMode],
                            ] as const).map(([key, label, value]) => (
                                <label key={key} className="flex items-center justify-between gap-3 text-[11px] text-neutral-300">
                                    {label}
                                    <input type="checkbox" checked={value} onChange={(event) => onUpdateSettings({ [key]: event.target.checked })} className="h-4 w-4 accent-fuchsia-500" />
                                </label>
                            ))}
                            {settings.airWriteMode && (
                                <div className="space-y-2 rounded-lg border border-neutral-800 p-2">
                                    <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-300">
                                        <label htmlFor="air-write-language">Language</label>
                                        <select id="air-write-language" value={settings.airWriteLanguage} onChange={(event) => onUpdateSettings({ airWriteLanguage: event.target.value as AirWritingLanguage })} className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px]">
                                            {WRITING_LANGUAGES.map((language) => (
                                                <option key={language.value} value={language.value}>{language.label}{language.experimental ? ' — experimental' : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-300">
                                        <label htmlFor="air-write-font">Font</label>
                                        <select id="air-write-font" value={settings.airWriteFont} onChange={(event) => onUpdateSettings({ airWriteFont: event.target.value as AirWritingFont })} className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px]">
                                            {AIR_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-neutral-300">
                                        <label htmlFor="air-write-color">Text color</label>
                                        <input id="air-write-color" type="color" value={settings.airWriteColor} onChange={(event) => onUpdateSettings({ airWriteColor: event.target.value })} className="h-7 w-12 cursor-pointer rounded border border-neutral-700 bg-transparent" />
                                    </div>
                                    {settings.airWriteLanguage === 'hi' && (
                                        <p className="text-[10px] leading-relaxed text-amber-300/80">Hindi is experimental and needs a browser with Hindi handwriting recognition; otherwise tap a word to type it.</p>
                                    )}
                                </div>
                            )}
                            <p className="text-[10px] leading-relaxed text-neutral-500">
                                {settings.airWriteMode
                                    ? '🤏 Pinch and move to write, release to lift · pause 0.8s to finish a word · tap a word on the preview to correct it or restore your writing · 🖐 hold palm 1s to clear · ✊ fist to undo.'
                                    : '☝️ Point to draw (laser: point to aim) · 🤏 Pinch to pause · 🖐 Hold open palm 1s to clear · ✊ Fist to undo.'}
                                {' '}Works over a shared screen too, and is included in recordings and exports.
                            </p>
                        </>
                    )}
                </div>

                {/* Teleprompter Module */}
                <Teleprompter
                    scriptText={settings.scriptText}
                    language={settings.scriptLanguage}
                    onLanguageChange={(scriptLanguage) => onUpdateSettings({ scriptLanguage })}
                    onScriptChange={setScriptText}
                />
            </div>

            <div className="pt-4 border-t border-neutral-800 text-xs text-neutral-500 text-center">
                AI Noise Suppression Active 🎙️
            </div>
        </aside>
    );
}