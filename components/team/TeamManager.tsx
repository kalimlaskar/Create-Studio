'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Check, Copy, LoaderCircle, LogOut, Mail, Pencil, Plus, RotateCw, Trash2, Users, X } from 'lucide-react';
import { focus } from '@/components/videos/ui';
import { ROLE_HINTS, ROLE_LABELS, type TeamInvite, type TeamMember, type WorkspaceSummary } from '@/lib/workspaces/types';

const D = 'font-[family-name:var(--font-display)]';
const card = 'rounded-3xl border border-[#14121F]/8 bg-white';
const inputClass = 'w-full rounded-xl border border-[#14121F]/12 bg-[#F7F6FB] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#6A4CFF] focus:bg-white focus:ring-4 focus:ring-[#6A4CFF]/10';
const primary = `inline-flex items-center justify-center gap-2 rounded-xl bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742] disabled:opacity-50 ${focus}`;
const ghost = `inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#14121F]/65 transition hover:bg-[#14121F]/5 hover:text-[#14121F] disabled:opacity-40 ${focus}`;

const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

interface Props {
    workspace: WorkspaceSummary;
    workspaces: WorkspaceSummary[];
    members: TeamMember[];
    invites: TeamInvite[];
    currentUserId: string;
    emailConfigured: boolean;
    justJoined: boolean;
}

/** Calls a team API route and returns its JSON, or an error sentence. */
async function call(url: string, method: string, body?: unknown): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
    const response = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    const data = await response?.json().catch(() => null) as Record<string, unknown> | null;
    if (!response?.ok) return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Something went wrong. Check your connection and try again.' };
    return { ok: true, data: data ?? {} };
}

export function TeamManager({ workspace, workspaces, members, invites, currentUserId, emailConfigured, justJoined }: Props) {
    const router = useRouter();
    const isAdmin = workspace.role === 'owner' || workspace.role === 'admin';
    const pending = invites.filter((invite) => !invite.expired);
    const used = members.length + pending.length;

    return (
        <div className="space-y-6">
            {justJoined && (
                <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <Check className="h-4 w-4 shrink-0" />You joined {workspace.name}. Videos you make now go into this workspace.
                </p>
            )}

            <Overview workspace={workspace} used={used} isAdmin={isAdmin} onChanged={() => router.refresh()} />

            {isAdmin && <InviteForm workspace={workspace} full={used >= workspace.seatLimit} isOwner={workspace.role === 'owner'} emailConfigured={emailConfigured} onInvited={() => router.refresh()} />}

            <Section title="Members" hint={`${members.length} ${members.length === 1 ? 'person' : 'people'} in ${workspace.name}.`}>
                <ul className="divide-y divide-[#14121F]/6">
                    {members.map((member) => (
                        <MemberRow key={member.userId} member={member} workspace={workspace} isSelf={member.userId === currentUserId} onChanged={() => router.refresh()} />
                    ))}
                </ul>
            </Section>

            {isAdmin && invites.length > 0 && (
                <Section title="Pending invites" hint="Each pending invite holds a seat until it’s accepted, cancelled or expires.">
                    <ul className="divide-y divide-[#14121F]/6">
                        {invites.map((invite) => <InviteRow key={invite.id} invite={invite} workspaceId={workspace.id} onChanged={() => router.refresh()} />)}
                    </ul>
                </Section>
            )}

            <WorkspaceList workspaces={workspaces} activeId={workspace.id} onChanged={() => router.refresh()} />
        </div>
    );
}

