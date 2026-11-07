import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { canonicalize, issueEvidenceCredential, publicJwks, verifyEvidenceCredential, validatePayload, sha256Hex, SCHEMA, JWS_TYP, POLICY } from './evidence-seal.mjs';
import { demoFixture, demoPrivateKey } from './evidence-seal-cli.mjs';
import { renderEvidenceBadge, renderEvidencePage } from './evidence-seal-view.mjs';

const f=demoFixture(), privateKey=demoPrivateKey(),kid='PUBLIC-TEST-ONLY-k1';
const base=f.payload;
const checked=(jws=f.credential,jwks=f.jwks,opts={})=>verifyEvidenceCredential(jws,jwks,{expectedIssuer:base.iss,expectedSubject:base.sub,now:base.iat+60,...opts});
const issue=(updates={})=>issueEvidenceCredential({...base,...updates},{privateKey,kid,jwks:f.jwks});
const mutate=(value)=>Buffer.from(value,'utf8').toString('base64url');
const parts=f.credential.split('.');
const badReceipt=(seg,val)=>parts.map((v,i)=>i===seg?val:v).join('.');
const expectReason=(r, reason)=>{assert.equal(r.valid,false,JSON.stringify(r));assert.equal(r.reason,reason)};

test('reproducible deterministic fixture signed with public, non-production test-only key',()=>{
  assert.equal(demoFixture().credential,f.credential);
  assert.equal(checked().valid,true);
  assert.deepEqual(f.jwks.keys.map(k=>k.kid),[kid]);
  assert.equal(f.jwks.keys[0].d,undefined);
});
test('signed receipt explicitly discloses self-issuance, does not assert independent evidence',()=>{
  let v=checked();assert.equal(v.evidence_verification,'not_performed');assert.equal(v.issuer_relationship,'self');assert.equal(v.payload.decision,'observed');
});
test('offline verifier pins both issuer and subject',()=>{
  expectReason(checked(f.credential,f.jwks,{expectedIssuer:'https://another.example'}),'wrong_issuer_or_subject');
  expectReason(checked(f.credential,f.jwks,{expectedSubject:'https://wrong.example/mcp'}),'wrong_issuer_or_subject');
  expectReason(verifyEvidenceCredential(f.credential,f.jwks,{}),'missing_expected_identity');
});
test('tampered payload rejected',()=>expectReason(checked(badReceipt(1,mutate(canonicalize({...base,decision:'indeterminate'})))),'invalid_signature'));
test('tampered signature rejected',()=>expectReason(checked(badReceipt(2,mutate('tampered'))),'invalid_signature'));
test('unknown signing key id rejected before validation',()=>{
  const h={alg:'EdDSA',kid:'other',typ:JWS_TYP};expectReason(checked(badReceipt(0,mutate(canonicalize(h)))),'unknown_kid');
});
test('wrong algorithm, typ and header extras rejected',()=>{
  for (let h of [{alg:'none',kid,typ:JWS_TYP},{alg:'HS256',kid,typ:JWS_TYP},{alg:'EdDSA',kid,typ:'JWT'},{alg:'EdDSA',kid,typ:JWS_TYP,crit:['exp']}])expectReason(checked(badReceipt(0,mutate(canonicalize(h)))),'invalid_protected_header');
});
test('no non-canonical headers or payloads accepted',()=>{
  const h=JSON.stringify({typ:JWS_TYP,kid,alg:'EdDSA'});
  expectReason(checked(badReceipt(0,mutate(h))),'non_canonical_json');
  const p=JSON.stringify({...base,decision:'observed'});
  expectReason(checked(badReceipt(1,mutate(p))),'non_canonical_json');
});
test('duplicate JSON keys refused via non-canonical roundtrip',()=>{
  const x=`{"alg":"EdDSA","kid":"${kid}","kid":"${kid}","typ":"${JWS_TYP}"}`;
  expectReason(checked(badReceipt(0,mutate(x))),'non_canonical_json');
});
test('private key or incompatible curve in published JWKS rejected',()=>{
  let keys={keys:[{...f.jwks.keys[0],d:'PRIVATE'}]};expectReason(checked(f.credential,keys),'private_key_disclosure');
  keys={keys:[{...f.jwks.keys[0],crv:'X25519'}]};expectReason(checked(f.credential,keys),'invalid_key_type');
  keys={keys:[f.jwks.keys[0],f.jwks.keys[0]]};expectReason(checked(f.credential,keys),'invalid_or_duplicate_kid');
});
test('key rotation fails closed for removed public key',()=>{
  const z=generateKeyPairSync('ed25519');expectReason(checked(f.credential,publicJwks(z.publicKey,'new-key')),'unknown_kid');
});
test('wrong signer private key refused at issuance',()=>{
  const z=generateKeyPairSync('ed25519');assert.throws(()=>issueEvidenceCredential(base,{privateKey:z.privateKey,kid,jwks:f.jwks}),/signer_key_mismatch/);
});
test('expired and future-issued JWS refused',()=>{
  expectReason(checked(f.credential,f.jwks,{now:base.exp}),'expired');
  expectReason(checked(f.credential,f.jwks,{now:base.iat-301}),'not_yet_valid');
  assert.equal(checked(f.credential,f.jwks,{now:base.iat-300}).valid,true);
});
test('durable revocation list excludes an otherwise valid JWS',()=>{
  expectReason(checked(f.credential,f.jwks,{revokedIds:new Set([base.jti])}),'revoked');
});
test('evidence reference is a digest, not accepted as independently validated',()=>{
  assert.equal(f.evidenceBytes.toString('utf8').includes('LOCAL TEST FIXTURE'),true);
  assert.equal(sha256Hex(f.evidenceBytes),base.evidence[0].sha256);
});
test('evidence older than one day cannot be signed',()=>{
  assert.throws(()=>issue({evidence:[{...base.evidence[0],observed_at:base.iat-86401}]}),/stale_or_future_evidence/);
  assert.throws(()=>issue({evidence:[{...base.evidence[0],observed_at:base.iat+1}]}),/stale_or_future_evidence/);
});
test('lifetime over 24h and inverted timestamps cannot be signed',()=>{
  assert.throws(()=>issue({exp:base.iat+86401}),/invalid_lifetime/);
  assert.throws(()=>issue({exp:base.iat}),/invalid_lifetime/);
});
test('no paid settlement, fulfilled entitlement or product authenticity assertion kind permitted in v0.1',()=>{
  for(const kind of ['paid_transaction','entitlement','physical_authenticity','certified_safe'])assert.throws(()=>issue({evidence:[{...base.evidence[0],kind}]}),/unknown_evidence_kind/);
});
test('no fabricated independent collector designation',()=>{
  assert.throws(()=>issue({evidence:[{...base.evidence[0],collector:'external'}]}),/unverified_independent_claim/);
  assert.throws(()=>issue({issuer_relationship:'independent'}),/unverified_independent_claim/);
});
test('fail closed for missing limitations',()=>{
  assert.throws(()=>issue({limitations:[]}),/missing_limitations/);
  assert.throws(()=>issue({limitations:['All good','Not paid']}),/missing_issuer_disclosure/);
});
test('unknown decision values including verified / bronze / gold forbidden',()=>{
  for(let decision of ['verified','bronze','gold','certified'])assert.throws(()=>issue({decision}),/invalid_decision/);
});
test('arbitrary extra claims, hidden trust levels or payment wording forbidden',()=>{
  assert.throws(()=>issue({level:'gold'}),/unexpected_payload_fields/);
  assert.throws(()=>issue({evidence:[{...base.evidence[0],paid:true}]}),/unexpected_evidence_fields/);
});
test('claims with insecure, secret-bearing or unsafe URLs blocked',()=>{
  for(let url of ['http://service.example/','javascript:alert(1)','https://user:pass@example.org','https://foo.test/?token=secret','https://x.test/#frag'])assert.throws(()=>issue({evidence:[{...base.evidence[0],url}]}),/invalid_evidence_reference/);
});
test('duplicate evidence ids rejected',()=>assert.throws(()=>issue({evidence:[base.evidence[0],base.evidence[0]]}),/invalid_evidence_id/));
test('bad digest refused',()=>assert.throws(()=>issue({evidence:[{...base.evidence[0],sha256:'a'.repeat(63)}]}),/invalid_evidence_reference/));
test('unverified signatures render no success and no active badge',()=>{
  let opts={credential:badReceipt(2,mutate('tampered')),jwks:f.jwks,expectedIssuer:base.iss,expectedSubject:base.sub,now:base.iat+60};
  let html=renderEvidencePage(opts),svg=renderEvidenceBadge(opts);
  assert.match(html,/No valid current credential/);assert.doesNotMatch(html,/Signature verified/);assert.match(svg,/NO VALID CREDENTIAL/);
});
test('verified presentation still says self-issued and not certification',()=>{
  let opts={credential:f.credential,jwks:f.jwks,expectedIssuer:base.iss,expectedSubject:base.sub,now:base.iat+60};
  assert.match(renderEvidencePage(opts),/SELF-ISSUED/);
  assert.match(renderEvidencePage(opts),/Signature verified — evidence uncorroborated/);
  assert.match(renderEvidenceBadge(opts),/NOT CERTIFICATION/);
});
test('presentation escapes arbitrary controlled evidence identifiers',()=>{
  let evil=issue({evidence:[{...base.evidence[0],id:'<img src=x onerror=alert(1)>'}]});
  let html=renderEvidencePage({credential:evil,jwks:f.jwks,expectedIssuer:base.iss,expectedSubject:base.sub,now:base.iat+60});
  assert.match(html,/&lt;img/); assert.doesNotMatch(html,/<img src=x onerror=/);
});
test('reproducible CLI demo command and verify command succeeds at pinned time, fails when expired',()=>{
  let out=mkdtempSync(join(tmpdir(),'authichain-aec-test-'));let cli=resolve('protocol/evidence-seal-cli.mjs');
  let a=spawnSync(process.execPath,[cli,'demo',out],{encoding:'utf8'}); assert.equal(a.status,0,a.stderr);
  let args=[cli,'verify',join(out,'test-only.jws'),join(out,'test-only-jwks.json'),base.iss,base.sub];
  let good=spawnSync(process.execPath,[...args,String(base.iat+10)],{encoding:'utf8'});assert.equal(good.status,0,good.stderr);
  let stale=spawnSync(process.execPath,[...args,String(base.exp)],{encoding:'utf8'});assert.equal(stale.status,1,stale.stderr);
  assert.equal(readFileSync(join(out,'test-only.jws'),'utf8').trim(),f.credential);
});
test('strict protected header rejects alternate payload representations',()=>{
  expectReason(checked(badReceipt(0,'=g')),'malformed_base64url');
  expectReason(checked('a.b.c.d'),'malformed_receipt');
});
test('issuer refuses non-Ed25519 public keys',()=>{
  const bad=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  assert.throws(()=>publicJwks(bad.publicKey,'wrong-type'),/invalid_public_key_type/);
});
test('source references cannot point to private network or credential-bearing URI',()=>{
  for (let url of ['https://127.0.0.1/private','https://192.168.1.1/admin','https://localhost/admin','https://host.test/thing?api_key=secret','https://host.test?session_id=abc'])
    assert.throws(()=>issue({evidence:[{...base.evidence[0],url}]}),/invalid_evidence_reference/);
});
