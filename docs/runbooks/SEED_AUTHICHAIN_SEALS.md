# Seed AuthiChain-owned signed seals (NICKEL-VERIFY)

The worker signs each seal with its existing Ed25519 attestation key (JWKS kid
`lue84wJNZjRSQ2IcOamnl9JNlOtuaD0Go4amAL6ccIE`) and writes it to `auth_seals`.
Nobody reads or exports the key. Seeds: `scripts/seed-authichain-seals.json`
(4 seals, all AuthiChain's own, labeled "Not a customer product").
**Run the seed once:** every call appends a new row.

## Order (all $0)
1. Apply migration `supabase/migrations/20261016171500_auth_seals_signature.sql` (additive, nullable columns).
2. Deploy `worker-app` (adds `POST /protocol/seal-sign` + route) and `authichain-verify-worker` (free `/api/verify` finds auth_seals UUIDs).
3. Confirm `GET https://authichain.com/protocol/issuer.json` → `ready:true, signing:true, kid:lue84wJ…`.
4. Seed (A or B).
5. For each printed seal_id: `curl -s "https://authichain.com/api/verify?id=<seal_id>"` → `source:"auth_seals"`, decision not `not_found`.

## A. GitHub Actions (blocked while billing-locked)
Actions → "Seed AuthiChain seals" → Run workflow. Uses GitHub OIDC, no secret.

## B. Free local path (CF Deploy, wrangler)
```bash
cd worker-app
TOKEN=$(openssl rand -hex 32)                       # stays in this shell only
printf %s "$TOKEN" | npx wrangler secret put SEAL_SEED_TOKEN   # same worker/config used to deploy worker-app
cd .. && SEAL_SIGN_BEARER="$TOKEN" node scripts/seed-authichain-seals.mjs
cd worker-app && npx wrangler secret delete SEAL_SEED_TOKEN   # remove right after
unset TOKEN
```
Tokens under 32 chars are ignored by the route.

## Rollback
- Code: `git revert <merge sha>` and redeploy both workers.
- Data (only the seeded rows): `delete from public.auth_seals where brand='authichain.com' and product_id like 'authichain-%' and signing_kid is not null;`. Run only with Zac's OK; it's a delete.
- Columns: see the rollback comment in the migration.
