// Team workspace shapes shared by the server and the team page (safe to import from client components).

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface WorkspaceSummary {
    id: string;
    name: string;
    /** The signed-in user's role here. */
    role: WorkspaceRole;
    seatLimit: number;
}

export interface TeamMember {
    userId: string;
    role: WorkspaceRole;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    joinedAt: string;
}

export interface TeamInvite {
    id: string;
    email: string;
    role: 'admin' | 'member';
    expiresAt: string;
    expired: boolean;
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };

export const ROLE_HINTS: Record<WorkspaceRole, string> = {
    owner: 'Everything, including roles',
    admin: 'Edits any video, invites people, manages integrations',
    member: 'Sees the team’s videos; edits their own',
};
