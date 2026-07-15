--4e20386475f34cce2da69d8f5cd9dfdc0cd500ed2e6efd8f456d72007995
Content-Disposition: form-data; name="index.js"


// authichain-verify v2.2
// Proxies /verify/* and /api cert operations to Supabase edge fn
// /health returns 200 always

const SUPA   = 'https://nhdnkzhtadfkkluiulhs.supabase.co/functions/v1';
const SUPA_A = '***REMOVED***';
const CORS   = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};

export default {
  async fetch(req) {
    const url  = new URL(req.url);
    const path = url.pathname;

    if (req.method==='OPTIONS') return new Response(null, {
      status:204,
      headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,apikey'}
    });

    // Health check — always 200
    if (path==='/health' || path==='/') {
      return Response.json({ok:true,service:'authichain-verify',version:'2.2',supa:SUPA}, {headers:CORS});
    }

    // Build Supabase target
    let supaPath = '/authichain-verify';
    if (path.includes('/verify/')) {
      const certId = path.split('/verify/')[1];
      supaPath = '/authichain-verify/verify/' + certId;
    } else if (path.includes('/stats')) {
      supaPath = '/authichain-verify/stats';
    }

    const r = await fetch(SUPA + supaPath, {
      method:   req.method,
      headers:  {'apikey':SUPA_A,'Authorization':'Bearer '+SUPA_A,'Content-Type':'application/json'},
      body:     req.method!=='GET'&&req.method!=='HEAD'?req.body:undefined
    }).catch(e => new Response(JSON.stringify({error:e.message}),{status:503}));

    const headers = new Headers(r.headers);
    headers.set('Access-Control-Allow-Origin','*');
    return new Response(r.body, {status:r.status, headers});
  }
};

--4e20386475f34cce2da69d8f5cd9dfdc0cd500ed2e6efd8f456d72007995--
