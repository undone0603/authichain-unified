/**
 * Offline, opt-in peer Agent Card validation.
 * Consumes a locally provided file; deliberately NO HTTP fetch, SSRF surface,
 * credentials, account registration, A2A task, billing, or trust grant.
 */
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const MAX_CARD_BYTES = 256 * 1024;

export function inspectPeerCard(card, expectedOrigin, { peerOwnerApproved = false } = {}) {
  const problems = [];
  let origin = null;
  try {
    const parsed = new URL(expectedOrigin);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
        parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash ||
        isIP(host) || host === "localhost" || host.endsWith(".localhost") ||
        host.endsWith(".internal") || host.endsWith(".local")) {
      throw new Error("INVALID_ORIGIN");
    }
    origin = parsed.origin;
  } catch {
    problems.push("EXPECTED_PEER_ORIGIN_INVALID");
  }
  const candidate = card && typeof card === "object" && !Array.isArray(card) ? card : {};
  if (typeof candidate.name !== "string" || !candidate.name.trim()) {
    problems.push("AGENT_NAME_MISSING");
  }
  if (!Array.isArray(candidate.skills) || candidate.skills.length === 0) {
    problems.push("SKILLS_MISSING");
  }
  const declared = Array.isArray(candidate.supportedInterfaces)
    ? candidate.supportedInterfaces : [];
  const supported = [];
  for (const item of declared) {
    if (item?.protocolBinding !== "JSONRPC" ||
        typeof item.protocolVersion !== "string" ||
        !item.protocolVersion.startsWith("1.0") ||
        typeof item.url !== "string") continue;
    try {
      const url = new URL(item.url);
      if (url.protocol === "https:" && url.origin === origin && !url.username &&
          !url.password && !url.search && !url.hash) {
        supported.push({ protocolBinding: "JSONRPC", protocolVersion: "1.0", url: url.toString() });
      }
    } catch { /* invalid interface is ignored */ }
  }
  if (supported.length === 0) problems.push("NO_MATCHING_A2A_1_0_INTERFACE");

  // A syntactically valid card is not independently verified issuer identity.
  return {
    schema: "authichain-peer-card-assessment/1",
    agent_name: typeof candidate.name === "string" ? candidate.name.slice(0, 80) : null,
    origin,
    selected_interface: supported[0] ?? null,
    status: problems.length ? "INVALID_OR_INCOMPATIBLE"
      : peerOwnerApproved ? "COMPATIBLE_WITH_OWNER_APPROVAL_NOT_CONNECTED"
      : "COMPATIBLE_PENDING_PEER_OWNER_APPROVAL",
    problems,
    issuer_verified: false,
    connected: false,
    message_sent: false,
    paid: false,
    note: "Local Agent Card validation only. Review issuer identity, authentication and permitted actions before any network exchange.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const cardPath = process.argv[2];
  const origin = process.argv[3];
  if (!cardPath || !origin) {
    console.error("Usage: node peer-card.mjs ./peer-card.json https://peer.example/");
    process.exitCode = 2;
  } else {
    try {
      const stat = await import("node:fs/promises").then(mod => mod.stat(cardPath));
      if (!stat.isFile() || stat.size > MAX_CARD_BYTES) throw new Error("CARD_FILE_TOO_LARGE");
      const card = JSON.parse(await readFile(cardPath, "utf8"));
      const report = inspectPeerCard(card, origin);
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
      if (report.problems.length) process.exitCode = 1;
    } catch (err) {
      console.error(err instanceof Error ? err.message : "PEER_CARD_READ_FAILED");
      process.exitCode = 1;
    }
  }
}
