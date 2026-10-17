// Who is a super admin: the comma-separated ADMIN_EMAILS setting on the server.
// Kept free of server imports so it can be unit-tested.

export function adminEmailList(value = process.env.ADMIN_EMAILS ?? '') {
    return value.split(',').map((email) => email.trim().toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

/** Only a confirmed email address counts, so nobody can sign up as an admin's address and get in. */
export function isAdminEmail(email: string | null | undefined, confirmed: boolean, list = adminEmailList()) {
    return Boolean(email && confirmed && list.includes(email.toLowerCase()));
}

export const REPORT_REASONS = [
    { id: 'nonconsensual', label: 'Sexual or intimate content of me, shared without my consent', urgent: true },
    { id: 'child_safety', label: 'It involves a child in a harmful or sexual way', urgent: true },
    { id: 'sexual', label: 'Nudity or sexual content', urgent: false },
    { id: 'harassment', label: 'Harassment, hate or bullying', urgent: false },
    { id: 'violence', label: 'Violence or dangerous acts', urgent: false },
    { id: 'spam', label: 'Spam, scam or phishing', urgent: false },
    { id: 'copyright', label: 'It uses my copyrighted work', urgent: false },
    { id: 'other', label: 'Something else', urgent: false },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['id'];
export const reportReason = (id: unknown) => REPORT_REASONS.find((reason) => reason.id === id) ?? null;
