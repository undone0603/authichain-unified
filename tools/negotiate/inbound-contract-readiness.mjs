#!/usr/bin/env node
/** AgentZ audit-only stdin transport. Never transmits or retains contract data. */
import {assessInboundSupplierContract} from "../../workers/authichain-com/src/inbound-contract-gate.mjs";
let raw="";
try {
 for await(const chunk of process.stdin){
   raw+=chunk.toString("utf8");
   if(Buffer.byteLength(raw,"utf8")>64*1024)throw Error("INPUT_LIMIT");
 }
 const input=raw.trim()?JSON.parse(raw):{};
 if(!input || typeof input!=="object" || Array.isArray(input))throw Error("INVALID_INPUT");
 const report=assessInboundSupplierContract(input);
 process.stdout.write(JSON.stringify(report)+"\n");
}catch(e){
 console.error(e instanceof Error?e.message:"INVALID_INPUT");
 process.exitCode=1;
}
