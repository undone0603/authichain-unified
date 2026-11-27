import test from "node:test";
import assert from "node:assert/strict";
import {TREASURY,BASE_USDC,UNIT_ATOMIC,classifyTransfer,assessTransfers,readPublicBaseReceipts} from "./x402-inbound-receipts.mjs";
const A="0x"+"1".repeat(40),B="0x"+"2".repeat(40),C="0x"+"3".repeat(40);
const usdc=(from,to,amount,tx,day="2026-10-29")=>({
 token:{address_hash:BASE_USDC,decimals:"6"},
 from:{hash:from},to:{hash:to},total:{value:String(amount)},
 transaction_hash:"0x"+tx.repeat(64),timestamp:day+"T09:00:00.000Z"
});
test("detects valid exact 5-cent Base USDC inbound transfers",()=>{
 const r=assessTransfers([usdc(A,TREASURY,UNIT_ATOMIC,"a"),usdc(B,TREASURY,UNIT_ATOMIC,"b")],{historyComplete:true});
 assert.equal(r.matchedFiveCentTransfers,2);
 assert.equal(r.observedUsdc,"0.10");
 assert.equal(r.distinctSourceAddresses,2);
 assert.equal(r.fetchedHistoryComplete,true);
});
test("same transfer recorded twice is not revenue twice",()=>{
 const t=usdc(A,TREASURY,50000,"a");
 assert.equal(assessTransfers([t,t]).matchedFiveCentTransfers,1);
});
test("own-wallet transfers and other amounts are excluded",()=>{
 const r=assessTransfers([
  usdc(TREASURY,TREASURY,50000,"a"),
  usdc(A,TREASURY,150000,"b"),
  usdc(C,TREASURY,50000,"c"),
  usdc(A,B,50000,"d")
 ]);
 assert.equal(r.matchedFiveCentTransfers,1);
 assert.equal(r.observedUsdc,"0.05");
});
test("unrelated token or malformed chain evidence ignored",()=>{
 const wrong=usdc(A,TREASURY,50000,"a");wrong.token.address_hash=A;
 const bad=usdc(A,TREASURY,50000,"b");bad.transaction_hash="not-hash";
 assert.equal(classifyTransfer(wrong),null);
 assert.equal(classifyTransfer(bad),null);
 assert.equal(assessTransfers([wrong,bad]).matchedFiveCentTransfers,0);
});
test("outgoing direct treasury funding is a reason for review not positive revenue",()=>{
 const r=assessTransfers([usdc(TREASURY,A,500000,"a"),usdc(A,TREASURY,50000,"b")]);
 assert.equal(r.directTreasuryToObservedPayersInFetchedHistory,1);
 assert.equal(r.treasuryFundingExclusionVerified,false);
 assert.equal(r.independentBuyerVerified,false);
 assert.equal(r.qualifyingCustomerRevenue,false);
});
test("even all valid transfers never assert customer independence or paid product delivery",()=>{
 const r=assessTransfers([usdc(A,TREASURY,50000,"a")]);
 assert.equal(r.qualifyingCustomerRevenue,false);
 assert.equal(r.paidServiceDeliveryVerified,false);
 assert.equal(r.independentBuyerVerified,false);
});
test("network reader calls only fixed Blockscout URL, never POSTs",async()=>{
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  calls.push({url,method:opts.method,headers:opts.headers});
  return new Response(JSON.stringify({items:[usdc(A,TREASURY,50000,"a")],next_page_params:null}),
   {headers:{"content-type":"application/json"}});
 };
 const r=await readPublicBaseReceipts({fetchImpl});
 assert.equal(r.observedUsdc,"0.05");
 assert.equal(calls.length,1);
 assert.equal(calls[0].method,"GET");
 assert.ok(calls[0].url.startsWith("https://base.blockscout.com/api/v2/addresses/"));
 assert.equal(r.fetchedHistoryComplete,true);
});
test("bad upstream response fails closed",async()=>{
 const fetchImpl=async()=>new Response("<html>login</html>",{headers:{"content-type":"text/html"}});
 await assert.rejects(readPublicBaseReceipts({fetchImpl}),/BLOCKSCOUT_NOT_AVAILABLE/);
});
test("paginated reader has a hard cap and cannot follow redirect",async()=>{
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  calls.push({url,opts});
  return new Response(JSON.stringify({items:[],next_page_params:{block_number:1}}),
    {headers:{"content-type":"application/json"}});
 };
 const r=await readPublicBaseReceipts({fetchImpl,maxPages:2});
 assert.equal(calls.length,2);
 assert.equal(r.fetchedHistoryComplete,false);
 assert.equal(calls[0].opts.redirect,"error");
 await assert.rejects(readPublicBaseReceipts({fetchImpl,maxPages:6}),/INVALID_PAGE_CAP/);
});
test("untrusted next_page_params rejects arbitrary URLs and unsafe keys",async()=>{
 const fetchImpl=async()=>new Response(JSON.stringify({items:[],next_page_params:{"url":"http://attacker.example/"+ "x".repeat(200)}}),
   {headers:{"content-type":"application/json"}});
 await assert.rejects(readPublicBaseReceipts({fetchImpl,maxPages:2}),/INVALID_NEXT_PAGE/);
});
