import 'server-only';
import { adminEmailList } from './emails';

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Emails the admins about an urgent report, through Resend when it's configured. Never throws. */
export async function emailAdminsAboutReport({ reason, videoTitle, details, adminUrl }: { reason: string; videoTitle: string; details: string | null; adminUrl: string }) {
    const to = adminEmailList();
    if (!process.env.RESEND_API_KEY || !process.env.ACCESS_EMAIL_FROM || !to.length) return;
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: `Cliprame Safety <${process.env.ACCESS_EMAIL_FROM}>`,
                to,
                subject: `Urgent report: ${reason}`,
                text: `An urgent report needs review.\n\nReason: ${reason}\nVideo: ${videoTitle}\n${details ? `Details: ${details}\n` : ''}\nReview it: ${adminUrl}\n\nIntimate content shared without consent should be removed within 24 hours of a complaint.`,
                html: `<p><strong>An urgent report needs review.</strong></p><p>Reason: ${escapeHtml(reason)}<br>Video: ${escapeHtml(videoTitle)}${details ? `<br>Details: ${escapeHtml(details)}` : ''}</p><p><a href="${adminUrl}">Review it in the admin dashboard</a></p><p style="color:#666">Intimate content shared without consent should be removed within 24 hours of a complaint.</p>`,
            }),
        });
        if (!response.ok) console.error('Could not email admins about a report:', response.status);
    } catch (error) {
        console.error('Could not email admins about a report:', error);
    }
}
