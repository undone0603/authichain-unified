import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {reconcileAuthenticated} from './x402-reconcile.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const pub=publicKey.export({type:'spki',format:'pem'});
const txHash='0x'+'a'.repeat(64),payTo='0x'+'b'.repeat(40),sender='0x'+'c'.repeat(40),resource='/api/x402/discovery';
const token='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const topic='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const word=x=>'0x'+x.slice(2).padStart(64,'0');
function fixture(){const delivery={requestId:'req-1',txHash,resource,status:'fulfilled',httpStatus:200};
const message=JSON.stringify(delivery);delivery.signature=sign(null,Buffer.from(message),privateKey).toString('base64url');
return {requests:[{requestId:'req-1',txHash,network:'eip155:8453',token,payTo,amount:'10000',resource,payerClass:'external',payerClassEvidence:'independently_verified',authorized:true,occurredAt:'2026-11-13T20:00:00Z'}],offerEvidence:{version:'signal-2026-11-13',source:'https://signal.authichain.com/offer',observedAt:'2026-11-13T19:00:00Z',validFrom:'2026-11-13T00:00:00Z',validUntil:'2026-11-14T00:00:00Z',network:'eip155:8453',token,amount:'10000',payTo,resource},deliveries:[delivery]};}
const receipt={transactionHash:txHash,status:'0x1',blockNumber:'0x64',logs:[{address:token,topics:[topic,word(sender),word(payTo)],data:'0x'+BigInt(10000).toString(16).padStart(64,'0')}]};
function mockFetch(result=receipt){return async(_url,options)=>{const {method}=JSON.parse(options.body);return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:method==='eth_getTransactionReceipt'?result:'0x70'})};};}
test('authenticated receipt and signed delivery remain partial evidence',async()=>{const x=await reconcileAuthenticated(fixture(),{trustedDeliveryPublicKey:pub,trustedRecipient:payTo,fetchImpl:mockFetch()});assert.equal(x.totals.verifiedExternalFulfilled,0);assert.equal(x.totals.verifiedAtomicUSDC,'0');assert.equal(x.totals.settlementDeliveryVerified,1);assert.equal(x.totals.settlementDeliveryAtomicUSDC,'10000');assert.equal(x.rows[0].status,'settlement_delivery_verified_payer_unconfirmed');});
test('forged delivery signature fails closed',async()=>{const x=fixture();x.deliveries[0].httpStatus=402;assert.equal((await reconcileAuthenticated(x,{trustedDeliveryPublicKey:pub,trustedRecipient:payTo,fetchImpl:mockFetch()})).totals.settlementDeliveryVerified,0);});
test('wrong trusted key fails closed',async()=>{const other=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});assert.equal((await reconcileAuthenticated(fixture(),{trustedDeliveryPublicKey:other,trustedRecipient:payTo,fetchImpl:mockFetch()})).totals.settlementDeliveryVerified,0);});
test('RPC failure never becomes revenue',async()=>{const x=await reconcileAuthenticated(fixture(),{trustedDeliveryPublicKey:pub,trustedRecipient:payTo,fetchImpl:async()=>{throw Error('offline');}});assert.equal(x.totals.settlementDeliveryVerified,0);});
test('missing trusted public key rejected',async()=>await assert.rejects(reconcileAuthenticated(fixture(),{})));
test('failed onchain receipt cannot qualify',async()=>{const x=await reconcileAuthenticated(fixture(),{trustedDeliveryPublicKey:pub,trustedRecipient:payTo,fetchImpl:mockFetch({...receipt,status:'0x0'})});assert.equal(x.totals.settlementDeliveryVerified,0);});

test('missing trusted recipient rejected before an RPC request',async()=>await assert.rejects(reconcileAuthenticated(fixture(),{trustedDeliveryPublicKey:pub,fetchImpl:()=>{throw Error('unexpected network');}}),/trusted recipient/));
test('manifest payee mismatch against independently configured recipient fails closed',async()=>{const x=await reconcileAuthenticated(fixture(),{trustedDeliveryPublicKey:pub,trustedRecipient:'0x'+'d'.repeat(40),fetchImpl:mockFetch()});assert.equal(x.totals.settlementDeliveryVerified,0);});

test('unattested buyer claims cannot become qualified revenue',async()=>{
  const x=await reconcileAuthenticated(fixture(),{trustedDeliveryPublicKey:pub,trustedRecipient:payTo,fetchImpl:mockFetch()});
  assert.equal(x.totals.verifiedExternalFulfilled,0);
  assert.equal(x.totals.settlementDeliveryVerified,1);
});

test('authenticated reconciliation rejects missing dated offer',async()=>{const x=fixture();delete x.offerEvidence;const result=await reconcileAuthenticated(x,{trustedDeliveryPublicKey:pub,trustedRecipient:payTo,fetchImpl:mockFetch()});assert.equal(result.totals.settlementDeliveryVerified,0);assert.equal(result.totals.verifiedExternalFulfilled,0);});
test('authenticated reconciliation rejects expired dated offer',async()=>{const x=fixture();x.offerEvidence.validUntil='2026-11-12T00:00:00Z';const result=await reconcileAuthenticated(x,{trustedDeliveryPublicKey:pub,trustedRecipient:payTo,fetchImpl:mockFetch()});assert.equal(result.totals.settlementDeliveryVerified,0);assert.equal(result.totals.verifiedExternalFulfilled,0);});
