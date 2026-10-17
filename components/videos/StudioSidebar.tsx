'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, ChevronsUpDown, Compass, Crown, Film, Home, Images, LogOut, PanelLeftClose, PanelLeftOpen, Plug, Plus, Sparkles, Tag, Upload, UserRound, Video, type LucideIcon } from 'lucide-react';
import { signOutAction } from '@/app/auth/actions';
import { startTour } from '@/components/tour/ProductTour';
import { D, focus } from './ui';

export interface SidebarAccount {
    name: string;
    handle: string | null;
    email: string | null;
    avatarUrl: string | null;
    plan: { id: 'free' | 'creator' | 'studio'; name: string; isPaid: boolean };
    videos: number;
    videoLimit: number;
    liveIntegrations: number;
}

/** Remembered in a cookie so the server renders the right width and nothing jumps on load. */
export const SIDEBAR_COOKIE = 'cliprame-sidebar';

type Item = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

export type CreateId = 'record' | 'upload' | 'reel';

const CREATE_OPTIONS: Array<{ id: CreateId; label: string; hint: string; icon: LucideIcon }> = [
    { id: 'record', label: 'Record a video', hint: 'Camera or screen', icon: Video },
    { id: 'upload', label: 'Upload a video', hint: 'Edit a clip you have', icon: Upload },
    { id: 'reel', label: 'Photo + video reel', hint: 'Templates and music', icon: Images },
];

/** Page-specific links shown under the main ones, e.g. "Getting started" on Home. */
export interface ExtraItem { key: string; label: string; icon: LucideIcon; href?: string; onClick?: () => void }

interface SidebarProps {
    account: SidebarAccount | null;
    initialCollapsed: boolean;
    /** On Home the create options run in place; elsewhere they open Home with ?create=. */
    onCreate?: (id: CreateId) => void;
    extraItems?: ExtraItem[];
    /** On Home, "Profile & settings" opens the profile editor instead of navigating. */
    onOpenProfile?: () => void;
}

const WORKSPACE: Item[] = [
    { href: '/studio', label: 'Home', icon: Home, match: (path) => path === '/studio' },
    { href: '/studio/videos', label: 'Videos', icon: Film, match: (path) => path.startsWith('/studio/videos') },
    { href: '/studio/integrations', label: 'Integrations', icon: Plug, match: (path) => path.startsWith('/studio/integrations') },
];

const EXPLORE: Item[] = [
    { href: '/features', label: 'Features', icon: Compass, match: () => false },
    { href: '/pricing', label: 'Pricing', icon: Tag, match: () => false },
];

function Avatar({ account, size = 'md' }: { account: SidebarAccount; size?: 'sm' | 'md' }) {
    const box = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm';
    return (
        <span aria-hidden="true" className={`relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6A4CFF] to-[#C04CFF] bg-cover bg-center font-bold text-white ring-2 ring-white ${box}`} style={account.avatarUrl ? { backgroundImage: `url("${account.avatarUrl}")` } : undefined}>
            {!account.avatarUrl && account.name.charAt(0).toUpperCase()}
        </span>
    );
}

/** Hover label for the collapsed rail. */
function Tip({ label, show }: { label: string; show: boolean }) {
    if (!show) return null;
    return <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#14121F] px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">{label}</span>;
}

