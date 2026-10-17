'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Download, EyeOff } from 'lucide-react';
import type { LeadRecord } from '@/lib/videos/types';
import { focus } from './ui';

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** One CSV with a column per field name seen across all submissions. */
function toCsv(leads: LeadRecord[]) {
    const fieldNames = [...new Set(leads.flatMap((lead) => Object.keys(lead.fields)))];
    const hiddenNames = [...new Set(leads.flatMap((lead) => Object.keys(lead.hidden)))].filter((name) => !fieldNames.includes(name));
    const header = ['submitted_at', 'form', ...fieldNames, ...hiddenNames, 'forwarded'];
    const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const rows = leads.map((lead) => [
        lead.createdAt,
        lead.formTitle ?? '',
        ...fieldNames.map((name) => lead.fields[name] ?? ''),
        ...hiddenNames.map((name) => lead.hidden[name] ?? ''),
        lead.forwardStatus ?? '',
    ].map((value) => cell(String(value))).join(','));
    return [header.join(','), ...rows].join('\n');
}

export function LeadsTable({ leads, videoTitle }: { leads: LeadRecord[]; videoTitle: string }) {
    const [open, setOpen] = useState<string | null>(null);
    const forms = useMemo(() => [...new Set(leads.map((lead) => lead.formTitle ?? 'Form'))], [leads]);

    const download = () => {
        const blob = new Blob([toCsv(leads)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${videoTitle.replace(/[^\w-]+/g, '-').slice(0, 60) || 'video'}-leads.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#14121F]/55">{leads.length} {leads.length === 1 ? 'submission' : 'submissions'}{forms.length > 1 ? ` across ${forms.length} forms` : ''}</p>
                <button type="button" onClick={download} className={`inline-flex items-center gap-1.5 rounded-full border border-[#14121F]/12 bg-white px-3 py-1.5 text-xs font-semibold hover:border-[#14121F]/25 ${focus}`}><Download className="h-3.5 w-3.5" /> Export CSV</button>
            </div>
            <ul className="mt-3 divide-y divide-[#14121F]/6">
                {leads.slice(0, 200).map((lead) => {
                    const expanded = open === lead.id;
                    const name = [lead.fields.firstname ?? lead.fields.first_name, lead.fields.lastname ?? lead.fields.last_name].filter(Boolean).join(' ') || lead.fields.name || lead.email || 'Anonymous';
                    const source = lead.hidden.utm_source || null;
                    return (
                        <li key={lead.id} className="py-3">
                            <button type="button" onClick={() => setOpen(expanded ? null : lead.id)} aria-expanded={expanded} className={`flex w-full items-center gap-3 rounded-xl text-left ${focus}`}>
                                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6A4CFF]/12 text-sm font-bold text-[#6A4CFF]">{name.charAt(0).toUpperCase()}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold">{name}{lead.fields.company && <span className="font-normal text-[#14121F]/55"> · {lead.fields.company}</span>}</span>
                                    <span className="block truncate text-xs text-[#14121F]/50">{lead.formTitle ?? 'Form'} · {when(lead.createdAt)}{source && ` · from ${source}`}</span>
                                </span>
                                {lead.forwardStatus === 'failed' && <span title={lead.forwardError ?? ''} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"><AlertTriangle className="h-3 w-3" /> Not forwarded</span>}
                                {lead.forwardStatus === 'ok' && <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 sm:inline-flex"><Check className="h-3 w-3" /> Forwarded</span>}
                                <ChevronDown className={`h-4 w-4 shrink-0 text-[#14121F]/35 transition ${expanded ? 'rotate-180' : ''}`} />
                            </button>
                            {expanded && (
                                <div className="mt-3 grid gap-3 rounded-2xl bg-[#F7F6FB] p-4 text-sm sm:ml-12 sm:grid-cols-2">
                                    <dl className="space-y-1.5">
                                        {Object.entries(lead.fields).map(([key, value]) => (
                                            <div key={key} className="flex gap-2"><dt className="w-28 shrink-0 truncate font-mono text-xs text-[#14121F]/50">{key}</dt><dd className="min-w-0 break-words">{value === 'true' ? 'Yes' : value}</dd></div>
                                        ))}
                                    </dl>
                                    {Object.keys(lead.hidden).length > 0 && (
                                        <dl className="space-y-1.5 border-t border-[#14121F]/8 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                                            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#14121F]/40"><EyeOff className="h-3 w-3" /> Hidden</p>
                                            {Object.entries(lead.hidden).map(([key, value]) => (
                                                <div key={key} className="flex gap-2"><dt className="w-28 shrink-0 truncate font-mono text-xs text-[#14121F]/50">{key}</dt><dd className="min-w-0 break-words text-[#14121F]/75">{value || '—'}</dd></div>
                                            ))}
                                        </dl>
                                    )}
                                    {lead.forwardStatus === 'failed' && lead.forwardError && <p className="text-xs font-medium text-red-600 sm:col-span-2">Forwarding failed: {lead.forwardError}</p>}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
