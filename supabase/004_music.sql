-- Jemput update 4: background music
-- Already set up Jemput before this? Paste this file into Supabase → SQL Editor → New query → Run.
-- (A brand-new setup only needs schema.sql, which already includes this.)
-- Safe to run more than once.

-- Music files are stored next to the photos, in each person's own folder, with the same rules.
update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/aac','audio/x-m4a'],
       file_size_limit = 10485760
 where id = 'photos';
