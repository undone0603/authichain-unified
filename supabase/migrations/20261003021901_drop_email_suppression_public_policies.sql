-- Close the public read and the insert-any policy on email_suppressions.
-- is_email_suppressed(text) stays, so a caller can ask about one address
-- without listing the table. Service role bypasses RLS and still writes.
-- Do not drop the function.

drop policy if exists "launchcheck suppress select" on public.email_suppressions;
drop policy if exists "launchcheck suppress insert" on public.email_suppressions;

revoke select, insert, update, delete on table public.email_suppressions from anon, authenticated;
