-- Applied to QRON-v2 (nhdnkzhtadfkkluiulhs) as api_keys_own_and_revoke_anon_accounts on 2026-10-03.
drop policy if exists api_keys_insert_own on public.api_keys;
create policy api_keys_insert_own on public.api_keys
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists api_keys_select_own on public.api_keys;
create policy api_keys_select_own on public.api_keys
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.accounts from anon;
