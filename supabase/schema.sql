-- Jemput database setup
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- It is safe to run more than once.

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

-- One row per wedding invitation. A person can have several.
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template    text not null default 'songket',
  details     jsonb not null default '{}'::jsonb,   -- names, date, venue, message…
  style       jsonb not null default '{}'::jsonb,   -- fonts, colours, border…
  photo       jsonb,                                -- storage path + position/zoom
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists invitations_owner_idx on public.invitations(owner);

-- One row per guest or household. `token` is the secret in their personal link.
create table if not exists public.guests (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.invitations(id) on delete cascade,
  token          text not null unique default replace(gen_random_uuid()::text, '-', ''),
  name           text not null check (char_length(name) between 1 and 120),
  phone          text not null default '' check (char_length(phone) <= 40),
  seats          int  not null default 2 check (seats between 1 and 50),
  side           text not null default 'Both' check (side in ('Groom','Bride','Both')),
  status         text not null default 'pending' check (status in ('pending','yes','no')),
  coming         int  not null default 0 check (coming >= 0),
  dietary        text not null default '' check (char_length(dietary) <= 200),
  note           text not null default '' check (char_length(note) <= 500),
  responded_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists guests_invitation_idx on public.guests(invitation_id);

-- Templates people save from their own designs.
create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  style       jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists templates_owner_idx on public.templates(owner);

-- Keep invitations.updated_at current.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists invitations_touch on public.invitations;
create trigger invitations_touch before update on public.invitations
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row-level security: signed-in people only ever see their own data
-- ─────────────────────────────────────────────────────────────
alter table public.invitations enable row level security;
alter table public.guests      enable row level security;
alter table public.templates   enable row level security;

drop policy if exists "own invitations" on public.invitations;
create policy "own invitations" on public.invitations for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

drop policy if exists "own guests" on public.guests;
create policy "own guests" on public.guests for all to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and i.owner = (select auth.uid())))
  with check (exists (select 1 from public.invitations i where i.id = invitation_id and i.owner = (select auth.uid())));

drop policy if exists "own templates" on public.templates;
create policy "own templates" on public.templates for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- Guest access. Guests never sign in and never touch the tables directly.
-- They can only call these two functions, and only with their own token.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_invite(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'invitation', jsonb_build_object('template', i.template, 'details', i.details, 'style', i.style, 'photo', i.photo),
    'guest',      jsonb_build_object('name', g.name, 'seats', g.seats, 'status', g.status,
                                     'coming', g.coming, 'dietary', g.dietary, 'note', g.note))
  from public.guests g
  join public.invitations i on i.id = g.invitation_id
  where g.token = p_token;
$$;

create or replace function public.submit_rsvp(p_token text, p_status text, p_coming int, p_dietary text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.guests;
begin
  if p_status not in ('yes','no') then
    raise exception 'Please choose accept or decline';
  end if;
  update public.guests set
    status       = p_status,
    coming       = case when p_status = 'yes' then greatest(1, least(coalesce(p_coming, 1), seats)) else 0 end,
    dietary      = case when p_status = 'yes' then left(coalesce(p_dietary, ''), 200) else '' end,
    note         = left(coalesce(p_note, ''), 500),
    responded_at = now()
  where token = p_token
  returning * into g;
  if not found then
    raise exception 'Invitation not found';
  end if;
  return jsonb_build_object('name', g.name, 'seats', g.seats, 'status', g.status,
                            'coming', g.coming, 'dietary', g.dietary, 'note', g.note);
end $$;

revoke all on function public.get_invite(text) from public;
revoke all on function public.submit_rsvp(text, text, int, text, text) from public;
grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, text, int, text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Live updates: RSVPs appear on the couple's guest list without refreshing
-- ─────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.guests;
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- Photo storage. Anyone with the link can view a photo (guests need to);
-- only the owner can upload or delete, inside their own folder.
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "photos: read own" on storage.objects;
create policy "photos: read own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "photos: upload own" on storage.objects;
create policy "photos: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "photos: update own" on storage.objects;
create policy "photos: update own" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "photos: delete own" on storage.objects;
create policy "photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
