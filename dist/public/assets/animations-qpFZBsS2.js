import{bh as s,bp as n}from"./index-ChaaJIQp.js";function l(a){const r=n.useRef(null);return n.useEffect(()=>{const e=r.current;if(!e)return;const o=a?.delay??0,t=new IntersectionObserver(([i])=>{i.isIntersecting&&(o>0?setTimeout(()=>e.classList.add("reveal-visible"),o):e.classList.add("reveal-visible"),t.unobserve(e))},{threshold:a?.threshold??.12});return t.observe(e),()=>t.disconnect()},[a?.threshold,a?.delay]),r}function m({children:a,className:r="",delay:e=0,direction:o="up"}){const t=l({delay:e});return s.jsx("div",{ref:t,className:`reveal-hidden reveal-${o} ${r}`,children:a})}function p(){const a=n.useRef(null);return n.useEffect(()=>{const r=a.current;if(!r)return;const e=o=>{const t=r.getBoundingClientRect();r.style.setProperty("--glow-x",`${o.clientX-t.left}px`),r.style.setProperty("--glow-y",`${o.clientY-t.top}px`)};return r.addEventListener("mousemove",e),()=>r.removeEventListener("mousemove",e)},[]),a}function d({children:a,className:r=""}){const e=p();return s.jsx("div",{ref:e,className:`mouse-glow ${r}`,children:a})}const f=`
  /* ── Reveal System ── */
  .reveal-hidden{opacity:0;transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
  .reveal-up{transform:translateY(32px)}
  .reveal-down{transform:translateY(-32px)}
  .reveal-left{transform:translateX(32px)}
  .reveal-right{transform:translateX(-32px)}
  .reveal-scale{transform:scale(.92)}
  .reveal-visible{opacity:1!important;transform:translateY(0) translateX(0) scale(1)!important}

  /* ── Ambient Orbs (enhanced multi-path) ── */
  @keyframes orbDrift1{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(40px,20px) scale(1.05)}50%{transform:translate(60px,40px) scale(1)}75%{transform:translate(20px,50px) scale(.95)}}
  @keyframes orbDrift2{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(-30px,-20px) scale(.95)}50%{transform:translate(-50px,-30px) scale(1.05)}75%{transform:translate(-20px,-10px) scale(1)}}
  @keyframes orbDrift3{0%,100%{transform:translate(0,0)}33%{transform:translate(-35px,55px)}66%{transform:translate(25px,-20px)}}
  @keyframes orbPulse{0%,100%{opacity:.3;filter:blur(120px)}50%{opacity:.5;filter:blur(100px)}}
  .orb{position:fixed;border-radius:9999px;pointer-events:none;z-index:0;filter:blur(120px);will-change:transform}

  /* ── Shimmer ── */
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  .shimmer-line{background:linear-gradient(90deg,transparent 40%,hsl(var(--primary)/.15) 50%,transparent 60%);background-size:200% 100%;animation:shimmer 2.5s ease-in-out infinite}

  /* ── Float ── */
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
  .animate-float{animation:float 4s ease-in-out infinite}

  /* ── Pulse Glow ── */
  @keyframes pulseGlow{0%,100%{box-shadow:0 0 20px 0 hsl(var(--primary)/.1)}50%{box-shadow:0 0 40px 8px hsl(var(--primary)/.2)}}
  .pulse-glow{animation:pulseGlow 3s ease-in-out infinite}

  /* ── Mouse Glow (cursor-following light on cards) ── */
  .mouse-glow{position:relative;overflow:hidden}
  .mouse-glow::before{content:'';position:absolute;width:250px;height:250px;background:radial-gradient(circle,hsl(var(--primary)/.12),transparent 70%);border-radius:50%;top:var(--glow-y,-200px);left:var(--glow-x,-200px);transform:translate(-50%,-50%);pointer-events:none;opacity:0;transition:opacity .4s}
  .mouse-glow:hover::before{opacity:1}

  /* ── Gradient Text Animation ── */
  @keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
  .animated-gradient{background-size:200% 200%;animation:gradientShift 4s ease infinite}

  /* ── Scroll Indicator ── */
  @keyframes scrollBounce{0%,20%,50%,80%,100%{transform:translateY(0)}40%{transform:translateY(8px)}60%{transform:translateY(4px)}}
  .scroll-indicator{animation:scrollBounce 2s ease infinite}

  /* ── Glass Surface ── */
  .glass-surface{background:hsl(var(--card)/.5);border:1px solid hsl(var(--border)/.5);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}

  /* ── Stat Glow ── */
  .stat-glow{text-shadow:0 0 30px hsl(var(--primary)/.3)}

  /* ── Tilt Card ── */
  .tilt-card{transition:transform .4s cubic-bezier(.16,1,.3,1),box-shadow .4s ease}
  .tilt-card:hover{transform:translateY(-4px) scale(1.01);box-shadow:0 20px 40px -12px hsl(var(--primary)/.15)}

  /* ── Hero entrance ── */
  @keyframes heroFadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
  .hero-enter{animation:heroFadeUp .9s cubic-bezier(.16,1,.3,1) forwards}
  .hero-enter-delay-1{animation-delay:.15s;opacity:0}
  .hero-enter-delay-2{animation-delay:.3s;opacity:0}
  .hero-enter-delay-3{animation-delay:.45s;opacity:0}
  .hero-enter-delay-4{animation-delay:.6s;opacity:0}

  /* ── Hero Glow ── */
  @keyframes heroGlow{0%,100%{opacity:.35}50%{opacity:.55}}

  /* ── Particle dots ── */
  @keyframes particleFloat{0%,100%{transform:translate(0,0);opacity:.4}50%{transform:translate(var(--px,10px),var(--py,-15px));opacity:.8}}
  .particle{position:absolute;width:3px;height:3px;background:hsl(var(--primary)/.5);border-radius:9999px;pointer-events:none;animation:particleFloat var(--dur,4s) ease-in-out infinite;animation-delay:var(--del,0s)}

  /* ── Number ticker ── */
  .number-ticker{display:inline-block;font-variant-numeric:tabular-nums}

  /* ── Section divider shimmer ── */
  .section-divider{height:1px;background:linear-gradient(90deg,transparent,hsl(var(--primary)/.3),transparent);margin:0 auto;max-width:600px}

  /* ── Card border glow ── */
  @keyframes borderGlow{0%,100%{border-color:hsl(var(--border)/.5)}50%{border-color:hsl(var(--primary)/.4)}}
  .border-glow-hover:hover{animation:borderGlow 2s ease infinite}
`;export{f as A,d as G,m as R};
