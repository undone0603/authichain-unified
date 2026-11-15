import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const script=fileURLToPath(new URL("./verify-app-supabase-values.mjs",import.meta.url));
const ref="nhdnkzhtadfkkluiulhs";
const url=`https://${ref}.supabase.co/`;
const db=`postgresql://postgres.${ref}:synthetic@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require`;
const base={EXPECTED_SUPABASE_REF:ref,NEXT_PUBLIC_SUPABASE_URL:url,AUTHICHAIN_PRODUCTION_APP_SUPABASE_URL:url,AUTHICHAIN_PRODUCTION_APP_DATABASE_URL:db};
const run=(changes={})=>spawnSync(process.execPath,[script],{env:{...base,...changes},encoding:"utf8"});
test("accepts matching protected values",()=>assert.equal(run().status,0));
for(const [name,changes] of [
  ["missing app URL",{AUTHICHAIN_PRODUCTION_APP_SUPABASE_URL:""}],
  ["different app project",{AUTHICHAIN_PRODUCTION_APP_SUPABASE_URL:"https://other.supabase.co/"}],
  ["different database project",{AUTHICHAIN_PRODUCTION_APP_DATABASE_URL:db.replace("postgres."+ref,"postgres.other")}],
  ["disabled TLS",{AUTHICHAIN_PRODUCTION_APP_DATABASE_URL:db.replace("sslmode=require","sslmode=disable")}],
  ["missing TLS requirement",{AUTHICHAIN_PRODUCTION_APP_DATABASE_URL:db.split("?")[0]}],
  ["duplicate TLS setting",{AUTHICHAIN_PRODUCTION_APP_DATABASE_URL:db+"&sslmode=disable"}],
  ["wrong database name",{AUTHICHAIN_PRODUCTION_APP_DATABASE_URL:db.replace("/postgres?","/other?")}],
  ["wrong pooler port",{AUTHICHAIN_PRODUCTION_APP_DATABASE_URL:db.replace(":6543/",":1234/")}],
  ["malformed public URL",{NEXT_PUBLIC_SUPABASE_URL:"not-a-url"}]
])test("rejects "+name,()=>{const r=run(changes);assert.notEqual(r.status,0);assert.ok(!r.stderr.includes("synthetic"));});
