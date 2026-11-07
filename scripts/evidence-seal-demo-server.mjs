#!/usr/bin/env node
/**
 * Local-only, READ-ONLY AuthiChain Evidence Credential / QRON resolution preview.
 * Never serves on 0.0.0.0 and never signs, pays, publishes or calls production.
 * The example issuer is issuer.example, not authichain.com.
 */
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { demoFixture } from '../protocol/evidence-seal-cli.mjs';
import { renderEvidencePage, renderEvidenceBadge } from '../protocol/evidence-seal-view.mjs';

const f=demoFixture();
const ctx={credential:f.credential,jwks:f.jwks,expectedIssuer:f.payload.iss,expectedSubject:f.payload.sub,now:f.payload.iat+1};
function makeResponse(path) {
  switch(path) {
    case '/':
    case '/evidence/demo':return [200,'text/html; charset=utf-8',renderEvidencePage(ctx)];
    case '/evidence/demo.json':return [200,'application/json; charset=utf-8',JSON.stringify({notice:'TEST-ONLY, NOT PRODUCTION',credential:f.credential,issuer:f.payload.iss,subject:f.payload.sub,at:ctx.now})];
    case '/evidence/demo/badge.svg':return [200,'image/svg+xml; charset=utf-8',renderEvidenceBadge(ctx)];
    case '/.well-known/seal.json':return [200,'application/json; charset=utf-8',JSON.stringify({...f.jwks,notice:'TEST PUBLIC KEY — NOT AUTHICHAIN PRODUCTION, NOT SEALKEEPER V9'})];
    case '/evidence/demo/source.json':return [200,'application/json; charset=utf-8',f.evidenceBytes];
    default:return [404,'application/json; charset=utf-8',JSON.stringify({error:'not_found',valid:false})];
  }
}
export function createDemoServer() {
  return http.createServer((req,res)=>{
    const headers={
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer',
      'X-Frame-Options':'DENY',
      'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    };
    if(req.method!=='GET' && req.method!=='HEAD'){
      res.writeHead(405,{...headers,Allow:'GET, HEAD','Content-Type':'application/json'});res.end(JSON.stringify({error:'read_only',valid:false}));return;
    }
    let url;
    try {url=new URL(req.url,'http://127.0.0.1');}catch{res.writeHead(400,headers);res.end();return;}
    const [status,type,body]=makeResponse(url.pathname);
    res.writeHead(status,{...headers,'Content-Type':type});res.end(req.method==='HEAD'?'':body);
  });
}
const isMain=process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if(isMain){
  const server=createDemoServer();
  const port=Number(process.env.DEMO_PORT||37880);
  server.listen(port,'127.0.0.1',()=>console.log(`TEST ONLY preview: http://127.0.0.1:${server.address().port}/evidence/demo`));
}
