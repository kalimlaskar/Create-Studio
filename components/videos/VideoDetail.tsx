'use client';

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronDown, Code2, Copy, ExternalLink, KeyRound, Link2, ListVideo, Lock, Mail, MousePointerClick, Plus, RefreshCw, Repeat, Trash2, UserPlus } from 'lucide-react';
import { videoApi } from '@/lib/videos/upload';
import { formatClock, formatPercent, parseClock, type AccessMode, type Chapter, type ShareLink, type VideoAnalytics, type VideoRecord, type ViewerSummary } from '@/lib/videos/types';
import { RetentionChart } from './RetentionChart';
import { InteractionsPanel } from './InteractionsPanel';
import { LeadsTable } from './LeadsTable';
import { ProductTour } from '@/components/tour/ProductTour';
import type { Interaction } from '@/lib/videos/interactions';
import { DropOffHeatmap } from './DropOffHeatmap';
import { ThumbnailEditor } from './ThumbnailEditor';
import { copyEmailSnippet } from '@/lib/videos/shareClipboard';
import { track } from '@/lib/analytics';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
const D = 'font-[family-name:var(--font-display)]';
const card = 'rounded-3xl border border-[#14121F]/8 bg-white';
const inputClass = 'w-full rounded-xl border border-[#14121F]/12 bg-[#F7F6FB] px-3 py-2 text-sm outline-none transition focus:border-[#6A4CFF] focus:bg-white focus:ring-4 focus:ring-[#6A4CFF]/10';

type Tab = 'share' | 'access' | 'embed' | 'chapters' | 'engage';

interface Props {
    initialVideo: VideoRecord;
    playbackUrl: string;
    posterUrl: string | null;
    initialLinks: ShareLink[];
    initialAnalytics: VideoAnalytics;
    /** On a paid plan (decided on the server). */
    isPaid: boolean;
    /** The server can send email codes (Resend is configured). */
    emailCodesAvailable: boolean;
}

