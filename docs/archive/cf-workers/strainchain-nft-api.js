--cdaa8188e336142de411ebe340e5a5c1aec6a0d1ceace7af98f207827e8d
Content-Disposition: form-data; name="worker.js"

// strainchain-nft-api v2.1 — fixed status code bug

const PRICING_TIERS = {
  free:         { name:'Free',         price:0,   monthly_scans:10,        brands:0,           artists:1,           api_calls:100,    features:{ qr_authentication:true,  nft_minting:false, basic_analytics:false, email_support:false } },
  basic:        { name:'Basic',        price:199, monthly_scans:500,       brands:1,           artists:5,           api_calls:10000,  features:{ qr_authentication:true,  nft_minting:true,  basic_analytics:true,  email_support:true,  compliance_reports:false, api_access:false,  white_label:false, dedicated_support:false } },
  professional: { name:'Professional', price:499, monthly_scans:2500,      brands:5,           artists:25,          api_calls:50000,  features:{ qr_authentication:true,  nft_minting:true,  basic_analytics:true,  advanced_analytics:true, email_support:true, priority_support:true, compliance_reports:true, api_access:true, white_label:false, bulk_operations:true } },
  enterprise:   { name:'Enterprise',   price:999, monthly_scans:'unlimited',brands:'unlimited', artists:'unlimited', api_calls:'unlimited', features:{ qr_authentication:true, nft_minting:true, basic_analytics:true, advanced_analytics:true, email_support:true, priority_support:true, compliance_reports:true, api_access:true, white_label:true, dedicated_support:true, custom_integrations:true, bulk_operations:true, sla_guarantee:true, custom_reporting:true } }
};

class SubscriptionManager {
  constructor(env) { this.env = env; }

  async getUserTier(userId) {
    if (!userId) return { tier:'free', limits:PRICING_TIERS.free };
    try {
      const sub = await this.env.CACHE.get(`subscription:${userId}`);
      if (!sub) return { tier:'free', limits:PRICING_TIERS.free };
      const s = JSON.parse(sub);
      if (new Date(s.expires) < new Date()) return { tier:'free', limits:PRICING_TIERS.free, expired:true };
      return { tier:s.tier, limits:PRICING_TIERS[s.tier], usage:await this.getUsage(userId), expires:s.expires };
    } catch { return { tier:'free', limits:PRICING_TIERS.free }; }
  }

  async checkUsageLimit(userId, action) {
    const sub = await this.getUserTier(userId);
    const usage = await this.getUsage(userId);
    if (action === 'scan') {
      const lim = sub.limits.monthly_scans;
      if (lim !== 'unlimited' && usage.scans >= lim) return { allowed:false, message:`Monthly scan limit (${lim}) reached.`, currentTier:sub.tier, usage:usage.scans, limit:lim };
    }
    if (action === 'nft_mint' && !sub.limits.features.nft_minting) return { allowed:false, message:'NFT minting requires a paid subscription.', currentTier:sub.tier };
    return { allowed:true };
  }

  async recordUsage(userId, action) {
    if (!userId) return;
    try {
      const key = `usage:${userId}:${new Date().toISOString().slice(0,7)}`;
      const raw = await this.env.CACHE.get(key);
      const data = raw ? JSON.parse(raw) : {};
      data[action] = (data[action]||0) + 1;
      data.lastActivity = new Date().toISOString();
      await this.env.CACHE.put(key, JSON.stringify(data), { expirationTtl: 60*60*24*35 });
    } catch {}
  }

  async getUsage(userId) {
    if (!userId) return { scans:0, api_calls:0, nfts_minted:0, brands:0, artists:0 };
    try {
      const key = `usage:${userId}:${new Date().toISOString().slice(0,7)}`;
      const raw = await this.env.CACHE.get(key);
      const data = raw ? JSON.parse(raw) : {};
      return { scans:data.scan||0, api_calls:data.api_call||0, nfts_minted:data.nft_mint||0, brands:data.brands||0, artists:data.artists||0 };
    } catch { return { scans:0, api_calls:0, nfts_minted:0, brands:0, artists:0 }; }
  }

