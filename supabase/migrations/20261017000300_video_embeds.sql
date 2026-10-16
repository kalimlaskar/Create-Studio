-- Embedding videos on other websites (/embed/<link> and /embed.js).
-- Run after 20261017000200_view_tracking_limits.sql.

alter table public.videos
    -- Owners can switch embedding off for a video; share links keep working.
    add column if not exists embed_enabled boolean not null default true,
    -- Paid plans can limit embedding to these websites (host names). Empty means anywhere.
    add column if not exists embed_domains text[] not null default '{}';

alter table public.view_sessions
    -- Where the view happened: the share page, or a video embedded on another website.
    add column if not exists source text not null default 'share' check (source in ('share', 'embed')),
    -- For embeds, the website the video was embedded on (host name only, never the full URL).
    add column if not exists referrer_host text check (char_length(referrer_host) <= 253);
