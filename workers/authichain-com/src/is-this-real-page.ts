/**
 * /is-this-real — NICKEL-VERIFY-V1 lead magnet (Zac, 2026-10-16).
 *
 * The visitor enters a seal ID. Email is optional (2026-10-23): only if they
 * give one AND tick the unchecked consent box does the page POST it to the
 * existing /api/leads/capture (QRON-v2 lead_captures, source "is-this-real",
 * unchanged payload) and to /api/email-optin (AuthiChain D1, see email-optin.ts). The check never waits
 * on it. After that the page runs up to 3 free checks against the
 * public GET /api/verify. The limit is counted in the browser (localStorage)
 * and is a courtesy cap, not enforcement. Then it shows the paid option:
 * x402 per call at POST /api/v1/agent-verify. No public price on this
 * page (price undecided, ADM-212); the 402 response carries it.
 * Copy rule: no "live", customers, price, or accuracy claims.
 * The example id is the published demonstration record, not a product seal.
 */
import { EMAIL_OPTIN_CONSENT_TEXT, EMAIL_OPTIN_PATH, EMAIL_OPTIN_PRIVACY_LINE_IS_THIS_REAL } from "./email-optin.ts";

export const IS_THIS_REAL_PATH = "/is-this-real";
export const IS_THIS_REAL_SOURCE = "is-this-real";
export const IS_THIS_REAL_FREE_CHECKS = 3;

export function isIsThisRealPath(p: string): boolean {
  return p === IS_THIS_REAL_PATH || p === `${IS_THIS_REAL_PATH}/`;
}

export function renderIsThisRealPage(): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Is this real? Check an AuthiChain seal | AuthiChain</title>
<meta name="description" content="Enter a seal ID. The example polygon-anchor-1 is a published demonstration record, not a product. After 3 free checks, agents can pay per check over x402.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://authichain.com${IS_THIS_REAL_PATH}">
<style>
body{font-family:system-ui,sans-serif;max-width:640px;margin:2rem auto;padding:0 1rem;color:#111;line-height:1.5}
label{display:block;margin:.75rem 0 .25rem;font-weight:600}
input[type=text],input[type=email]{width:100%;padding:.6rem;border:1px solid #bbb;border-radius:6px;box-sizing:border-box}
button{margin-top:1rem;padding:.7rem 1.2rem;border:0;border-radius:6px;background:#111;color:#fff;font-weight:600;cursor:pointer}
.small{font-size:.875rem;color:#555}.box{border:1px solid #ddd;border-radius:8px;padding:1rem;margin-top:1rem}
code{background:#f3f3f3;padding:.1rem .3rem;border-radius:4px}
</style></head><body>
<h1>Is this real?</h1>
<p>Enter a seal ID. Our goal: the page names polygon-anchor-1 as the published demonstration record and never as a customer product. The example <code>polygon-anchor-1</code> is a published demonstration record, not a product and not a physical inspection. This page does not itself read the anchor transaction. Your first ${IS_THIS_REAL_FREE_CHECKS} checks are free.</p>
<form id="itr-form" novalidate>
  <label for="seal">Seal ID</label>
  <input type="text" id="seal" name="sealId" required maxlength="128" placeholder="e.g. polygon-anchor-1">
  <label for="email">Email (optional)</label>
  <input type="email" id="email" name="email" maxlength="254" autocomplete="email">
  <label for="country">Country (optional, 2-letter code, e.g. US)</label>
  <input type="text" id="country" name="country" maxlength="2" pattern="[A-Za-z]{2}" autocomplete="country" style="text-transform:uppercase">
  <label class="small"><input type="checkbox" id="consent" name="consent" value="yes"> ${EMAIL_OPTIN_CONSENT_TEXT}</label>
  <p class="small">${EMAIL_OPTIN_PRIVACY_LINE_IS_THIS_REAL}</p>
  <button type="submit" id="go">Check</button>
</form>
<p id="status" class="small" role="status" aria-live="polite"></p>
<div id="result" class="box" hidden></div>
<div id="paid" class="box" hidden>
  <h2>More checks</h2>
  <p>After the free checks, agents can pay per check over x402; an unpaid call returns HTTP 402 with the price. No account needed.</p>
  <p class="small">Endpoint: <code>POST https://authichain.com/api/v1/agent-verify</code>. An empty JSON body <code>{}</code> is the unpaid HTTP 402 with the payment details. A seal UUID inside the daily free allowance is HTTP 200 with <code>free: true</code>, <code>verified: false</code>, and <code>settlement: null</code>. Our goal: a reader can tell that free answer from a paid receipt. That answer is not a paid receipt. A non-UUID sealId is HTTP 400 before payment. Current status: <a href="/api/x402/health">/api/x402/health</a>. Docs: <a href="/x402">/x402</a>.</p>
</div>
<p class="small">Our goal: a verdict on this page stays the public check for that id, and the page keeps the forensic and physical limits. A verdict on this page is the public check for that id. It is not a legal or forensic guarantee and not a physical inspection.</p>
<script>
(function(){
  var KEY="itr_free_used",MAX=${IS_THIS_REAL_FREE_CHECKS},captured=false;
  var f=document.getElementById("itr-form"),st=document.getElementById("status"),
      res=document.getElementById("result"),paid=document.getElementById("paid");
  function used(){return parseInt(localStorage.getItem(KEY)||"0",10)||0}
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
  if(used()>=MAX){paid.hidden=false}
  f.addEventListener("submit",async function(e){
    e.preventDefault();
    var seal=f.sealId.value.trim(),email=f.email.value.trim();
    if(!seal){st.textContent="Enter a seal ID.";return}
    if(email&&!f.consent.checked){st.textContent="To save your email, tick the box. Or clear the email to just check.";return}
    if(used()>=MAX){paid.hidden=false;st.textContent="You have used your "+MAX+" free checks.";return}
    st.textContent="Checking...";
    try{
      if(!captured&&email&&f.consent.checked){
        var lr=await fetch("/api/leads/capture",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({email:email,source:"${IS_THIS_REAL_SOURCE}",product_interest:"nickel-verify",
            message:"consent: yes; first seal: "+seal.slice(0,128),page_url:location.href})});
        if(!lr.ok){st.textContent="We could not save your details. Please try again.";return}
        captured=true;
        fetch("${EMAIL_OPTIN_PATH}",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({email:email,country:f.country.value.trim().toUpperCase(),consent:"yes"})}).catch(function(){});
      }
      var r=await fetch("/api/verify?id="+encodeURIComponent(seal));
      var j=await r.json().catch(function(){return {}});
      localStorage.setItem(KEY,String(used()+1));
      var v=j.verdict||j.decision||"unknown";
      res.hidden=false;
      res.innerHTML="<strong>Seal "+esc(seal)+":</strong> "+esc(v)+
        (j.unknowns&&j.unknowns.length?"<br><span class=small>Not checked: "+esc(j.unknowns.join(", "))+"</span>":"");
      var left=MAX-used();
      st.textContent=left>0?left+" free check"+(left===1?"":"s")+" left.":"That was your last free check.";
      if(left<=0)paid.hidden=false;
    }catch(err){st.textContent="Something went wrong. Please try again."}
  });
})();
</script>
</body></html>`;
}
