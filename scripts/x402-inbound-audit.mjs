#!/usr/bin/env node
// Read-only public Base-USDC ledger audit. No key, no POST, no payment, no customer claims.
import {readPublicBaseReceipts} from "./x402-inbound-receipts.mjs";
try{
 const proof=await readPublicBaseReceipts();
 console.log(JSON.stringify(proof,null,2));
 if(!proof.fetchedHistoryComplete)process.exitCode=2;
}catch(e){
 console.error("x402 public receipt audit unavailable:",e instanceof Error?e.message:"unknown");
 process.exitCode=1;
}
