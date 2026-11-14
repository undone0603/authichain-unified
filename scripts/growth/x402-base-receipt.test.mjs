import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyBaseReceipt,fetchBaseReceipt} from './x402-base-receipt.mjs';
const txHash='0x'+'a'.repeat(64),recipient='0x'+'b'.repeat(40),sender='0x'+'c'.repeat(40);
const topic='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const word=x=>'0x'+x.slice(2).toLowerCase().padStart(64,'0');
const amount='10000';
const make=()=>({transactionHash:txHash,status:'0x1',blockNumber:'0x64',logs:[{address:'0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913',topics:[topic,word(sender),word(recipient)],data:'0x'+BigInt(amount).toString(16).padStart(64,'0')}]});
const verify=receipt=>verifyBaseReceipt({txHash,recipient,amount,receipt,headBlock:'0x70'});
test('valid confirmed USDC Transfer matches exact recipient and amount',()=>assert.equal(verify(make()).verified,true));
for(const [label,change] of [
 ['failed receipt',r=>r.status='0x0'],['wrong tx',r=>r.transactionHash='0x'+'d'.repeat(64)],
 ['wrong asset',r=>r.logs[0].address=sender],['wrong recipient',r=>r.logs[0].topics[2]=word(sender)],
 ['wrong amount',r=>r.logs[0].data='0x'+'0'.repeat(63)+'1'],['wrong topic',r=>r.logs[0].topics[0]=word(sender)],
 ['duplicate transfer',r=>r.logs.push({...r.logs[0]})],['bad block',r=>r.blockNumber='invalid']
]) test('fails closed '+label,()=>{const r=make();change(r);assert.equal(verify(r).verified,false);});
test('requires confirmation depth',()=>assert.equal(verifyBaseReceipt({txHash,recipient,amount,receipt:make(),headBlock:'0x64'}).verified,false));
test('no network request on invalid RPC target',async()=>{await assert.rejects(fetchBaseReceipt(txHash,{rpcUrl:'https://evil.example',recipient,amount,fetchImpl:()=>{throw Error('unexpected network')}}));});
test('mocked independent read-only RPC receipt check',async()=>{
 const methods=[];const fetchImpl=async(url,opts)=>{const body=JSON.parse(opts.body);methods.push(body.method);return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:body.method==='eth_getTransactionReceipt'?make():'0x70'})};};
 assert.equal((await fetchBaseReceipt(txHash,{recipient,amount,fetchImpl})).verified,true);
 assert.deepEqual(methods,['eth_getTransactionReceipt','eth_blockNumber']);
});
