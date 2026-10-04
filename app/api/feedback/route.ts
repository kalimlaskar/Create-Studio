const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: Request) {
    const webhookUrl = process.env.CREATOR_FEEDBACK_WEBHOOK_URL;
    if (!webhookUrl) {
        return Response.json({ error: 'Feedback collection is not configured on this deployment yet.' }, { status: 503 });
    }

    const body = await request.json().catch(() => null) as { rating?: unknown; message?: unknown; role?: unknown } | null;
    const rating = Number(body?.rating);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const role = typeof body?.role === 'string' ? body.role.slice(0, 40) : 'creator';
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || message.length < 5 || message.length > MAX_MESSAGE_LENGTH) {
        return Response.json({ error: 'Add a 5–2000 character note and choose a 1–5 rating.' }, { status: 400 });
    }

    try {
        const upstream = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating, message, role, submittedAt: new Date().toISOString() }),
            cache: 'no-store',
        });
        if (!upstream.ok) return Response.json({ error: 'Feedback could not be delivered. Please try again later.' }, { status: 502 });
        return Response.json({ ok: true });
    } catch {
        return Response.json({ error: 'Feedback service is unavailable. Please try again later.' }, { status: 502 });
    }
}
