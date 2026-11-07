#!/usr/bin/env node
/** Offline reference CLI; no online issuance and no production credentials. */
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { issueEvidenceCredential, verifyEvidenceCredential, publicJwks, sha256Hex, SCHEMA, POLICY } from './evidence-seal.mjs';
import { renderEvidencePage, renderEvidenceBadge } from './evidence-seal-view.mjs';

const usage='Usage: node protocol/evidence-seal-cli.mjs demo <outdir> | verify <jws-file> <jwks-file> <expected-issuer> <expected-subject> [unix-seconds] | hash <file>';
/** Well-known PUBLIC test seed. Non-production, intentionally reproducible. */
export function demoPrivateKey() { return createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,7)]),format:'der',type:'pkcs8'}); }
export function demoFixture() {
  const privateKey=demoPrivateKey(),kid='PUBLIC-TEST-ONLY-k1', jwks=publicJwks(createPublicKey(privateKey),kid);
  const evidenceBytes=Buffer.from(JSON.stringify({notice:'LOCAL TEST FIXTURE; no service was contacted',tools:['verify_record'],observed_at:'2026-11-06T20:00:00Z'}));
  const payload={schema:SCHEMA,policy:POLICY,iss:'https://issuer.example',sub:'https://service.example/mcp',jti:'urn:uuid:00000000-0000-4000-8000-000000000001',iat:1794000000,exp:1794003600,issuer_relationship:'self',decision:'observed',evidence:[{id:'demo-fixture',kind:'mcp_discovery',url:'https://service.example/mcp',sha256:sha256Hex(evidenceBytes),observed_at:1794000000,collector:'issuer',scope:'read_only'}],limitations:['This is self-asserted test-only evidence; no external service was contacted.','Does not prove tool execution, product authenticity, paid settlement, safety, or regulatory certification.']};
  const credential=issueEvidenceCredential(payload,{privateKey,kid,jwks});
  return {jwks,payload,credential,evidenceBytes};
}
export function cli(args) {
  if(args[0]==='demo'&&args.length===2) {
    const out=resolve(args[1]),f=demoFixture();mkdirSync(out,{recursive:true});
    writeFileSync(resolve(out,'test-only.jws'),f.credential+'\n');
    writeFileSync(resolve(out,'test-only-jwks.json'),JSON.stringify(f.jwks,null,2)+'\n');
    writeFileSync(resolve(out,'test-only-observation.json'),f.evidenceBytes);
    writeFileSync(resolve(out,'test-only-view.html'),renderEvidencePage({credential:f.credential,jwks:f.jwks,expectedIssuer:f.payload.iss,expectedSubject:f.payload.sub,now:f.payload.iat+1}));
    writeFileSync(resolve(out,'test-only-badge.svg'),renderEvidenceBadge({credential:f.credential,jwks:f.jwks,expectedIssuer:f.payload.iss,expectedSubject:f.payload.sub,now:f.payload.iat+1}));
    process.stdout.write('TEST ONLY artifacts created; no AuthiChain production SEAL issued.\n');return 0;
  }
  if(args[0]==='verify'&&(args.length===5||args.length===6)) {
    const credential=readFileSync(args[1],'utf8').trim(),jwks=JSON.parse(readFileSync(args[2],'utf8'));
    const now=args.length===6?Number(args[5]):Math.floor(Date.now()/1000);
    const r=verifyEvidenceCredential(credential,jwks,{expectedIssuer:args[3],expectedSubject:args[4],now});
    process.stdout.write(JSON.stringify({...r,payload:r.valid?{jti:r.payload.jti,iss:r.payload.iss,sub:r.payload.sub,scope:r.payload.decision,limitations:r.payload.limitations}:null},null,2)+'\n');
    return r.valid?0:1;
  }
  if(args[0]==='hash'&&args.length===2) {process.stdout.write(sha256Hex(readFileSync(args[1]))+'\n');return 0;}
  process.stderr.write(usage+'\n');return 2;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) process.exitCode=cli(process.argv.slice(2));
