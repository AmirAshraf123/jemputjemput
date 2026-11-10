-- Jemput update 2: group links
-- Already set up Jemput before this? Paste this file into Supabase → SQL Editor → New query → Run.
-- (A brand-new setup only needs schema.sql, which already includes this.)
-- Safe to run more than once.

-- ─────────────────────────────────────────────────────────────
-- New columns
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

-- ─────────────────────────────────────────────────────────────
-- Guest functions (personal links), updated so group replies can be changed later
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
