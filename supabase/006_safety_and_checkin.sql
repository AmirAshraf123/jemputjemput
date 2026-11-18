-- Jemput update 6: delete-my-account, spam limits on group links, reporting shared templates, and check-in on the day
-- Already set up Jemput before this? Paste this file into Supabase → SQL Editor → New query → Run.
-- (A brand-new setup only needs schema.sql, which already includes this.)
-- Safe to run more than once. Run 002 to 005 first if you haven't.

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
