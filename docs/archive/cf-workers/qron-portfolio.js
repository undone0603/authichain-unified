--d32628677bfb4835a055f8a66256c02a65e97aa6c95d8e0b60d91192fd81
Content-Disposition: form-data; name="worker.js"

// QRON Portfolio — Freelance QR Art Showcase
// Converts visitors into paying clients for custom QR art

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/robots.txt') {
      return new Response('User-agent: *\nAllow: /\nSitemap: https://qron-portfolio.undone-k.workers.dev/sitemap.xml', { headers: { 'Content-Type': 'text/plain' } });
    }
    if (url.pathname === '/sitemap.xml') {
      return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://qron-portfolio.undone-k.workers.dev/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>', { headers: { 'Content-Type': 'application/xml' } });
    }
    return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  }
};

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-C85Y67MTQL"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-C85Y67MTQL');
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QRON — AI-Powered Artistic QR Codes | Custom QR Art for Brands</title>
<meta name="description" content="Transform your brand with stunning AI-generated QR code art designed to increase scan engagement. Custom designs for packaging, menus, marketing.">
<meta property="og:title" content="QRON — AI-Powered Artistic QR Codes">
<meta property="og:description" content="Transform boring QR codes into scannable works of art. Designed to increase engagement.">
<meta property="og:image" content="https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=1200&q=80&auto=format">
<link rel="preconnect" href="https://images.unsplash.com">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#08080a;--bg2:#0f0f14;--bg3:#141418;--primary:#d4af37;--primary-dim:#b8941f;--secondary:#14b8a6;--text:#f0f0f0;--text-dim:#888898;--border:rgba(212,175,55,0.18);--border-dim:rgba(212,175,55,0.08);--mono:'DM Mono',monospace;--display:'Bebas Neue',sans-serif;--body:'DM Sans',sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--body);overflow-x:hidden}
nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:16px 32px;background:rgba(8,8,10,0.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.logo{display:flex;align-items:center;gap:10px;font-family:var(--display);font-size:24px;color:var(--primary);letter-spacing:3px;text-decoration:none}
.nav-right{display:flex;align-items:center;gap:20px}
.nav-sub{font-family:var(--mono);font-size:10px;color:var(--text-dim);text-decoration:none;letter-spacing:0.5px;opacity:0.6;transition:opacity .2s}
.nav-sub:hover{opacity:1;color:var(--primary)}
.nav-cta{padding:10px 24px;background:var(--primary);color:#000;font-weight:700;font-family:var(--mono);font-size:12px;text-decoration:none;border-radius:4px;text-transform:uppercase;letter-spacing:1px;transition:all .2s}
.nav-cta:hover{background:var(--primary-dim);transform:translateY(-1px)}
.hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:120px 24px 80px;position:relative;background:linear-gradient(135deg, rgba(8,8,10,0.92) 0%, rgba(8,8,10,0.75) 50%, rgba(8,8,10,0.92) 100%), url('https://images.unsplash.com/photo-1579154204601-01588f351e67?w=1920&q=80&auto=format') center/cover no-repeat}
.hero::before{content:'';position:absolute;top:20%;left:50%;transform:translateX(-50%);width:600px;height:600px;background:radial-gradient(ellipse,rgba(212,175,55,0.06) 0%,transparent 70%);pointer-events:none}
.badge{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--primary);border:1px solid var(--border);padding:6px 16px;border-radius:24px;margin-bottom:32px}
.badge::before{content:'';width:6px;height:6px;background:var(--primary);border-radius:50%;animation:p 2s infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
h1{font-family:var(--display);font-size:clamp(48px,8vw,96px);font-weight:400;line-height:1;margin-bottom:24px;background:linear-gradient(135deg,var(--primary),var(--secondary));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.sub{font-size:20px;color:var(--text-dim);max-width:600px;line-height:1.6;margin-bottom:48px}
.stats{display:flex;gap:48px;margin-bottom:48px}
.st{text-align:center}
.sn{font-family:var(--display);font-size:36px;font-weight:400;color:var(--primary)}
.sl{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--text-dim);margin-top:4px}
.ctas{display:flex;gap:16px;flex-wrap:wrap;justify-content:center}
.bp{padding:16px 40px;background:var(--primary);color:#000;font-weight:700;font-family:var(--mono);font-size:13px;text-decoration:none;border-radius:4px;text-transform:uppercase;letter-spacing:1px;transition:all .2s;display:inline-flex;align-items:center;gap:8px}
.bp:hover{background:var(--primary-dim);transform:translateY(-2px);box-shadow:0 8px 32px rgba(212,175,55,0.3)}
.bs{padding:16px 40px;border:1px solid var(--border);color:var(--text-dim);font-size:14px;text-decoration:none;border-radius:4px;text-transform:uppercase;letter-spacing:1px;font-weight:600;transition:all .2s}
.bs:hover{border-color:var(--primary);color:var(--primary)}
section{padding:100px 32px}
.inner{max-width:1200px;margin:0 auto}
h2{font-family:var(--display);font-size:clamp(32px,5vw,56px);font-weight:400;text-align:center;margin-bottom:16px;letter-spacing:2px}
h2 .a{color:var(--primary)}
.ssub{text-align:center;color:var(--text-dim);font-size:16px;margin-bottom:64px;max-width:600px;margin-left:auto;margin-right:auto}
.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-bottom:48px}
.sc{background:var(--bg2);border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:32px 24px;text-align:center;transition:all .3s}
.sc:hover{border-color:var(--primary);transform:translateY(-4px)}
.si{font-size:48px;margin-bottom:16px}
.sname{font-family:var(--display);font-size:20px;font-weight:400;letter-spacing:1px;margin-bottom:8px}
.sd{font-size:13px;color:var(--text-dim);line-height:1.6}
.ps{background:linear-gradient(180deg, rgba(15,15,20,0.95) 0%, rgba(15,15,20,0.88) 50%, rgba(15,15,20,0.95) 100%), url('https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1920&q=80&auto=format') center/cover no-repeat;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.pg{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:2px;max-width:960px;margin:0 auto}
.pc{background:var(--bg);border:1px solid rgba(255,255,255,0.05);padding:48px 32px;text-align:center;position:relative;transition:border-color .3s}
.pc.f{border-color:var(--primary)}
.pc.f::before{content:'BEST VALUE';position:absolute;top:-1px;left:50%;transform:translateX(-50%);font-family:var(--mono);font-size:9px;letter-spacing:2px;color:#000;background:var(--primary);padding:4px 12px;font-weight:700}
.pt{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--text-dim);margin-bottom:16px}
.pa{font-family:var(--display);font-size:56px;font-weight:400;color:var(--primary);line-height:1;margin-bottom:8px;letter-spacing:1px}
.pa span{font-size:18px;color:var(--text-dim);font-weight:400}
.pi{font-size:13px;color:var(--text-dim);margin-bottom:24px}
.pf{list-style:none;text-align:left;margin-bottom:32px}
.pf li{padding:8px 0;font-size:13px;color:var(--text-dim);border-bottom:1px solid rgba(255,255,255,0.03);display:flex;align-items:center;gap:8px}
.pf li::before{content:'\\2713';color:var(--primary);font-weight:700;flex-shrink:0}
.pb{display:block;padding:14px;background:var(--primary);color:#000;font-weight:700;font-family:var(--mono);font-size:12px;text-decoration:none;border-radius:4px;text-transform:uppercase;letter-spacing:1px;transition:all .2s}
.pb:hover{background:var(--primary-dim)}
.pb.o{background:transparent;border:1px solid var(--border);color:var(--text-dim)}
.pb.o:hover{border-color:var(--primary);color:var(--primary)}
.ig{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:48px}
.ic{background:var(--bg2);border:1px solid rgba(255,255,255,0.03);border-radius:8px;padding:20px;text-align:center;transition:border-color .3s}
.ic:hover{border-color:var(--primary)}
.ii{font-size:32px;margin-bottom:8px}
.in{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px}
.cb{text-align:center;padding:120px 32px;position:relative;background:linear-gradient(180deg, rgba(8,8,10,0.93) 0%, rgba(8,8,10,0.8) 50%, rgba(8,8,10,0.93) 100%), url('https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=1920&q=80&auto=format') center/cover no-repeat}
.cb::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:800px;height:400px;background:radial-gradient(ellipse,rgba(212,175,55,0.06),transparent 70%);pointer-events:none}
.footer-links a{display:block;font-size:13px;color:var(--text-dim);text-decoration:none;padding:4px 0;transition:color .2s}
.footer-links a:hover{color:var(--primary)}
@media(max-width:768px){nav{padding:12px 16px}.hero{padding:100px 16px 60px}.stats{gap:24px}section{padding:60px 16px}.pg{grid-template-columns:1fr}.footer-grid{grid-template-columns:1fr!important;gap:32px!important}}
</style>
</head>
<body>

<nav>
  <a href="/" class="logo">
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none"><polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="#d4af37" opacity="0.15" stroke="#d4af37" stroke-width="1.5"/><polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="#08080a" stroke="#d4af37" stroke-width="0.5" opacity="0.6"/><rect x="10" y="11" width="5" height="5" rx="1" fill="#d4af37" opacity="0.8"/><rect x="21" y="11" width="5" height="5" rx="1" fill="#d4af37" opacity="0.8"/><rect x="10" y="21" width="5" height="5" rx="1" fill="#d4af37" opacity="0.8"/><rect x="16" y="16" width="4" height="4" rx="0.5" fill="#14b8a6" opacity="0.7"/><rect x="21" y="21" width="5" height="5" rx="1" fill="#14b8a6" opacity="0.5"/></svg>
    QRON
  </a>
  <div class="nav-right">
    <a href="https://authichain-api.undone-k.workers.dev/" class="nav-sub">Part of AuthiChain</a>
    <a href="mailto:authichain@gmail.com?subject=Custom%20QRON%20Art%20Request" class="nav-cta">Get a Quote</a>
  </div>
</nav>

<section class="hero">
  <div class="badge">AI-Powered QR Art Studio</div>
  <h1>QR Codes That<br>People Actually Scan</h1>
  <p class="sub">Transform boring black-and-white QR codes into stunning, scannable works of art — designed to increase scan engagement.</p>
  <div class="stats">
    <div class="st"><div class="sn">8</div><div class="sl">Art Styles</div></div>
    <div class="st"><div class="sn">100%</div><div class="sl">Scannable</div></div>
    <div class="st"><div class="sn">High</div><div class="sl">Engagement</div></div>
    <div class="st"><div class="sn">3s</div><div class="sl">Generation</div></div>
  </div>
  <div class="ctas">
    <a href="mailto:authichain@gmail.com?subject=Custom%20QRON%20Art%20Request&body=Hi%2C%20I%27d%20like%20a%20custom%20QRON%20art%20QR%20code.%0A%0ACompany%3A%0AWebsite%3A%0AStyle%3A%0A" class="bp">Request Custom Art</a>
    <a href="https://qron.space" class="bs">View Live Gallery</a>
  </div>
</section>

<section>
  <div class="inner">
    <h2>8 <span class="a">Signature Styles</span></h2>
    <p class="ssub">Each style is AI-generated and guaranteed 100% scannable. Pick your aesthetic or let us recommend one for your brand.</p>
    <div class="sg">
      <div class="sc"><div class="si">&#x1f30c;</div><div class="sname">Cosmic Nebula</div><div class="sd">Deep space imagery with swirling galaxies and star clusters forming the QR pattern</div></div>
      <div class="sc"><div class="si">&#x1f48e;</div><div class="sname">Holographic Mosaic</div><div class="sd">Iridescent faceted gems and prismatic light refractions</div></div>
      <div class="sc"><div class="si">&#x1f3d9;</div><div class="sname">Cyberpunk</div><div class="sd">Neon-soaked rain-slick streets with glowing circuit patterns</div></div>
      <div class="sc"><div class="si">&#x1f3a8;</div><div class="sname">Watercolor</div><div class="sd">Soft pigment bleeds with organic botanical elements</div></div>
      <div class="sc"><div class="si">&#x1f30a;</div><div class="sname">Teal Pulse</div><div class="sd">Bioluminescent deep-ocean waves with cyan glow</div></div>
      <div class="sc"><div class="si">&#x1f525;</div><div class="sname">Neon Glitch</div><div class="sd">Digital distortion effects with vibrant color bursts</div></div>
      <div class="sc"><div class="si">&#x1f308;</div><div class="sname">Prism Shift</div><div class="sd">Light-bending prismatic effects with rainbow refractions</div></div>
      <div class="sc"><div class="si">&#x1f4bb;</div><div class="sname">Matrix Cascade</div><div class="sd">Falling code streams with green digital rain patterns</div></div>
    </div>
  </div>
</section>

<section class="ps">
  <div class="inner">
    <h2>Simple <span class="a">Pricing</span></h2>
    <p class="ssub">From single designs to enterprise volume. Every QR is guaranteed scannable or your money back.</p>
    <div class="pg">
      <div class="pc">
        <div class="pt">Single Design</div>
        <div class="pa">$49<span>/each</span></div>
        <div class="pi">Perfect for testing</div>
        <ul class="pf">
          <li>1 custom QR art design</li>
          <li>Choice of any style</li>
          <li>3 revisions included</li>
          <li>High-res PNG + SVG</li>
          <li>100% scan guarantee</li>
        </ul>
        <a href="https://buy.stripe.com/6oU3cvafv1gW25YcHG1Nu0z" class="pb o">Order Now — $49</a>
      </div>
      <div class="pc f">
        <div class="pt">Brand Pack</div>
        <div class="pa">$199<span>/5 designs</span></div>
        <div class="pi">Save 20% per design</div>
        <ul class="pf">
          <li>5 custom QR art designs</li>
          <li>Mix and match styles</li>
          <li>Unlimited revisions</li>
          <li>All formats (PNG/SVG/PDF)</li>
          <li>Brand color matching</li>
          <li>Priority 24h delivery</li>
        </ul>
        <a href="https://buy.stripe.com/aFabJ1cnD9Ns25Y7nm1Nu0A" class="pb">Order Now — $199</a>
      </div>
      <div class="pc">
        <div class="pt">Enterprise</div>
        <div class="pa">$999<span>/mo</span></div>
        <div class="pi">Volume + API access</div>
        <ul class="pf">
          <li>50+ designs/month</li>
          <li>API integration</li>
          <li>Custom trained styles</li>
          <li>White-label option</li>
          <li>Dedicated account manager</li>
          <li>Blockchain verification</li>
        </ul>
        <a href="https://buy.stripe.com/bJe9AT3R7gbQ9yq9vu1Nu0B" class="pb o">Subscribe — $999/mo</a>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="inner">
    <h2>Built for <span class="a">Every Industry</span></h2>
    <p class="ssub">Our QR art works across all verticals.</p>
    <div class="ig">
      <div class="ic"><div class="ii">&#x1f48e;</div><div class="in">Luxury</div></div>
      <div class="ic"><div class="ii">&#x1f374;</div><div class="in">Restaurants</div></div>
      <div class="ic"><div class="ii">&#x1f48a;</div><div class="in">Pharma</div></div>
      <div class="ic"><div class="ii">&#x1f33f;</div><div class="in">Cannabis</div></div>
      <div class="ic"><div class="ii">&#x1f4f1;</div><div class="in">Tech</div></div>
      <div class="ic"><div class="ii">&#x1f457;</div><div class="in">Fashion</div></div>
      <div class="ic"><div class="ii">&#x1f3a8;</div><div class="in">Art</div></div>
      <div class="ic"><div class="ii">&#x1f3e8;</div><div class="in">Hotels</div></div>
    </div>
  </div>
</section>

<section class="cb" id="contact">
  <h2 style="margin-bottom:24px">Ready to <span class="a">Stand Out</span>?</h2>
  <p style="color:var(--text-dim);font-size:18px;margin-bottom:48px;max-width:500px;margin-left:auto;margin-right:auto">Get your first custom QRON art QR code in under 24 hours. 100% scannable guaranteed.</p>
  <form id="leadForm" style="max-width:480px;margin:0 auto 48px;text-align:left">
    <input type="text" name="name" placeholder="Your Name" required style="width:100%;padding:14px;margin-bottom:12px;background:#111;border:1px solid var(--border);border-radius:4px;color:#fff;font-family:var(--body);font-size:14px">
    <input type="email" name="email" placeholder="Email Address" required style="width:100%;padding:14px;margin-bottom:12px;background:#111;border:1px solid var(--border);border-radius:4px;color:#fff;font-family:var(--body);font-size:14px">
    <input type="text" name="company" placeholder="Company (optional)" style="width:100%;padding:14px;margin-bottom:12px;background:#111;border:1px solid var(--border);border-radius:4px;color:#fff;font-family:var(--body);font-size:14px">
    <select name="style" style="width:100%;padding:14px;margin-bottom:12px;background:#111;border:1px solid var(--border);border-radius:4px;color:#888;font-family:var(--body);font-size:14px">
      <option value="">Preferred Style</option>
      <option>Cosmic Nebula</option><option>Holographic Mosaic</option><option>Cyberpunk</option>
      <option>Watercolor</option><option>Teal Pulse</option><option>Neon Glitch</option>
      <option>Prism Shift</option><option>Matrix Cascade</option><option>Not Sure Yet</option>
    </select>
    <textarea name="message" placeholder="Tell us about your project..." rows="3" style="width:100%;padding:14px;margin-bottom:16px;background:#111;border:1px solid var(--border);border-radius:4px;color:#fff;font-family:var(--body);font-size:14px;resize:vertical"></textarea>
    <button type="submit" class="bp" style="width:100%;justify-content:center;border:none;cursor:pointer;font-size:14px">Get a Free Sample</button>
    <div id="formMsg" style="text-align:center;margin-top:12px;font-size:14px;display:none"></div>
  </form>
  <div class="ctas">
    <a href="mailto:authichain@gmail.com?subject=Custom%20QRON%20Art%20Request" class="bs">Or Email Directly</a>
    <a href="https://qron.space" class="bs">See More Examples</a>
  </div>
</section>
<script>
document.getElementById('leadForm').addEventListener('submit',async function(e){
  e.preventDefault();
  const btn=this.querySelector('button');
  const msg=document.getElementById('formMsg');
  btn.textContent='Sending...';btn.disabled=true;
  try{
    const d={name:this.name.value,email:this.email.value,company:this.company.value,style:this.style.value,message:this.message.value,source:'portfolio'};
    const r=await fetch('https://qron-automation.undone-k.workers.dev/webhook/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
    if(r.ok){msg.style.display='block';msg.style.color='#00ff88';msg.textContent='Received! We will reply within 2 hours with your free sample.';this.reset();}
    else throw new Error('fail');
  }catch(e){msg.style.display='block';msg.style.color='var(--primary)';msg.textContent='Thanks! Email us at authichain@gmail.com and we will get right back to you.';}
  btn.textContent='Get a Free Sample';btn.disabled=false;
});
</script>

<footer style="border-top:1px solid var(--border);padding:64px 32px 32px;background:var(--bg);">
  <div style="max-width:1200px;margin:0 auto;">
    <div class="footer-grid" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:48px;">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <svg width="28" height="28" viewBox="0 0 36 36" fill="none"><polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="#d4af37" opacity="0.15" stroke="#d4af37" stroke-width="1.5"/><polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="#08080a" stroke="#d4af37" stroke-width="0.5" opacity="0.6"/><rect x="10" y="11" width="5" height="5" rx="1" fill="#d4af37" opacity="0.8"/><rect x="21" y="11" width="5" height="5" rx="1" fill="#d4af37" opacity="0.8"/><rect x="10" y="21" width="5" height="5" rx="1" fill="#d4af37" opacity="0.8"/><rect x="16" y="16" width="4" height="4" rx="0.5" fill="#14b8a6" opacity="0.7"/><rect x="21" y="21" width="5" height="5" rx="1" fill="#14b8a6" opacity="0.5"/></svg>
          <span style="font-family:var(--display);font-size:18px;letter-spacing:2px;">THE AUTHENTIC ECONOMY</span>
        </div>
        <p style="font-size:13px;color:var(--text-dim);line-height:1.7;max-width:280px;">Verifying products, documents, and assets across industries.</p>
      </div>
      <div class="footer-links">
        <div style="font-family:var(--mono);font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-dim);margin-bottom:16px;">Protocol</div>
        <a href="https://authichain-api.undone-k.workers.dev/">API Gateway</a>
        <a href="https://authichain-dashboard.undone-k.workers.dev/?key=***REMOVED***">Dashboard</a>
        <a href="mailto:authichain@gmail.com">Contact</a>
      </div>
      <div class="footer-links">
        <div style="font-family:var(--mono);font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-dim);margin-bottom:16px;">Verticals</div>
        <a href="https://strainchain.io">StrainChain</a>
        <a href="https://qron-portfolio.undone-k.workers.dev/">QRON Studio</a>
        <a href="https://govchain.us">GovChain</a>
      </div>
      <div class="footer-links">
        <div style="font-family:var(--mono);font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-dim);margin-bottom:16px;">Resources</div>
        <a href="https://authichain-api.undone-k.workers.dev/docs">API Docs</a>
        <a href="https://qron.space">QR Gallery</a>
        <a href="mailto:authichain@gmail.com">Support</a>
      </div>
    </div>
    <div style="border-top:1px solid var(--border-dim);padding-top:24px;text-align:center;">
      <div style="font-family:var(--mono);font-size:11px;color:var(--text-dim);opacity:0.5;">&copy; 2026 QRON Studio &middot; A Division of AuthiChain Protocol &middot; Transparency &middot; Compliance &middot; Authenticity</div>
    </div>
  </div>
</footer>

</body>
</html>`;

--d32628677bfb4835a055f8a66256c02a65e97aa6c95d8e0b60d91192fd81--
