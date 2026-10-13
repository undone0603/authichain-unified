import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const jobId = body.jobId || "job_" + Date.now();
    const steps = body.steps || [
      "Initialize autonomous browser session",
      "Evaluate current DOM tree state",
      "Log execution results to D1 memory store"
    ];

    // Trigger async task handling here
    console.log(`[Agent API] Triggered workflow job: ${jobId} with ${steps.length} steps.`);

    return NextResponse.json({ status: "success", jobId, stepCount: steps.length }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ status: "error", message: e.message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "online", endpoint: "/api/trigger-agent" });
}