export function StudioSidebar({ account, initialCollapsed, onCreate, extraItems = [], onOpenProfile }: SidebarProps) {
    const pathname = usePathname() ?? '';
    const [collapsed, setCollapsed] = useState(initialCollapsed);
    const [menuOpen, setMenuOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const createRef = useRef<HTMLDivElement>(null);

    const toggle = () => {
        const next = !collapsed;
        setCollapsed(next);
        document.cookie = `${SIDEBAR_COOKIE}=${next ? 'collapsed' : 'open'}; path=/; max-age=31536000; samesite=lax`;
    };

    useEffect(() => {
        if (!menuOpen && !createOpen) return;
        const onDown = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
            if (!createRef.current?.contains(event.target as Node)) setCreateOpen(false);
        };
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); setCreateOpen(false); } };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [menuOpen, createOpen]);

    const badgeFor = (href: string) => {
        if (!account) return null;
        if (href === '/studio/videos' && account.videos > 0) return <span className="ml-auto rounded-full bg-[#14121F]/[0.06] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#14121F]/55">{account.videos}</span>;
        if (href === '/studio/integrations' && account.liveIntegrations > 0) {
            return (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700" title={`${account.liveIntegrations} live`}>
                    <span className="relative flex h-1.5 w-1.5"><span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-emerald-500" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
                    {account.liveIntegrations}
                </span>
            );
        }
        return null;
    };

    const usage = account ? Math.min(1, account.videos / Math.max(1, account.videoLimit)) : 0;

    return (
        <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-[#14121F]/[0.07] bg-white/80 backdrop-blur-xl transition-[width] duration-300 md:flex ${collapsed ? 'w-[76px]' : 'w-[264px]'}`}>
            {/* Brand and collapse */}
            <div className={`flex h-16 items-center ${collapsed ? 'justify-center' : 'justify-between pl-5 pr-3'}`}>
                {!collapsed && (
                    <Link href="/" aria-label="Cliprame home" className={`inline-flex items-center gap-2.5 rounded-xl ${focus}`}>
                        <Image src="/cliprame-icon.svg" alt="" width={30} height={30} className="h-[30px] w-[30px]" />
                        <span className={`${D} text-[17px] font-bold tracking-tight`}>Cliprame</span>
                    </Link>
                )}
                <button type="button" onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} className={`group relative rounded-lg p-2 text-[#14121F]/40 transition hover:bg-[#14121F]/[0.05] hover:text-[#14121F] ${focus}`}>
                    {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
                    <Tip label="Expand" show={collapsed} />
                </button>
            </div>

            <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto pb-4 ${collapsed ? 'px-3' : 'px-4'}`}>
                {/* Primary action: what to make */}
                <div ref={createRef} data-tour="create" className={`relative mt-2 ${collapsed ? 'self-center' : ''}`}>
                    <button
                        type="button"
                        onClick={() => setCreateOpen((value) => !value)}
                        aria-haspopup="menu"
                        aria-expanded={createOpen}
                        className={`group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#6A4CFF] to-[#A44CFF] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(106,76,255,0.95),inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:shadow-[0_16px_34px_-14px_rgba(106,76,255,1),inset_0_1px_0_rgba(255,255,255,0.25)] ${collapsed ? 'h-11 w-11' : 'h-11 w-full px-4 text-sm'} ${focus}`}
                    >
                        <span aria-hidden="true" className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition duration-700 group-hover:translate-x-full" />
                        <Plus className={`relative h-[18px] w-[18px] transition duration-200 ${createOpen ? 'rotate-45' : ''}`} strokeWidth={2.6} />
                        {collapsed ? <><span className="sr-only">Create</span>{!createOpen && <Tip label="Create" show />}</> : <span className="relative">Create</span>}
                    </button>
                    {createOpen && (
                        <div role="menu" className={`animate-dialog-in absolute z-50 rounded-2xl border border-[#14121F]/10 bg-white p-1.5 shadow-[0_24px_60px_-20px_rgba(20,18,31,0.45)] ${collapsed ? 'left-full top-0 ml-3 w-64' : 'left-0 right-0 top-full mt-2'}`}>
                            {CREATE_OPTIONS.map(({ id, label, hint, icon: Icon }) => {
                                const content = (
                                    <>
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#6A4CFF]/10 text-[#6A4CFF] transition group-hover:bg-[#6A4CFF] group-hover:text-white"><Icon className="h-4 w-4" /></span>
                                        <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-[#14121F]/50">{hint}</span></span>
                                    </>
                                );
                                const itemClass = `group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-[#F7F6FB] ${focus}`;
                                return onCreate ? (
                                    <button key={id} type="button" role="menuitem" onClick={() => { setCreateOpen(false); onCreate(id); }} className={itemClass}>{content}</button>
                                ) : (
                                    <Link key={id} role="menuitem" href={`/studio?create=${id}`} onClick={() => setCreateOpen(false)} className={itemClass}>{content}</Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                <NavGroup label="Workspace" collapsed={collapsed}>
                    {WORKSPACE.map((item) => <NavLink key={item.href} item={item} active={item.match(pathname)} collapsed={collapsed} badge={badgeFor(item.href)} />)}
                    {extraItems.map((extra) => <ExtraLink key={extra.key} item={extra} collapsed={collapsed} />)}
                </NavGroup>

                <NavGroup label="Explore" collapsed={collapsed}>
                    {EXPLORE.map((item) => <NavLink key={item.href} item={item} active={false} collapsed={collapsed} external />)}
                </NavGroup>

                {/* Plan */}
                {account && !collapsed && (
                    account.plan.isPaid ? (
                        <div className="mt-auto flex items-center gap-2.5 rounded-2xl border border-[#14121F]/[0.07] bg-[#F7F6FB] px-3.5 py-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFB547] to-[#FF7A59] text-white"><Crown className="h-4 w-4" /></span>
                            <div className="min-w-0 text-xs">
                                <p className="font-semibold">{account.plan.name} plan</p>
                                <p className="text-[#14121F]/50">{account.videos} of {account.videoLimit} videos hosted</p>
                            </div>
                        </div>
                    ) : (
                        <div className="relative mt-auto overflow-hidden rounded-2xl bg-[#14121F] p-4 text-white">
                            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#6A4CFF]/60 blur-2xl" />
                            <p className="relative flex items-center gap-1.5 text-xs font-semibold text-white/70"><Sparkles className="h-3.5 w-3.5 text-[#B6A6FF]" /> Free plan</p>
                            <p className="relative mt-2 text-sm font-semibold">{account.videos} of {account.videoLimit} videos hosted</p>
                            <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                                <div className={`h-full rounded-full ${usage >= 0.8 ? 'bg-gradient-to-r from-amber-300 to-orange-400' : 'bg-gradient-to-r from-[#B6A6FF] to-[#F0A6FF]'}`} style={{ width: `${Math.max(4, usage * 100)}%` }} />
                            </div>
                            <Link href="/pricing" className="relative mt-3.5 flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#14121F] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                                Upgrade for more <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    )
                )}
            </div>

            {/* Account */}
            {account && (
                <div ref={menuRef} data-tour="account" className={`relative border-t border-[#14121F]/[0.07] ${collapsed ? 'p-3' : 'p-3'}`}>
                    <button
                        type="button"
                        onClick={() => setMenuOpen((value) => !value)}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        className={`group relative flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-[#14121F]/[0.04] ${collapsed ? 'justify-center' : ''} ${focus}`}
                    >
                        <Avatar account={account} />
                        {collapsed ? <Tip label={account.name} show /> : (
                            <>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold">{account.name}</span>
                                    <span className="block truncate text-xs text-[#14121F]/50">{account.handle ? `@${account.handle}` : account.email ?? account.plan.name}</span>
                                </span>
                                <ChevronsUpDown className="h-4 w-4 shrink-0 text-[#14121F]/35" />
                            </>
                        )}
                    </button>

                    {menuOpen && (
                        <div role="menu" className={`animate-dialog-in absolute bottom-full z-50 mb-2 w-60 overflow-hidden rounded-2xl border border-[#14121F]/10 bg-white p-1.5 shadow-[0_24px_60px_-20px_rgba(20,18,31,0.45)] ${collapsed ? 'left-3' : 'left-3 right-3 w-auto'}`}>
                            <div className="flex items-center gap-3 px-2.5 py-2.5">
                                <Avatar account={account} size="sm" />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{account.name}</p>
                                    <p className="truncate text-xs text-[#14121F]/50">{account.email ?? (account.handle ? `@${account.handle}` : '')}</p>
                                </div>
                            </div>
                            <div className="my-1 h-px bg-[#14121F]/[0.07]" />
                            {onOpenProfile ? (
                                <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); onOpenProfile(); }} className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-[#14121F]/75 hover:bg-[#14121F]/[0.05] hover:text-[#14121F] ${focus}`}><UserRound className="h-4 w-4" /> Profile & settings</button>
                            ) : (
                                <Link role="menuitem" href="/studio/account" onClick={() => setMenuOpen(false)} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-[#14121F]/75 hover:bg-[#14121F]/[0.05] hover:text-[#14121F] ${focus}`}><UserRound className="h-4 w-4" /> Profile & settings</Link>
                            )}
                            <Link role="menuitem" href="/pricing" onClick={() => setMenuOpen(false)} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-[#14121F]/75 hover:bg-[#14121F]/[0.05] hover:text-[#14121F] ${focus}`}>
                                <Crown className="h-4 w-4" /> {account.plan.isPaid ? `${account.plan.name} plan` : 'Upgrade plan'}
                            </Link>
                            <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); startTour(); }} className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-[#14121F]/75 hover:bg-[#14121F]/[0.05] hover:text-[#14121F] ${focus}`}><Sparkles className="h-4 w-4" /> Take the tour</button>
                            <div className="my-1 h-px bg-[#14121F]/[0.07]" />
                            <form action={signOutAction}>
                                <button role="menuitem" type="submit" className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 ${focus}`}><LogOut className="h-4 w-4" /> Sign out</button>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
}

function NavGroup({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactNode }) {
    return (
        <nav aria-label={label} className="mt-6">
            {collapsed ? <div className="mx-auto mb-2 h-px w-6 bg-[#14121F]/10" /> : <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#14121F]/35">{label}</p>}
            <ul className="space-y-0.5">{children}</ul>
        </nav>
    );
}

function NavLink({ item, active, collapsed, badge, external }: { item: Item; active: boolean; collapsed: boolean; badge?: React.ReactNode; external?: boolean }) {
    const Icon = item.icon;
    return (
        <li>
            <Link
                href={item.href}
                data-tour={`nav-${item.label.toLowerCase()}`}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex items-center gap-3 rounded-xl text-sm transition ${collapsed ? 'h-11 w-11 justify-center mx-auto' : 'px-3 py-2.5'} ${active
                    ? 'bg-white font-semibold text-[#14121F] shadow-[0_1px_2px_rgba(20,18,31,0.06),0_6px_16px_-8px_rgba(20,18,31,0.25)] ring-1 ring-[#14121F]/[0.06]'
                    : 'font-medium text-[#14121F]/60 hover:bg-[#14121F]/[0.04] hover:text-[#14121F]'} ${focus}`}
            >
                {active && <span aria-hidden="true" className={`absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#6A4CFF] to-[#C04CFF] ${collapsed ? '-left-3' : '-left-4'}`} />}
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${active ? 'bg-gradient-to-br from-[#6A4CFF] to-[#A44CFF] text-white shadow-[0_6px_14px_-6px_rgba(106,76,255,0.9)]' : 'text-[#14121F]/50 group-hover:text-[#14121F]'}`}>
                    <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2.3 : 2} />
                </span>
                {collapsed ? <><span className="sr-only">{item.label}</span><Tip label={item.label} show /></> : (
                    <>
                        <span className="truncate">{item.label}</span>
                        {badge}
                        {external && <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-[#14121F]/30 opacity-0 transition group-hover:opacity-100" />}
                    </>
                )}
            </Link>
        </li>
    );
}

function ExtraLink({ item, collapsed }: { item: ExtraItem; collapsed: boolean }) {
    const Icon = item.icon;
    const className = `group relative flex items-center gap-3 rounded-xl text-sm font-medium text-[#14121F]/60 transition hover:bg-[#14121F]/[0.04] hover:text-[#14121F] ${collapsed ? 'mx-auto h-11 w-11 justify-center' : 'w-full px-3 py-2.5 text-left'} ${focus}`;
    const inner = (
        <>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#14121F]/50 group-hover:text-[#14121F]"><Icon className="h-[17px] w-[17px]" /></span>
            {collapsed ? <><span className="sr-only">{item.label}</span><Tip label={item.label} show /></> : <span className="truncate">{item.label}</span>}
        </>
    );
    return <li>{item.href ? <a href={item.href} className={className}>{inner}</a> : <button type="button" onClick={item.onClick} className={className}>{inner}</button>}</li>;
}

/** Bottom tab bar on phones, where the sidebar is hidden. */
export function MobileTabBar() {
    const pathname = usePathname() ?? '';
    const tabs = [...WORKSPACE, { href: '/pricing', label: 'Plans', icon: Crown, match: (path: string) => path === '/pricing' }];
    return (
        <nav aria-label="Studio" className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-[#14121F]/10 bg-white/90 p-1.5 shadow-[0_16px_40px_-16px_rgba(20,18,31,0.45)] backdrop-blur-xl md:hidden" style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}>
            <ul className="grid grid-cols-4">
                {tabs.map(({ href, label, icon: Icon, match }) => {
                    const active = match(pathname);
                    return (
                        <li key={href}>
                            <Link href={href} aria-current={active ? 'page' : undefined} className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition ${active ? 'bg-[#6A4CFF]/10 text-[#4B30D9]' : 'text-[#14121F]/50'} ${focus}`}>
                                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                                {label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