function Section({ title, hint, children, action }: { title: string; hint?: string; children: ReactNode; action?: ReactNode }) {
    return (
        <section className={`${card} p-6 sm:p-8`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className={`${D} text-xl font-bold tracking-tight`}>{title}</h2>
                    {hint && <p className="mt-1 text-sm text-[#14121F]/55">{hint}</p>}
                </div>
                {action}
            </div>
            <div className="mt-5">{children}</div>
        </section>
    );
}

function Initial({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
    return (
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#6A4CFF] to-[#C04CFF] bg-cover bg-center text-sm font-bold text-white" style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}>
            {!avatarUrl && name.charAt(0).toUpperCase()}
        </span>
    );
}

function Overview({ workspace, used, isAdmin, onChanged }: { workspace: WorkspaceSummary; used: number; isAdmin: boolean; onChanged: () => void }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(workspace.name);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const share = Math.min(1, used / Math.max(1, workspace.seatLimit));

    const save = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        const result = await call(`/api/workspaces/${workspace.id}`, 'PATCH', { name });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        setEditing(false);
        onChanged();
    };

    return (
        <section className={`${card} p-6 sm:p-8`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#14121F]/45">Current workspace</p>
                    {editing ? (
                        <form onSubmit={save} className="mt-2 flex max-w-md gap-2">
                            <label htmlFor="workspace-name" className="sr-only">Workspace name</label>
                            <input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required autoFocus className={inputClass} />
                            <button type="submit" disabled={busy || !name.trim()} className={primary}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Save'}</button>
                            <button type="button" onClick={() => { setEditing(false); setName(workspace.name); setError(null); }} className={ghost} aria-label="Cancel renaming"><X className="h-4 w-4" /></button>
                        </form>
                    ) : (
                        <div className="mt-1 flex items-center gap-2">
                            <h2 className={`${D} truncate text-2xl font-bold tracking-tight`}>{workspace.name}</h2>
                            {isAdmin && <button type="button" onClick={() => setEditing(true)} className={ghost} aria-label="Rename workspace"><Pencil className="h-3.5 w-3.5" /></button>}
                        </div>
                    )}
                    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
                    <p className="mt-2 text-sm text-[#14121F]/55">You’re {{ owner: 'the', admin: 'an', member: 'a' }[workspace.role]} <strong className="font-semibold text-[#14121F]">{ROLE_LABELS[workspace.role].toLowerCase()}</strong> · {ROLE_HINTS[workspace.role]}.</p>
                </div>

                <div className="w-full sm:w-56">
                    <div className="flex items-baseline justify-between text-sm">
                        <span className="font-semibold">Seats</span>
                        <span className="tabular-nums text-[#14121F]/55">{used} of {workspace.seatLimit}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#14121F]/6" role="progressbar" aria-label="Seats used" aria-valuenow={used} aria-valuemin={0} aria-valuemax={workspace.seatLimit}>
                        <div className={`h-full rounded-full ${share >= 1 ? 'bg-amber-500' : 'bg-[#6A4CFF]'}`} style={{ width: `${share * 100}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-[#14121F]/45">Members and pending invites. Seats come from the owner’s plan.</p>
                </div>
            </div>
        </section>
    );
}

function InviteForm({ workspace, full, isOwner, emailConfigured, onInvited }: { workspace: WorkspaceSummary; full: boolean; isOwner: boolean; emailConfigured: boolean; onInvited: () => void }) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'member' | 'admin'>('member');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<{ text: string; upgrade: boolean } | null>(null);
    const [sent, setSent] = useState<{ email: string; url: string; emailed: boolean } | null>(null);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setSent(null);
        const result = await call(`/api/workspaces/${workspace.id}/invites`, 'POST', { email, role });
        setBusy(false);
        if (!result.ok) return setError({ text: result.error, upgrade: /seat/i.test(result.error) });
        setSent({ email: email.trim().toLowerCase(), url: String(result.data.inviteUrl ?? ''), emailed: result.data.emailSent === true });
        setEmail('');
        onInvited();
    };

    return (
        <Section title="Invite people" hint="They’ll see the team’s videos, viewer analytics and leads. Invites work for 7 days.">
            {full ? (
                <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Every seat is taken. {isOwner ? <><Link href="/pricing" className="font-semibold underline underline-offset-2">Upgrade your plan</Link> for more, or remove someone first.</> : 'Ask the owner to upgrade, or remove someone first.'}
                </p>
            ) : (
                <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                    <div>
                        <label htmlFor="invite-email" className="sr-only">Email address</label>
                        <input id="invite-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" autoComplete="off" className={inputClass} />
                    </div>
                    <div>
                        <label htmlFor="invite-role" className="sr-only">Role</label>
                        <select id="invite-role" value={role} onChange={(event) => setRole(event.target.value as 'member' | 'admin')} className={inputClass}>
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <button type="submit" disabled={busy || !email.trim()} className={primary}>
                        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Send invite
                    </button>
                </form>
            )}
            <p className="mt-2 text-xs text-[#14121F]/45">{ROLE_LABELS[role]}: {ROLE_HINTS[role]}.</p>

            {error && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                    {error.text}{error.upgrade && isOwner && <> <Link href="/pricing" className="font-semibold underline underline-offset-2">See plans</Link></>}
                </p>
            )}
            {sent && (
                <div role="status" className="mt-4 rounded-2xl border border-[#14121F]/8 bg-[#F7F6FB] p-4 text-sm">
                    <p className="flex items-center gap-2 font-semibold">
                        <Check className="h-4 w-4 text-emerald-600" />
                        {sent.emailed ? `Invite sent to ${sent.email}.` : `Invite created for ${sent.email}.`}
                    </p>
                    <p className="mt-1 text-[#14121F]/60">
                        {sent.emailed ? 'You can also share the link yourself, on WhatsApp or Slack.' : emailConfigured ? 'The email didn’t go through. Copy the link and send it yourself.' : 'Email isn’t set up on this server, so copy the link and send it yourself.'}
                    </p>
                    {sent.url && <CopyLink url={sent.url} />}
                    <p className="mt-2 text-xs text-[#14121F]/45">The link only works when signed in as {sent.email}.</p>
                </div>
            )}
        </Section>
    );
}

function CopyLink({ url }: { url: string }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };
    return (
        <div className="mt-3 flex gap-2">
            <input readOnly value={url} aria-label="Invite link" onFocus={(event) => event.currentTarget.select()} className={`${inputClass} bg-white font-mono text-xs`} />
            <button type="button" onClick={copy} className={`${primary} shrink-0`}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}</button>
        </div>
    );
}

function MemberRow({ member, workspace, isSelf, onChanged }: { member: TeamMember; workspace: WorkspaceSummary; isSelf: boolean; onChanged: () => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isOwner = workspace.role === 'owner';
    const canRemove = !isSelf && member.role !== 'owner' && (workspace.role === 'owner' || workspace.role === 'admin');
    const canLeave = isSelf && member.role !== 'owner';

    const changeRole = async (role: 'admin' | 'member') => {
        setBusy(true);
        setError(null);
        const result = await call(`/api/workspaces/${workspace.id}/members/${member.userId}`, 'PATCH', { role });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        onChanged();
    };

    const remove = async () => {
        const question = isSelf
            ? `Leave ${workspace.name}? You’ll lose access to its videos. Videos you made stay with the team.`
            : `Remove ${member.name} from ${workspace.name}? The videos they made stay with the team.`;
        if (!window.confirm(question)) return;
        setBusy(true);
        setError(null);
        const result = await call(`/api/workspaces/${workspace.id}/members/${member.userId}`, 'DELETE');
        setBusy(false);
        if (!result.ok) return setError(result.error);
        onChanged();
    };

    return (
        <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Initial name={member.name} avatarUrl={member.avatarUrl} />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{member.name}{isSelf && <span className="font-normal text-[#14121F]/45"> (you)</span>}</p>
                <p className="truncate text-xs text-[#14121F]/50">{member.email ?? '—'} · joined {dateText(member.joinedAt)}</p>
                {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
            </div>
            {isOwner && member.role !== 'owner' ? (
                <>
                    <label htmlFor={`role-${member.userId}`} className="sr-only">Role for {member.name}</label>
                    <select id={`role-${member.userId}`} value={member.role} disabled={busy} onChange={(event) => changeRole(event.target.value as 'admin' | 'member')} className="rounded-lg border border-[#14121F]/12 bg-white px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-[#6A4CFF]">
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                    </select>
                </>
            ) : (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${member.role === 'owner' ? 'bg-[#6A4CFF]/10 text-[#5B3DF5]' : 'bg-[#14121F]/6 text-[#14121F]/65'}`}>{ROLE_LABELS[member.role]}</span>
            )}
            {canRemove && <button type="button" onClick={remove} disabled={busy} className={ghost} aria-label={`Remove ${member.name}`}><Trash2 className="h-3.5 w-3.5" />Remove</button>}
            {canLeave && <button type="button" onClick={remove} disabled={busy} className={ghost}><LogOut className="h-3.5 w-3.5" />Leave</button>}
        </li>
    );
}

function InviteRow({ invite, workspaceId, onChanged }: { invite: TeamInvite; workspaceId: string; onChanged: () => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [url, setUrl] = useState<string | null>(null);

    const cancel = async () => {
        setBusy(true);
        setError(null);
        const result = await call(`/api/workspaces/${workspaceId}/invites/${invite.id}`, 'DELETE');
        setBusy(false);
        if (!result.ok) return setError(result.error);
        onChanged();
    };

    // Only a hash of each link is stored, so "resend" makes a fresh invite (the old link stops working).
    const resend = async () => {
        setBusy(true);
        setError(null);
        const result = await call(`/api/workspaces/${workspaceId}/invites`, 'POST', { email: invite.email, role: invite.role });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        if (result.data.emailSent !== true) setUrl(String(result.data.inviteUrl ?? ''));
        onChanged();
    };

    return (
        <li className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-3">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-[#14121F]/20 text-[#14121F]/40"><Mail className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{invite.email}</p>
                    <p className={`text-xs ${invite.expired ? 'text-amber-700' : 'text-[#14121F]/50'}`}>{ROLE_LABELS[invite.role]} · {invite.expired ? `expired ${dateText(invite.expiresAt)}` : `expires ${dateText(invite.expiresAt)}`}</p>
                    {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
                </div>
                <button type="button" onClick={resend} disabled={busy} className={ghost}><RotateCw className="h-3.5 w-3.5" />{invite.expired ? 'Send again' : 'Resend'}</button>
                <button type="button" onClick={cancel} disabled={busy} className={ghost} aria-label={`Cancel invite for ${invite.email}`}><X className="h-3.5 w-3.5" />Cancel</button>
            </div>
            {url && <CopyLink url={url} />}
        </li>
    );
}

function WorkspaceList({ workspaces, activeId, onChanged }: { workspaces: WorkspaceSummary[]; activeId: string; onChanged: () => void }) {
    const [busyId, setBusyId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const switchTo = async (id: string) => {
        setBusyId(id);
        setError(null);
        const result = await call('/api/workspaces/active', 'POST', { workspaceId: id });
        setBusyId(null);
        if (!result.ok) return setError(result.error);
        onChanged();
    };

    const create = async (event: FormEvent) => {
        event.preventDefault();
        setBusyId('new');
        setError(null);
        const result = await call('/api/workspaces', 'POST', { name });
        setBusyId(null);
        if (!result.ok) return setError(result.error);
        setCreating(false);
        setName('');
        onChanged();
    };

    return (
        <Section
            title="Your workspaces"
            hint="The studio shows one workspace at a time. New videos and integrations go into the one you’re in."
            action={!creating && <button type="button" onClick={() => setCreating(true)} className={`${ghost} border border-[#14121F]/12`}><Plus className="h-3.5 w-3.5" />New workspace</button>}
        >
            {creating && (
                <form onSubmit={create} className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-[#F7F6FB] p-3">
                    <label htmlFor="new-workspace" className="sr-only">Workspace name</label>
                    <input id="new-workspace" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Acme sales team" maxLength={80} required autoFocus className={`${inputClass} min-w-0 flex-1 bg-white`} />
                    <button type="submit" disabled={busyId === 'new' || !name.trim()} className={primary}>{busyId === 'new' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Create'}</button>
                    <button type="button" onClick={() => { setCreating(false); setName(''); }} className={ghost}>Cancel</button>
                </form>
            )}
            {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
            <ul className="divide-y divide-[#14121F]/6">
                {workspaces.map((workspace) => (
                    <li key={workspace.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#14121F]/5 text-[#14121F]/55"><Users className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{workspace.name}</p>
                            <p className="text-xs text-[#14121F]/50">{ROLE_LABELS[workspace.role]}</p>
                        </div>
                        {workspace.id === activeId ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><Check className="h-3 w-3" />Current</span>
                        ) : (
                            <button type="button" onClick={() => switchTo(workspace.id)} disabled={busyId !== null} className={`${ghost} border border-[#14121F]/12`}>
                                {busyId === workspace.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}Switch
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </Section>
    );
}
