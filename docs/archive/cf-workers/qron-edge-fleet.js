--e89e2b69a29ae433f850e51ad4187caa6cb20391bc457a2ae2aba7755f5f
Content-Disposition: form-data; name="edge.js"

// src/edge.ts
var worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = request.headers.get("host") || "";
    const hostname = host.toLowerCase().split(":")[0];
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({
        status: "Ecosystem Edge Live",
        node: "Active",
        detected_host: hostname
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname.startsWith("/s/")) {
      const shortcode = url.pathname.split("/")[2];
      if (!shortcode) return Response.redirect(`${url.origin}/`, 302);
      try {
        const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
        let _brandId = null;
        const isStandardDomain = hostname.includes("qron.space") || hostname.includes("localhost") || hostname.includes("vercel.app");
        if (!isStandardDomain) {
          const brandRes = await fetch(`${supabaseUrl}/rest/v1/brands?domain=eq.${hostname}&select=id`, {
            headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
          });
          const brands = await brandRes.json();
          if (brands && brands.length > 0) {
            _brandId = brands[0].id;
          }
        }
        const isNumeric = /^\d+$/.test(shortcode);
        const qronFilter = isNumeric ? `or=(id.eq.${shortcode},short_code.eq.${shortcode})` : `short_code.eq.${shortcode}`;
        const qronRes = await fetch(`${supabaseUrl}/rest/v1/qrons?${qronFilter}&select=*`, {
          headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
        });
        const qrons = await qronRes.json();
        if (!qrons || qrons.length === 0) {
          return Response.redirect(`${url.origin}/`, 302);
        }
        const qron = qrons[0];
        const rulesRes = await fetch(`${supabaseUrl}/rest/v1/redirect_rules?qron_id=eq.${qron.id}&is_active=eq.true&order=priority.asc`, {
          headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
        });
        const rules = await rulesRes.json();
        let destination = qron.target_url;
        if (rules && rules.length > 0) {
          const userAgent2 = request.headers.get("user-agent") || "";
          const now = /* @__PURE__ */ new Date();
          for (const rule of rules) {
            if (rule.start_time && new Date(rule.start_time) > now) continue;
            if (rule.end_time && new Date(rule.end_time) < now) continue;
            if (rule.rule_type === "device") {
              const targetDevice = rule.configuration?.device;
              const isMobile = /mobile/i.test(userAgent2);
              const isTablet = /tablet/i.test(userAgent2);
              if (targetDevice === "mobile" && !isMobile) continue;
              if (targetDevice === "tablet" && !isTablet) continue;
              if (targetDevice === "desktop" && (isMobile || isTablet)) continue;
            }
            if (rule.rule_type === "a_b") {
              const weight = rule.a_b_weight || 50;
              const random = Math.random() * 100;
              if (random > weight) continue;
            }
            if (rule.configuration?.redirect_url) {
              destination = rule.configuration.redirect_url;
              break;
            }
          }
        }
        const userAgent = request.headers.get("user-agent") || "unknown";
        const ip = request.headers.get("cf-connecting-ip") || "unknown";
        const country = request.headers.get("cf-ipcountry") || "unknown";
        const city = request.headers.get("cf-ipcity") || "unknown";
        const region = request.headers.get("cf-region") || "unknown";
        fetch(`${supabaseUrl}/rest/v1/qrons?id=eq.${qron.id}`, {
          method: "PATCH",
          headers: {
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ scan_count: (qron.scan_count || 0) + 1 })
        });
        fetch(`${supabaseUrl}/rest/v1/scan_logs`, {
          method: "POST",
          headers: {
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            qron_id: qron.id,
            ip,
            country,
            city,
            region,
            user_agent: userAgent
          })
        });
        return Response.redirect(destination, 302);
      } catch (err) {
        console.error("[edge] Redirect error:", err);
        return Response.redirect(`${url.origin}/`, 302);
      }
    }
    return new Response(JSON.stringify({ error: "Unauthorized Edge Access" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
};
var edge_default = worker;
export {
  edge_default as default
};
//# sourceMappingURL=edge.js.map

--e89e2b69a29ae433f850e51ad4187caa6cb20391bc457a2ae2aba7755f5f--
