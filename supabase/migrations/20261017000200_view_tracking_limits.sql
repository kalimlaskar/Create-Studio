-- Abuse limits for viewer analytics (/api/track). Run after 20261017000000_video_sharing.sql.
-- ip_hash is a salted SHA-256 of the viewer's IP address, used only to rate-limit
-- new sessions per network. The raw IP address is never stored.

alter table public.view_sessions add column if not exists ip_hash text check (char_length(ip_hash) <= 64);

create index if not exists view_sessions_ip_recent_idx on public.view_sessions (ip_hash, started_at desc);
create index if not exists view_sessions_viewer_recent_idx on public.view_sessions (video_id, viewer_key, last_seen_at desc);
