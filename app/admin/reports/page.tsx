import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Flag, Mail } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/auth';
import { loadReports } from '@/lib/admin/data';
import { REPORT_REASONS } from '@/lib/admin/emails';
import { BanUserButton, DismissReportButton, ReviewVideoButton, VideoTakedownButton } from '@/components/admin/AdminActions';
import { D, card, dateTime, timeAgo } from '@/components/admin/ui';

const reasonLabel = (id: string) => REPORT_REASONS.find((reason) => reason.id === id)?.label ?? id;

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
    const admin = await requireAdmin();
    const status = (await searchParams).status === 'closed' ? 'closed' : 'open';
    const reports = await loadReports(admin.db, status);
    const { data: bans } = await admin.db.from('account_bans').select('user_id');
    const banned = new Set((bans ?? []).map((row) => row.user_id as string));

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className={`${D} text-3xl font-bold tracking-tight`}>Reports</h1>
                    <p className="mt-1 text-sm text-[#14121F]/55">Urgent reports first. Open a video only to judge a report; every viewing is logged.</p>
                </div>
                <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-[#14121F]/8">
                    {(['open', 'closed'] as const).map((tab) => (
                        <Link key={tab} href={tab === 'open' ? '/admin/reports' : '/admin/reports?status=closed'} className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold capitalize ${status === tab ? 'bg-[#14121F] text-white' : 'text-[#14121F]/60 hover:text-[#14121F]'}`}>{tab === 'open' ? 'Open' : 'Resolved'}</Link>
                    ))}
                </div>
            </div>

            {reports.length === 0 && (
                <div className={`${card} flex flex-col items-center px-6 py-14 text-center`}>
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    <p className="mt-3 font-semibold">{status === 'open' ? 'Nothing to review' : 'No resolved reports yet'}</p>
                    <p className="mt-1 text-sm text-[#14121F]/55">Reports from the “Report this video” link on share pages appear here.</p>
                </div>
            )}

            <ul className="space-y-3">
                {reports.map((report) => (
                    <li key={report.id} className={`${card} p-5 ${report.urgent && report.status === 'open' ? 'border-red-300 ring-2 ring-red-100' : ''}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                                    {report.urgent ? <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"><AlertTriangle className="h-3 w-3" /> Urgent</span> : <Flag className="h-4 w-4 text-[#14121F]/40" />}
                                    {reasonLabel(report.reason)}
                                </p>
                                <p className="mt-1 text-xs text-[#14121F]/50">Reported {timeAgo(report.createdAt)} · {dateTime(report.createdAt)}{report.sameVideoCount > 1 && <span className="font-semibold text-red-600"> · {report.sameVideoCount} reports on this video</span>}</p>
                            </div>
                            {report.status !== 'open' && <span className="rounded-full bg-[#14121F]/[0.06] px-2.5 py-1 text-xs font-semibold capitalize text-[#14121F]/60">{report.status}{report.resolvedAt ? ` ${timeAgo(report.resolvedAt)}` : ''}</span>}
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_1fr]">
                            <div className="rounded-xl bg-[#F7F6FB] p-3.5 text-sm">
                                {report.video ? (
                                    <>
                                        <p className="font-semibold">“{report.video.title}”{report.video.removed && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Taken down</span>}</p>
                                        <p className="mt-0.5 text-xs text-[#14121F]/55">Uploaded {timeAgo(report.video.createdAt)} by {report.video.ownerEmail ?? 'unknown'}{banned.has(report.video.ownerId) && <span className="font-semibold text-red-700"> (banned)</span>}</p>
                                    </>
                                ) : <p className="text-[#14121F]/55">The video has been deleted.</p>}
                            </div>
                            <div className="text-sm">
                                {report.details ? <p className="leading-6 text-[#14121F]/75">“{report.details}”</p> : <p className="text-[#14121F]/45">No details given.</p>}
                                {report.reporterEmail && <a href={`mailto:${report.reporterEmail}`} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6A4CFF] hover:underline"><Mail className="h-3.5 w-3.5" />{report.reporterEmail}</a>}
                                {report.resolution && <p className="mt-1.5 text-xs text-[#14121F]/55">Resolution: {report.resolution}</p>}
                            </div>
                        </div>

                        {report.video && (
                            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#14121F]/[0.06] pt-4">
                                <ReviewVideoButton reportId={report.id} />
                                <VideoTakedownButton videoId={report.video.id} removed={report.video.removed} />
                                {report.video.ownerId !== admin.id && <BanUserButton userId={report.video.ownerId} banned={banned.has(report.video.ownerId)} />}
                                {report.status === 'open' && <span className="ml-auto"><DismissReportButton reportId={report.id} /></span>}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
