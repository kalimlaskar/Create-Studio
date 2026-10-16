# Cliprame

Cliprame is a browser-based creator studio for recording lessons, presentations and screen walkthroughs, editing them, and building short photo/video reels. It is built with Next.js (App Router), Supabase, Gemini and Razorpay.

See [the architecture and creator-flow diagrams](./docs/architecture.md) for the app components, service boundaries, and end-to-end creation paths.

## Features

- **Recording studio**: camera, microphone and optional screen capture, a floating picture-in-picture camera, a teleprompter with AI-generated scripts, background effects, artistic and hologram looks, and hand-tracked "air drawing" annotations.
- **Video editor**: timeline trimming and cuts, speed, zoom, colour grading, style presets, transitions, text overlays, music, word-timed captions, transcript-based editing, and a Delivery Coach that finds filler words and pauses.
- **Photo Reel Studio**: templates, motion and transitions, depth-based camera moves (dolly, orbit, sway), AI on-screen captions, and AI voiceovers in multiple languages.
- **Accounts and plans**: Supabase sign-up and sign-in (password or one-time email code), profile settings, and Free/Creator/Studio subscriptions billed through Razorpay.
- **Installable PWA** with a service worker.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the public product page. Create an account or sign in to open `/studio`.

## Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Supabase publishable key |
| `NEXT_PUBLIC_SITE_URL` | Public | Site origin, used to build auth email links |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Public | Optional support address shown in the UI |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Service-role key for billing and plan usage. Never expose it. |
| `GEMINI_API_KEY` | Server | All AI features: transcription, scripts, reel captions, translation and voiceover |
| `AI_DAILY_LIMIT` / `AI_PRO_DAILY_LIMIT` | Server | Daily request caps for AI scripts and reel captions (defaults 12 and 200) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Server | Razorpay API credentials |
| `RAZORPAY_PLAN_ID_CREATOR` / `RAZORPAY_PLAN_ID_STUDIO` | Server | Razorpay plan IDs for the paid plans. `RAZORPAY_PLAN_ID` is still accepted as a fallback for Creator. |
| `RAZORPAY_WEBHOOK_SECRET` | Server | Verifies Razorpay webhook signatures |
| `CREATOR_FEEDBACK_WEBHOOK_URL` | Server | Optional endpoint that receives in-app feedback |
| `TEMP_AUTH_ENABLED`, `TEMP_AUTH_USERNAME`, `TEMP_AUTH_PASSWORD`, `TEMP_AUTH_SECRET` | Server | Optional local tester login (see below) |

Only the Supabase URL and publishable key belong in `NEXT_PUBLIC_` variables. All provider keys stay on the server.

## Supabase setup

