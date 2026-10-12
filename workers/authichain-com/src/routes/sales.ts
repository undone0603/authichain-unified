import Anthropic from "@anthropic-ai/sdk";

export const SALES_SYSTEM_PROMPT = `
CRITICAL DIRECTIVE - STRIPE INTEGRATION:
If the user expresses a clear intent to purchase, upgrade, or start using the platform, serve them the direct checkout link immediately rather than redirecting to a generic pricing page.

Format the response exactly like this:
"Ready to get started? [Click here to begin your EU DPP Readiness Audit](/battery-passport)"
`;

export interface Env {
  ANTHROPIC_API_KEY: string;
}

export async function handleSalesInquiry(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
    });
  }
  try {
    const { messages } = await request.json<any>();
    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: SALES_SYSTEM_PROMPT,
      messages: messages,
    });
    const textContent = response.content.find(
      (block: any) => block.type === "text"
    );
    return new Response(
      JSON.stringify({ reply: textContent ? textContent.text : "Error" }),
      { status: 200 }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