function timeAgo(iso: string) {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return days < 30 ? `${days} d ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const shareUrl = (slug: string) => `${window.location.origin}/v/${slug}`;

/** The page origin, read only in the browser so server and client render the same first. */
const useOrigin = () => useSyncExternalStore(() => () => {}, () => window.location.origin, () => '');

export function VideoDetail({ initialVideo, playbackUrl, posterUrl: initialPosterUrl, initialLinks, initialAnalytics, isPaid, emailCodesAvailable }: Props) {
    const playerRef = useRef<HTMLVideoElement>(null);
    const [video, setVideo] = useState(initialVideo);
    const [links, setLinks] = useState(initialLinks);
    const [analytics, setAnalytics] = useState(initialAnalytics);
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState<Tab>('share');
    const [title, setTitle] = useState(initialVideo.title);
    const [copied, setCopied] = useState<string | null>(null);
    const [notice, setNotice] = useState('');
    const [currentMs, setCurrentMs] = useState(0);
    const [posterUrl, setPosterUrl] = useState(initialPosterUrl);

    const defaultLink = links.find((link) => link.isDefault) ?? null;
    const flash = (key: string) => { setCopied(key); setTimeout(() => setCopied((value) => (value === key ? null : value)), 1800); };

    const save = async (change: Partial<{ title: string; chapters: Chapter[]; ctaLabel: string; ctaUrl: string; embedEnabled: boolean; embedDomains: string[]; accessMode: AccessMode; accessSecret: string; accessEmails: string[]; interactions: Interaction[] }>) => {
        setNotice('');
        try {
            const { video: updated } = await videoApi<{ video: VideoRecord }>(`/api/videos/${video.id}`, { method: 'PATCH', body: JSON.stringify(change) });
            setVideo(updated);
            return true;
        } catch (error) {
            setNotice((error as Error).message);
            return false;
        }
    };

    const refresh = async () => {
        setRefreshing(true);
        try {
            const data = await videoApi<{ analytics: VideoAnalytics }>(`/api/videos/${video.id}/analytics`);
            setAnalytics(data.analytics);
        } catch (error) {
            setNotice((error as Error).message);
        } finally {
            setRefreshing(false);
        }
    };

    const copyLink = async (link: ShareLink) => {
        await navigator.clipboard.writeText(shareUrl(link.slug));
        flash(`link-${link.id}`);
    };

    const copyEmail = async (link: ShareLink) => {
        await copyEmailSnippet({ slug: link.slug, title: video.title, durationMs: video.durationMs, recipientName: link.recipientName });
        flash(`email-${link.id}`);
    };

    const setLinkActive = async (link: ShareLink, active: boolean) => {
        try {
            const { link: updated } = await videoApi<{ link: ShareLink }>(`/api/videos/${video.id}/links/${link.id}`, { method: 'PATCH', body: JSON.stringify({ active }) });
            setLinks((list) => list.map((item) => (item.id === updated.id ? updated : item)));
        } catch (error) {
            setNotice((error as Error).message);
        }
    };

    const seek = (ms: number) => {
        const player = playerRef.current;
        if (!player) return;
        player.currentTime = ms / 1000;
        void player.play().catch(() => {});
    };

    const currentChapter = [...video.chapters].reverse().find((chapter) => currentMs >= chapter.startMs);

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href="/studio/videos" className={`inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-[#14121F]/60 hover:text-[#14121F] ${focus}`}><ArrowLeft className="h-4 w-4" /> All videos</Link>
                {defaultLink && !defaultLink.revokedAt && (
                    <div className="flex items-center gap-2">
                        <a href={`/v/${defaultLink.slug}`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 rounded-full border border-[#14121F]/15 bg-white px-3.5 py-2 text-sm font-semibold hover:border-[#14121F]/30 ${focus}`}><ExternalLink className="h-4 w-4" /> Open share page</a>
                        <button type="button" onClick={() => void copyLink(defaultLink)} className={`inline-flex items-center gap-1.5 rounded-full bg-[#6A4CFF] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(106,76,255,0.8)] hover:bg-[#5839e0] ${focus}`}>
                            {copied === `link-${defaultLink.id}` ? <><Check className="h-4 w-4" /> Copied</> : <><Link2 className="h-4 w-4" /> Copy share link</>}
                        </button>
                    </div>
                )}
            </div>

            <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => { if (title.trim() && title.trim() !== video.title) void save({ title: title.trim() }); else setTitle(video.title); }}
                onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                aria-label="Video title"
                maxLength={160}
                className={`${D} -ml-2 w-full rounded-xl border border-transparent bg-transparent px-2 py-1 text-3xl font-bold tracking-tight outline-none hover:border-[#14121F]/10 focus:border-[#6A4CFF] focus:bg-white`}
            />
            {notice && <p role="alert" className="-mt-5 text-sm font-medium text-red-600">{notice}</p>}
            {video.removed && (
                <div role="alert" className="-mt-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
                    <p className="font-semibold">This video was taken down by Cliprame for breaking our content rules{video.removed.reason ? `: ${video.removed.reason}` : ''}.</p>
                    <p className="mt-1 text-red-800/80">It no longer plays on share links or embeds. If you think this is a mistake, contact support and we’ll take another look.</p>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                <section className="space-y-3">
                    <div data-tour="player" className="overflow-hidden rounded-3xl bg-[#0B0A10]">
                        <video ref={playerRef} src={playbackUrl} poster={posterUrl ?? undefined} controls playsInline preload="metadata" onTimeUpdate={(event) => setCurrentMs(event.currentTarget.currentTime * 1000)} className="aspect-video w-full" />
                    </div>
                    {!video.removed && (
                        <ThumbnailEditor videoId={video.id} playbackUrl={playbackUrl} posterUrl={posterUrl} player={playerRef} onChange={(change) => { setVideo(change.video); setPosterUrl(change.posterUrl); }} />
                    )}
                    {video.chapters.length > 0 && (
                        <ol className="flex flex-wrap gap-2" aria-label="Chapters">
                            {video.chapters.map((chapter) => {
                                const isCurrent = currentChapter === chapter;
                                return (
                                    <li key={`${chapter.startMs}`}>
                                        <button type="button" onClick={() => seek(chapter.startMs)} aria-current={isCurrent ? 'true' : undefined} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${isCurrent ? 'border-[#6A4CFF] bg-[#6A4CFF]/10 text-[#6A4CFF]' : 'border-[#14121F]/10 bg-white hover:border-[#14121F]/25'} ${focus}`}>
                                            <span className="tabular-nums text-[#14121F]/50">{formatClock(chapter.startMs)}</span>{chapter.title}
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </section>

                <section className={`${card} p-1.5`}>
                    <div role="tablist" aria-label="Video settings" className="grid grid-cols-5 gap-1 rounded-[1.1rem] bg-[#F7F6FB] p-1">
                        {([['share', 'Share'], ['access', 'Access'], ['embed', 'Embed'], ['chapters', 'Chapters'], ['engage', 'Engage']] as const).map(([id, label]) => (
                            <button key={id} type="button" role="tab" data-tour={`tab-${id}`} aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex items-center justify-center gap-1 truncate rounded-xl px-1.5 py-2 text-sm font-semibold transition ${tab === id ? 'bg-white shadow-sm' : 'text-[#14121F]/55 hover:text-[#14121F]'} ${focus}`}>{id === 'access' && video.accessMode !== 'public' && <Lock aria-label="Protected" className="h-3 w-3 shrink-0 text-[#6A4CFF]" />}{label}</button>
                        ))}
                    </div>
                    <div role="tabpanel" className="p-4">
                        {tab === 'share' && (
                            <SharePanel
                                videoId={video.id}
                                links={links}
                                viewers={analytics.viewers}
                                copied={copied}
                                onCopyLink={copyLink}
                                onCopyEmail={copyEmail}
                                onToggle={setLinkActive}
                                onCreated={(link) => setLinks((list) => [...list, link])}
                            />
                        )}
                        {tab === 'chapters' && (
                            <ChaptersEditor chapters={video.chapters} durationMs={video.durationMs} currentMs={currentMs} onSave={(chapters) => save({ chapters })} onSeek={seek} />
                        )}
                        {tab === 'access' && (
                            <AccessPanel key={`${video.accessMode}-${video.accessEmails.join(',')}`} video={video} emailCodesAvailable={emailCodesAvailable} onSave={save} />
                        )}
                        {tab === 'embed' && (
                            <EmbedPanel video={video} defaultLink={defaultLink} isPaid={isPaid} onSave={save} />
                        )}
                        {tab === 'engage' && (
                            <div className="space-y-6">
                                <InteractionsPanel interactions={video.interactions} durationMs={video.durationMs} currentMs={currentMs} onSave={(interactions) => save({ interactions })} />
                                <div className="border-t border-[#14121F]/[0.07] pt-5">
                                    <p className="mb-2 text-sm font-semibold">Button under the video</p>
                                    <CtaEditor key={`${video.ctaLabel}-${video.ctaUrl}`} label={video.ctaLabel ?? ''} url={video.ctaUrl ?? ''} onSave={(ctaLabel, ctaUrl) => save({ ctaLabel, ctaUrl })} />
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <AnalyticsSection analytics={analytics} videoTitle={video.title} durationMs={video.durationMs} hasChapters={video.chapters.length > 0} refreshing={refreshing} onRefresh={() => void refresh()} onAddChapters={() => setTab('chapters')} onSeek={(ms) => { seek(ms); playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />
            <ProductTour
                id="video"
                steps={[
                    { target: 'player', title: 'Your video', body: 'Preview it here. When you click a moment in the analytics below, the player jumps to it.', placement: 'right' },
                    { target: 'tab-share', title: 'Share it', body: 'Copy the link, or make a personal link for each prospect so you know exactly who watched. There’s an email-ready thumbnail too.', placement: 'bottom' },
                    { target: 'tab-access', title: 'Lock it', body: 'For pricing or proposals: ask for a PIN, a password or an email code before it plays.', placement: 'bottom' },
                    { target: 'tab-engage', title: 'Turn views into leads', body: 'Add a form before the video, a button at the right moment, or your Calendly page at the end.', placement: 'bottom' },
                    { target: 'stats', title: 'The numbers', body: 'Plays, viewers, how much they watched and who clicked your button. Refresh any time.', placement: 'top' },
                    { target: 'heatmap', title: 'Where they rewatched or left', body: 'Darker means more viewers. Click a moment to watch exactly what made people replay or stop.', placement: 'top' },
                ]}
            />
        </div>
    );
}

/* ------------------------------- Access ------------------------------ */

const ACCESS_OPTIONS: Array<{ id: AccessMode; name: string; hint: string; icon: typeof Lock }> = [
    { id: 'public', name: 'Anyone with the link', hint: 'No check. The video plays straight away.', icon: Link2 },
    { id: 'pin', name: 'PIN', hint: 'Viewers type a 6–8 digit PIN you share with them.', icon: KeyRound },
    { id: 'password', name: 'Password', hint: 'Viewers type a password you share with them.', icon: Lock },
    { id: 'email', name: 'Email code', hint: 'Viewers confirm their email with a one-time code. You see who watched.', icon: Mail },
];

function AccessPanel({ video, emailCodesAvailable, onSave }: { video: VideoRecord; emailCodesAvailable: boolean; onSave: (change: { accessMode: AccessMode; accessSecret?: string; accessEmails?: string[] }) => Promise<boolean> }) {
    const [mode, setMode] = useState<AccessMode>(video.accessMode);
    const [secret, setSecret] = useState('');
    const [emails, setEmails] = useState(video.accessEmails.join('\n'));
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const keepsSecret = mode === video.accessMode && (mode === 'pin' || mode === 'password');
    const emailList = emails.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
    const changed = mode !== video.accessMode || secret !== '' || (mode === 'email' && emailList.join(',') !== video.accessEmails.join(','));

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setSaved(false);
        const ok = await onSave({
            accessMode: mode,
            ...(mode === 'pin' || mode === 'password' ? { accessSecret: secret } : {}),
            ...(mode === 'email' ? { accessEmails: emailList } : {}),
        });
        setSaving(false);
        if (ok) { setSecret(''); setSaved(true); track('video_access_changed', { mode }); }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <div>
                <p className="text-sm font-semibold">Who can watch</p>
                <p className="mt-0.5 text-xs leading-5 text-[#14121F]/55">Applies to every share link and embed of this video. You can always watch your own links while signed in.</p>
            </div>

            <div role="radiogroup" aria-label="Who can watch" className="space-y-1.5">
                {ACCESS_OPTIONS.map(({ id, name, hint, icon: Icon }) => {
                    const unavailable = id === 'email' && !emailCodesAvailable && video.accessMode !== 'email';
                    return (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={mode === id}
                            disabled={unavailable}
                            onClick={() => { setMode(id); setSecret(''); setSaved(false); }}
                            className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${mode === id ? 'border-[#6A4CFF] bg-[#6A4CFF]/[0.06]' : 'border-[#14121F]/10 enabled:hover:border-[#14121F]/25'} ${focus}`}>
                            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${mode === id ? 'text-[#6A4CFF]' : 'text-[#14121F]/45'}`} />
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold">{name}</span>
                                <span className="block text-xs leading-5 text-[#14121F]/55">{unavailable ? 'Needs an email service on the server (RESEND_API_KEY and ACCESS_EMAIL_FROM).' : hint}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {(mode === 'pin' || mode === 'password') && (
                <label className="block">
                    <span className="text-xs font-semibold text-[#14121F]/60">{keepsSecret ? `New ${mode === 'pin' ? 'PIN' : 'password'} (leave empty to keep the current one)` : mode === 'pin' ? 'PIN' : 'Password'}</span>
                    <input
                        value={secret}
                        onChange={(event) => setSecret(mode === 'pin' ? event.target.value.replace(/\D/g, '').slice(0, 8) : event.target.value)}
                        type={mode === 'pin' ? 'text' : 'password'}
                        inputMode={mode === 'pin' ? 'numeric' : undefined}
                        autoComplete="new-password"
                        placeholder={mode === 'pin' ? '6–8 digits' : 'At least 8 characters'}
                        className={`${inputClass} mt-1 ${mode === 'pin' ? 'tracking-[0.3em]' : ''}`}
                    />
                    <span className="mt-1 block text-[11px] text-[#14121F]/45">Send it to viewers separately from the link. It’s stored encrypted, so it can’t be shown again.</span>
                </label>
            )}

            {mode === 'email' && (
                <label className="block">
                    <span className="text-xs font-semibold text-[#14121F]/60">Only these people (optional)</span>
                    <textarea value={emails} onChange={(event) => setEmails(event.target.value)} rows={3} placeholder={'ana@acme.com\n@acme.com'} className={`${inputClass} mt-1 resize-y`} />
                    <span className="mt-1 block text-[11px] leading-4 text-[#14121F]/45">One per line. Use @acme.com to allow a whole company. Leave empty to allow any verified email. Personal links sent to an address only open for that address.</span>
                </label>
            )}

            <div className="flex items-center gap-3">
                <button type="submit" disabled={saving || !changed} className={`rounded-xl bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742] disabled:opacity-40 ${focus}`}>{saving ? 'Saving…' : 'Save'}</button>
                {saved && <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-[#14121F]/60"><Check className="h-3.5 w-3.5" /> Saved</span>}
            </div>
            {video.accessMode !== 'public' && <p className="text-[11px] leading-4 text-[#14121F]/45">Saving a change signs out everyone who already unlocked the video.</p>}
        </form>
    );
}

/* ------------------------------- Share ------------------------------- */

function SharePanel({ videoId, links, viewers, copied, onCopyLink, onCopyEmail, onToggle, onCreated }: {
    videoId: string;
    links: ShareLink[];
    viewers: ViewerSummary[];
    copied: string | null;
    onCopyLink: (link: ShareLink) => void;
    onCopyEmail: (link: ShareLink) => void;
    onToggle: (link: ShareLink, active: boolean) => void;
    onCreated: (link: ShareLink) => void;
}) {
    const origin = useOrigin();
    const [form, setForm] = useState({ recipientName: '', recipientEmail: '', recipientCompany: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const defaultLink = links.find((link) => link.isDefault);
    const personal = links.filter((link) => !link.isDefault).reverse();

    const create = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const { link } = await videoApi<{ link: ShareLink }>(`/api/videos/${videoId}/links`, { method: 'POST', body: JSON.stringify(form) });
            onCreated(link);
            track('personal_link_created');
            setForm({ recipientName: '', recipientEmail: '', recipientCompany: '' });
        } catch (createError) {
            setError((createError as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const linkButtons = (link: ShareLink) => (
        <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={Boolean(link.revokedAt)} onClick={() => onCopyLink(link)} className={`inline-flex items-center gap-1.5 rounded-full bg-[#F7F6FB] px-3 py-1.5 text-xs font-semibold hover:bg-[#6A4CFF]/10 hover:text-[#6A4CFF] disabled:opacity-40 ${focus}`}>
                {copied === `link-${link.id}` ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Link</>}
            </button>
            <button type="button" disabled={Boolean(link.revokedAt)} onClick={() => onCopyEmail(link)} title="Copies a thumbnail with a play button, ready to paste into an email" className={`inline-flex items-center gap-1.5 rounded-full bg-[#F7F6FB] px-3 py-1.5 text-xs font-semibold hover:bg-[#6A4CFF]/10 hover:text-[#6A4CFF] disabled:opacity-40 ${focus}`}>
                {copied === `email-${link.id}` ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Mail className="h-3.5 w-3.5" /> For email</>}
            </button>
            <button type="button" onClick={() => onToggle(link, Boolean(link.revokedAt))} className={`rounded-full px-3 py-1.5 text-xs font-semibold text-[#14121F]/55 hover:bg-[#F7F6FB] hover:text-[#14121F] ${focus}`}>
                {link.revokedAt ? 'Turn on' : 'Turn off'}
            </button>
        </div>
    );

    return (
        <div className="space-y-5">
            {defaultLink && (
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#14121F]/50">Anyone with the link</p>
                    <p className="mt-2 truncate rounded-xl bg-[#F7F6FB] px-3 py-2 font-mono text-xs text-[#14121F]/70">{origin ? `${origin}/v/${defaultLink.slug}` : ''}</p>
                    <div className="mt-2">{linkButtons(defaultLink)}</div>
                    {defaultLink.revokedAt && <p className="mt-1.5 text-xs text-[#14121F]/55">This link is off. People who open it see “This video isn’t available”.</p>}
                </div>
            )}

            <form onSubmit={(event) => void create(event)} className="space-y-2 rounded-2xl bg-[#F7F6FB] p-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold"><UserPlus className="h-4 w-4 text-[#6A4CFF]" /> Personal link</p>
                <p className="text-xs leading-5 text-[#14121F]/55">Each person gets their own link, so you see exactly when they watch and what they focus on.</p>
                <input className={inputClass} placeholder="Name, e.g. Priya Sharma" value={form.recipientName} maxLength={120} onChange={(event) => setForm({ ...form, recipientName: event.target.value })} aria-label="Recipient name" />
                <input className={inputClass} type="email" placeholder="Email" value={form.recipientEmail} maxLength={254} onChange={(event) => setForm({ ...form, recipientEmail: event.target.value })} aria-label="Recipient email" />
                <input className={inputClass} placeholder="Company (optional)" value={form.recipientCompany} maxLength={120} onChange={(event) => setForm({ ...form, recipientCompany: event.target.value })} aria-label="Recipient company" />
                {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
                <button type="submit" disabled={busy || (!form.recipientName.trim() && !form.recipientEmail.trim())} className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#14121F] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742] disabled:opacity-40 ${focus}`}><Plus className="h-4 w-4" /> Create link</button>
            </form>

            {personal.length > 0 && (
                <ul className="divide-y divide-[#14121F]/6">
                    {personal.map((link) => {
                        const viewer = viewers.find((item) => item.linkId === link.id);
                        return (
                            <li key={link.id} className={`py-3 ${link.revokedAt ? 'opacity-60' : ''}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">{link.recipientName || link.recipientEmail}{link.recipientCompany && <span className="font-normal text-[#14121F]/55"> · {link.recipientCompany}</span>}</p>
                                        {link.recipientName && link.recipientEmail && <p className="truncate text-xs text-[#14121F]/55">{link.recipientEmail}</p>}
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${viewer?.sessions ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F7F6FB] text-[#14121F]/50'}`}>
                                        {viewer?.sessions ? `Watched ${formatPercent(viewer.watchedShare)}` : 'Not watched yet'}
                                    </span>
                                </div>
                                <div className="mt-2">{linkButtons(link)}</div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/* ------------------------------ Chapters ----------------------------- */

interface ChapterRow {
    id: number;
    title: string;
    time: string;
}

let nextRowId = 1;
const toRows = (chapters: Chapter[]): ChapterRow[] => chapters.map((chapter) => ({ id: nextRowId++, title: chapter.title, time: formatClock(chapter.startMs) }));

function ChaptersEditor({ chapters, durationMs, currentMs, onSave, onSeek }: { chapters: Chapter[]; durationMs: number; currentMs: number; onSave: (chapters: Chapter[]) => Promise<boolean>; onSeek: (ms: number) => void }) {
    const [rows, setRows] = useState<ChapterRow[]>(() => toRows(chapters));
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const titleRefs = useRef(new Map<number, HTMLInputElement>());

    // Parse and check every row so problems show next to the row, not only on save.
    const checked = rows.map((row, index) => {
        const startMs = index === 0 ? 0 : parseClock(row.time);
        let problem = '';
        if (startMs === null) problem = 'Use a time like 1:05';
        else if (durationMs && startMs >= durationMs) problem = `After the end (${formatClock(durationMs)})`;
        else if (rows.some((other, j) => j !== index && (j === 0 ? 0 : parseClock(other.time)) === startMs)) problem = 'Two chapters start here';
        return { ...row, startMs, problem };
    });
    const dirty = JSON.stringify(checked.map((row) => [row.title.trim(), row.startMs])) !== JSON.stringify(chapters.map((chapter) => [chapter.title, chapter.startMs]));
    const roundedNow = Math.floor(currentMs / 1000) * 1000;
    const takenNow = checked.some((row) => row.startMs === roundedNow);

    const update = (id: number, change: Partial<ChapterRow>) => {
        setSaved(false);
        setError('');
        setRows((list) => list.map((row) => (row.id === id ? { ...row, ...change } : row)));
    };

    // Keep rows in time order once a time has been typed.
    const sortRows = () => setRows((list) => {
        const [first, ...rest] = list;
        if (!first) return list;
        const sorted = [...rest].sort((a, b) => (parseClock(a.time) ?? Infinity) - (parseClock(b.time) ?? Infinity));
        return [first, ...sorted];
    });

    const add = () => {
        setSaved(false);
        const id = nextRowId++;
        const time = rows.length ? formatClock(roundedNow) : '0:00';
        setRows((list) => {
            const next = [...list, { id, title: '', time }];
            const [first, ...rest] = next;
            return [first, ...rest.sort((a, b) => (parseClock(a.time) ?? Infinity) - (parseClock(b.time) ?? Infinity))];
        });
        requestAnimationFrame(() => titleRefs.current.get(id)?.focus());
    };

    const submit = async () => {
        setError('');
        const blank = checked.find((row) => !row.title.trim());
        if (blank) {
            titleRefs.current.get(blank.id)?.focus();
            return setError('Give every chapter a title.');
        }
        if (checked.some((row) => row.problem)) return setError('Fix the highlighted times first.');
        setSaving(true);
        const ok = await onSave(checked.map((row) => ({ title: row.title.trim(), startMs: row.startMs as number })));
        if (ok) track('chapters_saved', { count: checked.length });
        setSaving(false);
        setSaved(ok);
    };

    // Sections drawn across the video, so the split is easy to see.
    const segments = checked
        .filter((row) => row.startMs !== null && !row.problem)
        .map((row, index, list) => ({ ...row, endMs: list[index + 1]?.startMs ?? durationMs }));

    return (
        <div className="space-y-4">
            <p className="text-xs leading-5 text-[#14121F]/55">Split the video into sections. Viewers can jump between them, and analytics show which sections each person watched or skipped.</p>

            {durationMs > 0 && (
                <div>
                    <div className="relative flex h-7 overflow-hidden rounded-lg bg-[#F7F6FB]" aria-hidden="true">
                        {segments.map((segment, index) => (
                            <button
                                key={segment.id}
                                type="button"
                                tabIndex={-1}
                                onClick={() => onSeek(segment.startMs as number)}
                                title={`${segment.title || 'Untitled'} · ${formatClock(segment.startMs as number)}`}
                                className={`h-full min-w-0 border-r-2 border-white px-1.5 text-left text-[10px] font-semibold text-white transition hover:brightness-110 ${index % 2 ? 'bg-[#8B74FF]' : 'bg-[#6A4CFF]'}`}
                                style={{ width: `${(((segment.endMs as number) - (segment.startMs as number)) / durationMs) * 100}%` }}>
                                <span className="block truncate">{segment.title || '…'}</span>
                            </button>
                        ))}
                        <span className="pointer-events-none absolute inset-y-0 w-0.5 bg-[#FF3D81]" style={{ left: `${Math.min(100, (currentMs / durationMs) * 100)}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[#14121F]/45"><span>0:00</span><span>Now {formatClock(currentMs)}</span><span>{formatClock(durationMs)}</span></div>
                </div>
            )}

            {rows.length === 0 ? (
                <div className="rounded-2xl bg-[#F7F6FB] px-4 py-6 text-center">
                    <ListVideo className="mx-auto h-5 w-5 text-[#14121F]/40" />
                    <p className="mt-2 text-sm font-semibold">No chapters yet</p>
                    <p className="mt-1 text-xs text-[#14121F]/55">Start with an intro, then play the video and add a chapter where each new section begins.</p>
                </div>
            ) : (
                <ol className="space-y-2">
                    {checked.map((row, index) => (
                        <li key={row.id} className={`rounded-2xl border p-2 transition ${row.problem ? 'border-red-300 bg-red-50/40' : 'border-[#14121F]/8 bg-white focus-within:border-[#6A4CFF]/50'}`}>
                            <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6A4CFF]/10 text-[11px] font-bold text-[#6A4CFF]">{index + 1}</span>
                                <input
                                    value={index === 0 ? '0:00' : row.time}
                                    onChange={(event) => update(row.id, { time: event.target.value })}
                                    onBlur={sortRows}
                                    disabled={index === 0}
                                    inputMode="numeric"
                                    aria-label={`Chapter ${index + 1} start time`}
                                    title={index === 0 ? 'The first chapter always starts at 0:00' : 'Start time, e.g. 1:05'}
                                    className="w-[4.25rem] shrink-0 rounded-lg border border-[#14121F]/12 bg-[#F7F6FB] px-2 py-1.5 text-center font-mono text-sm tabular-nums outline-none focus:border-[#6A4CFF] focus:bg-white disabled:opacity-60"
                                />
                                <input
                                    ref={(element) => { if (element) titleRefs.current.set(row.id, element); else titleRefs.current.delete(row.id); }}
                                    value={row.title}
                                    onChange={(event) => update(row.id, { title: event.target.value })}
                                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void submit(); } }}
                                    maxLength={80}
                                    placeholder={index === 0 ? 'Intro' : 'Chapter title'}
                                    aria-label={`Chapter ${index + 1} title`}
                                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium outline-none placeholder:font-normal placeholder:text-[#14121F]/35 hover:border-[#14121F]/10 focus:border-[#6A4CFF] focus:bg-white"
                                />
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2 pl-8">
                                <span className={`text-[11px] ${row.problem ? 'font-semibold text-red-600' : 'text-[#14121F]/40'}`}>
                                    {row.problem || (index === 0 ? 'Starts the video' : `Starts at ${row.startMs !== null ? formatClock(row.startMs) : '—'}`)}
                                </span>
                                <span className="flex items-center gap-1">
                                    {index > 0 && (
                                        <button type="button" onClick={() => update(row.id, { time: formatClock(roundedNow) })} className={`rounded-md px-2 py-1 text-[11px] font-semibold text-[#6A4CFF] hover:bg-[#6A4CFF]/10 ${focus}`}>Use {formatClock(roundedNow)}</button>
                                    )}
                                    <button type="button" onClick={() => row.startMs !== null && onSeek(row.startMs)} className={`rounded-md px-2 py-1 text-[11px] font-semibold text-[#14121F]/55 hover:bg-[#F7F6FB] hover:text-[#14121F] ${focus}`}>Play</button>
                                    <button type="button" onClick={() => { setSaved(false); setRows((list) => list.filter((item) => item.id !== row.id)); }} aria-label={`Remove chapter ${index + 1}`} className={`rounded-md p-1 text-[#14121F]/35 hover:bg-red-50 hover:text-red-600 ${focus}`}><Trash2 className="h-3.5 w-3.5" /></button>
                                </span>
                            </div>
                        </li>
                    ))}
                </ol>
            )}

            <button type="button" onClick={add} disabled={rows.length > 0 && takenNow} className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#14121F]/20 px-3 py-2.5 text-sm font-semibold text-[#14121F]/70 hover:border-[#6A4CFF] hover:text-[#6A4CFF] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#14121F]/20 disabled:hover:text-[#14121F]/70 ${focus}`}>
                <Plus className="h-4 w-4" /> {rows.length === 0 ? 'Add first chapter' : `Add chapter at ${formatClock(roundedNow)}`}
            </button>
            {rows.length > 0 && takenNow && <p className="-mt-2 text-center text-[11px] text-[#14121F]/50">Play the video to where the next section starts, then add it.</p>}

            {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
            <button type="button" onClick={() => void submit()} disabled={saving || (!dirty && !error)} className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#14121F] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742] disabled:opacity-40 ${focus}`}>
                {saving ? 'Saving…' : saved && !dirty ? <><Check className="h-4 w-4" /> Saved</> : dirty ? 'Save chapters' : 'No changes'}
            </button>
        </div>
    );
}

/* -------------------------------- Embed ------------------------------ */

const escapeAttribute = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function EmbedPanel({ video, defaultLink, isPaid, onSave }: { video: VideoRecord; defaultLink: ShareLink | null; isPaid: boolean; onSave: (change: { embedEnabled?: boolean; embedDomains?: string[] }) => Promise<boolean> }) {
    const origin = useOrigin();
    const [mode, setMode] = useState<'inline' | 'popup'>('inline');
    const [label, setLabel] = useState('Watch the video');
    const [copied, setCopied] = useState<'script' | 'iframe' | null>(null);
    const [domains, setDomains] = useState(video.embedDomains.join('\n'));
    const [savingDomains, setSavingDomains] = useState(false);
    const [domainsSaved, setDomainsSaved] = useState(false);

    if (!defaultLink || defaultLink.revokedAt) {
        return <p className="rounded-2xl bg-[#F7F6FB] px-4 py-6 text-center text-sm text-[#14121F]/60">Turn the “Anyone with the link” share link back on to embed this video.</p>;
    }

    const slug = defaultLink.slug;
    const scriptCode = `<div class="cliprame-embed" data-video="${slug}"${mode === 'popup' ? ` data-mode="popup" data-label="${escapeAttribute(label.trim() || 'Watch the video')}"` : ''}></div>\n<script src="${origin}/embed.js" async></script>`;
    const iframeCode = `<iframe src="${origin}/embed/${slug}" title="${escapeAttribute(video.title)}" style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;

    const copy = async (kind: 'script' | 'iframe') => {
        await navigator.clipboard.writeText(kind === 'script' ? scriptCode : iframeCode);
        setCopied(kind);
        track('embed_code_copied', { mode: kind === 'iframe' ? 'iframe' : mode });
        setTimeout(() => setCopied(null), 1800);
    };

    const saveDomains = async () => {
        setSavingDomains(true);
        const list = domains.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
        setDomainsSaved(await onSave({ embedDomains: list }));
        setSavingDomains(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold">Allow embedding on other websites</p>
                    <p className="mt-0.5 text-xs leading-5 text-[#14121F]/55">Put the video on your site, landing page or help centre. Views there show up in analytics.</p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={video.embedEnabled}
                    aria-label="Allow embedding"
                    onClick={() => void onSave({ embedEnabled: !video.embedEnabled })}
                    className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${video.embedEnabled ? 'bg-[#6A4CFF]' : 'bg-[#14121F]/20'} ${focus}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${video.embedEnabled ? 'left-[1.375rem]' : 'left-0.5'}`} />
                </button>
            </div>

            {video.embedEnabled && (
                <>
                    <div role="radiogroup" aria-label="Embed style" className="grid grid-cols-2 gap-1 rounded-xl bg-[#F7F6FB] p-1">
                        {([['inline', 'Inline', 'The video sits in your page'], ['popup', 'Popup', 'A button opens the video']] as const).map(([id, name, hint]) => (
                            <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)} className={`rounded-lg px-3 py-2 text-left transition ${mode === id ? 'bg-white shadow-sm' : 'text-[#14121F]/55 hover:text-[#14121F]'} ${focus}`}>
                                <span className="block text-sm font-semibold">{name}</span>
                                <span className="block text-[11px] text-[#14121F]/50">{hint}</span>
                            </button>
                        ))}
                    </div>

                    {mode === 'popup' && (
                        <label className="block">
                            <span className="text-xs font-semibold text-[#14121F]/60">Button text</span>
                            <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={40} className={`${inputClass} mt-1`} />
                        </label>
                    )}

                    <div className="overflow-hidden rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB]">
                        {mode === 'inline' ? (
                            origin && <iframe src={`${origin}/embed/${slug}`} title="Embed preview" className="block aspect-video w-full border-0" allow="autoplay; fullscreen; picture-in-picture" />
                        ) : (
                            <div className="flex items-center justify-center px-4 py-6">
                                <span className="inline-flex items-center gap-2.5 rounded-full bg-[#6A4CFF] py-3 pl-3.5 pr-5 text-[15px] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(106,76,255,0.9)]">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">▶</span>{label.trim() || 'Watch the video'}
                                </span>
                            </div>
                        )}
                        <p className="border-t border-[#14121F]/8 px-3 py-1.5 text-[11px] text-[#14121F]/45">Preview</p>
                    </div>

                    <div>
                        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-[#14121F] px-4 py-3 font-mono text-[11px] leading-5 text-white/85">{origin ? scriptCode : ''}</pre>
                        <button type="button" onClick={() => void copy('script')} className={`mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#6A4CFF] px-3 py-2.5 text-sm font-bold text-white transition hover:bg-[#5839e0] ${focus}`}>
                            {copied === 'script' ? <><Check className="h-4 w-4" /> Copied</> : <><Code2 className="h-4 w-4" /> Copy embed code</>}
                        </button>
                        <button type="button" onClick={() => void copy('iframe')} className={`mt-1.5 w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-[#14121F]/55 hover:text-[#6A4CFF] ${focus}`}>
                            {copied === 'iframe' ? 'Copied the iframe code' : 'Can’t use scripts (Notion, some site builders)? Copy the iframe code'}
                        </button>
                    </div>

                    <div className="rounded-2xl border border-[#14121F]/8 p-3.5">
                        <p className="flex items-center gap-1.5 text-sm font-semibold">{!isPaid && <Lock className="h-3.5 w-3.5 text-[#14121F]/45" />}Only on my websites</p>
                        <p className="mt-0.5 text-xs leading-5 text-[#14121F]/55">Stop others from copying your embed code onto their sites. One website per line, e.g. acme.com or *.acme.com. Leave empty to allow anywhere.</p>
                        {isPaid ? (
                            <>
                                <textarea value={domains} onChange={(event) => { setDomains(event.target.value); setDomainsSaved(false); }} rows={3} placeholder={'acme.com\n*.acme.com'} className={`${inputClass} mt-2 font-mono`} />
                                <button type="button" onClick={() => void saveDomains()} disabled={savingDomains} className={`mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#14121F] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2c2742] disabled:opacity-50 ${focus}`}>
                                    {savingDomains ? 'Saving…' : domainsSaved ? <><Check className="h-3.5 w-3.5" /> Saved</> : 'Save websites'}
                                </button>
                            </>
                        ) : (
                            <a href="/pricing" className="mt-2 inline-block text-xs font-semibold text-[#6A4CFF] hover:underline">Available on Creator and Studio plans</a>
                        )}
                    </div>
                    {!isPaid && <p className="text-[11px] leading-5 text-[#14121F]/45">Free plan embeds show a small “Powered by Cliprame” badge. Upgrade to remove it.</p>}
                </>
            )}
        </div>
    );
}

/* -------------------------------- CTA -------------------------------- */

function CtaEditor({ label, url, onSave }: { label: string; url: string; onSave: (label: string, url: string) => Promise<boolean> }) {
    const [values, setValues] = useState({ label, url });
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    return (
        <div className="space-y-3">
            <p className="text-xs leading-5 text-[#14121F]/55">A button under the video, such as “Book a demo”. Clicks show up in analytics for each viewer.</p>
            <input className={inputClass} placeholder="Button text, e.g. Book a demo" maxLength={40} value={values.label} onChange={(event) => { setSaved(false); setValues({ ...values, label: event.target.value }); }} aria-label="Button text" />
            <input className={inputClass} type="url" placeholder="https://cal.com/you/demo" maxLength={500} value={values.url} onChange={(event) => { setSaved(false); setValues({ ...values, url: event.target.value }); }} aria-label="Button link" />
            {values.label.trim() && (
                <div className="rounded-2xl bg-[#F7F6FB] p-4 text-center">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#14121F]/45">Preview</p>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#6A4CFF] px-5 py-2.5 text-sm font-semibold text-white"><MousePointerClick className="h-4 w-4" />{values.label}</span>
                </div>
            )}
            <div className="flex gap-2">
                <button type="button" disabled={saving} onClick={async () => { setSaving(true); setSaved(await onSave(values.label, values.url)); setSaving(false); }} className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#14121F] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742] disabled:opacity-50 ${focus}`}>
                    {saving ? 'Saving…' : saved ? <><Check className="h-4 w-4" /> Saved</> : 'Save button'}
                </button>
                {(label || values.label) && (
                    <button type="button" onClick={async () => { setValues({ label: '', url: '' }); setSaved(await onSave('', '')); }} className={`rounded-xl px-3 py-2.5 text-sm font-semibold text-[#14121F]/55 hover:bg-[#F7F6FB] ${focus}`}>Remove</button>
                )}
            </div>
        </div>
    );
}

/* ------------------------------ Analytics ---------------------------- */

const EVENT_LABEL: Record<string, string> = { play: 'Played', pause: 'Paused', seek: 'Jumped to', ended: 'Finished the video', chapter: 'Opened chapter', cta: 'Clicked', form: 'Filled in', booking: 'Booked a call' };

function AnalyticsSection({ analytics, videoTitle, durationMs, hasChapters, refreshing, onRefresh, onAddChapters, onSeek }: { analytics: VideoAnalytics; videoTitle: string; durationMs: number; hasChapters: boolean; refreshing: boolean; onRefresh: () => void; onAddChapters: () => void; onSeek: (ms: number) => void }) {
    const tiles = [
        { label: 'Plays', value: analytics.plays.toLocaleString('en-IN'), hint: `${analytics.opens.toLocaleString('en-IN')} page opens` },
        { label: 'Unique viewers', value: analytics.uniqueViewers.toLocaleString('en-IN'), hint: 'Different browsers' },
        { label: 'Average watched', value: formatPercent(analytics.averageWatched), hint: 'Of the video, per play' },
        { label: 'Watched to the end', value: formatPercent(analytics.completionRate), hint: 'Of plays' },
        { label: 'Button clicks', value: analytics.ctaClicks.toLocaleString('en-IN'), hint: 'From the share page' },
    ];

    return (
        <section aria-labelledby="analytics-title" className={`space-y-5 transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between gap-3">
                <h2 id="analytics-title" className={`${D} text-xl font-bold tracking-tight`}>Analytics</h2>
                <button type="button" onClick={onRefresh} disabled={refreshing} className={`inline-flex items-center gap-1.5 rounded-full border border-[#14121F]/12 bg-white px-3 py-1.5 text-xs font-semibold hover:border-[#14121F]/25 ${focus}`}><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button>
            </div>

            <div data-tour="stats" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {tiles.map((tile) => (
                    <div key={tile.label} className={`${card} p-4`}>
                        <p className="text-xs font-medium text-[#14121F]/55">{tile.label}</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight">{tile.value}</p>
                        <p className="mt-0.5 text-[11px] text-[#14121F]/45">{tile.hint}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                <div className={`${card} p-5`}>
                    <h3 className="font-semibold">Audience retention</h3>
                    <p className="mt-0.5 text-xs text-[#14121F]/55">Share of plays still watching at each moment. Lines mark chapters.</p>
                    <div className="mt-4">
                        {analytics.plays ? <RetentionChart retention={analytics.retention} durationMs={durationMs} chapters={analytics.chapters} /> : <EmptyChart text="Retention appears after the first play." />}
                    </div>
                </div>

                <div className={`${card} p-5`}>
                    <h3 className="font-semibold">Chapters</h3>
                    <p className="mt-0.5 text-xs text-[#14121F]/55">Share of plays that reached each chapter.</p>
                    {!hasChapters ? (
                        <div className="mt-4 rounded-2xl bg-[#F7F6FB] px-4 py-6 text-center text-sm text-[#14121F]/60">
                            Add chapters to see which parts people care about.
                            <button type="button" onClick={onAddChapters} className="mt-2 block w-full text-sm font-semibold text-[#6A4CFF] hover:underline">Add chapters</button>
                        </div>
                    ) : (
                        <ol className="mt-4 space-y-3.5">
                            {analytics.chapters.map((chapter) => (
                                <li key={chapter.startMs}>
                                    <div className="flex items-baseline justify-between gap-3 text-sm">
                                        <span className="truncate font-medium">{chapter.title}</span>
                                        <span className="shrink-0 tabular-nums text-xs text-[#14121F]/50">{formatClock(chapter.startMs)}–{formatClock(chapter.endMs)}</span>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2.5">
                                        <div className="h-2.5 flex-1 overflow-hidden rounded-r-[4px] bg-[#14121F]/[0.05]">
                                            <div className="h-full rounded-r-[4px]" style={{ width: `${Math.round(chapter.reached * 100)}%`, background: '#6A4CFF' }} />
                                        </div>
                                        <span className="w-10 text-right text-sm font-semibold tabular-nums">{formatPercent(chapter.reached)}</span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-[#14121F]/50">Watched {formatPercent(chapter.watched)} on average · {formatPercent(chapter.rewatched)} rewatched</p>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>

            <div data-tour="heatmap" className={`${card} p-5`}>
                <h3 className="font-semibold">Re-watches, skips and drop-offs</h3>
                <p className="mt-0.5 text-xs text-[#14121F]/55">Where viewers went back over a part, jumped past it, or stopped watching. Click a moment to play it.</p>
                <div className="mt-4">
                    {analytics.plays ? <DropOffHeatmap buckets={analytics.heatmap ?? []} plays={analytics.plays} durationMs={durationMs} chapters={analytics.chapters} onSeek={onSeek} /> : <EmptyChart text="The heatmap appears after the first play." />}
                </div>
            </div>

            {analytics.leads.length > 0 && (
                <div className={`${card} p-5`}>
                    <h3 className="font-semibold">Leads</h3>
                    <p className="mt-0.5 text-xs text-[#14121F]/55">Everyone who filled in a form on this video, with the hidden values sent alongside.</p>
                    <div className="mt-4"><LeadsTable leads={analytics.leads} videoTitle={videoTitle} /></div>
                </div>
            )}

            {analytics.sources.length > 0 && (
                <div className={`${card} p-5`}>
                    <h3 className="font-semibold">Where views came from</h3>
                    <p className="mt-0.5 text-xs text-[#14121F]/55">Plays on the share link and on each website the video is embedded on.</p>
                    <ul className="mt-4 space-y-3">
                        {analytics.sources.map((source) => {
                            const share = analytics.plays ? source.plays / analytics.plays : 0;
                            return (
                                <li key={`${source.kind}-${source.label}`}>
                                    <div className="flex items-baseline justify-between gap-3 text-sm">
                                        <span className="flex min-w-0 items-center gap-2 truncate font-medium">
                                            {source.kind === 'embed' ? <Code2 className="h-3.5 w-3.5 shrink-0 text-[#14121F]/45" /> : <Link2 className="h-3.5 w-3.5 shrink-0 text-[#14121F]/45" />}
                                            {source.label}
                                        </span>
                                        <span className="shrink-0 text-sm font-semibold tabular-nums">{source.plays.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-r-[4px] bg-[#14121F]/[0.05]">
                                        <div className="h-full rounded-r-[4px]" style={{ width: `${Math.round(share * 100)}%`, background: '#6A4CFF' }} />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <div className={`${card} p-5`}>
                <h3 className="font-semibold">Viewers</h3>
                <p className="mt-0.5 text-xs text-[#14121F]/55">People with personal links are named. Everyone else is grouped by browser.</p>
                {analytics.viewers.length === 0 ? (
                    <p className="mt-4 rounded-2xl bg-[#F7F6FB] px-4 py-6 text-center text-sm text-[#14121F]/55">No one has opened the video yet. Share a link to get started.</p>
                ) : (
                    <ul className="mt-3 divide-y divide-[#14121F]/6">
                        {analytics.viewers.map((viewer) => <ViewerRow key={viewer.key} viewer={viewer} />)}
                    </ul>
                )}
            </div>
        </section>
    );
}

function EmptyChart({ text }: { text: string }) {
    return <div className="grid h-[240px] place-items-center rounded-2xl bg-[#F7F6FB] text-sm text-[#14121F]/55">{text}</div>;
}

function ViewerRow({ viewer }: { viewer: ViewerSummary }) {
    const [open, setOpen] = useState(false);
    const summary = useMemo(() => describeViewer(viewer), [viewer]);
    return (
        <li className="py-3.5">
            <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className={`flex w-full items-center gap-3 rounded-xl text-left ${focus}`}>
                <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${viewer.linkId ? 'bg-[#6A4CFF]/12 text-[#6A4CFF]' : 'bg-[#14121F]/[0.06] text-[#14121F]/50'}`}>{viewer.name.charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{viewer.name}{viewer.company && <span className="font-normal text-[#14121F]/55"> · {viewer.company}</span>}</span>
                    <span className="block truncate text-xs text-[#14121F]/55">
                        {viewer.sessions ? `Watched ${timeAgo(viewer.lastSeenAt)}` : `Opened ${timeAgo(viewer.lastSeenAt)}, didn’t play`}
                        {viewer.sessions > 1 ? ` · ${viewer.sessions} plays` : ''}{viewer.embedHosts.length ? ` · on ${viewer.embedHosts.join(', ')}` : ''}{viewer.device ? ` · ${viewer.device}` : ''}{viewer.country ? ` · ${viewer.country}` : ''}
                    </span>
                </span>
                <span className="hidden items-center gap-1.5 sm:flex">
                    {viewer.rewatched && <span className="inline-flex items-center gap-1 rounded-full bg-[#F7F6FB] px-2 py-0.5 text-[11px] font-semibold text-[#14121F]/65"><Repeat className="h-3 w-3" /> Rewatched</span>}
                    {viewer.ctaClicked && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><MousePointerClick className="h-3 w-3" /> Clicked button</span>}
                </span>
                <span className="flex w-28 shrink-0 items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#14121F]/[0.06]"><span className="block h-full rounded-full bg-[#6A4CFF]" style={{ width: `${Math.round(viewer.watchedShare * 100)}%` }} /></span>
                    <span className="w-9 text-right text-xs font-semibold tabular-nums">{formatPercent(viewer.watchedShare)}</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#14121F]/35 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="ml-12 mt-3 space-y-3">
                    {summary && <p className="rounded-xl bg-[#6A4CFF]/[0.06] px-3 py-2 text-sm text-[#14121F]/80">{summary}</p>}
                    {viewer.email && <p className="text-xs text-[#14121F]/55">{viewer.email}</p>}
                    {viewer.timeline.length > 0 ? (
                        <ol className="space-y-1.5 border-l border-[#14121F]/10 pl-4">
                            {viewer.timeline.map((event, index) => (
                                <li key={index} className="text-xs text-[#14121F]/70">
                                    <span className="font-semibold text-[#14121F]">{EVENT_LABEL[event.type] ?? event.type}</span>
                                    {event.type === 'chapter' || event.type === 'cta' ? ` “${event.detail ?? ''}”` : ` at ${formatClock(event.positionMs)}`}
                                    <span className="text-[#14121F]/40"> · {new Date(event.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="text-xs text-[#14121F]/50">No activity recorded yet.</p>}
                </div>
            )}
        </li>
    );
}

/** A plain-language read of what the viewer focused on, from their chapter engagement. */
function describeViewer(viewer: ViewerSummary) {
    const parts: string[] = [];
    if (viewer.chaptersWatched.length) parts.push(`Focused on ${listOf(viewer.chaptersWatched)}`);
    if (viewer.chaptersSkipped.length) parts.push(`skipped ${listOf(viewer.chaptersSkipped)}`);
    if (viewer.rewatched) parts.push('went back to rewatch parts');
    if (viewer.ctaClicked) parts.push('clicked your button');
    if (!parts.length) return viewer.sessions ? `Watched ${formatPercent(viewer.watchedShare)} of the video.` : null;
    const text = parts.join('; ');
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

const listOf = (items: string[]) => (items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
