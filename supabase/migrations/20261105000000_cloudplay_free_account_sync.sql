-- Cloud Play Iraq — free account library sync
-- Applied to project syscezbzxgnfxftfzaqa as migration "cloudplay_free_account_sync".
-- Free accounts: Supabase Auth + these two tables. No payment/subscription data.
-- Every table is protected by row-level security: a signed-in user can only
-- read/write their own rows (auth.uid() = user_id).

create table if not exists public.cloudplay_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_type text not null check (item_type in ('movie', 'channel')),
  item_id text not null check (char_length(item_id) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

create table if not exists public.cloudplay_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 200),
  position_sec integer not null check (position_sec >= 0),
  duration_sec integer not null check (duration_sec >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists cloudplay_progress_user_updated_idx
  on public.cloudplay_progress (user_id, updated_at desc);

alter table public.cloudplay_favorites enable row level security;
alter table public.cloudplay_progress enable row level security;

-- Favorites: own-row policies
create policy cloudplay_favorites_select_own on public.cloudplay_favorites
  for select to authenticated using (auth.uid() = user_id);
create policy cloudplay_favorites_insert_own on public.cloudplay_favorites
  for insert to authenticated with check (auth.uid() = user_id);
create policy cloudplay_favorites_update_own on public.cloudplay_favorites
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy cloudplay_favorites_delete_own on public.cloudplay_favorites
  for delete to authenticated using (auth.uid() = user_id);

-- Progress: own-row policies
create policy cloudplay_progress_select_own on public.cloudplay_progress
  for select to authenticated using (auth.uid() = user_id);
create policy cloudplay_progress_insert_own on public.cloudplay_progress
  for insert to authenticated with check (auth.uid() = user_id);
create policy cloudplay_progress_update_own on public.cloudplay_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy cloudplay_progress_delete_own on public.cloudplay_progress
  for delete to authenticated using (auth.uid() = user_id);
