import { readFileSync } from 'node:fs';

export const EXPECTED = 'https://authichain.com/mcp';
export function verify(report, surface) {
  const fail = reason => ({ pass: false, reason });
  if (!report || typeof report !== 'object' || Array.isArray(report) || report.version !== 1) return fail('invalid_report');
  if (typeof report.baseline !== 'string' || !report.baseline.trim()) return fail('missing_baseline');
  if (!Array.isArray(report.servers) || report.servers.length !== 1) return fail('expected_one_server');
  const s = report.servers[0];
  if (!s || s.client !== 'claude' || s.name !== 'authichain' || s.url !== EXPECTED) return fail('wrong_server');
  if (s.status !== 'unchanged') return fail('not_unchanged_' + String(s.status));
  if (!Array.isArray(s.changes) || s.changes.length || s.error != null) return fail('remote_report_error_or_drift');
  if (!surface || surface.method !== 'introspect' || !Array.isArray(surface.tools) || surface.tools.length === 0) return fail('missing_introspected_tools');
  if (!Array.isArray(surface.egress) || !surface.egress.includes('authichain.com')) return fail('wrong_egress');
  const names = surface.tools.map(t => t?.name);
  const expected = ['get_pricing', 'verify', 'query_provenance', 'verify_attestation', 'verify_record', 'dpp_readiness_check', 'scan_living_qr'];
  if (names.length !== expected.length || new Set(names).size !== names.length ||
      [...names].sort().join('\0') !== [...expected].sort().join('\0')) return fail('unexpected_tool_names');
  return {pass:true, evidence:'self_baselined_remote_mcp_tool_surface_recheck', endpoint:EXPECTED,
    toolCount:surface.tools.length, readOnly:true, productAuthenticityVerified:false, independentEndorsement:false};
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw Error('usage: node verify-report.mjs report.json surface.json');
    const verdict = verify(JSON.parse(readFileSync(process.argv[2], 'utf8')), JSON.parse(readFileSync(process.argv[3], 'utf8')));
    process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
    if (!verdict.pass) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`invalid_cedr_evidence: ${String(error?.message || error)}\n`);
    process.exitCode = 2;
  }
}
