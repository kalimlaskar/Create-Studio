# Cliprame architecture and creator flow

Cliprame is a browser-based creator studio built with Next.js App Router. The diagrams below describe the current implementation; in particular, saved projects are device-local and are not synchronized to user accounts.

## Architecture

```mermaid
flowchart LR
    creator[Creator browser]

    subgraph next[Next.js application]
        pages[App Router pages<br/>home · login · signup · pricing · studio]
        studio[Creator studio UI<br/>recording · photo reels]
        editor[Video editor<br/>timeline · captions · audio · overlays]
        browserWork[Browser media work<br/>capture · canvas render · export]
        localData[IndexedDB<br/>video editor and photo reel drafts]
        authActions[Server actions<br/>sign in · sign up · profile · sign out]
        api[Server API routes<br/>transcribe · script · caption · dub · feedback]
        billingApi[Billing API routes<br/>subscribe · verify · cancel · webhook · plan]
        sessionCheck[Session and claims checks]
        planCheck[Plan and usage checks]
    end

    subgraph supabase[Supabase]
        auth[Supabase Auth]
        profiles[(profiles table<br/>row-level security)]
        avatars[(profile-avatars<br/>storage bucket)]
        billingData[(subscriptions and<br/>AI usage tables)]
    end

    subgraph providers[External services]
        gemini[Google Gemini<br/>transcription · text · speech]
        razorpay[Razorpay Subscriptions]
        feedback[Configured feedback webhook]
    end

    subgraph onDevice[In-browser models]
        mediapipe[MediaPipe<br/>segmentation · hand tracking]
        depth[Depth Anything<br/>via transformers.js]
        ffmpeg[ffmpeg.wasm<br/>MP4 conversion]
    end

    creator --> pages
    creator <--> studio
    studio --> editor
    studio --> browserWork
    editor --> browserWork
    browserWork <--> localData
    browserWork --> onDevice
    studio <--> localData

    pages --> authActions
    authActions --> auth
    authActions --> profiles
    authActions --> avatars
    pages --> sessionCheck
    sessionCheck --> auth
    studio --> api
    editor --> api
    api --> sessionCheck
    api --> planCheck
    planCheck --> billingData
    api --> gemini
    api --> feedback
    pages --> billingApi
    billingApi --> sessionCheck
    billingApi <--> razorpay
    billingApi --> billingData
```

### Data and service boundaries

- The Next.js app serves the public pages and the protected studio. Supabase sessions are checked on the server for studio access and AI routes. A separately configured temporary demo session can also unlock the studio.
- Supabase Auth owns user identity. The `profiles` table stores display names and unique usernames, and restricts reads and updates to the authenticated owner with row-level security. Profile pictures live in the `profile-avatars` storage bucket.
- Camera, microphone, and optional display capture happen in the browser. Background segmentation, hand tracking (MediaPipe), depth estimation (Depth Anything via transformers.js), and MP4 conversion (ffmpeg.wasm) also run on the device. Depth maps are cached in IndexedDB.
- Video and photo-reel rendering/export use browser media and canvas APIs.
- Video-editor drafts (including source video and music blobs) and photo-reel drafts (including clip, music, and voiceover blobs) are stored in separate IndexedDB databases on the current browser/device. They are not account-backed or synchronized.
- `/api/transcribe`, `/api/generate-script`, `/api/generate-reel-caption`, and `/api/dub` all call Google Gemini. Provider credentials remain server-side, and these routes require an authenticated Supabase session.
- Usage limits are enforced before each AI call and refunded if the call fails. Transcription and voiceover use monthly minutes that depend on the user's plan (`lib/plans/server.ts`). Script and reel-caption generation use daily request credits (`lib/supabase/ai-quota.ts`).
- `/api/feedback` forwards a rating and comment to the configured webhook. It does not attach video or account data.
- Billing uses Razorpay Subscriptions. The server creates the subscription, verifies the checkout signature, and records status from signed Razorpay webhooks, which are the source of truth for the plan. The `subscriptions` table is written only with the service-role key.
- Plans (`components/pricing/planLimits.ts`): Free (1-minute exports with a watermark), Creator ($15/month: 5-minute exports, no watermark), and Studio ($35/month: 15-minute exports, no watermark). Each plan also sets monthly transcription and voiceover minutes.

## Creator flow

