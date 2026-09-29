/**
 * Pre-send opt-out check for .github/workflows/b2b-outreach.yml.
 *
 *   pnpm exec tsx scripts/outreach-optout-check.ts
 *
 * Writes `ready`, `kind` and `reason` to $GITHUB_OUTPUT. The workflow only
 * sends live (scheduled or manual) when ready=true; otherwise the run stays a
 * dry run. It always exits 0: "not ready" is a gate result, not a crash.
 *
 * ready=true means the recipient can opt out in a way that gets recorded:
 * - signed_link: OUTREACH_UNSUBSCRIBE_SECRET is set here AND the edge router
 *   verifies a token made with it (GET /api/outreach/unsubscribe/check), so
 *   the links in tonight's emails will actually work. A secret bound in
 *   GitHub but not on the Worker, or two different values, fails here
 *   instead of in a recipient's inbox.
 * - configured_url: UNSUBSCRIBE_URL is an https page the operator says
 *   records opt-outs.
 * - mailto: OUTREACH_ALLOW_MAILTO_OPTOUT=true, the operator's statement that
 *   the reply-to inbox is processed by hand.
 */
import { appendFileSync } from "node:fs";
import {
  DEFAULT_UNSUBSCRIBE_ORIGIN,
  unsubscribeCheckUrl,
} from "../server/outreach/unsubscribe-link";

export type OptOutCheck = {
  ready: boolean;
  kind: "signed_link" | "configured_url" | "mailto" | "none";
  reason: string;
};

export async function checkOptOut(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<OptOutCheck> {
  const secret = env.OUTREACH_UNSUBSCRIBE_SECRET;
  if (secret) {
    const origin = env.UNSUBSCRIBE_ORIGIN || DEFAULT_UNSUBSCRIBE_ORIGIN;
    const url = await unsubscribeCheckUrl({ secret, origin });
    try {
      const res = await fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as {
        configured?: boolean;
        tokenValid?: boolean;
      };
      if (res.ok && body.configured === true && body.tokenValid === true) {
        return {
          ready: true,
          kind: "signed_link",
          reason: `signed opt-out links verify at ${origin}`,
        };
      }
      if (body.configured === false) {
        return {
          ready: false,
          kind: "signed_link",
          reason:
            "edge router has no OUTREACH_UNSUBSCRIBE_SECRET or Supabase credentials; opt-out links would 503",
        };
      }
      if (body.configured === true && body.tokenValid === false) {
        return {
          ready: false,
          kind: "signed_link",
          reason:
            "edge router holds a different OUTREACH_UNSUBSCRIBE_SECRET; opt-out links would be rejected",
        };
      }
      return {
        ready: false,
        kind: "signed_link",
        reason: `opt-out check answered HTTP ${res.status}; route not deployed yet?`,
      };
    } catch (e) {
      return {
        ready: false,
        kind: "signed_link",
        reason: `opt-out check unreachable: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }
  const page = env.UNSUBSCRIBE_URL;
  if (page?.startsWith("https://")) {
    return {
      ready: true,
      kind: "configured_url",
      reason: "UNSUBSCRIBE_URL is set (operator says it records opt-outs)",
    };
  }
  if (env.OUTREACH_ALLOW_MAILTO_OPTOUT === "true") {
    return {
      ready: true,
      kind: "mailto",
      reason:
        "mailto opt-out; OUTREACH_ALLOW_MAILTO_OPTOUT says the inbox is processed by hand",
    };
  }
  return {
    ready: false,
    kind: "none",
    reason:
      "no recordable opt-out: set OUTREACH_UNSUBSCRIBE_SECRET (GitHub and the edge router), or UNSUBSCRIBE_URL, or OUTREACH_ALLOW_MAILTO_OPTOUT=true",
  };
}

/**
 * `reason` can carry a network error message. GITHUB_OUTPUT is line-based, so
 * a stray \r or control character could smuggle in another output key. Keep
 * printable ASCII only, one line, bounded.
 */
export function outputSafe(text: string, max = 240): string {
  return text
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

async function main() {
  const result = await checkOptOut();
  const reason = outputSafe(result.reason);
  const line = `Opt-out check: ${result.ready ? "ready" : "NOT READY"} (${result.kind}) - ${reason}`;
  console.log(line);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `ready=${result.ready === true}\nkind=${outputSafe(result.kind, 32)}\nreason=${reason}\n`
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${line}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    // Never let a crash here look like "ready": print and leave ready unset.
    console.error(e);
    process.exit(0);
  });
}
