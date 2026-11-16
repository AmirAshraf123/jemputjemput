-- Jemput update 3: guest groups for every occasion
-- Already set up Jemput before this? Paste this file into Supabase → SQL Editor → New query → Run.
-- (A brand-new setup only needs schema.sql, which already includes this.)
-- Safe to run more than once.

-- Weddings and engagements still use Groom / Bride / Both. Other occasions can label guests with any
-- short group name, such as Family, Friends or Work, or leave it blank.
alter table public.guests drop constraint if exists guests_side_check;
alter table public.guests alter column side set default '';
do $$ begin
  alter table public.guests add constraint guests_side_length check (char_length(side) <= 40);
exception when duplicate_object then null; end $$;

-- Group-link replies: "Both" for weddings and engagements, no group for anything else.
create or replace function public.default_side(p_details jsonb) returns text
language sql immutable as $$
  select case when coalesce(p_details->>'occasion', 'wedding') in ('wedding', 'engagement') then 'Both' else '' end;
$$;

-- Group-link replies now use default_side() (same function as in 002, with that one change).
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

revoke all on function public.submit_group_rsvp(text, text, text, text, int, text, text) from public;
grant execute on function public.submit_group_rsvp(text, text, text, text, int, text, text) to anon, authenticated;
