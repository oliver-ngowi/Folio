-- Run this in the Supabase SQL editor (or `supabase db push`).
-- Users sign in with email + password (Authentication -> Providers -> Email).

create table if not exists public.folders (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  color      text not null
);

create table if not exists public.notes (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  folder_id  uuid references public.folders on delete set null,
  title      text not null default '',
  content    text not null default '',
  pinned     boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

-- Notes vs journal entries vs tasks. Safe to re-run on an existing database.
alter table public.notes add column if not exists kind   text    not null default 'note'
  check (kind in ('note', 'journal', 'task'));
alter table public.notes add column if not exists date   date;       -- journal day / task due date
alter table public.notes add column if not exists "time" text;       -- task due time, 'HH:mm'
alter table public.notes add column if not exists done   boolean not null default false;
alter table public.notes add column if not exists remind integer;    -- task reminder, minutes before due
alter table public.notes add column if not exists mood   text;       -- journal mood

create table if not exists public.attachments (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  note_id    uuid not null references public.notes on delete cascade,
  kind       text not null check (kind in ('image', 'audio')),
  name       text not null,
  size       bigint not null,
  duration   real,
  created_at timestamptz not null
);

create index if not exists notes_user_idx on public.notes (user_id);
create index if not exists attachments_note_idx on public.attachments (note_id);

alter table public.folders     enable row level security;
alter table public.notes       enable row level security;
alter table public.attachments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['folders', 'notes', 'attachments'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Private storage bucket for photos / voice notes, namespaced by user id.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "own files" on storage.objects;
create policy "own files" on storage.objects for all to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
