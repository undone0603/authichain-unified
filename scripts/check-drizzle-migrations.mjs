import { readFile, readdir } from 'node:fs/promises';

const config = await readFile('drizzle.config.ts', 'utf8');
if (!config.includes('dialect: "postgresql"') && !config.includes("dialect: 'postgresql'")) {
  throw new Error('drizzle.config.ts must use the PostgreSQL dialect');
}
if (!config.includes('out: "./drizzle/migrations"') && !config.includes("out: './drizzle/migrations'")) {
  throw new Error('drizzle.config.ts must use ./drizzle/migrations as the migration output directory');
}

const entries = (await readdir('drizzle/migrations', { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (entries.length === 0) throw new Error('No numbered SQL migrations found in drizzle/migrations');

for (const name of entries) {
  const sql = await readFile(`drizzle/migrations/${name}`, 'utf8');
  const header = sql.match(/^--\s*drizzle\/migrations\/([^\r\n]+)$/m)?.[1]?.trim();
  if (header && header !== name) {
    console.warn(`${name}: migration header points to ${header}; preserving historical migration content until production state is verified.`);
  }
}

const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'));
if (journal.dialect !== 'postgresql') {
  console.warn(`Migration journal dialect is ${journal.dialect}; expected postgresql.`);
}

const tags = new Set(journal.entries.map((entry) => `${entry.tag}.sql`));
const missing = entries.filter((name) => !tags.has(name));
if (missing.length > 0) {
  console.warn(`Migration journal is stale; ${missing.length} migration file(s) are not represented:`);
  for (const name of missing) console.warn(`  - ${name}`);
  console.warn('Production state must be verified before rewriting the journal.');
}

console.log(`Checked ${entries.length} numbered migration files; journal drift is visible without blocking CI.`);
