import {describe,it,expect} from "vitest";
import {tryHandleNegotiate,negotiateDiscovery} from "./negotiate-route";
const url="https://authichain.com/negotiate";
const input=()=>({
  objective:"Plan replacement part purchase without authorization",
  issues:[
    {key:"price_usd",direction:"minimize",target:80,walkAway:120,weight:5,unit:"USD"},
    {key:"delivery_days",direction:"minimize",target:2,walkAway:10,weight:4,unit:"days"},
    {key:"warranty_months",direction:"maximize",target:24,walkAway:6,weight:2,unit:"months"},
  ],
});
const post=(data:unknown,headers:Record<string,string>={"content-type":"application/json"})=>
  new Request(url,{method:"POST",headers,body:JSON.stringify(data)});
describe("/negotiate public safe planning route",()=>{
  it("has a discoverable GET without submitting offers",async()=>{
    const r=await tryHandleNegotiate(new Request(url));
    expect(r?.status).toBe(200);
    const data=await r!.json();
    expect(data.schema).toBe("authichain-negotiate-discovery/0.1");
    expect(data.mcpTool).toBe("negotiate");
    expect(data.boundaries.payment).toBe(false);
    expect(data.boundaries.orders).toBe(false);
    expect(r?.headers.get("cache-control")).toBe("no-store");
  });
  it("evaluates general-purpose issue planning without accepting an order",async()=>{
    const r=await tryHandleNegotiate(post(input()));
    expect(r?.status).toBe(200);
    const d=await r!.json();
    expect(d.proposals.length).toBeGreaterThanOrEqual(3);
    expect(d.decision).toBe("NO_AGREEMENT_OR_AUTHORIZATION");
    expect(d.allowedActions.purchase).toBe(false);
    expect(d.sideEffectsPerformed).toBe(0);
  });
  it("rejects other origins and non JSON content types",async()=>{
    expect((await tryHandleNegotiate(post(input(),{"content-type":"application/json",Origin:"https://attacker.example"})))?.status).toBe(403);
    expect((await tryHandleNegotiate(post(input(),{"content-type":"text/plain"})))?.status).toBe(415);
  });
  it("rejects malformed JSON and unknown fields safely",async()=>{
    const r=await tryHandleNegotiate(new Request(url,{method:"POST",body:"{",headers:{"content-type":"application/json"}}));
    expect(r?.status).toBe(422);
    const a=input();a.issues[0].walkAway=60;
    expect((await tryHandleNegotiate(post(a)))?.status).toBe(422);
  });
  it("limits request sizes and methods",async()=>{
    const bad=new Request(url,{method:"POST",body:JSON.stringify({...input(),junk:"x".repeat(17_000)}),headers:{"content-type":"application/json"}});
    expect((await tryHandleNegotiate(bad))?.status).toBe(422);
    expect((await tryHandleNegotiate(new Request(url,{method:"PUT"})))?.status).toBe(405);
    expect(await tryHandleNegotiate(new Request("https://authichain.com/elsewhere"))).toBeNull();
  });
  it("provides /api/negotiate alias without changing economics",async()=>{
    const r=await tryHandleNegotiate(new Request("https://authichain.com/api/negotiate"));
    expect(r?.status).toBe(200);
    expect(negotiateDiscovery().status).toBe("stateless_proposals_only");
  });
});