1. Create a Supabase project and copy its Project URL and **publishable** key into `.env.local`. Copy the service-role key into `SUPABASE_SERVICE_ROLE_KEY`.
2. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` locally and your deployed HTTPS origin in production. In Supabase Authentication URL Configuration, set the matching Site URL and add the origin plus `/auth/callback` to Redirect URLs.
3. Configure Supabase Auth email templates and delivery. For numeric sign-in codes, the **Magic Link** template must include `{{ .Token }}`. Configure SMTP before production use so confirmation and login emails are delivered reliably.
4. Apply every file in [`supabase/migrations/`](./supabase/migrations) in filename order (SQL Editor, or `supabase db push`):
   - `20261006000000_create_profiles.sql`: profiles table, created automatically for new users
   - `20261007000000_ai_usage_limits.sql`: daily AI request credits
   - `20261007000100_billing_subscriptions.sql`: subscriptions table
   - `20261007000200_account_profile_settings.sql`: unique usernames and the `profile-avatars` storage bucket
   - `20261017000000_video_sharing.sql`: hosted videos, share links and viewer analytics
   - `20261017000100_billing_and_usage.sql`: payments, webhook event log, monthly AI minutes, and the shared "is paying" rule
   - `20261017000200_view_tracking_limits.sql`: abuse limits for viewer analytics
5. Restart `npm run dev`, then create an account at **Sign up**.

Profile reads and updates are restricted to the owner by row-level security. Subscription rows can be read by their owner and are written only on the server with the service-role key.

### Temporary tester login

Tester auth is disabled by default and whenever Supabase is configured. To enable it locally, set `TEMP_AUTH_ENABLED=true` and provide private `TEMP_AUTH_USERNAME` and `TEMP_AUTH_PASSWORD` values. Production also requires a random `TEMP_AUTH_SECRET` of at least 32 characters. Do not use shared tester credentials for real users.

## AI features

All AI routes require a signed-in user and call Google Gemini from the server.

| Route | What it does | Limit |
|---|---|---|
| `/api/transcribe` | Word-timed captions from source audio (Auto, English, Hindi, Hinglish). Audio up to about 14 MB. | Monthly transcription minutes per plan |
| `/api/dub` | Translates text and generates a voiceover (English, Hindi, Bengali, Tamil, Telugu; male or female voice) | Monthly voiceover minutes per plan |
| `/api/generate-script` | Teleprompter script (English, Hindi, Hinglish, Bengali, Marathi, Tamil, Telugu) | Daily request credits |
| `/api/generate-reel-caption` | Short on-screen caption for a reel | Daily request credits |

If a metered AI call fails, the minutes or credit it used are refunded. Accuracy varies with the recording, accent, background noise and code-switching, so review generated captions, scripts and voiceovers before publishing.

In-browser models also run on the creator's device: MediaPipe for background segmentation and hand tracking, Depth Anything (via transformers.js) for depth motion in reels, and ffmpeg.wasm for MP4 conversion.

## Plans and billing

Plan limits are defined in [`components/pricing/planLimits.ts`](./components/pricing/planLimits.ts):

| | Free | Creator ($15/mo) | Studio ($35/mo) |
|---|---|---|---|
| Longest export | 1 min | 5 min | 15 min |
| Watermark | Yes | No | No |
| Transcription / month | 10 min | 90 min | 250 min |
| AI voiceover / month | 2 min | 30 min | 100 min |

Billing uses Razorpay Subscriptions:

1. `/api/billing/subscribe` creates the subscription on the server and returns its ID for Razorpay Checkout.
2. `/api/billing/verify` checks the checkout signature against the stored subscription ID. It does not grant the plan.
3. A signed Razorpay webhook updates the subscription status. That webhook is the source of truth. Point Razorpay at `https://<your-domain>/api/billing/webhook` and subscribe to the `subscription.*` events.
4. `/api/billing/cancel` cancels at the end of the billing cycle. The user keeps their plan until the paid period ends.
5. `/api/plan` returns the user's current plan and this month's usage.

### How plans are enforced

- **One source of truth.** A user's plan is read on the server from the `subscriptions` row (`lib/plans/server.ts`, `getEffectivePlan`), using one rule in `lib/plans/entitlement.ts`. The same rule is `public.is_pro()` in SQL. The browser never decides the plan.
  - **Paid:** `active` or `authenticated`.
  - **Paid until the period ends:** `pending` (payment retrying) or `cancelled`.
  - **Free:** everything else.
- **Limits checked on the server too.**
  - **Upload requests:** `/api/videos` rejects videos longer than the plan's export length, files above the plan's size cap, and accounts over their hosted-video count.
  - **Uploaded files:** `/api/videos/:id/complete` reads the real length from the uploaded MP4's header and deletes files that break the limits.
  - **AI minutes:** counted atomically in the database.
- **Known limit:** the watermark is drawn in the browser while rendering, so a determined user could remove it from a downloaded file. Hosted videos are still limited by length, size and count.
- **One webhook.** `/api/billing/webhook` and `/api/razorpay/webhook` run the same handler (`lib/billing/webhook.ts`). It verifies the signature, processes each event once, updates the subscription and records successful charges in `payments`.
- **Account deletion** cancels any active subscription, deletes hosted video files and the profile photo, then deletes the user (rows cascade).

## Operations

- **Health check:** `GET /api/health` returns 200 when the database answers and storage is configured, otherwise 503. Point an uptime monitor or status page (for example Better Stack or UptimeRobot) at it.
- **Cleanup:** `GET /api/cron/cleanup` (daily via `vercel.json`, authorised with `Authorization: Bearer $CRON_SECRET`) deletes uploads stuck in "uploading" for over 24 hours, with their R2 files, and webhook event IDs older than 90 days.
- **Error monitoring:** set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` to turn on Sentry (`instrumentation.ts`, `instrumentation-client.ts`). It runs without IP addresses or cookies. Add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` to upload source maps.
- **Product analytics:** set `NEXT_PUBLIC_POSTHOG_KEY` to turn on PostHog. It tracks page views and a few product events (`lib/analytics.ts`), respects Do Not Track, and never runs on `/v/` share pages.
- **Viewer analytics abuse limits** (`lib/videos/tracking.ts`):
  - Link previews and bots are ignored.
  - Reopening a video within 30 minutes continues the same session.
  - Each network (stored only as a salted hash) can create at most 60 new sessions an hour.
  - Watch time can't grow faster than real time.
  - Viewers with Global Privacy Control or Do Not Track aren't tracked.
