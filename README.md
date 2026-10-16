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
4. Apply every file in [`supabase/migrations/`](./supabase/migrations) in order (SQL Editor, or `supabase db push`):
   - `20261006000000_create_profiles.sql`: profiles table, created automatically for new users
   - `20261007000000_ai_usage_limits.sql`: daily AI request credits
   - `20261007000100_billing_subscriptions.sql`: subscriptions table and Pro checks
   - `20261007000200_account_profile_settings.sql`: unique usernames and the `profile-avatars` storage bucket
5. Restart `npm run dev`, then create an account at **Sign up**.

> **Schema not yet in migrations:** monthly plan usage (`lib/plans/server.ts`) needs an `ai_minutes_usage` table and `consume_ai_seconds` / `refund_ai_seconds` functions. The alternative webhook at `/api/razorpay/webhook` also writes to `payments` and `razorpay_events` tables and to extra `subscriptions` columns. None of these are created by the migrations in this repo, so add them before relying on transcription/voiceover limits or on that webhook.

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

## Local drafts

Saved editor projects and photo-reel drafts, including their video, music and voiceover files, are stored in IndexedDB on the current browser/device. They are not synced to the account or to other devices.

## Effects

Comic, pencil sketch, pixel and anime looks are processed locally on a small working canvas. The live photo-avatar option accepts a PNG, JPEG or WebP cartoon portrait and animates a mouth from the local microphone volume. It does not upload the portrait or run a speech model, so mouth motion is approximate. MediaPipe models load only when an effect that needs them is selected.

## Browser extension

[`extension/`](./extension) contains **Cliprame Recorder**, a Chrome extension that records a browser tab with a camera bubble and microphone. It can mask private data on the page (picked elements, emails, phone and card numbers, API keys, PAN and Aadhaar numbers, custom words and form fields) before the data reaches the recording. Finished recordings open in the studio through `/studio?import=extension&recording=<id>`. See [extension/README.md](./extension/README.md) to load it and for how masking works.

## Creator feedback

The home screen includes an optional rating and comment form. Set `CREATOR_FEEDBACK_WEBHOOK_URL` to deliver responses to your own collection endpoint. The form does not attach video or account data.

## Scripts

- `npm run dev`: start the development server
- `npm run build`: production build
- `npm run start`: serve the production build
- `npm run lint`: run ESLint
