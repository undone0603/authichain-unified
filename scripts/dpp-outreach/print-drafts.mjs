import fs from 'node:fs';
import { parse } from 'node:path';

const csv = fs.readFileSync(new URL('./warm-10.csv', import.meta.url), 'utf8').trim().split(/\r?\n/);
const [header, ...rows] = csv;
const cols = header.split(',');
const template = fs.readFileSync(new URL('./email-template.txt', import.meta.url), 'utf8');

function fill(tpl, row) {
  return tpl.replaceAll(/\{\{(\w+)\}\}/g, (_, k) => row[k] ?? '');
}

for (const line of rows) {
  if (!line.trim() || line.startsWith('EXAMPLE')) continue;
  const parts = line.split(',');
  if (parts.length < cols.length) continue;
  const row = Object.fromEntries(cols.map((c, i) => [c, parts[i] || '']));
  if (!row.email || !row.contact_name) continue;
  const body = fill(template, row);
  console.log('\n' + '='.repeat(60));
  console.log(`To: ${row.email}`);
  console.log(body);
}
