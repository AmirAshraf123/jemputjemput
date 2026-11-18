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
  side           text not null default '' check (char_length(side) <= 40),   -- Groom/Bride/Both for weddings; any group name otherwise
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
  created_at  timestamptz not null default now(),
  is_public    boolean not null default false,                                  -- shared as a community template
  author       text check (author is null or char_length(author) between 1 and 60),   -- the name it's credited to
  published_at timestamptz
);
create index if not exists templates_owner_idx on public.templates(owner);
create index if not exists templates_public_idx on public.templates(published_at desc) where is_public;

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
drop policy if exists "shared templates" on public.templates;
create policy "shared templates" on public.templates for select to authenticated using (is_public);

-- Group-link replies: "Both" for weddings and engagements, no group for anything else.
create or replace function public.default_side(p_details jsonb) returns text
language sql immutable as $$
  select case when coalesce(p_details->>'occasion', 'wedding') in ('wedding', 'engagement') then 'Both' else '' end;
$$;

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
    values (i.id, v_name, left(btrim(coalesce(p_phone, '')), 40), greatest(1, v_coming), public.default_side(i.details), p_status, v_coming,
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
values ('photos', 'photos', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/aac','audio/x-m4a'])
on conflict (id) do update set allowed_mime_types = excluded.allowed_mime_types;   -- photos and background music

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


-- ═════════════════════════════════════════════════════════════
-- Update 6 (also in 006_safety_and_checkin.sql): account deletion, spam limits, template reports, check-in
-- ═════════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────
-- 1. Delete my account. Invitations, guests and templates go with it (they're linked with "on delete cascade").
--    The website removes the account's photos and music from storage first.
-- ─────────────────────────────────────────────────────────────
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Spam limits on group links: at most 8 replies in 10 minutes from one connection,
--    and 60 in 10 minutes for the whole link. Real guests never get near these.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.group_reply_log (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  ip            text not null default '',
  at            timestamptz not null default now()
);
create index if not exists group_reply_log_idx on public.group_reply_log(invitation_id, at);
alter table public.group_reply_log enable row level security;   -- no policies: only the reply function can use it

create or replace function public.submit_group_rsvp(p_token text, p_name text, p_phone text, p_status text,
                                                    p_coming int, p_dietary text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  i public.invitations; g public.guests; m public.guests;
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_phone text := public.norm_phone(p_phone);
  v_coming int; v_updated boolean := false; v_count int;
  v_ip text := btrim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1));
begin
  select * into i from public.invitations where group_token = p_token and group_enabled;
  if not found then raise exception 'Invitation not found'; end if;

  -- spam limits
  delete from public.group_reply_log where at < now() - interval '1 day';
  if v_ip <> '' and (select count(*) from public.group_reply_log where invitation_id = i.id and ip = v_ip and at > now() - interval '10 minutes') >= 8 then
    raise exception 'Too many replies from this connection. Please try again in a few minutes.';
  end if;
  if (select count(*) from public.group_reply_log where invitation_id = i.id and at > now() - interval '10 minutes') >= 60 then
    raise exception 'This link is getting a lot of replies right now. Please try again in a few minutes.';
  end if;
  insert into public.group_reply_log (invitation_id, ip) values (i.id, v_ip);

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
    values (i.id, v_name, left(btrim(coalesce(p_phone, '')), 40), greatest(1, v_coming), public.default_side(i.details), p_status, v_coming,
            case when p_status = 'yes' then left(coalesce(p_dietary, ''), 200) else '' end,
            left(coalesce(p_note, ''), 500), now(), 'group', g.dup_of, coalesce(g.dup_reason, ''))
    returning * into g;
  end if;

  return jsonb_build_object('token', g.token, 'updated', v_updated, 'name', g.name, 'seats', i.group_max_seats,
                            'status', g.status, 'coming', g.coming, 'dietary', g.dietary, 'note', g.note);
end $$;
revoke all on function public.submit_group_rsvp(text, text, text, text, int, text, text) from public;
grant execute on function public.submit_group_rsvp(text, text, text, text, int, text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Reporting shared templates. After 3 different people report one, it leaves the community list.
--    Its owner still has it, but can't put it back on the list themselves.
-- ─────────────────────────────────────────────────────────────
alter table public.templates add column if not exists reported boolean not null default false;

create table if not exists public.template_reports (
  template_id uuid not null references public.templates(id) on delete cascade,
  reporter    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason      text not null default '' check (char_length(reason) <= 200),
  created_at  timestamptz not null default now(),
  primary key (template_id, reporter)
);
alter table public.template_reports enable row level security;   -- no policies: reports go through the function below

create or replace function public.report_template(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.templates where id = p_id and is_public and owner <> auth.uid()) then
    raise exception 'Template not found';
  end if;
  insert into public.template_reports (template_id, reporter, reason)
    values (p_id, auth.uid(), left(coalesce(p_reason, ''), 200)) on conflict do nothing;
  if (select count(*) from public.template_reports where template_id = p_id) >= 3 then
    update public.templates set reported = true where id = p_id;
  end if;
end $$;
revoke all on function public.report_template(uuid, text) from public;
grant execute on function public.report_template(uuid, text) to authenticated;

-- owners can't clear the reported flag through the normal table access
create or replace function public.keep_reported_flag()
returns trigger language plpgsql as $$
begin
  if new.reported is distinct from old.reported and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    new.reported := old.reported;
  end if;
  return new;
end $$;
drop trigger if exists keep_reported_flag on public.templates;
create trigger keep_reported_flag before update on public.templates for each row execute function public.keep_reported_flag();

drop policy if exists "shared templates" on public.templates;
create policy "shared templates" on public.templates for select to authenticated using (is_public and not reported);

-- ─────────────────────────────────────────────────────────────
-- 4. Check-in on the day: when each guest arrived
-- ─────────────────────────────────────────────────────────────
alter table public.guests add column if not exists checked_in_at timestamptz;

-- ═════════════════════════════════════════════════════════════
-- Update 7 (also in 007_events.sql): separate events
-- ─────────────────────────────────────────────────────────────
-- 1. Which events each guest is invited to, and their answer for each
-- ─────────────────────────────────────────────────────────────
alter table public.guests
  add column if not exists events  text[],                                -- null = every event
  add column if not exists replies jsonb not null default '{}'::jsonb;    -- { "<event id>": { "s": "yes"|"no", "n": 2 } }

-- ─────────────────────────────────────────────────────────────
-- 2. Helpers
-- ─────────────────────────────────────────────────────────────
-- The ids of an invitation's events, in order. Empty when it's a single event.
create or replace function public.event_ids(p_details jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(e->>'id' order by n), '{}')
  from jsonb_array_elements(case when jsonb_typeof(p_details->'events') = 'array' then p_details->'events' else '[]'::jsonb end)
       with ordinality as t(e, n)
  where coalesce(e->>'id', '') <> '' and p_details->>'multi' = '1';   -- events switched off: a single event again
$$;

-- The events someone is invited to: the ones on their list that still exist.
-- No list, or a list that no longer matches any event, means every event.
create or replace function public.invited_events(p_details jsonb, p_list text[]) returns text[]
language sql immutable as $$
  select case
    when p_list is null or cardinality(array(select x from unnest(public.event_ids(p_details)) x where x = any(p_list))) = 0
      then public.event_ids(p_details)
    else array(select x from unnest(public.event_ids(p_details)) x where x = any(p_list))
  end;
$$;

-- Checks a set of answers against the events a guest is invited to.
-- Returns { replies, status, coming }: yes if they're coming to anything, and the most seats they need at any one event.
create or replace function public.sum_replies(p_events text[], p_replies jsonb, p_max int) returns jsonb
language plpgsql immutable as $$
declare
  e text; r jsonb; s text; n int;
  out jsonb := '{}'::jsonb; any_yes boolean := false; most int := 0;
begin
  if cardinality(p_events) = 0 then raise exception 'This invitation has no events'; end if;
  foreach e in array p_events loop
    r := case when jsonb_typeof(p_replies) = 'object' then p_replies->e end;
    s := r->>'s';
    if s is null or s not in ('yes','no') then raise exception 'Please answer for each event'; end if;
    n := case when s = 'yes' then greatest(1, least(coalesce((r->>'n')::int, 1), p_max)) else 0 end;
    out := out || jsonb_build_object(e, jsonb_build_object('s', s, 'n', n));
    if s = 'yes' then any_yes := true; most := greatest(most, n); end if;
  end loop;
  return jsonb_build_object('replies', out, 'status', case when any_yes then 'yes' else 'no' end, 'coming', most);
exception when invalid_text_representation then
  raise exception 'Please answer for each event';
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3. What guests see: now with their events and answers
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_invite(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'invitation', jsonb_build_object('template', i.template, 'details', i.details, 'style', i.style, 'photo', i.photo),
    'guest',      jsonb_build_object('name', g.name,
                                     'seats', case when g.source = 'group' then i.group_max_seats else g.seats end,
                                     'status', g.status, 'coming', g.coming, 'dietary', g.dietary, 'note', g.note,
                                     'events', to_jsonb(public.invited_events(i.details, g.events)),
                                     'replies', g.replies))
  from public.guests g
  join public.invitations i on i.id = g.invitation_id
  where g.token = p_token;
$$;

create or replace function public.get_group_invite(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'invitation', jsonb_build_object('template', i.template, 'details', i.details, 'style', i.style, 'photo', i.photo),
    'max_seats',  i.group_max_seats,
    'events',     to_jsonb(public.invited_events(i.details,
                     case when jsonb_typeof(i.details->'groupEvents') = 'array'
                          then array(select jsonb_array_elements_text(i.details->'groupEvents')) end)))
  from public.invitations i
  where i.group_token = p_token and i.group_enabled;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Replying event by event from a personal link
-- ─────────────────────────────────────────────────────────────
create or replace function public.submit_rsvp_events(p_token text, p_replies jsonb, p_dietary text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.guests; i public.invitations; v_max int; v_ev text[]; v_sum jsonb;
begin
  select * into g from public.guests where token = p_token;
  if not found then raise exception 'Invitation not found'; end if;
  select * into i from public.invitations where id = g.invitation_id;
  v_max := case when g.source = 'group' then i.group_max_seats else g.seats end;
  v_ev  := public.invited_events(i.details, g.events);
  v_sum := public.sum_replies(v_ev, p_replies, v_max);

  update public.guests set
    replies      = v_sum->'replies',
    status       = v_sum->>'status',
    coming       = (v_sum->>'coming')::int,
    seats        = case when source = 'group' then greatest(1, (v_sum->>'coming')::int) else seats end,
    dietary      = case when v_sum->>'status' = 'yes' then left(coalesce(p_dietary, ''), 200) else '' end,
    note         = left(coalesce(p_note, ''), 500),
    responded_at = now()
  where id = g.id
  returning * into g;
  return jsonb_build_object('name', g.name, 'seats', v_max, 'status', g.status, 'coming', g.coming,
                            'dietary', g.dietary, 'note', g.note, 'events', to_jsonb(v_ev), 'replies', g.replies);
end $$;
revoke all on function public.submit_rsvp_events(text, jsonb, text, text) from public;
grant execute on function public.submit_rsvp_events(text, jsonb, text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. Replying from a group link. One function handles both single-event and multi-event invitations;
--    the older 7-value version (still used by pages already open in someone's browser) passes through to it.
--  • Same WhatsApp number already replied through this group link → that reply is updated, no new row.
--  • Same number or same name as someone on the list → a new row, flagged as a possible duplicate.
--  • Spam limits: 8 replies in 10 minutes from one connection, 60 in 10 minutes for the whole link.
-- ─────────────────────────────────────────────────────────────
create or replace function public.submit_group_rsvp_events(p_token text, p_name text, p_phone text, p_status text,
                                                           p_coming int, p_replies jsonb, p_dietary text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  i public.invitations; g public.guests; m public.guests;
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_phone text := public.norm_phone(p_phone);
  v_status text; v_coming int; v_replies jsonb := '{}'::jsonb; v_ev text[]; v_list text[]; v_sum jsonb;
  v_updated boolean := false; v_count int;
  v_ip text := btrim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1));
begin
  select * into i from public.invitations where group_token = p_token and group_enabled;
  if not found then raise exception 'Invitation not found'; end if;

  -- spam limits
  delete from public.group_reply_log where at < now() - interval '1 day';
  if v_ip <> '' and (select count(*) from public.group_reply_log where invitation_id = i.id and ip = v_ip and at > now() - interval '10 minutes') >= 8 then
    raise exception 'Too many replies from this connection. Please try again in a few minutes.';
  end if;
  if (select count(*) from public.group_reply_log where invitation_id = i.id and at > now() - interval '10 minutes') >= 60 then
    raise exception 'This link is getting a lot of replies right now. Please try again in a few minutes.';
  end if;
  insert into public.group_reply_log (invitation_id, ip) values (i.id, v_ip);

  if char_length(v_name) < 1 or char_length(v_name) > 120 then raise exception 'Please enter your name'; end if;
  if length(v_phone) < 8 or length(v_phone) > 15 then raise exception 'Please enter your WhatsApp number'; end if;

  -- the events the group link is for (none chosen = all of them); new guests from the link are invited to those
  v_list := case when jsonb_typeof(i.details->'groupEvents') = 'array' and jsonb_array_length(i.details->'groupEvents') > 0
                 then array(select jsonb_array_elements_text(i.details->'groupEvents')) end;
  v_ev := public.invited_events(i.details, v_list);
  if cardinality(v_ev) > 0 and p_replies is not null then
    v_sum := public.sum_replies(v_ev, p_replies, i.group_max_seats);
    v_status := v_sum->>'status'; v_coming := (v_sum->>'coming')::int; v_replies := v_sum->'replies';
  else
    if p_status is null or p_status not in ('yes','no') then raise exception 'Please choose accept or decline'; end if;
    v_status := p_status;
    v_coming := case when p_status = 'yes' then greatest(1, least(coalesce(p_coming, 1), i.group_max_seats)) else 0 end;
    -- an older page on a multi-event invitation: the one answer counts for every event
    for k in 1 .. coalesce(cardinality(v_ev), 0) loop
      v_replies := v_replies || jsonb_build_object(v_ev[k], jsonb_build_object('s', v_status, 'n', v_coming));
    end loop;
  end if;

  select * into g from public.guests
    where invitation_id = i.id and source = 'group' and phone_norm = v_phone
    order by created_at limit 1;

  if found then
    -- keep earlier answers for events this link isn't for (the couple may have invited them to more)
    update public.guests set
      name = v_name, status = v_status, coming = v_coming, seats = greatest(1, v_coming), replies = coalesce(replies, '{}'::jsonb) || v_replies,
      dietary = case when v_status = 'yes' then left(coalesce(p_dietary, ''), 200) else '' end,
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
                               responded_at, source, dup_of, dup_reason, replies, events)
    values (i.id, v_name, left(btrim(coalesce(p_phone, '')), 40), greatest(1, v_coming), public.default_side(i.details), v_status, v_coming,
            case when v_status = 'yes' then left(coalesce(p_dietary, ''), 200) else '' end,
            left(coalesce(p_note, ''), 500), now(), 'group', g.dup_of, coalesce(g.dup_reason, ''), v_replies, v_list)
    returning * into g;
  end if;

  return jsonb_build_object('token', g.token, 'updated', v_updated, 'name', g.name, 'seats', i.group_max_seats,
                            'status', g.status, 'coming', g.coming, 'dietary', g.dietary, 'note', g.note,
                            'events', to_jsonb(v_ev), 'replies', g.replies);
end $$;
revoke all on function public.submit_group_rsvp_events(text, text, text, text, int, jsonb, text, text) from public;
grant execute on function public.submit_group_rsvp_events(text, text, text, text, int, jsonb, text, text) to anon, authenticated;

create or replace function public.submit_group_rsvp(p_token text, p_name text, p_phone text, p_status text,
                                                    p_coming int, p_dietary text, p_note text)
returns jsonb language sql security definer set search_path = public as $$
  select public.submit_group_rsvp_events(p_token, p_name, p_phone, p_status, p_coming, null, p_dietary, p_note);
$$;
revoke all on function public.submit_group_rsvp(text, text, text, text, int, text, text) from public;
grant execute on function public.submit_group_rsvp(text, text, text, text, int, text, text) to anon, authenticated;

-- A personal-link reply from an older page on a multi-event invitation: the one answer counts for every event.
create or replace function public.submit_rsvp(p_token text, p_status text, p_coming int, p_dietary text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.guests; i public.invitations; v_max int; v_ev text[]; v_rep jsonb := '{}'::jsonb; v_coming int;
begin
  if p_status not in ('yes','no') then raise exception 'Please choose accept or decline'; end if;
  select * into g from public.guests where token = p_token;
  if not found then raise exception 'Invitation not found'; end if;
  select * into i from public.invitations where id = g.invitation_id;
  v_max := case when g.source = 'group' then i.group_max_seats else g.seats end;
  v_coming := case when p_status = 'yes' then greatest(1, least(coalesce(p_coming, 1), v_max)) else 0 end;
  v_ev := public.invited_events(i.details, g.events);
  for k in 1 .. coalesce(cardinality(v_ev), 0) loop
    v_rep := v_rep || jsonb_build_object(v_ev[k], jsonb_build_object('s', p_status, 'n', v_coming));
  end loop;
  update public.guests set
    status       = p_status,
    coming       = v_coming,
    seats        = case when source = 'group' then greatest(1, v_coming) else seats end,
    replies      = v_rep,
    dietary      = case when p_status = 'yes' then left(coalesce(p_dietary, ''), 200) else '' end,
    note         = left(coalesce(p_note, ''), 500),
    responded_at = now()
  where id = g.id
  returning * into g;
  return jsonb_build_object('name', g.name, 'seats', v_max, 'status', g.status, 'coming', g.coming,
                            'dietary', g.dietary, 'note', g.note, 'events', to_jsonb(v_ev), 'replies', g.replies);
end $$;
revoke all on function public.submit_rsvp(text, text, int, text, text) from public;
grant execute on function public.submit_rsvp(text, text, int, text, text) to anon, authenticated;