import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=readFileSync(new URL('./wrangler.jsonc',import.meta.url),'utf8');
test('AgentZ memory source cannot silently bind shared staging or production D1',()=>{
 assert.doesNotMatch(config,/"database_name"\s*:\s*"authichain-staging-db"/);
 assert.doesNotMatch(config,/"database_id"\s*:\s*"7cc833bb-32ed-47a3-aba8-df44657ca510"/);
 assert.doesNotMatch(config,/"database_name"\s*:\s*"authichain-verify"/);
 assert.doesNotMatch(config,/"database_name"\s*:\s*"authichain_main"/);
});
test('AgentZ memory requires a dedicated D1 binding before enabling persistent execution',()=>{
 const stripped=config.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm,'');
 const parsed=JSON.parse(stripped);
 const dbs=parsed.d1_databases??[];
 if(dbs.length){
  assert.equal(dbs.length,1);
  assert.equal(dbs[0].binding,'AGENTZ_DB');
  assert.equal(dbs[0].database_name,'agentz-memory');
  assert.match(dbs[0].database_id,/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
  assert.equal(dbs[0].migrations_dir,'migrations');
 }
});
