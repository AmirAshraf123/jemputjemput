-- Jemput update 5: community templates
-- Already set up Jemput before this? Paste this file into Supabase → SQL Editor → New query → Run.
-- (A brand-new setup only needs schema.sql, which already includes this.)
-- Safe to run more than once.

-- A saved template can be shared with everyone, credited to a name its designer chooses.
alter table public.templates add column if not exists is_public    boolean not null default false;
alter table public.templates add column if not exists author       text;
alter table public.templates add column if not exists published_at timestamptz;

do $$ begin
  alter table public.templates add constraint templates_author_len check (author is null or char_length(author) between 1 and 60);
exception when duplicate_object then null; end $$;

create index if not exists templates_public_idx on public.templates(published_at desc) where is_public;

-- Anyone signed in can see shared templates. Only their owner can change or delete them (the "own templates" rule).
drop policy if exists "shared templates" on public.templates;
create policy "shared templates" on public.templates for select to authenticated using (is_public);
