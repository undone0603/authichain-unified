import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const verifyDir = './scripts/verify';
const files = fs.readdirSync(verifyDir).filter(f => f.endsWith('.js'));

console.log(`🚀 Starting system verification suite... (${files.length} checks)\n`);

let passed = 0;
let failed = 0;

files.forEach(file => {
  try {
    console.log(`Checking ${file}...`);
    execSync(`node ${path.join(verifyDir, file)}`, { stdio: 'inherit' });
    passed++;
  } catch (e) {
    console.error(`❌ ${file} failed.`);
    failed++;
  }
});

console.log(`\n--- Verification Summary ---`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
