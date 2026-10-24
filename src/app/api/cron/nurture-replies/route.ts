import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Held. This Next route used to send nurture mail and quote an invented
 * pilot price. Planning stays on the edge handler, which does not send
 * unless NURTURE_SEND_ENABLED and ?send=1. This handler does neither.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      held: true,
      error: "nurture_send_held",
      message:
        "This route does not send mail or quote a pilot price. Nurture planning stays on the held edge route.",
    },
    { status: 410 }
  );
}
