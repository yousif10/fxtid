CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_buckets_count_ck" CHECK ("rate_limit_buckets"."count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_reset_idx" ON "rate_limit_buckets" USING btree ("reset_at");--> statement-breakpoint
ALTER TABLE "rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Supabase hardening (no-op on plain Postgres / PGlite where these roles do not exist).
-- RLS is already enabled with NO policies on every table (deny-by-default). In
-- addition, remove all table/sequence/function privileges from the Data API roles
-- so the auto-generated REST/GraphQL APIs cannot read, write or even enumerate
-- employee data. The application connects server-side as the table owner and is
-- unaffected. Future objects created by the migrating role get the same treatment.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
