-- Jemput update 7: separate events (for example an akad nikah in the morning and a reception at night)
-- Already set up Jemput before this? Paste this file into Supabase → SQL Editor → New query → Run.
-- (A brand-new setup only needs schema.sql, which already includes this.)
-- Safe to run more than once. Run 006 first if you haven't.
--
-- The events themselves live in invitations.details.events, as a list of
--   { id, name, date, start, end, venue, address }.
-- Each guest can be invited to some of them, and answers each one separately.

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