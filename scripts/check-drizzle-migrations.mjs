import { readFile, readdir } from 'node:fs/promises';

const migrationDir = 'drizzle/migrations';
const journalPath = `${migrationDir}/meta/_journal.json`;
const config = await readFile('drizzle.config.ts', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

if (!config.includes('dialect: "postgresql"') && !config.includes("dialect: 'postgresql'")) {
  throw new Error('drizzle.config.ts must use the PostgreSQL dialect');
}
if (!config.includes('out: "./drizzle/migrations"') && !config.includes("out: './drizzle/migrations'")) {
  throw new Error('drizzle.config.ts must use ./drizzle/migrations as the migration output directory');
}
if (packageJson.scripts?.['db:migrate'] !== 'drizzle-kit migrate') {
  throw new Error('package.json db:migrate must remain the canonical drizzle-kit migrate command');
}

const retiredMigrationPaths = [
  'scripts/manual-migration.js',
  'scripts/patch-schema.js',
  'scripts/update-schema.js',
  'scripts/ops/apply-reputation-migration.cjs',
  'ops/scripts/ops/apply-reputation-migration.cjs',
  'scripts/apply-orchestration-sql.mjs',
  'ops/scripts/apply-orchestration-sql.mjs',
];

for (const path of retiredMigrationPaths) {
  try {
    await readFile(path);
    throw new Error(`Retired direct migration runner still exists: ${path}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const entries = (await readdir(migrationDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (entries.length === 0) throw new Error(`No numbered SQL migrations found in ${migrationDir}`);

for (const name of entries) {
  const sql = await readFile(`${migrationDir}/${name}`, 'utf8');
  const header = sql.match(/^--\s*drizzle\/migrations\/([^\r\n]+)$/m)?.[1]?.trim();
  if (header && header !== name) {
    console.warn(`${name}: migration header points to ${header}; preserving historical migration content until production state is verified.`);
  }
}

const journal = JSON.parse(await readFile(journalPath, 'utf8'));
if (journal.dialect !== 'postgresql') {
  console.warn(`Migration journal dialect is ${journal.dialect}; expected postgresql.`);
}

const tags = new Set(journal.entries.map((entry) => `${entry.tag}.sql`));
const missing = entries.filter((name) => !tags.has(name));
const orphaned = [...tags].filter((name) => !entries.includes(name));
if (missing.length > 0) {
  console.warn(`Migration journal is stale; ${missing.length} migration file(s) are not represented:`);
  for (const name of missing) console.warn(`  - ${name}`);
  console.warn('Production state must be verified before rewriting the journal.');
}
if (orphaned.length > 0) {
  console.warn(`Migration journal contains ${orphaned.length} entry/entries without a numbered SQL file:`);
  for (const name of orphaned) console.warn(`  - ${name}`);
  console.warn('Do not remove or rewrite journal history without verifying the database tracking table.');
}

console.log(`Checked ${entries.length} numbered migration files against ${journalPath}; journal drift is visible without blocking CI.`);
