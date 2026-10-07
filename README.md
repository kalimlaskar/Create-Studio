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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the public product page. Create an account or sign in to open `/studio`.

Cliprame is a browser-based lesson, presentation, and social-reel creation workspace built with Next.js.

See [the architecture and creator-flow diagrams](./docs/architecture.md) for the app components, service boundaries, and end-to-end creation paths.

## Supabase authentication setup

1. Create a Supabase project and copy its Project URL and **publishable** key from Connect/API settings into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put a secret/service-role key in a `NEXT_PUBLIC_` variable.
2. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` locally and your deployed HTTPS origin in production. In Supabase Authentication URL Configuration, set the matching Site URL and add the origin plus `/auth/callback` to Redirect URLs.
3. Configure Supabase Auth email templates and delivery. For numeric sign-in codes, the **Magic Link** template must include `{{ .Token }}`. Configure SMTP before production use so confirmation and login emails are reliably delivered.
4. Apply `supabase/migrations/20261006000000_create_profiles.sql` and `supabase/migrations/20261007000200_account_profile_settings.sql` to the project. In Supabase, open **SQL Editor**, create a query for each migration, paste its contents, and run it. The account settings migration adds unique usernames and a profile-picture storage bucket.
5. Restart `npm run dev`, then create an individual account at **Sign up**. Confirm the email if confirmation is enabled. Returning users can sign in with a password or request a one-time email code. Profile names, usernames, and profile pictures are stored in Supabase; editor and reel drafts remain local to the browser.

Temporary tester auth is disabled by default and whenever Supabase is configured. To explicitly enable a local tester, set `TEMP_AUTH_ENABLED=true` and provide private `TEMP_AUTH_USERNAME` and `TEMP_AUTH_PASSWORD` values. Production additionally requires a random `TEMP_AUTH_SECRET` of at least 32 characters. Do not use shared tester credentials for real users.

Only the Supabase project URL and publishable key belong in `NEXT_PUBLIC_` variables. Never put a Supabase secret/service-role key in browser-visible environment variables. Sign-in and sign-up are handled by server actions; the `/studio` route and paid AI generation routes verify the Supabase session. Profile reads and updates are restricted to the authenticated owner by row-level security.

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

The teleprompter's AI script builder and photo-reel caption/voiceover generation use the server-side `GEMINI_API_KEY` and support the languages shown in the UI. Generated text/audio should be reviewed before publishing.

## Cartoon and photo-avatar effects

Comic, pencil sketch, pixel, and anime looks are processed locally on a small working canvas. The live photo-avatar option accepts a PNG, JPEG, or WebP cartoon portrait and animates a calibrated mouth from the local microphone volume envelope. It does not upload the portrait or run a speech model, and its mouth motion is approximate rather than phoneme/word-accurate. The face-tracked vector avatar loads MediaPipe only when selected; image segmentation loads only when a segmentation background is selected.

Accuracy varies with the recording, accent, background noise, and code-switching. Review generated captions before publishing.

Copy `.env.example` to `.env.local` and configure the Supabase URL/publishable key to enable registration and protected studio access. Set `GEMINI_API_KEY` for AI scripts, reel captions, dubbing, and voiceovers; set `OPENAI_API_KEY` for Whisper transcription. These provider keys stay on the server.

## Local projects and free plan

Saved editor projects and photo/video reel drafts are stored in IndexedDB on the current browser/device; they are not synced to an account or another device. The current free-plan prototype adds a visible watermark and limits recordings/exports to 60 seconds. Payments and paid-plan entitlements are not enabled.

Profile names, unique usernames, profile pictures, and passwords can be managed from the account menu. Supabase Auth identifies users, but account-backed project sync is not implemented. Billing uses Razorpay Subscriptions: checkout is created server-side, activation is confirmed by a signed payment check, and the signed `/api/billing/webhook` keeps status in sync. Set the `RAZORPAY_*` and `SUPABASE_SERVICE_ROLE_KEY` variables from `.env.example` and run the Supabase migrations to enable it.

## Creator feedback

The home screen includes an optional rating/comment form. Set `CREATOR_FEEDBACK_WEBHOOK_URL` on the server to deliver responses to a configured collection endpoint. The form does not attach video or account data. A small pilot can share a test URL with 5–10 creators, ask them to try recording, script generation, and editing, and use this form to collect qualitative feedback; recruit participants and configure the webhook before claiming user testing is complete.
