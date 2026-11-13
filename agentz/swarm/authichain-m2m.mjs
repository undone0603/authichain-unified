/** AgentZ's narrowly scoped, no-wallet M2M evidence action.
 * This is NOT an unattended production send or an agent authorization grant.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { DEMO_RECORD, runFreeM2M } from '../../scripts/alliances/m2m-verify.mjs';

export async function runAgentZEvidenceAction({live=false,fetchImpl,recordId=DEMO_RECORD}={}) {
  if (recordId!==DEMO_RECORD) throw new Error('only_published_demo_record_allowed');
  const result=await runFreeM2M({live,fetchImpl});
  return {
    agent: 'AgentZ',
    action: 'READ_EVIDENCE',
    actionContract: 'authichain.agentz.m2m.read_evidence.v1',
    mode: live ? 'live_free_demo' : 'dry_run',
    status: result.status==='tool_response_received'?'protocol_response_received':result.status,
    evidence: result,
    audit: {persisted:false, signedByAgent:false, immutable:false},
    authority: {subjectAuthenticated:false, productionSendAuthorized:false,
      paymentAuthorized:false, productionIssuerVerified:false},
    nextActions: {publish:false, pay:false, enroll:false, promoteToProduction:false},
  };
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const report=await runAgentZEvidenceAction({live:process.argv.includes('--live')});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if (report.mode==='live_free_demo' && report.status!=='protocol_response_received') process.exitCode=2;
}
