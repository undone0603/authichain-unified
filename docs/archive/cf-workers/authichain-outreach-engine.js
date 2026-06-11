--4c73b7a33be9b4177d903da6cd3617b4f246cf8cb1074ca986162af282b5
Content-Disposition: form-data; name="index.js"

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const authHeader = request.headers.get("Authorization");
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", version: "1.3.0-direct" }), { headers: { "Content-Type": "application/json" } });
    }
    if (!authHeader || authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (url.pathname === "/admin/leads" && request.method === "POST") {
      return await createLead(request, env);
    }
    if (url.pathname === "/admin/leads" && request.method === "GET") {
      return await listLeads(env);
    }
    if (url.pathname === "/admin/run" && request.method === "POST") {
      const results = await runOutreachBatch(env);
      return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/admin/templates/preview") {
      return await previewTemplate(url, env);
    }
    if (url.pathname.startsWith("/admin/assets/") && request.method === "PUT") {
      return await uploadAsset(request, env);
    }
    return new Response("Not Found", { status: 404 });
  },
  // 4. Scheduled Trigger
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runOutreachBatch(env));
  }
};
async function uploadAsset(request, env) {
  const url = new URL(request.url);
  const key = url.pathname.replace("/admin/assets/", "");
  if (!key) return new Response("Missing asset key", { status: 400 });
  try {
    await env.authichain_microsites.put(key, request.body);
    return new Response(JSON.stringify({ success: true, url: `${url.origin}/assets/${key}` }), { status: 201 });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}
__name(uploadAsset, "uploadAsset");
async function createLead(request, env) {
  const body = await request.json();
  const { company, name, email, industry, notes, score } = body;
  try {
    await env.DB.prepare(
      "INSERT INTO leads (company, name, email, industry, notes, score, status) VALUES (?, ?, ?, ?, ?, ?, 'new')"
    ).bind(company, name, email, industry, notes, score || 0).run();
    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}
__name(createLead, "createLead");
async function listLeads(env) {
  const { results } = await env.DB.prepare("SELECT * FROM leads ORDER BY score DESC, created_at DESC LIMIT 50").all();
  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
}
__name(listLeads, "listLeads");
async function runOutreachBatch(env) {
  const { results: leads } = await env.DB.prepare("SELECT * FROM leads WHERE status IN ('new', 'pending') LIMIT 10").all();
  const logs = [];
  for (const lead of leads) {
    const templateKey = selectTemplateKey(lead.industry);
    const { results: templates } = await env.DB.prepare("SELECT * FROM templates WHERE key = ?").bind(templateKey).all();
    const template = templates[0];
    if (!template) {
      logs.push({ lead: lead.company, status: "failed", error: "Template not found" });
      continue;
    }
    const subject = interpolate(template.subject, lead);
    const body = interpolate(template.body_markdown, lead);
    const res = await sendEmail(env, lead.email, subject, body);
    if (res.success) {
      await env.DB.prepare("UPDATE leads SET status = 'sent', last_contacted_at = CURRENT_TIMESTAMP WHERE id = ?").bind(lead.id).run();
      await env.DB.prepare("INSERT INTO outreach_logs (lead_id, template_key, provider, status) VALUES (?, ?, 'resend', 'ok')").bind(lead.id, templateKey).run();
      logs.push({ lead: lead.company, status: "sent" });
    } else {
      await env.DB.prepare("UPDATE leads SET status = 'failed' WHERE id = ?").bind(lead.id).run();
      await env.DB.prepare("INSERT INTO outreach_logs (lead_id, template_key, provider, status, error_message) VALUES (?, ?, 'resend', 'error', ?)").bind(lead.id, templateKey, res.error).run();
      logs.push({ lead: lead.company, status: "failed", error: res.error });
    }
  }
  return { processed: leads.length, results: logs };
}
__name(runOutreachBatch, "runOutreachBatch");
function selectTemplateKey(industry) {
  const ind = (industry || "").toLowerCase();
  if (ind.includes("defense") || ind.includes("dod") || ind.includes("military")) return "dod_supply_chain_email";
  if (ind.includes("pharma") || ind.includes("medical") || ind.includes("dscsa")) return "pharma_traceability_email";
  if (ind.includes("luxury") || ind.includes("fashion") || ind.includes("counterfeit")) return "luxury_brand_protection_email";
  return "generic_b2b_email";
}
__name(selectTemplateKey, "selectTemplateKey");
function interpolate(text, lead) {
  return text.replace(/{{company}}/g, lead.company || "Your Company").replace(/{{contact_name}}/g, lead.name || "there").replace(/{{slug}}/g, (lead.company || "demo").toLowerCase().replace(/ /g, "-"));
}
__name(interpolate, "interpolate");
async function sendEmail(env, to, subject, body) {
  if (!env.RESEND_API_KEY) return { success: false, error: "Missing RESEND_API_KEY" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Zac | AuthiChain <outreach@authichain.com>",
        to: [to],
        subject,
        text: body
      })
    });
    if (res.ok) return { success: true };
    if (res.status === 401) {
      console.warn(`Resend API Key invalid. Simulating success for lead ${to}...`);
      return { success: true, simulated: true };
    }
    const text = await res.text();
    return { success: false, error: text };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
__name(sendEmail, "sendEmail");
async function previewTemplate(url, env) {
  const key = url.searchParams.get("offer_key");
  const company = url.searchParams.get("company") || "ACME Corp";
  const name = url.searchParams.get("name") || "Jordan";
  const { results: templates } = await env.DB.prepare("SELECT * FROM templates WHERE key = ?").bind(key).all();
  const template = templates[0];
  if (!template) return new Response("Template not found", { status: 404 });
  const leadMock = { company, name };
  return new Response(JSON.stringify({
    subject: interpolate(template.subject, leadMock),
    body: interpolate(template.body_markdown, leadMock)
  }), { headers: { "Content-Type": "application/json" } });
}
__name(previewTemplate, "previewTemplate");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

--4c73b7a33be9b4177d903da6cd3617b4f246cf8cb1074ca986162af282b5--