```mermaid
flowchart TD
    start([Open Cliprame]) --> landing[View product page]
    landing --> authChoice{Sign in or create account?}
    authChoice -->|Sign in| signin[Sign in with Supabase]
    authChoice -->|Create account| signup[Create Supabase account]
    signin --> session{Valid session?}
    signup --> emailCheck{Email confirmation<br/>required?}
    emailCheck -->|Yes| confirm[Confirm email, then sign in]
    emailCheck -->|No| session
    confirm --> session
    session -->|No| landing
    session -->|Yes| studio[Open creator studio]

    studio --> choose{Choose a creation mode}
    choose -->|Record video| setup[Set up camera, microphone,<br/>script and recording options]
    setup --> capture[Record camera video<br/>and optionally share a screen]
    capture --> review[Review the recording]
    review --> edit[Open video editor]
    edit --> editWork[Adjust timeline, captions,<br/>audio, overlays and visual style]
    editWork --> transcriptionChoice{Generate word-timed captions?}
    transcriptionChoice -->|Yes| transcribe[Send source audio to Gemini<br/>through the server API]
    transcriptionChoice -->|No| saveVideo{Save a local draft?}
    transcribe --> editWork
    saveVideo -->|Yes| videoDraft[Save video and project<br/>to browser IndexedDB]
    saveVideo -->|No| exportVideo[Render and download video]
    videoDraft --> exportVideo
    exportVideo --> moreVideo{Continue editing?}
    moreVideo -->|Yes| editWork
    moreVideo -->|No| choose

    choose -->|Create photo reel| reel[Add photos and short clips]
    reel --> styleReel[Arrange clips and set timing,<br/>text, motion, transitions and style]
    styleReel --> optionalAI{Use optional AI tools?}
    optionalAI -->|Generate caption| caption[Request caption from<br/>Gemini via server API]
    optionalAI -->|Generate voiceover| voice[Request translation and speech<br/>from Gemini via server API]
    optionalAI -->|Skip| reelReady[Review reel]
    caption --> reelReady
    voice --> reelReady
    reelReady --> saveReel{Save a local draft?}
    saveReel -->|Yes| reelDraft[Save reel assets and settings<br/>to browser IndexedDB]
    saveReel -->|No| exportReel[Render and download reel]
    reelDraft --> exportReel
    exportReel --> moreReel{Create another reel?}
    moreReel -->|Yes| reel
    moreReel -->|No| choose
```

### Sharing a hosted video

```mermaid
sequenceDiagram
    participant C as Creator browser
    participant S as Next.js API
    participant R as Cloudflare R2
    participant D as Supabase
    participant V as Viewer browser
    C->>C: Convert WebM to MP4, read duration, grab poster
    C->>S: POST /api/videos
    S->>D: Insert video (uploading)
    S-->>C: Presigned PUT URLs
    C->>R: Upload video and poster
    C->>S: POST /api/videos/:id/complete
    S->>R: HEAD check
    S->>D: Mark ready, create default share link
    V->>S: GET /v/:slug
    S->>D: Look up link and video (service role)
    S-->>V: Share page with presigned playback URL
    V->>R: Stream the video
    V->>S: POST /api/track (seconds played, events)
    S->>D: Upsert view session, insert events
    C->>S: Open /studio/videos/:id
    S->>D: Read sessions and events (row-level security)
    S-->>C: Retention, chapters, viewers
```

### Upgrading a plan

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Next.js API
    participant R as Razorpay
    participant D as Supabase
    B->>S: POST /api/billing/subscribe (plan)
    S->>R: Create subscription
    S->>D: Upsert subscription (status created)
    S-->>B: Subscription ID and key ID
    B->>R: Razorpay Checkout
    R-->>B: Payment ID and signature
    B->>S: POST /api/billing/verify
    S->>D: Mark authenticated if signature matches
    R->>S: Signed subscription.* webhook
    S->>D: Update status and period end
    B->>S: GET /api/plan
    S-->>B: Effective plan and monthly usage
```

### Optional AI steps

While signed in, the editor can send captured source audio to `/api/transcribe` for word-timed captions. The teleprompter can request a script from `/api/generate-script`; photo reels can request a caption from `/api/generate-reel-caption` or translated speech from `/api/dub`. The server validates each request and calls the configured provider; results return to the browser for review and editing.
