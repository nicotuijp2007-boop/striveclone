-- One row per user holding all of their Liftlog data as JSON.
-- `rev` increases on every write; the app only writes when it has seen the latest rev,
-- so two devices saving at once can't overwrite each other.

create table if not exists public.user_data (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb       not null,
  rev        bigint      not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- Each signed-in user can only see and change their own row.
create policy "Read own data"   on public.user_data for select to authenticated using (auth.uid() = user_id);
create policy "Create own data" on public.user_data for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own data" on public.user_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own data" on public.user_data for delete to authenticated using (auth.uid() = user_id);

create or replace function public.user_data_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists user_data_touch on public.user_data;
create trigger user_data_touch before update on public.user_data
  for each row execute function public.user_data_touch();
