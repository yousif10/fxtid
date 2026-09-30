-- FXT ID system: post-migration security checks (read-only). Run in the SQL Editor.

-- 1) Every application table must have RLS enabled (expect zero rows).
select c.relname as table_without_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  and c.relname <> '__drizzle_migrations';

-- 2) No RLS policies on application tables (deny-by-default; expect zero rows).
select tablename, policyname from pg_policies where schemaname = 'public';

-- 3) Data API roles have no table privileges (expect zero rows).
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated');

-- 4) Photo bucket is private (expect public = false).
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'employee-photos';

-- 5) No storage policies expose the photo bucket (review any rows returned).
select policyname, roles, cmd, qual from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (qual ilike '%employee-photos%' or with_check ilike '%employee-photos%');
