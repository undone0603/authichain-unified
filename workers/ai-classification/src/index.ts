export interface Env {
  OPENAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "POST" || url.pathname !== "/api/classify") {
      return new Response(JSON.stringify({ error: "Method not allowed or route not found" }), { 
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const { imageUrl, productId, industryContext } = await request.json();

      if (!imageUrl || !productId) {
        return new Response(JSON.stringify({ error: "Missing required fields: imageUrl, productId" }), { status: 400 });
      }

      const systemPrompt = `You are the AuthiChain Anomaly Detection Engine. 
      Analyze the provided product image within the context of the '${industryContext || 'General'}' industry.
      Check for micro-features, packaging defects, and counterfeit indicators.
      You MUST respond ONLY with a strict JSON object:
      {
        "decision": "Authentic" | "Suspicious" | "Fraudulent",
        "confidenceScore": number (0.0 to 1.0),
        "flaggedAnomalies": string[] (list of observed defects or 'None'),
        "latencyOptimization": true
      }`;

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4-vision-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: [
                { type: "text", text: "Analyze this physical product scan for authenticity." },
                { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
              ] 
            }
          ],
          max_tokens: 300,
          response_format: { type: "json_object" }
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`Vision API Error: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      const classificationResult = JSON.parse(aiData.choices[0].message.content);

      ctx.waitUntil(
        fetch(`${env.SUPABASE_URL}/rest/v1/verifications`, {
          method: "POST",
          headers: {
            "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({
            cert_id: productId,
            verifier: "ai-classification-engine",
            result: classificationResult.decision,
            confidence: classificationResult.confidenceScore,
            metadata: { anomalies: classificationResult.flaggedAnomalies }
          })
        })
      );

      return new Response(JSON.stringify({
        success: true,
        productId,
        classification: classificationResult
      }), { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      });

    } catch (error: any) {
      return new Response(JSON.stringify({ error: "Classification pipeline failed", details: error.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
