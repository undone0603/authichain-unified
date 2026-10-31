// stdin {record, anchor} -> stdout scan result. A DigitalProductPassport
// prints the passport scan. Any other record prints verifyRecord().
// agentz/core/signature.py calls this file.
import { verifyScan } from '../../protocol/passport.mjs';
import { fileURLToPath } from 'node:url';

export function scanRecord(record, anchor = null) {
  return verifyScan(record, anchor ?? null).body;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    const { record, anchor } = JSON.parse(input);
    process.stdout.write(JSON.stringify(scanRecord(record, anchor ?? null)));
  });
}
