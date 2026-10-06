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
        sessionCheck[Session and claims checks]
    end

    subgraph supabase[Supabase]
        auth[Supabase Auth]
        profiles[(profiles table<br/>row-level security)]
    end

    subgraph providers[External services]
        openai[OpenAI Whisper]
        gemini[Google Gemini<br/>text and speech]
        feedback[Configured feedback webhook]
    end

    creator --> pages
    creator <--> studio
    studio --> editor
    studio --> browserWork
    editor --> browserWork
    browserWork <--> localData
    studio <--> localData

    pages --> authActions
    authActions --> auth
    authActions --> profiles
    pages --> sessionCheck
    sessionCheck --> auth
    studio --> api
    editor --> api
    api --> sessionCheck
    api --> openai
    api --> gemini
    api --> feedback
```

### Data and service boundaries

- The Next.js app serves the public pages and the protected studio. Supabase sessions are checked on the server for studio access and AI routes. A separately configured temporary demo session can also unlock the studio.
- Supabase Auth owns user identity. The `profiles` table stores display names and restricts reads and updates to the authenticated owner with row-level security.
- Camera, microphone, and optional display capture happen in the browser. Video and photo-reel rendering/export use browser media and canvas APIs.
- Video-editor drafts (including source video and music blobs) and photo-reel drafts (including clip, music, and voiceover blobs) are stored in separate IndexedDB databases on the current browser/device. They are not account-backed or synchronized.
- `/api/transcribe` forwards audio to OpenAI Whisper. `/api/generate-script`, `/api/generate-reel-caption`, and `/api/dub` call Google Gemini. Provider credentials remain server-side; these routes require an authenticated session (Supabase, or a demo session when demo auth is enabled and Supabase is not configured).
- `/api/feedback` forwards a rating and comment to the configured webhook. It does not attach video or account data.
- The prototype has no configured billing or paid-plan entitlement flow. Recording and exports currently have a 60-second free limit and a watermark.

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
    transcriptionChoice -->|Yes| transcribe[Send source audio to Whisper<br/>through the server API]
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

### Optional AI steps

While signed in, the editor can send captured source audio to `/api/transcribe` for word-timed captions. The teleprompter can request a script from `/api/generate-script`; photo reels can request a caption from `/api/generate-reel-caption` or translated speech from `/api/dub`. The server validates each request and calls the configured provider; results return to the browser for review and editing.
