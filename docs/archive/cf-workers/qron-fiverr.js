--a0f5b620d2d2acf390f2bc4a276e0d9328e4c060f52829ee005238f1959a
Content-Disposition: form-data; name="index.js"

// qron-fiverr v5.3 — browser-side generation (no CF timeout)
const STRIPE_KEY = '***REMOVED***';
const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const ORDER_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QRON — Generate Your QR Art</title>
<style>:root{--g:#C9A227;--bg:#0a0a0a;--s:#111;--b:rgba(201,162,39,.2);--t:#e5e5e5;--m:#666}*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--t);font-family:system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{background:var(--s);border:1px solid var(--b);border-radius:16px;padding:36px;max-width:540px;width:100%}.logo{font-size:22px;font-weight:900;color:var(--g);letter-spacing:.08em;margin-bottom:6px}h1{font-size:18px;margin-bottom:4px}.sub{color:var(--m);font-size:13px;margin-bottom:28px}label{display:block;font-size:11px;font-weight:700;color:var(--g);letter-spacing:.1em;text-transform:uppercase;margin:16px 0 6px}input,textarea{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--b);border-radius:8px;color:var(--t);font-size:14px;padding:11px 13px;outline:none;font-family:inherit}input:focus,textarea:focus{border-color:var(--g)}textarea{resize:vertical;min-height:72px}.sg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px}.s{border:1px solid var(--b);border-radius:8px;padding:9px;cursor:pointer;font-size:12px;text-align:center}.s:hover{border-color:var(--g)}.s.on{border-color:var(--g);background:rgba(201,162,39,.1);color:var(--g)}.btn{width:100%;margin-top:24px;padding:14px;background:var(--g);color:#000;font-size:15px;font-weight:700;border:none;border-radius:10px;cursor:pointer}.btn:disabled{opacity:.5;cursor:not-allowed}.prev{margin-top:20px;border:1px dashed var(--b);border-radius:10px;padding:20px;text-align:center;min-height:110px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--m);font-size:13px}.prev img{max-width:100%;max-height:280px;border-radius:8px}.spin{width:28px;height:28px;border:3px solid rgba(201,162,39,.2);border-top-color:var(--g);border-radius:50%;animation:sp .7s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}.note{font-size:11px;color:var(--m);margin-top:8px}</style></head>
<body><div class="card">
<div class="logo">QRON</div>
<h1>Generate Your AI QR Art</h1>
<p class="sub">After your Fiverr/direct purchase — generate instantly here.</p>
<label>URL to Encode *</label>
<input id="url" type="url" placeholder="https://your-site.com" required>
<label>Art Style</label>
<div class="sg" id="sg"></div>
<label>Brand Notes (optional)</label>
<textarea id="notes" placeholder='Colors, mood — e.g. "dark emerald for cannabis brand"'></textarea>
<label>Email for Download Link</label>
<input id="email" type="email" placeholder="you@email.com">
<p class="note">Order ref (optional)</p>
<input id="oid" placeholder="Fiverr order ID or your name" style="margin-top:4px">
<div class="prev" id="prev"><span>Your AI QR art will appear here</span></div>
<button class="btn" id="sub">🎨 Generate QR Art</button>
<p class="note" style="margin-top:12px">Need to purchase first? <a href="/buy" style="color:var(--g)">Buy a pack →</a></p>
</div>
<script>
// Call qron-ai-api directly from browser (no CF worker timeout)
const API = 'https://qron-ai-api.undone-k.workers.dev';
const SUPA = 'https://nhdnkzhtadfkkluiulhs.supabase.co';
const ANON = '***REMOVED***';
const ST=[{id:'space',l:'🚀 Space'},{id:'cannabis',l:'🌿 Cannabis'},{id:'cyberpunk',l:'⚡ Cyberpunk'},{id:'nature',l:'🍃 Nature'},{id:'abstract',l:'◆ Abstract'},{id:'retro',l:'📻 Retro'}];
let sel='space';
ST.forEach(s=>{const d=document.createElement('div');d.className='s'+(s.id===sel?' on':'');d.textContent=s.l;d.onclick=()=>{document.querySelectorAll('.s').forEach(e=>e.classList.remove('on'));d.classList.add('on');sel=s.id};document.getElementById('sg').appendChild(d)});
document.getElementById('sub').onclick=async()=>{
  const u=document.getElementById('url').value.trim();
  if(!u){alert('URL required');return;}
  const btn=document.getElementById('sub'),prev=document.getElementById('prev');
  const email=document.getElementById('email').value.trim();
  const notes=document.getElementById('notes').value.trim();
  const oid=document.getElementById('oid').value.trim()||('guest-'+Date.now());
  btn.disabled=true;btn.textContent='Generating... (30-90s)';
  prev.innerHTML='<div class="spin"></div><p>AI crafting your QR art — do not close this window</p><p style="font-size:11px;color:var(--m);margin-top:4px">HuggingFace → Replicate fallback</p>';
  try{
    // Direct call to qron-ai-api (browser has no timeout issues)
    const r=await fetch(API+'/v1/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:u,style:sel,prompt:notes||undefined})});
    const d=await r.json();
    const imgUrl=d.previewUrl||d.downloadUrl||d.imageUrl||d.url;
    if(imgUrl){
      prev.innerHTML='<img src="'+imgUrl+'"><p style="color:var(--g);margin-top:8px">✅ Done! <a href="'+imgUrl+'" download target="_blank" style="color:var(--g);font-weight:700">⬇ Download PNG</a></p><p style="font-size:11px;color:var(--m)">Provider: '+d.provider+' · Style: '+sel+'</p>';
      // Log the fulfilled order
      if(email)fetch(SUPA+'/rest/v1/leads',{method:'POST',headers:{apikey:ANON,Authorization:'Bearer '+ANON,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({email:email,source:'gig-order',name:'Order '+oid,company:'style:'+sel+'|url:'+u+'|img:'+imgUrl})}).catch(()=>{});
    }else{
      prev.innerHTML='<p style="color:#f90">Generation failed: '+(d.error||d.message||'Unknown')+'</p><p style="font-size:11px;color:var(--m)">Email authichain@gmail.com with your order ID: '+oid+'</p>';
    }
    btn.textContent='🎨 Generate Another';btn.disabled=false;
  }catch(e){
    prev.innerHTML='<p style="color:#f66">Connection error: '+e.message+'</p><p style="font-size:11px;color:var(--m)">Try again or email authichain@gmail.com</p>';
    btn.disabled=false;btn.textContent='🎨 Generate QR Art';
  }
};
</script></body></html>`;
const BUY_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QRON — Buy AI QR Art</title>
<style>:root{--g:#C9A227;--bg:#0a0a0a;--s:#111;--b:rgba(201,162,39,.2);--t:#e5e5e5;--m:#666}*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--t);font-family:system-ui,sans-serif;padding:56px 24px;max-width:900px;margin:0 auto}.logo{font-size:26px;font-weight:900;color:var(--g);letter-spacing:.08em;margin-bottom:4px}h1{font-size:22px;margin-bottom:4px}.sub{color:var(--m);font-size:14px;margin-bottom:40px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-bottom:36px}.card{background:var(--s);border:1px solid var(--b);border-radius:12px;padding:24px}.card.pop{border-color:var(--g)}.nm{font-size:12px;font-weight:700;color:var(--m);letter-spacing:.06em;margin-bottom:6px}.pr{font-size:38px;font-weight:900;color:var(--g);line-height:1}.pe{font-size:12px;color:var(--m);margin-bottom:12px}.ds{font-size:12px;color:var(--m);line-height:1.5;margin-bottom:16px}.btn{display:block;text-align:center;padding:11px;background:var(--g);color:#000;font-weight:700;border-radius:8px;border:none;width:100%;cursor:pointer;font-size:13px}footer{color:var(--m);font-size:13px;text-align:center;padding-top:20px}</style></head>
<body><div class="logo">QRON</div><h1>Buy AI QR Art</h1>
<p class="sub">One-time packs + monthly plans. After purchase → <a href="/order" style="color:var(--g)">generate instantly at /order</a>.</p>
<div class="grid">
  <div class="card"><div class="nm">SINGLE DESIGN</div><div class="pr">$49</div><div class="pe">one-time · 1 credit</div><div class="ds">1 AI QR in any style. 768px PNG. Commercial use. 24h.</div><button class="btn" onclick="buy('single')">Buy $49 →</button></div>
  <div class="card pop"><div class="nm">BRAND PACK ★</div><div class="pr">$199</div><div class="pe">one-time · 5 credits</div><div class="ds">5 AI QRs, matched brand theme. Priority. ZIP delivery.</div><button class="btn" onclick="buy('pack')">Buy $199 →</button></div>
  <div class="card"><div class="nm">MONTHLY CREATOR</div><div class="pr">$29</div><div class="pe">/month · 10 credits</div><div class="ds">10 credits/month. Dashboard. API. Cancel anytime.</div><button class="btn" onclick="buy('creator')">Subscribe $29/mo →</button></div>
  <div class="card"><div class="nm">MONTHLY STUDIO</div><div class="pr">$149</div><div class="pe">/month · 50 credits</div><div class="ds">50 credits/month. Priority. Bulk ZIP. Custom prompts.</div><button class="btn" onclick="buy('studio')">Subscribe $149/mo →</button></div>
</div>
<footer>✅ Secure checkout via Stripe · After purchase: <a href="/order" style="color:var(--g)">Generate at qron.space/order</a></footer>
<script>async function buy(plan){const email=prompt('Email for receipt (optional):')||undefined;const btn=event.target;btn.textContent='Loading...';try{const r=await fetch('/buy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan,email})});const d=await r.json();if(d.url)window.location.href=d.url;else alert(d.error||'Error — try again');}catch(e){alert('Error: '+e.message);}btn.textContent=btn.dataset.label||'Buy Now';}</script>
</body></html>`;

function j(data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{...CORS,'Content-Type':'application/json'}});
}

async function createCheckout(planId, email, req) {
  const origin = new URL(req.url).origin;
  const ONE_TIME = { single:'price_1TGOM9GqTruSqV8TdV7j3DuL', pack:'price_1TGOMBGqTruSqV8TBxL9yYLU' };
  const SUBS = { creator:'price_1T9aoZGqTruSqV8T2SG', studio:'price_1StuAZGqTruSqV8TcoS' };
  const isOTP = !!ONE_TIME[planId];
  const priceId = ONE_TIME[planId] || SUBS[planId] || SUBS.creator;
  const body = new URLSearchParams({
    'mode': isOTP ? 'payment' : 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'success_url': `${origin}/order?ref={CHECKOUT_SESSION_ID}`,
    'cancel_url': `${origin}/buy`,
  });
  if (email) body.set('customer_email', email);
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method:'POST', headers:{'Authorization':`Bearer ${STRIPE_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},
    body: body.toString(),
  });
  const s = await res.json();
  if (!res.ok) throw new Error(s.error?.message || 'Stripe error');
  return s;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, '') || '/';
    if (req.method === 'OPTIONS') return new Response(null, {status:204, headers:CORS});
    if (path === '/health') return j({ok:true, version:'5.3.0', service:'qron-fiverr'});
    if (path === '/fiverr') return Response.redirect('https://qron.space/gig', 302);
    if (req.method === 'GET' && (path === '/' || path === '/order')) return new Response(ORDER_HTML, {headers:{'Content-Type':'text/html;charset=utf-8',...CORS}});
    if (req.method === 'GET' && path === '/buy') return new Response(BUY_HTML, {headers:{'Content-Type':'text/html;charset=utf-8',...CORS}});
    if (req.method === 'POST' && path === '/buy') {
      let body={}; try{body=await req.json();}catch{}
      try { const s=await createCheckout(body.plan||'single',body.email,req); return j({url:s.url,sessionId:s.id}); }
      catch(err) { return j({error:err.message},500); }
    }
    return j({error:'Not found', path}, 404);
  }
};

--a0f5b620d2d2acf390f2bc4a276e0d9328e4c060f52829ee005238f1959a--
