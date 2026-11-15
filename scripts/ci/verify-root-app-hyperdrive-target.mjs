#!/usr/bin/env node
// Read-only Cloudflare attestation. Never print connection credentials or provider response bodies.
const fail = (message) => { console.error("::error::"+message); process.exitCode=1; };
const ref=process.env.EXPECTED_SUPABASE_REF;
const token=process.env.CLOUDFLARE_API_TOKEN;
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!/^[a-z0-9]{20}$/.test(ref||"")||!token||!/^[a-f0-9]{32}$/.test(account||"")){
  fail("Missing expected project or protected Cloudflare credentials");
}else{
  try{
    const headers={Authorization:"Bearer "+token,Accept:"application/json"};
    const get=async path=>{
      const r=await fetch("https://api.cloudflare.com/client/v4"+path,{headers});
      if(!r.ok)throw Error("Cloudflare read denied");
      const j=await r.json();
      if(j.success!==true||!j.result)throw Error("Cloudflare read incomplete");
      return j.result;
    };
    const settings=await get("/accounts/"+account+"/workers/scripts/authichain-app/settings");
    const bindings=settings.bindings||[];
    const hd=bindings.filter(b=>b.type==="hyperdrive"&&b.name==="HYPERDRIVE");
    if(hd.length!==1||!hd[0].id)throw Error("Root app Hyperdrive binding missing or ambiguous");
    const cfg=await get("/accounts/"+account+"/hyperdrive/configs/"+encodeURIComponent(hd[0].id));
    const origin=cfg.origin||{};
    const pooler=typeof origin.host==="string"&&origin.host.endsWith(".pooler.supabase.com")&&origin.user==="postgres."+ref;
    const direct=origin.host==="db."+ref+".supabase.co"&&origin.user==="postgres";
    if(!(pooler||direct)||origin.database!=="postgres")throw Error("Root app Hyperdrive target does not match attested Supabase project");
    console.log("ROOT_APP_HYPERDRIVE_TARGET_MATCH: configured Worker binding and database project agree");
  }catch{fail("Root app Hyperdrive project attestation unavailable or mismatched; release held");}
}
