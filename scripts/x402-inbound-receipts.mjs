/**
 * x402 inbound receipts: public-chain observation only.
 *
 * No wallet signing, outbound transfers, fund movement, paid API calls,
 * private credentials, vendor costs, or new storage. Never classify payer
 * independence or product delivery solely from a token Transfer event.
 */
export const TREASURY = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const UNIT_ATOMIC = "50000";
export const BLOCKSCOUT = "https://base.blockscout.com";
const lower=x=>String(x??"").toLowerCase();
const hashIsValid=x=>/^0x[a-f0-9]{64}$/i.test(String(x??""));
const addrIsValid=x=>/^0x[a-f0-9]{40}$/i.test(String(x??""));
const mask=a=>typeof a==="string"&&addrIsValid(a)?a.slice(0,8)+"…"+a.slice(-6):"invalid";
export function classifyTransfer(x){
  const contract=lower(x?.token?.address_hash);
  const src=lower(x?.from?.hash);
  const dst=lower(x?.to?.hash);
  const atomic=String(x?.total?.value??"");
  if(contract!==lower(BASE_USDC)||!addrIsValid(src)||!addrIsValid(dst)||
     lower(x?.token?.decimals)!=="6"||!/^(0|[1-9][0-9]{0,24})$/.test(atomic)||
     !hashIsValid(x?.transaction_hash)||
     typeof x?.timestamp!=="string"||!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}T/.test(x.timestamp)) return null;
  const direction=dst===lower(TREASURY)?"incoming":src===lower(TREASURY)?"outgoing":"unrelated";
  return{
    tx:lower(x.transaction_hash),time:x.timestamp,day:x.timestamp.slice(0,10),
    src,dst,amountAtomic:atomic,direction,
    selfTransfer:src===lower(TREASURY)&&dst===lower(TREASURY),
    exactFiveCent:atomic===UNIT_ATOMIC
  };
}
export function assessTransfers(items,{historyComplete=false}={}){
  if(!Array.isArray(items)||items.length>2500)throw Error("INVALID_TRANSFER_LIST");
  const seen=new Set(),clean=[];
  for(const raw of items){
    const t=classifyTransfer(raw);
    if(!t||seen.has(t.tx+":"+t.src+":"+t.dst+":"+t.amountAtomic))continue;
    seen.add(t.tx+":"+t.src+":"+t.dst+":"+t.amountAtomic);
    clean.push(t);
  }
  const five=clean.filter(x=>x.direction==="incoming"&&x.exactFiveCent&&!x.selfTransfer);
  const payerAddrs=new Set(five.map(x=>x.src));
  const possibleTreasuryFunded=clean.filter(x=>x.direction==="outgoing"&&payerAddrs.has(x.dst));
  const daily={};
  for(const t of five){
    const line=daily[t.day]??{count:0,amountAtomic:"0"};
    line.count++;
    line.amountAtomic=String(BigInt(line.amountAtomic)+BigInt(t.amountAtomic));
    daily[t.day]=line;
  }
  const sum=five.reduce((n,t)=>n+BigInt(t.amountAtomic),0n);
  return{
    schema:"authichain-x402-inbound-observation/1",
    network:"eip155:8453",asset:BASE_USDC,treasury:TREASURY,
    source:"Base Blockscout ERC-20 event history; not processor/customer attribution",
    fetchedHistoryComplete:historyComplete,
    matchedFiveCentTransfers:five.length,
    observedAtomic:sum.toString(),
    observedUsdc:(Number(sum)/1e6).toFixed(2),
    distinctSourceAddresses:payerAddrs.size,
    dayCounts:daily,
    observedPayerShortIds:[...payerAddrs].sort().map(mask),
    lastObservedDay:five.length?five.map(x=>x.day).sort().at(-1):null,
    directTreasuryToObservedPayersInFetchedHistory:possibleTreasuryFunded.length,
    treasuryFundingExclusionVerified:false,
    independentBuyerVerified:false,
    paidServiceDeliveryVerified:false,
    qualifyingCustomerRevenue:false,
    settlementMeaning:"Confirmed-looking public transfer events, NOT proof of independent customer funding or a delivered x402 service",
    evidenceTxHashes:five.map(x=>x.tx).sort(),
    nextEvidence:[
      "Resolve source-wallet ownership and related-party funding privately",
      "Verify paid API response and facilitator settlement receipt for each transfer",
      "Exclude founder, self, wallet recycling, refund, and promotional-funded activity",
      "Match source transaction to durable signed service delivery with unique idempotency key"
    ]
  };
}
/** Fixed Blockscout origin only. Does not pay; never signs, mutates or fetches arbitrary URLs. */
export async function readPublicBaseReceipts({fetchImpl=fetch,maxPages=5}={}){
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>5)throw Error("INVALID_PAGE_CAP");
  const all=[];
  let params=null,finished=false;
  for(let page=0;page<maxPages;page++){
    const url=new URL(BLOCKSCOUT+"/api/v2/addresses/"+TREASURY+"/token-transfers");
    url.searchParams.set("type","ERC-20");
    if(params){
      if(!params||typeof params!=="object"||Array.isArray(params))throw Error("INVALID_NEXT_PAGE");
      for(const [k,v] of Object.entries(params)){
        if(!/^[a-z_]{1,35}$/.test(k)||!["string","number"].includes(typeof v)||String(v).length>150)
          throw Error("INVALID_NEXT_PAGE");
        url.searchParams.set(k,String(v));
      }
    }
    const res=await fetchImpl(url.toString(),{
      method:"GET",
      headers:{accept:"application/json","user-agent":"authichain-receipt-audit/1"},
      redirect:"error",
      signal:AbortSignal.timeout(12000)
    });
    if(!res.ok||!String(res.headers.get("content-type")??"").includes("application/json"))
      throw Error("BLOCKSCOUT_NOT_AVAILABLE");
    const body=await res.text();
    if(body.length>1_500_000)throw Error("RESPONSE_TOO_LARGE");
    let d;try{d=JSON.parse(body)}catch{throw Error("INVALID_RESPONSE")}
    if(!Array.isArray(d.items)||d.items.length>500)throw Error("INVALID_RESPONSE");
    all.push(...d.items);
    if(!d.next_page_params){finished=true;break;}
    params=d.next_page_params;
  }
  return assessTransfers(all,{historyComplete:finished});
}
