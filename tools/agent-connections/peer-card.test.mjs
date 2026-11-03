import test from "node:test";
import assert from "node:assert/strict";
import {inspectPeerCard} from "./peer-card.mjs";

const origin = "https://peer.example/";
const card = {
  name:"Independent A2A Agent",
  skills:[{id:"hello",name:"Hello"}],
  supportedInterfaces:[{url:"https://peer.example/a2a",protocolBinding:"JSONRPC",protocolVersion:"1.0"}],
};
test("valid card is still not connected or authenticated",()=>{
  const r=inspectPeerCard(card,origin);
  assert.equal(r.status,"COMPATIBLE_PENDING_PEER_OWNER_APPROVAL");
  assert.equal(r.connected,false);
  assert.equal(r.issuer_verified,false);
  assert.equal(r.message_sent,false);
  assert.equal(r.paid,false);
});
test("owner approval changes review state but never starts a connection",()=>{
  const r=inspectPeerCard(card,origin,{peerOwnerApproved:true});
  assert.equal(r.status,"COMPATIBLE_WITH_OWNER_APPROVAL_NOT_CONNECTED");
  assert.equal(r.connected,false);
});
test("cross-origin target is rejected",()=>{
  const r=inspectPeerCard({...card,supportedInterfaces:[{...card.supportedInterfaces[0],url:"https://attacker.example/a2a"}]},origin);
  assert.ok(r.problems.includes("NO_MATCHING_A2A_1_0_INTERFACE"));
});
test("refuse localhost, IP literals, HTTP and credential-bearing origins",()=>{
  for (const hostile of ["http://peer.example/","https://localhost/","https://127.0.0.1/","https://me:secret@peer.example/","https://peer.example:8443/","https://peer.example/?token=key"]) {
    const r=inspectPeerCard(card,hostile);
    assert.ok(r.problems.includes("EXPECTED_PEER_ORIGIN_INVALID"),hostile);
  }
});
test("reject missing skills, incompatible A2A version and empty cards",()=>{
  const missing = inspectPeerCard({...card,skills:[]},origin);
  assert.ok(missing.problems.includes("SKILLS_MISSING"));
  const old = inspectPeerCard({...card,supportedInterfaces:[{url:"https://peer.example/a2a",protocolBinding:"JSONRPC",protocolVersion:"0.3"}]},origin);
  assert.ok(old.problems.includes("NO_MATCHING_A2A_1_0_INTERFACE"));
  assert.equal(inspectPeerCard(null,origin).status,"INVALID_OR_INCOMPATIBLE");
});
