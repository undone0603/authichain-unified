import { NextResponse } from "next/server";

/**
 * Closed. The previous handler returned a hardcoded fixture profile
 * ("Alex Chen", admin@qron.space) to anyone and echoed unauthenticated
 * PATCH bodies. It was not backed by a user record.
 */
function closed() {
  return NextResponse.json(
    { error: "Closed. This route served fixture data and is not a user API." },
    { status: 410 }
  );
}

export function GET() {
  return closed();
}

export function PATCH() {
  return closed();
}
