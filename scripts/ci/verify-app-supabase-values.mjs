#!/usr/bin/env node
// Fail-closed pre-publish check for protected, explicitly attested application values.
// Cloudflare secret_text bindings are opaque to read-only API clients. This checks
// separately supplied environment-scoped values; it does NOT prove live secret equality.
const ref=process.env.EXPECTED_SUPABASE_REF;
const error=()=>{console.error("::error::Protected application Supabase target missing or mismatched; release held");process.exitCode=1};
const parse=(v)=>{try{return new URL(v)}catch{return null}};
const app=parse(process.env.AUTHICHAIN_PRODUCTION_APP_SUPABASE_URL);
const pub=parse(process.env.NEXT_PUBLIC_SUPABASE_URL);
const db=parse(process.env.AUTHICHAIN_PRODUCTION_APP_DATABASE_URL);
const validHttp=(u)=>u?.protocol==="https:"&&u.hostname===ref+".supabase.co"&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&u.pathname==="/";
const validDb=(u)=>{
  if(!u||!["postgres:","postgresql:"].includes(u.protocol)||!u.username||!u.password||u.pathname!=="/postgres"||!["require","verify-ca","verify-full"].includes(u.searchParams.get("sslmode"))||u.searchParams.getAll("sslmode").length!==1)return false;
  return (u.hostname==="db."+ref+".supabase.co"&&u.username==="postgres"&&(!u.port||u.port==="5432"))||
    (u.hostname.endsWith(".pooler.supabase.com")&&u.username==="postgres."+ref&&["5432","6543"].includes(u.port));
};
if(!/^[a-z0-9]{20}$/.test(ref||"")||!validHttp(app)||!validHttp(pub)||!validDb(db))error();
else console.log("APP_SUPABASE_ATTESTED_VALUES_MATCH: protected supplied values agree with project (live secret equality not proven)");
