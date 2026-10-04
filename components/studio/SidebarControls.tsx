'use client';

import React, { useRef } from 'react';
import { Sun, Smartphone, Monitor, Square, Sparkles, Upload, X } from 'lucide-react';
import { AspectRatioType, FilterPresetType, StudioSettings } from '@/types/studio';
import { Teleprompter } from './Teleprompter';

interface SidebarControlsProps {
    settings: StudioSettings;
    onUpdateSettings: (newSettings: Partial<StudioSettings>) => void;
}

export function SidebarControls({ settings, onUpdateSettings }: SidebarControlsProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        <aside className="flex max-h-[44dvh] w-full shrink-0 flex-col justify-between overflow-y-auto border-b border-neutral-800 bg-neutral-900 p-4 md:max-h-full md:w-80 md:border-b-0 md:border-r">
            <div>
                <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="w-6 h-6 text-indigo-500" />
                    <h1 className="text-lg font-bold tracking-tight">CreatorStudio</h1>
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