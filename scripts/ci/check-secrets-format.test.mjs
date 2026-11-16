import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const VALIDATOR = new URL('../check-secrets-format.mjs', import.meta.url);
function validate(nextPublicUrl = '', databaseUrl = '') {
  const out = spawnSync(process.execPath, [VALIDATOR.pathname], {
    encoding: 'utf8',
    timeout: 10000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: nextPublicUrl,
      DATABASE_URL: databaseUrl,
    },
  });
  assert.equal(out.error, undefined);
  return { status: out.status, output: out.stdout + out.stderr };
}

test('valid Supabase and pooler URLs retain successful validation', () => {
  const result = validate('https://ci-project.supabase.co', 'postgresql://ci-user:canary-password@aws-0-us-east-1.pooler.supabase.com:6543/app');
  assert.equal(result.status, 0);
  assert.match(result.output, /Secrets format validation passed/);
  assert.doesNotMatch(result.output, /canary-password/);
});

test('invalid public Supabase URL fails without printing its secret-derived value', () => {
  const canary = 'https://private-project.invalid/path?access_token=private-canary-value';
  const result = validate(canary);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(result.output, /private-project|private-canary-value|access_token/);
});

test('direct database hostname fails without leaking the hostname, username or password', () => {
  const canary = 'postgresql://private-user:private-password@db.private-project.supabase.co:5432/db';
  const result = validate('', canary);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /DATABASE_URL/);
  assert.doesNotMatch(result.output, /private-user|private-password|private-project|db\.private/);
});

test('malformed database URL fails closed, absent optional bindings still pass', () => {
  const invalid = validate('', 'not-a-database-url:private-canary');
  assert.notEqual(invalid.status, 0);
  assert.doesNotMatch(invalid.output, /private-canary/);
  const absent = validate();
  assert.equal(absent.status, 0);
});
