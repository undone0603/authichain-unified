--522080e73ac5f5a2cd32b15a05ed491e704c5c66a0f30aee05023f35e6e7
Content-Disposition: form-data; name="index.js"

var f=Object.defineProperty;var d=(t,e)=>f(t,"name",{value:e,configurable:!0});function h(t,e){if(!e.INTERNAL_SECRET)return!1;let c=t.headers.get("X-Internal-Secret")??"",s=new TextEncoder,n=s.encode(c),o=s.encode(e.INTERNAL_SECRET),l=Math.max(n.length,o.length),r=n.length^o.length;for(let i=0;i<l;i++)r|=(n[i]??0)^(o[i]??0);return r===0}d(h,"isAuthorized");var g={async fetch(t,e,c){let s=new URL(t.url);if(t.method!=="POST"||s.pathname!=="/api/classify")return new Response(JSON.stringify({error:"Method not allowed or route not found"}),{status:405,headers:{"Content-Type":"application/json"}});if(!h(t,e))return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{"Content-Type":"application/json"}});try{let{imageUrl:n,productId:o,industryContext:l}=await t.json();if(!n||!o)return new Response(JSON.stringify({error:"Missing required fields: imageUrl, productId"}),{status:400});let r=`You are the AuthiChain Anomaly Detection Engine.
      Analyze the provided product image within the context of the '${l||"General"}' industry.
      Check for micro-features, packaging defects, and counterfeit indicators.
      You MUST respond ONLY with a strict JSON object:
      {
        "decision": "Authentic" | "Suspicious" | "Fraudulent",
        "confidenceScore": number (0.0 to 1.0),
        "flaggedAnomalies": string[] (list of observed defects or 'None'),
        "latencyOptimization": true
      }`,i=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${e.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4-vision-preview",messages:[{role:"system",content:r},{role:"user",content:[{type:"text",text:"Analyze this physical product scan for authenticity."},{type:"image_url",image_url:{url:n,detail:"high"}}]}],max_tokens:300,response_format:{type:"json_object"}})});if(!i.ok){let u=await i.text();throw new Error(`Vision API Error: ${u}`)}let p=await i.json(),a=JSON.parse(p.choices[0].message.content);return c.waitUntil(fetch(`${e.SUPABASE_URL}/rest/v1/verifications`,{method:"POST",headers:{apikey:e.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({cert_id:o,verifier:"ai-classification-engine",result:a.decision,confidence:a.confidenceScore,metadata:{anomalies:a.flaggedAnomalies}})})),new Response(JSON.stringify({success:!0,productId:o,classification:a}),{status:200,headers:{"Content-Type":"application/json"}})}catch(n){return new Response(JSON.stringify({error:"Classification pipeline failed",details:n.message}),{status:500,headers:{"Content-Type":"application/json"}})}}};export{g as default};
//# sourceMappingURL=index.js.map

--522080e73ac5f5a2cd32b15a05ed491e704c5c66a0f30aee05023f35e6e7--
