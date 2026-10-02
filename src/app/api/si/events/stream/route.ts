import { NextRequest } from "next/server";
import { GET as getFeed } from "../../feed/route";
import type { SiFeedEvent } from "../../../../../lib/si-feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

type StreamCursor = { timestamp: string; id: string };
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodeLastEventId(value: string | null): StreamCursor | null {
  if (!value) return null;
  try {
    const cursor = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as StreamCursor;
    if (
      typeof cursor.timestamp !== "string" ||
      new Date(cursor.timestamp).toISOString() !== cursor.timestamp ||
      !UUID.test(cursor.id)
    ) {
      return null;
    }
    return cursor;
  } catch {
    return null;
  }
}

function category(event: SiFeedEvent) {
  if (event.type.startsWith("github.deployment")) return "deployment";
  if (event.type.includes("check_run") || event.type.includes("workflow_run"))
    return "ci";
  if (event.source === "github") return "github";
  if (event.source === "agentz") return "agentz";
  return "ci";
}

export async function GET(request: NextRequest) {
  const cursor = decodeLastEventId(request.headers.get("last-event-id"));
  const resumeFrom = cursor?.timestamp ?? new Date().toISOString();
  const initialUrl = new URL(request.url);
  initialUrl.searchParams.delete("cursor");
  initialUrl.searchParams.set("since", resumeFrom);
  initialUrl.searchParams.set("limit", "100");

  const firstResponse = await getFeed(
    new NextRequest(initialUrl, { headers: request.headers })
  );
  if (!firstResponse.ok) return firstResponse;
  const firstBody = (await firstResponse.json()) as { events?: SiFeedEvent[] };
  let last = cursor;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SiFeedEvent) => {
        const next: StreamCursor = { timestamp: event.timestamp, id: event.id };
        const id = Buffer.from(JSON.stringify(next), "utf8").toString(
          "base64url"
        );
        controller.enqueue(
          encoder.encode(
            `id: ${id}\nevent: ${category(event)}\ndata: ${JSON.stringify(event)}\n\n`
          )
        );
        last = next;
      };

      try {
        controller.enqueue(encoder.encode("retry: 2500\n\n"));
        const sendUnseen = (events: SiFeedEvent[]) => {
          const unseen = events
            .filter(event =>
              last
                ? event.timestamp > last.timestamp ||
                  (event.timestamp === last.timestamp && event.id > last.id)
                : event.timestamp > resumeFrom
            )
            .sort((a, b) =>
              a.timestamp === b.timestamp
                ? a.id.localeCompare(b.id)
                : a.timestamp.localeCompare(b.timestamp)
            );
          for (const event of unseen) send(event);
        };
        sendUnseen(firstBody.events ?? []);
        if (!request.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const feedUrl = new URL(request.url);
          feedUrl.searchParams.delete("cursor");
          feedUrl.searchParams.set("since", last?.timestamp ?? resumeFrom);
          feedUrl.searchParams.set("limit", "100");
          const response = await getFeed(
            new NextRequest(feedUrl, { headers: request.headers })
          );
          if (response.ok) {
            const body = (await response.json()) as { events?: SiFeedEvent[] };
            sendUnseen(body.events ?? []);
          }
        }
      } catch {
        // A bounded stream closes cleanly; EventSource reconnects with its last event id.
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "private, no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