  async upgradeSubscription(userId, tier) {
    if (!PRICING_TIERS[tier]) throw new Error('Invalid tier');
    const sub = { userId, tier, price:PRICING_TIERS[tier].price, started:new Date().toISOString(), expires:new Date(Date.now()+30*24*60*60*1000).toISOString(), paymentId:`payment_${Date.now()}`, status:'active' };
    await this.env.CACHE.put(`subscription:${userId}`, JSON.stringify(sub));
    try { await this.env.ANALYTICS.put(`subscription_history:${userId}:${Date.now()}`, JSON.stringify(sub)); } catch {}
    return { success:true, subscription:sub, features:PRICING_TIERS[tier].features };
  }

  getNextTier(t) { const ts=['free','basic','professional','enterprise']; const i=ts.indexOf(t); return i<ts.length-1?ts[i+1]:'enterprise'; }
}

const CORS = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS,PUT,DELETE","Access-Control-Allow-Headers":"Content-Type,Authorization,X-User-ID" };
const json = (data, status=200) => new Response(JSON.stringify(data,null,2), { status, headers:{...CORS,"Content-Type":"application/json"} });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null, { headers:CORS });

    try {
      const sm = new SubscriptionManager(env);

      // ── Pricing ─────────────────────────────────────────────────────────
      if (path === '/pricing') return json({ success:true, tiers:PRICING_TIERS, recommendation:'Most popular: Professional', discount:'Save 20% with annual billing' });

      // ── Subscription ─────────────────────────────────────────────────────
      if (path === '/subscription/status') {
        const userId = request.headers.get('X-User-ID');
        if (!userId) return json({ error:'User ID required', tier:'free', limits:PRICING_TIERS.free }, 401);
        return json(await sm.getUserTier(userId));
      }

      if (path === '/subscription/upgrade' && request.method === 'POST') {
        const body = await request.json();
        return json(await sm.upgradeSubscription(body.userId, body.tier));
      }

      if (path === '/subscription/usage') {
        const userId = request.headers.get('X-User-ID');
        if (!userId) return json({ error:'User ID required' }, 401);
        const [usage, tier] = await Promise.all([sm.getUsage(userId), sm.getUserTier(userId)]);
        return json({ usage, limits:tier.limits, tier:tier.tier });
      }

      if (path === '/admin/revenue') {
        return json({ distribution:{free:1000,basic:150,professional:75,enterprise:22}, totalRevenue:150*199+75*499+22*999, monthlyRecurring:150*199+75*499+22*999, annualRunRate:(150*199+75*499+22*999)*12 });
      }

      // ── Scan package ─────────────────────────────────────────────────────
      if (path === '/scan-package') {
        const userId = request.headers.get('X-User-ID');
        const limitCheck = await sm.checkUsageLimit(userId, 'scan');
        if (!limitCheck.allowed) return json({ success:false, error:limitCheck.message, upgrade_url:'/pricing', current_tier:limitCheck.currentTier }, 402);
        await sm.recordUsage(userId, 'scan');
        return json(await handlePackageScan(request, env));
      }

      // ── Named routes ─────────────────────────────────────────────────────
      const userId = request.headers.get('X-User-ID');
      if (userId) await sm.recordUsage(userId, 'api_call');

      if (path === '/' || path === '/health') {
        // health check — test bindings
        const health = { success:true, apiStatus:'operational', version:'2.1.0', timestamp:new Date().toISOString(), bindings:{} };
        try { await env.DB.prepare("SELECT 1").first(); health.bindings.db = 'connected'; } catch(e) { health.bindings.db = 'error: '+e.message; }
        try { await env.CACHE.put('health', '1'); health.bindings.cache = 'connected'; } catch(e) { health.bindings.cache = 'error: '+e.message; }
        try { await env.ANALYTICS.put('health', '1'); health.bindings.analytics = 'connected'; } catch(e) { health.bindings.analytics = 'error: '+e.message; }
        return json(health);
      }

      if (path === '/generate-demo-qr') return json(generateDemoQR());
      if (path === '/get-collection')   return json(await getUserCollection(request, env, sm));
      if (path === '/leaderboard')      return json(getLeaderboard());
      if (path === '/onboard-user')     return json(await onboardUser(request, env));
      if (path === '/analytics')        return json(getAnalytics());
      if (path === '/test-db')          return json(await testDB(env));
      if (path === '/register-brand')   return json(await registerBrand(request, env, sm));
      if (path === '/register-artist')  return json(await registerArtist(request, env, sm));

      return json({
        success:true,
        name:'StrainChain NFT API',
        version:'2.1.0',
        description:'Cannabis authentication and NFT ecosystem',
        endpoints:['/','/health','/pricing','/subscription/status','/subscription/upgrade','/subscription/usage','/scan-package','/generate-demo-qr','/get-collection','/leaderboard','/onboard-user','/analytics','/register-brand','/register-artist','/test-db'],
        timestamp:new Date().toISOString()
      });

    } catch (error) {
      console.error("Worker error:", error);
      return json({ success:false, error:error.message, timestamp:new Date().toISOString() }, 500);
    }
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateDemoQR() {
  const demos = [
    { qrCode:"DEMO_001_"+Date.now(), brandName:"Green Valley Premium", strainName:"Northern Lights", batchNumber:"BATCH_NL_001", artist:"Maya Chen", thc:23.4, cbd:1.2, verified:true, demo:true },
    { qrCode:"DEMO_002_"+Date.now(), brandName:"Stellar Strains",      strainName:"Galactic Glue",   batchNumber:"BATCH_GG_005", artist:"Luna Rodriguez", thc:28.1, cbd:0.8, verified:true, demo:true },
    { qrCode:"DEMO_003_"+Date.now(), brandName:"Mountain High",         strainName:"Wedding Cake",    batchNumber:"BATCH_WC_012", artist:"Zara Chen", thc:26.8, cbd:0.5, verified:true, demo:true }
  ];
  const pkg = demos[Math.floor(Math.random()*demos.length)];
  return { success:true, qrData:pkg, qrCodeUrl:"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data="+encodeURIComponent(JSON.stringify(pkg)), timestamp:new Date().toISOString() };
}

