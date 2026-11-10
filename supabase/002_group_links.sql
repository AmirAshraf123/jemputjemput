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

-- ─────────────────────────────────────────────────────────────
-- Group links and duplicate flags
-- ─────────────────────────────────────────────────────────────
-- Each invitation can have one shareable group link (off until the couple turns it on).
alter table public.invitations
  add column if not exists group_token     text unique default replace(gen_random_uuid()::text, '-', ''),
  add column if not exists group_enabled   boolean not null default false,
  add column if not exists group_max_seats int not null default 2 check (group_max_seats between 1 and 20);

-- Where each guest came from, and a flag when a group reply looks like someone already on the list.
alter table public.guests
  add column if not exists source     text not null default 'personal' check (source in ('personal','group')),
  add column if not exists phone_norm text not null default '',
  add column if not exists dup_of     uuid references public.guests(id) on delete set null,
  add column if not exists dup_reason text not null default '';
create index if not exists guests_phone_idx on public.guests(invitation_id, phone_norm);

-- Phone numbers are compared as digits only; 8-digit Singapore numbers get +65 in front.
create or replace function public.norm_phone(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if length(d) = 8 then d := '65' || d; end if;
  return d;
end $$;

create or replace function public.guests_set_phone_norm() returns trigger
language plpgsql as $$ begin new.phone_norm := public.norm_phone(new.phone); return new; end $$;
drop trigger if exists guests_phone_norm on public.guests;
create trigger guests_phone_norm before insert or update of phone on public.guests
  for each row execute function public.guests_set_phone_norm();
update public.guests set phone_norm = public.norm_phone(phone) where phone_norm = '' and phone <> '';


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
-- They can only call these functions, with their own code or a group link.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_invite(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'invitation', jsonb_build_object('template', i.template, 'details', i.details, 'style', i.style, 'photo', i.photo),
    'guest',      jsonb_build_object('name', g.name,
                                     'seats', case when g.source = 'group' then i.group_max_seats else g.seats end,
                                     'status', g.status, 'coming', g.coming, 'dietary', g.dietary, 'note', g.note))
  from public.guests g
  join public.invitations i on i.id = g.invitation_id
  where g.token = p_token;
$$;

create or replace function public.submit_rsvp(p_token text, p_status text, p_coming int, p_dietary text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.guests; v_max int;
begin
  if p_status not in ('yes','no') then
    raise exception 'Please choose accept or decline';
  end if;
  select case when gu.source = 'group' then i.group_max_seats else gu.seats end into v_max
    from public.guests gu join public.invitations i on i.id = gu.invitation_id where gu.token = p_token;
  if not found then
    raise exception 'Invitation not found';
  end if;
  update public.guests set
    status       = p_status,
    coming       = case when p_status = 'yes' then greatest(1, least(coalesce(p_coming, 1), v_max)) else 0 end,
    seats        = case when source = 'group' then greatest(1, least(coalesce(p_coming, 1), v_max)) else seats end,
    dietary      = case when p_status = 'yes' then left(coalesce(p_dietary, ''), 200) else '' end,
    note         = left(coalesce(p_note, ''), 500),
    responded_at = now()
  where token = p_token
  returning * into g;
  return jsonb_build_object('name', g.name, 'seats', v_max, 'status', g.status,
                            'coming', g.coming, 'dietary', g.dietary, 'note', g.note);
end $$;

-- ─────────────────────────────────────────────────────────────
-- Group link functions
-- ─────────────────────────────────────────────────────────────
-- Shows the invitation for a group link, only while the couple has it turned on.
create or replace function public.get_group_invite(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'invitation', jsonb_build_object('template', i.template, 'details', i.details, 'style', i.style, 'photo', i.photo),
    'max_seats',  i.group_max_seats)
  from public.invitations i
  where i.group_token = p_token and i.group_enabled;
$$;

-- Records a reply from a group link.
--  • Same WhatsApp number already replied through this group link → that reply is updated, no new row.
--  • Same number as someone on the personal list → a new row, flagged as a possible duplicate.
--    (A group reply can never change a personal guest's reply.)
--  • Same name as someone already on the list → a new row, flagged as a possible duplicate.
-- Returns a personal code so the guest's phone can show and change their reply later.
create or replace function public.submit_group_rsvp(p_token text, p_name text, p_phone text, p_status text,
                                                    p_coming int, p_dietary text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  i public.invitations; g public.guests; m public.guests;
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_phone text := public.norm_phone(p_phone);
  v_coming int; v_updated boolean := false; v_count int;
begin
  select * into i from public.invitations where group_token = p_token and group_enabled;
  if not found then raise exception 'Invitation not found'; end if;
  if p_status not in ('yes','no') then raise exception 'Please choose accept or decline'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then raise exception 'Please enter your name'; end if;
  if length(v_phone) < 8 or length(v_phone) > 15 then raise exception 'Please enter your WhatsApp number'; end if;
  v_coming := case when p_status = 'yes' then greatest(1, least(coalesce(p_coming, 1), i.group_max_seats)) else 0 end;

  select * into g from public.guests
    where invitation_id = i.id and source = 'group' and phone_norm = v_phone
    order by created_at limit 1;

  if found then
    update public.guests set
      name = v_name, status = p_status, coming = v_coming, seats = greatest(1, v_coming),
      dietary = case when p_status = 'yes' then left(coalesce(p_dietary, ''), 200) else '' end,
      note = left(coalesce(p_note, ''), 500), responded_at = now()
    where id = g.id returning * into g;
    v_updated := true;
  else
    select count(*) into v_count from public.guests where invitation_id = i.id and source = 'group';
    if v_count >= 500 then raise exception 'This group link has reached its limit. Please contact the couple.'; end if;

    select * into m from public.guests
      where invitation_id = i.id and phone_norm = v_phone order by created_at limit 1;
    if found then
      g.dup_of := m.id; g.dup_reason := 'Same number as ' || m.name;
    else
      select * into m from public.guests
        where invitation_id = i.id
          and lower(regexp_replace(name, '\s+', '', 'g')) = lower(regexp_replace(v_name, '\s+', '', 'g'))
        order by created_at limit 1;
      if found then g.dup_of := m.id; g.dup_reason := 'Same name as ' || m.name; end if;
    end if;

    insert into public.guests (invitation_id, name, phone, seats, side, status, coming, dietary, note,
                               responded_at, source, dup_of, dup_reason)
    values (i.id, v_name, left(btrim(coalesce(p_phone, '')), 40), greatest(1, v_coming), 'Both', p_status, v_coming,
            case when p_status = 'yes' then left(coalesce(p_dietary, ''), 200) else '' end,
            left(coalesce(p_note, ''), 500), now(), 'group', g.dup_of, coalesce(g.dup_reason, ''))
    returning * into g;
  end if;

  return jsonb_build_object('token', g.token, 'updated', v_updated, 'name', g.name, 'seats', i.group_max_seats,
                            'status', g.status, 'coming', g.coming, 'dietary', g.dietary, 'note', g.note);
end $$;

revoke all on function public.get_invite(text) from public;
revoke all on function public.submit_rsvp(text, text, int, text, text) from public;
revoke all on function public.get_group_invite(text) from public;
revoke all on function public.submit_group_rsvp(text, text, text, text, int, text, text) from public;
grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, text, int, text, text) to anon, authenticated;
grant execute on function public.get_group_invite(text) to anon, authenticated;
grant execute on function public.submit_group_rsvp(text, text, text, text, int, text, text) to anon, authenticated;

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
