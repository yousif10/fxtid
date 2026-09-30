-- FXT ID system: private photo bucket (alternative to `pnpm storage:setup`).
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-photos', 'employee-photos', false, 10485760, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- REQUIRED POLICIES: none.
-- storage.objects has Row Level Security enabled by Supabase. With NO policies
-- for this bucket, the anon/authenticated roles (i.e. anyone using the public
-- API keys) can neither list, read, upload nor delete photos. The application
-- accesses the bucket only from server code with the secret key, which bypasses
-- RLS, and streams photos to authorised admins / valid verification tokens.
-- Do NOT add policies granting anon or authenticated access to this bucket.
