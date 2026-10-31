import { NextResponse } from "next/server";

/**
 * Closed. The previous handler returned hardcoded fixture workspace settings
 * (including a fake `qron_live_sk_` API key) to anyone and echoed
 * unauthenticated PATCH bodies. It was not backed by a settings record.
 */
function closed() {
  return NextResponse.json(
    {
      error:
        "Closed. This route served fixture data and is not a settings API.",
    },
    { status: 410 }
  );
}

export function GET() {
  return closed();
}

export function PATCH() {
  return closed();
}
