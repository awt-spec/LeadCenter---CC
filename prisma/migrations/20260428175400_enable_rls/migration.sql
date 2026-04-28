-- Defense in depth: revoke ALL access to public schema from Supabase's
-- "anon" and "authenticated" roles, then enable RLS on every table.
--
-- The application connects via Supavisor as the `postgres` role, which
-- BYPASSes RLS by default — so the app keeps working unchanged. This
-- migration only blocks access from the Supabase REST API, the
-- realtime channel, and direct connections that authenticate as
-- anon/authenticated.

-- 1. Lock down public schema for anon/authenticated
REVOKE ALL ON SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 2. Default: future tables created by the app also have no access
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- 3. Enable RLS on every business table.
-- (Without policies = deny by default for non-superusers).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '_prisma_%'
  LOOP
    -- ENABLE only (not FORCE): the postgres superuser bypasses RLS,
    -- so the application keeps working. Other roles still need
    -- explicit policies to read/write.
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'public', r.tablename);
  END LOOP;
END $$;