- **Tests:** `npm test` runs Vitest (`tests/`). The tests cover the paid-access rule, the Razorpay webhook (signatures, retries, replaced subscriptions), upload limits and MP4 length, fake-view limits, analytics, chapters and the R2 signer.

## Legal pages

`/privacy`, `/terms` and `/dpa` describe what the app actually does with data, and are linked from the home page footer, sign-in and sign-up, and share pages. They are a starting draft: **have a lawyer review them before launch**, then set `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_SUPPORT_EMAIL` and `NEXT_PUBLIC_GRIEVANCE_OFFICER`. Update the subprocessor list in `components/legal/LegalPage.tsx` if your hosting or providers change.

## Local drafts

Saved editor projects and photo-reel drafts, including their video, music and voiceover files, are stored in IndexedDB on the current browser/device. They are not synced to the account or to other devices.

## Effects

Comic, pencil sketch, pixel and anime looks are processed locally on a small working canvas. The live photo-avatar option accepts a PNG, JPEG or WebP cartoon portrait and animates a mouth from the local microphone volume. It does not upload the portrait or run a speech model, so mouth motion is approximate. MediaPipe models load only when an effect that needs them is selected.

## Video hosting, share links and analytics

Creators upload videos at `/studio/videos` and share them through `/v/<link>` pages. These pages have chapters, a call-to-action button and viewer analytics, similar to Vidyard or Loom.

- **Storage:** videos and poster images go straight from the browser to a private Cloudflare R2 bucket through short-lived presigned URLs (`lib/storage/r2.ts`, AWS Signature V4 with no SDK). WebM recordings are converted to MP4 in the browser first, so they seek properly and play on iPhone.
- **Share links:** each video has an "anyone with the link" URL. Creators can also make a **personal link** per recipient (name, email, company), so views are attributed to that person. "For email" copies a thumbnail with a play button (`/v/<link>/thumbnail`) and a link, ready to paste into Gmail or Outlook. Links can be turned off at any time.
- **Chapters and button:** chapters are set per video and shown on the share page for jumping. An optional button (for example "Book a demo") links to any https URL.
- **Analytics:** the share page reports which seconds were played, and how often, plus play, pause, seek, chapter and button events, to `/api/track`. The video page shows plays, unique viewers, average watched, completion, button clicks, an audience retention chart with chapter markers, per-chapter reach and rewatch rates, and a per-viewer list. That list shows what each person focused on or skipped and their activity timeline. The creator's own views are not counted.

### Setup

1. Create a **private** R2 bucket and an API token with Object Read & Write on it. Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET` to `.env.local`.
2. Add a CORS policy to the bucket so browsers can upload and play files:
   ```json
   [{ "AllowedOrigins": ["http://localhost:3000", "https://www.cliprame.com"], "AllowedMethods": ["GET", "PUT", "HEAD"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```
3. Apply `supabase/migrations/20261017000000_video_sharing.sql`. It adds `videos`, `share_links`, `view_sessions` and `view_events` with row-level security. Tracking writes use `SUPABASE_SERVICE_ROLE_KEY`.

Notes: uploads are limited to 2 GB. Viewers are identified by a random key stored in their browser, never by account. The share page tells viewers that the sender can see how the video is watched. `/api/track` accepts anonymous reports, so view counts can be inflated by someone determined to. Add rate limiting before relying on the numbers for billing.

## Browser extension

[`extension/`](./extension) contains **Cliprame Recorder**, a Chrome extension that records a browser tab with a camera bubble and microphone. It can mask private data on the page (picked elements, emails, phone and card numbers, API keys, PAN and Aadhaar numbers, custom words and form fields) before the data reaches the recording. Finished recordings open in the studio through `/studio?import=extension&recording=<id>`. See [extension/README.md](./extension/README.md) to load it and for how masking works.

## Creator feedback

The home screen includes an optional rating and comment form. Set `CREATOR_FEEDBACK_WEBHOOK_URL` to deliver responses to your own collection endpoint. The form does not attach video or account data.

## Scripts

- `npm run dev`: start the development server
- `npm run build`: production build
- `npm run start`: serve the production build
- `npm run lint`: run ESLint
