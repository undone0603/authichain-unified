/**
 * Generation seal check on the apex edge worker.
 * /verify is otherwise proxied to APP_WORKER. This path stays here:
 * WebCrypto, no Node, no Vercel.
 */
import {
  checkPresentedSeal,
  type ProtocolRecord,
} from "../../../src/lib/generation-seal.ts";

const PATH = "/verify/generation";
const MAX_BODY = 1_500_000;

const HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function isProtocol(value: unknown): value is ProtocolRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as ProtocolRecord;
  return Boolean(record.proof?.proofValue && record.credentialSubject && record.issuer);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

async function readImage(value: unknown): Promise<Uint8Array | undefined> {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const cleaned = value.replace(/^data:[^,]*,/, "");
  const bin = atob(cleaned);
  if (bin.length > MAX_BODY) throw new Error("image_too_large");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function postCheck(request: Request): Promise<Response> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY) return json({ verdict: "invalid", reasons: ["body_too_large"] }, 413);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ verdict: "invalid", reasons: ["bad_json"] }, 400);
  }
  const wrapped = body as { record?: unknown; imageBase64?: unknown };
  const record = isProtocol(wrapped.record) ? wrapped.record : isProtocol(body) ? body : null;
  if (!record) return json({ verdict: "invalid", reasons: ["not_a_generation_record"] }, 400);
  try {
    const image = await readImage(wrapped.imageBase64);
    return json(await checkPresentedSeal(record, image));
  } catch (err) {
    const reason = err instanceof Error && err.message === "image_too_large" ? "image_too_large" : "bad_image";
    return json({ verdict: "invalid", reasons: [reason] }, 400);
  }
}

function page(id: string): Response {
  const shown = id.replace(/[<>&"']/g, "");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Generation check</title>
<style>
:root{--ink:#0c0c0d;--paper:#f2efe8;--line:#2a2a2e;--steel:#8b93a7;--char:#141416}
*{box-sizing:border-box}body{margin:0;min-height:100dvh;background:var(--ink);color:var(--paper);font:16px/1.5 IBM Plex Sans,Segoe UI,system-ui,sans-serif}
main{max-width:40rem;margin:0 auto;padding:2.5rem 1rem 4rem}
h1{font-family:Newsreader,Palatino,serif;font-weight:500;font-size:2.4rem;letter-spacing:-.02em;margin:0}
p,label{color:var(--steel)}textarea,input{width:100%;border:1px solid var(--line);border-radius:10px;background:var(--char);color:var(--paper);font:inherit}
textarea{min-height:9rem;padding:.75rem}button{min-height:2.75rem;margin-top:1rem;padding:.5rem 1.25rem;border:0;border-radius:10px;background:var(--paper);color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
#out{white-space:pre-wrap;word-break:break-word}
</style></head><body><main>
<p>EDGE CHECK</p>
<h1>Generation seal</h1>
<p>Checked on the authichain.com worker. Artwork only. Not a product attestation. Not anchored.${shown ? ` Id ${shown}.` : ""}</p>
<label>Record JSON<textarea id="record" spellcheck="false"></textarea></label>
<label>Original image, optional<input id="image" type="file" accept="image/png,image/jpeg,image/webp"></label>
<button type="button" id="go">Check</button>
<p id="out"></p>
<script>
const out = document.getElementById("out");
document.getElementById("go").onclick = async () => {
  out.textContent = "Checking…";
  let record;
  try { record = JSON.parse(document.getElementById("record").value); }
  catch { out.textContent = "That is not JSON."; return; }
  let imageBase64;
  const file = document.getElementById("image").files[0];
  if (file) {
    if (file.size > 1500000) { out.textContent = "Image must be under 1.5 MB."; return; }
    imageBase64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
  }
  const res = await fetch("/verify/generation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record, imageBase64 })
  });
  const body = await res.json();
  out.textContent = body.verdict + "\\n" + (body.reasons || []).join("\\n");
};
</script>
</main></body></html>`;
  return new Response(html, { headers: HEADERS });
}

/** Returns a response when this request is the generation check. Otherwise null. */
export function tryHandleGeneration(request: Request): Response | Promise<Response> | null {
  const url = new URL(request.url);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : url.pathname;
  if (path !== PATH && !path.startsWith(PATH + "/")) return null;
  if (request.method === "POST" && path === PATH) return postCheck(request);
  if (request.method === "GET") {
    const id = path.slice(PATH.length).replace(/^\//, "");
    return page(id);
  }
  return new Response("method not allowed", { status: 405, headers: { Allow: "GET, POST" } });
}
