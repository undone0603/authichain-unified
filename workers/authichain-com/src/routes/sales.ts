/**
 * POST /api/sales — catalogue reply for the battery-passport sales path.
 * No model provider. No Stripe session. Private plans get no checkout URL.
 */
import {
  answerSalesInquiry,
  salesTextFromBody,
  SALES_MAX_CHARS,
} from "../../../../src/lib/sales-reply";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function handleSalesInquiry(
  request: Request,
  _env?: unknown
): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: { ...JSON_HEADERS, Allow: "POST" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Malformed JSON payload" },
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const text = salesTextFromBody(body);
  if (text == null || text.trim().length === 0) {
    return Response.json(
      { error: "Missing message" },
      { status: 400, headers: JSON_HEADERS }
    );
  }
  if (text.length > SALES_MAX_CHARS) {
    return Response.json(
      { error: "Message too long" },
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const answer = answerSalesInquiry(text);
  console.log(
    JSON.stringify({
      event: "sales_inquiry",
      intent: answer.intent,
      plan: answer.plan,
    })
  );
  return Response.json(
    {
      reply: answer.reply,
      plan: answer.plan,
      checkout_url: answer.checkout_url,
      verify_url: answer.verify_url,
      intent: answer.intent,
    },
    { status: 200, headers: JSON_HEADERS }
  );
}
