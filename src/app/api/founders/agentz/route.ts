import { NextRequest, NextResponse } from "next/server";
import { closerReply } from "@/lib/dreamdash/closer-kb";
import { isAgentzRequest } from "@/lib/dreamdash/agentz-auth";

export const dynamic = "force-dynamic";

const OPS = ["dashboard", "cycle", "digest", "capture", "import-sam", "mutate", "ask"] as const;

function target(request: NextRequest, path: string) {
  return new URL(path, request.nextUrl.origin);
}

async function proxy(request: NextRequest, path: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  for (const name of ["authorization", "x-agentz-secret", "x-agentz-key", "x-agent-secret", "x-internal-secret"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(target(request, path), { ...init, headers, cache: "no-store" });
}

export async function GET(request: NextRequest) {
  if (!isAgentzRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = await proxy(request, "/api/founders/dashboard", { method: "GET" });
  const data = await res.json();
  return NextResponse.json(
    { ...data, ops: OPS, note: "AgentZ may cycle, capture, mutate, digest, ask. send marks draft sent — does not email the lead." },
    { status: res.status },
  );
}

export async function POST(request: NextRequest) {
  if (!isAgentzRequest(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    op?: string;
    prompt?: string;
    capture?: unknown;
    id?: string;
    action?: string;
    notes?: string;
    kind?: string;
    detail?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const op = body.op || "dashboard";
  if (op === "ask") {
    const dashRes = await proxy(request, "/api/founders/dashboard", { method: "GET" });
    const dash = await dashRes.json();
    return NextResponse.json({
      actor: "agentz",
      reply: closerReply(String(body.prompt || ""), dash.leads ?? []),
    });
  }
  if (op === "dashboard") {
    const res = await proxy(request, "/api/founders/dashboard", { method: "GET" });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  if (op === "cycle") {
    const res = await proxy(request, "/api/founders/cycle", { method: "POST" });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  if (op === "digest") {
    const res = await proxy(request, "/api/founders/digest", { method: "POST" });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  if (op === "capture") {
    const res = await proxy(request, "/api/founders/leads", {
      method: "POST",
      body: JSON.stringify({ capture: body.capture }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  if (op === "import-sam") {
    const res = await proxy(request, "/api/founders/leads", {
      method: "POST",
      body: JSON.stringify({ action: "import-sam" }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  if (op === "mutate") {
    const res = await proxy(request, "/api/founders/leads", {
      method: "PATCH",
      body: JSON.stringify({
        id: body.id,
        action: body.action,
        notes: body.notes,
        kind: body.kind,
        detail: body.detail,
      }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  return NextResponse.json({ error: "unknown op", ops: OPS }, { status: 400 });
}
