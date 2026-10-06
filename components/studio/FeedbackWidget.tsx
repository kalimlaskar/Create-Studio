'use client';

import React, { useState } from 'react';
import { MessageSquareText, Send, Star } from 'lucide-react';

export function FeedbackWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [rating, setRating] = useState(5);
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);

    const submit = async () => {
        if (isSending || message.trim().length < 5) return;
        setIsSending(true);
        setStatus(null);
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating, message: message.trim(), role: 'creator' }),
            });
            const result = await response.json() as { error?: string };
            if (!response.ok) throw new Error(result.error ?? 'Feedback could not be sent.');
            setStatus('Thanks—your feedback has been sent.');
            setMessage('');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Feedback could not be sent.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {isOpen && (
                <section className="mb-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl" aria-label="Creator feedback form">
                    <h2 className="text-sm font-semibold text-white">Help shape Cliprame</h2>
                    <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">Tell us what worked, what felt confusing, and what you need next. No video or personal data is attached.</p>
                    <div className="mt-3 flex items-center gap-1" aria-label={`Rating: ${rating} out of 5`}>
                        {[1, 2, 3, 4, 5].map((value) => (
                            <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} star rating`} aria-pressed={rating === value}
                                className={`rounded p-1 ${value <= rating ? 'text-amber-300' : 'text-neutral-600'}`}><Star className="h-5 w-5 fill-current" /></button>
                        ))}
                    </div>
                    <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={4} placeholder="What should we improve?"
                        className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-indigo-500 focus:outline-none" />
                    <div className="mt-2 flex items-center justify-between gap-2">
                        <span role="status" className="text-[10px] text-neutral-400">{status}</span>
                        <button type="button" onClick={() => void submit()} disabled={isSending || message.trim().length < 5}
                            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                            <Send className="h-3.5 w-3.5" /> {isSending ? 'Sending…' : 'Send'}
                        </button>
                    </div>
                </section>
            )}
            <button type="button" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen}
                className="ml-auto flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-neutral-100 shadow-xl hover:border-indigo-500 hover:bg-neutral-800">
                <MessageSquareText className="h-4 w-4 text-indigo-300" /> {isOpen ? 'Close feedback' : 'Give feedback'}
            </button>
        </div>
    );
}