async function handlePackageScan(request, env) {
  try {
    const body = await request.json().catch(()=>({}));
    const { qrData, userLocation, userId } = body;
    if (!qrData || !userId) return { success:false, error:"qrData and userId required" };
    let pkg;
    try { pkg = typeof qrData==='string' ? JSON.parse(qrData) : qrData; } catch { pkg = { qrCode:qrData, verified:true, demo:true, brandName:"Demo Brand", strainName:"Demo Strain" }; }
    if (!pkg.verified && !pkg.demo && !(pkg.qrCode && pkg.brandName)) return { success:false, error:"Package authentication failed" };
    const existing = await env.ANALYTICS.get("nft:"+pkg.qrCode).catch(()=>null);
    if (existing) return { success:true, action:"already_verified", nft:JSON.parse(existing), pointsEarned:10 };
    const rarity = calcRarity(pkg);
    const nftId = "nft_"+Date.now()+"_"+Math.random().toString(36).slice(2,9);
    const nft = { id:nftId, owner:userId, rarity:rarity.level, rarityScore:rarity.score, packageQR:pkg.qrCode, name:`${pkg.brandName} - ${pkg.strainName}`, created:new Date().toISOString() };
    await env.ANALYTICS.put("nft:"+pkg.qrCode, JSON.stringify(nft));
    await env.ANALYTICS.put("user_nft:"+userId+":"+nftId, JSON.stringify(nft));
    const pts = {Common:25,Uncommon:50,Rare:75,Epic:100,Legendary:150}[rarity.level]||25;
    return { success:true, action:"nft_created", nft, pointsEarned:pts, message:`🎉 ${pkg.brandName} verified! ${rarity.level} NFT created!` };
  } catch(e) { return { success:false, error:e.message }; }
}

function calcRarity(pkg) {
  let s=100;
  if(["Green Valley Premium","Stellar Strains","Mountain High"].includes(pkg.brandName)) s*=1.3;
  if(pkg.thc>25) s*=1.4; else if(pkg.thc>20) s*=1.2;
  if(pkg.artist) s*=1.2;
  const h=new Date().getHours(); if(h>=6&&h<=10) s*=1.1;
  let level; s=Math.round(s);
  if(s>=400)level="Legendary"; else if(s>=300)level="Epic"; else if(s>=200)level="Rare"; else if(s>=150)level="Uncommon"; else level="Common";
  return {level,score:s};
}

