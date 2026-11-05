#!/usr/bin/env node
/** Offline proposal CLI for AgentZ. No network, secrets, account, or purchase. */
import {evaluateNegotiation} from "../../workers/authichain-com/src/negotiation-engine.mjs";
let raw="";
try{
  for await(const chunk of process.stdin){
    raw+=chunk.toString("utf8");
    if(Buffer.byteLength(raw,"utf8")>16*1024)throw Error("payload exceeds 16 KiB");
  }
  const input=JSON.parse(raw);
  const report=evaluateNegotiation(input);
  process.stdout.write(JSON.stringify(report)+"\n");
}catch(e){
  console.error(e instanceof Error?e.name:"INVALID_INPUT");
  process.exitCode=1;
}
