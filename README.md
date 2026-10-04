This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Creator Studio is a browser-based video recording and editing workspace built with Next.js.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Automatic captions

Automatic captions use OpenAI Whisper word timestamps. Set `OPENAI_API_KEY` in `.env.local` on the server before using the Captions tab. The key is never sent to the browser. Audio is captured from the source video and sent to OpenAI; the transcription API accepts files up to 25 MB. Hindi, Hinglish, and English (including accented English) can be selected, and generated words remain editable in the editor.

The teleprompter's AI script builder uses the same server-side `OPENAI_API_KEY` and supports English, Hindi, Hinglish, Bengali, Marathi, Tamil, and Telugu. Generated text is a draft; review it before recording.

Accuracy varies with the recording, accent, background noise, and code-switching. Review generated captions before publishing.

Copy `.env.example` to `.env.local` and set the server-only values before using AI script generation, captions, or feedback delivery.

## Local projects and free plan

Saved editor projects are stored in IndexedDB on the current browser/device; they are not synced to an account or another device. The current free-plan prototype adds a visible watermark and limits camera recordings and exports to 60 seconds. Payments and paid-plan entitlements are not enabled until a billing provider, credentials, and a persistent account/database service are configured.

The Creator Profile name is a local browser label, not an authenticated account. The Upgrade control is deliberately disabled: no Stripe/Razorpay checkout, subscription verification, or paid-limit bypass should be presented as live until auth, database entitlements, provider secrets, and verified webhooks are configured.

## Creator feedback

The home screen includes an optional rating/comment form. Set `CREATOR_FEEDBACK_WEBHOOK_URL` on the server to deliver responses to a configured collection endpoint. The form does not attach video or account data. A small pilot can share a test URL with 5–10 creators, ask them to try recording, script generation, and editing, and use this form to collect qualitative feedback; recruit participants and configure the webhook before claiming user testing is complete.