async function getUserCollection(request, env, sm) {
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return { success:false, error:"userId required" };
  const [raw, tier] = await Promise.all([env.ANALYTICS.get("user_stats:"+userId).catch(()=>null), sm.getUserTier(userId)]);
  const stats = raw ? JSON.parse(raw) : { userId, totalPoints:0, nftsCollected:0, lastActivity:null };
  return { success:true, userId, stats, subscription:{ tier:tier.tier, expires:tier.expires }, timestamp:new Date().toISOString() };
}

function getLeaderboard() {
  return { success:true, leaderboard:[{rank:1,username:"CannabisKing420",points:4200,nfts:12},{rank:2,username:"StrainCollector",points:2500,nfts:8},{rank:3,username:"GreenThumb",points:1780,nfts:5}], totalUsers:1247, timestamp:new Date().toISOString() };
}

async function onboardUser(request, env) {
  try {
    const { username, email, location } = await request.json();
    if (!username||!email) return { success:false, error:"username and email required" };
    const userId = "user_"+Date.now();
    await env.ANALYTICS.put("user:"+userId, JSON.stringify({ id:userId, username, email, location, joined:new Date().toISOString(), totalPoints:0, nftsCollected:0, tier:'free' }));
    return { success:true, userId, welcomeBonus:100, message:"Welcome to StrainChain!" };
  } catch(e) { return { success:false, error:e.message }; }
}

function getAnalytics() {
  return { success:true, analytics:{ totalScans:8234, totalNFTs:8234, totalUsers:1247, paidUsers:247, totalBrands:234, totalArtists:156, dailyGrowth:6.7, monthlyRevenue:150*199+75*499+22*999 }, timestamp:new Date().toISOString() };
}

async function testDB(env) {
  try { const r=await env.DB.prepare("SELECT 1 as test").first(); return { success:true, database:"connected", result:r }; }
  catch(e) { return { success:false, database:"error", error:e.message }; }
}

async function registerBrand(request, env, sm) {
  try {
    const { brandName, email, licenseNumber, userId } = await request.json();
    if (!brandName||!email) return { success:false, error:"brandName and email required" };
    if (userId) {
      const [tier, usage] = await Promise.all([sm.getUserTier(userId), sm.getUsage(userId)]);
      if (tier.limits.brands!=='unlimited' && usage.brands>=tier.limits.brands) return { success:false, error:`Brand limit (${tier.limits.brands}) reached. Upgrade to add more.`, upgrade_url:'/pricing' };
      await sm.recordUsage(userId, 'brands');
    }
    const brandId = "brand_"+Date.now();
    await env.ANALYTICS.put("brand:"+brandId, JSON.stringify({ id:brandId, brandName, email, licenseNumber, userId, status:"pending", registered:new Date().toISOString() }));
    return { success:true, brandId, status:"pending_approval" };
  } catch(e) { return { success:false, error:e.message }; }
}

async function registerArtist(request, env, sm) {
  try {
    const { artistName, email, portfolio, userId } = await request.json();
    if (!artistName||!email) return { success:false, error:"artistName and email required" };
    if (userId) {
      const [tier, usage] = await Promise.all([sm.getUserTier(userId), sm.getUsage(userId)]);
      if (tier.limits.artists!=='unlimited' && usage.artists>=tier.limits.artists) return { success:false, error:`Artist limit (${tier.limits.artists}) reached. Upgrade to add more.`, upgrade_url:'/pricing' };
      await sm.recordUsage(userId, 'artists');
    }
    const artistId = "artist_"+Date.now();
    await env.ANALYTICS.put("artist:"+artistId, JSON.stringify({ id:artistId, artistName, email, portfolio, userId, status:"active", registered:new Date().toISOString() }));
    return { success:true, artistId, status:"active" };
  } catch(e) { return { success:false, error:e.message }; }
}

--cdaa8188e336142de411ebe340e5a5c1aec6a0d1ceace7af98f207827e8d--
