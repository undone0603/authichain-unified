-- notifications.userId was live as uuid, guarded by two RLS policies
-- comparing against auth.uid() (Supabase Auth's session UUID). But
-- src/db/schema.ts has always defined it as integer, and every actual
-- caller in the codebase (createSystemNotification and its callers)
-- passes an integer public.users.id -- this app's real identity model,
-- not Supabase Auth. A repo-wide search found zero supabase-js client
-- usage of the notifications table (the only path where these policies
-- would ever be evaluated -- the server's raw pg connection uses a
-- service role and bypasses RLS entirely), so the policies were dead
-- scaffolding from a generic Supabase template, never wired to real
-- usage. Confirmed via /api/cron/pipeline failing with Postgres 22P02
-- ("invalid input syntax for type uuid") when inserting an integer
-- user id. Table had 0 rows, so no data-loss risk.
DROP POLICY IF EXISTS "Users can view own notifications" ON "notifications";
DROP POLICY IF EXISTS "Users can update own notifications" ON "notifications";
ALTER TABLE "notifications" ALTER COLUMN "userId" TYPE integer USING NULL;
