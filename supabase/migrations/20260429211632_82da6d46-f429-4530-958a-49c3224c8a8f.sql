create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text,
  timezone text not null default 'UTC',
  default_reminder_time time not null default '09:00',
  raw_mode_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.writing_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  content text not null,
  raw_mode boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.post_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  note_id uuid references public.writing_notes(id) on delete cascade,
  angle text not null check (angle in ('insight', 'story', 'tactical')),
  title text not null,
  content text not null,
  word_count integer not null default 0,
  quality_flags text[] not null default '{}',
  tags text[] not null default '{}',
  is_selected boolean not null default false,
  selected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  draft_id uuid references public.post_drafts(id) on delete set null,
  note_id uuid references public.writing_notes(id) on delete set null,
  scheduled_for timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'scheduled' check (status in ('scheduled', 'reminded', 'snoozed', 'posted')),
  reminder_sent_at timestamptz,
  follow_up_sent_at timestamptz,
  posted_at timestamptz,
  snoozed_until timestamptz,
  copy_snapshot text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.preference_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  draft_id uuid references public.post_drafts(id) on delete cascade,
  signal_type text not null check (signal_type in ('selected', 'regenerated', 'copied', 'posted')),
  angle text,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_writing_notes_user_created on public.writing_notes(user_id, created_at desc);
create index idx_post_drafts_user_created on public.post_drafts(user_id, created_at desc);
create index idx_post_drafts_note on public.post_drafts(note_id);
create index idx_scheduled_posts_user_schedule on public.scheduled_posts(user_id, scheduled_for asc);
create index idx_scheduled_posts_status_schedule on public.scheduled_posts(status, scheduled_for asc);
create index idx_preference_signals_user_created on public.preference_signals(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.writing_notes enable row level security;
alter table public.post_drafts enable row level security;
alter table public.scheduled_posts enable row level security;
alter table public.preference_signals enable row level security;

create policy "Users can view their own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "Users can create their own profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = user_id);

create policy "Users can view their own notes" on public.writing_notes for select using (auth.uid() = user_id);
create policy "Users can create their own notes" on public.writing_notes for insert with check (auth.uid() = user_id);
create policy "Users can update their own notes" on public.writing_notes for update using (auth.uid() = user_id);
create policy "Users can delete their own notes" on public.writing_notes for delete using (auth.uid() = user_id);

create policy "Users can view their own drafts" on public.post_drafts for select using (auth.uid() = user_id);
create policy "Users can create their own drafts" on public.post_drafts for insert with check (auth.uid() = user_id);
create policy "Users can update their own drafts" on public.post_drafts for update using (auth.uid() = user_id);
create policy "Users can delete their own drafts" on public.post_drafts for delete using (auth.uid() = user_id);

create policy "Users can view their own scheduled posts" on public.scheduled_posts for select using (auth.uid() = user_id);
create policy "Users can create their own scheduled posts" on public.scheduled_posts for insert with check (auth.uid() = user_id);
create policy "Users can update their own scheduled posts" on public.scheduled_posts for update using (auth.uid() = user_id);
create policy "Users can delete their own scheduled posts" on public.scheduled_posts for delete using (auth.uid() = user_id);

create policy "Users can view their own preference signals" on public.preference_signals for select using (auth.uid() = user_id);
create policy "Users can create their own preference signals" on public.preference_signals for insert with check (auth.uid() = user_id);
create policy "Users can delete their own preference signals" on public.preference_signals for delete using (auth.uid() = user_id);

create trigger update_profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();
create trigger update_writing_notes_updated_at before update on public.writing_notes for each row execute function public.update_updated_at_column();
create trigger update_post_drafts_updated_at before update on public.post_drafts for each row execute function public.update_updated_at_column();
create trigger update_scheduled_posts_updated_at before update on public.scheduled_posts for each row execute function public.update_updated_at_column();