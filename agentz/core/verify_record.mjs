// stdin {record, anchor} -> stdout verifyRecord() result. The check itself is
// protocol/verifier.mjs, the reference verifier the conformance suite runs;
// this file only lets agentz/core/signature.py call it.
import { verifyRecord } from '../../protocol/verifier.mjs';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  const { record, anchor } = JSON.parse(input);
  process.stdout.write(JSON.stringify(verifyRecord(record, anchor ?? null)));
});
