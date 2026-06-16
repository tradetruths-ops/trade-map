-- Run this once in the Supabase SQL Editor.
-- Stores admin-managed Daily Levels, Stock List, and Calendar data
-- as shared JSON blobs so all subscribers see the same data,
-- instead of each admin edit being stuck in their own browser's localStorage.

create table if not exists public.app_data (
  key text primary key,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

create policy "Public read app_data"
  on public.app_data for select
  using (true);

-- No insert/update/delete policy for anon/authenticated — all writes go
-- through api/app-data.js using the service role key, gated by ADMIN_API_PASSWORD.
