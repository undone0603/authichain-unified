// Read-only independent Base receipt verification. No wallet, transfers, or writes.
const USDC='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const HASH=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const WORD=/^0x[0-9a-fA-F]{64}$/;
function rpcQuantity(v) { if(typeof v!=='string'||!/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(v)) throw Error('invalid_rpc_quantity');return BigInt(v); }
export function verifyBaseReceipt({txHash,recipient,amount,receipt,headBlock,minConfirmations=12}) {
  if(!HASH.test(txHash||'')||!ADDRESS.test(recipient||'')||!/^[1-9][0-9]*$/.test(String(amount))||
     !Number.isSafeInteger(minConfirmations)||minConfirmations<1||minConfirmations>10000) return {verified:false,reason:'invalid_request'};
  if(!receipt||String(receipt.transactionHash).toLowerCase()!==txHash.toLowerCase()||
     receipt.status!=='0x1'||!Array.isArray(receipt.logs)) return {verified:false,reason:'unsuccessful_or_missing_receipt'};
  let confirmations;
  try {const block=rpcQuantity(receipt.blockNumber),head=rpcQuantity(headBlock);confirmations=head>=block?head-block+1n:0n;}
  catch {return {verified:false,reason:'invalid_block_evidence'};}
  if(confirmations<BigInt(minConfirmations)) return {verified:false,reason:'insufficient_confirmations'};
  const expected='0x'+recipient.slice(2).toLowerCase().padStart(64,'0');
  const matches=receipt.logs.filter(l=>String(l.address).toLowerCase()===USDC&&
    Array.isArray(l.topics)&&l.topics.length===3&&String(l.topics[0]).toLowerCase()===TRANSFER&&
    String(l.topics[2]).toLowerCase()===expected);
  if(matches.length!==1) return {verified:false,reason:'missing_or_ambiguous_usdc_transfer'};
  const log=matches[0];
  if(!WORD.test(log.topics[1])||!WORD.test(log.data)||BigInt(log.data)!==BigInt(amount))
    return {verified:false,reason:'invalid_transfer_amount_or_sender'};
  return {verified:true,txHash:txHash.toLowerCase(),recipient:recipient.toLowerCase(),amountAtomic:String(amount),confirmations:confirmations.toString()};
}
export async function fetchBaseReceipt(txHash,{fetchImpl=fetch,rpcUrl='https://mainnet.base.org',minConfirmations=12,recipient,amount}={}) {
  if(!HASH.test(txHash||'')||rpcUrl!=='https://mainnet.base.org') throw Error('invalid_rpc_target');
  const call=async(method,params)=>{const response=await fetchImpl(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw Error('rpc_http_error');const json=await response.json();if(json.error||json.id!==1||json.jsonrpc!=='2.0')throw Error('rpc_response_error');return json.result;};
  const receipt=await call('eth_getTransactionReceipt',[txHash]);
  const headBlock=await call('eth_blockNumber',[]);
  return verifyBaseReceipt({txHash,recipient,amount,receipt,headBlock,minConfirmations});
}
