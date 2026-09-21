// Founder alert fan-out. One publisher for DreamDash + onboard.
// ntfy topic stays zk_live_alerts_99. Token optional (ntfy.sh free cannot reserve).
// SMS is Verizon email-to-SMS only — extras were triple-texting.
// Never email the lead. Never thaw outreach.

export const NTFY_URL = "https://ntfy.sh/zk_live_alerts_99";
export const NTFY_TOPIC = "zk_live_alerts_99";
export const FOUNDER_INBOXES = ["authichain@gmail.com", "undone.k@gmail.com"] as const;
export const FOUNDER_SMS_E164 = "+19895056723";
export const FOUNDER_SMS_NATIONAL = "9895056723";
export const FOUNDER_CLICK = "https://authichain.com/founders";

/** Single gateway until owner names another carrier. */
export const FOUNDER_SMS_GATEWAYS = [`${FOUNDER_SMS_NATIONAL}@vtext.com`] as const;

export type FounderAlertKind = "intake" | "draft" | "digest";

export type FounderAlert = {
  title: string;
  text: string;
  subject: string;
  kind?: FounderAlertKind;
  click?: string;
};

export type FounderAlertEnv = {
  RESEND_API_KEY?: string;
  RESEND_API_KEY2?: string;
  NTFY_TOKEN?: string;
};

export function smsBody(alert: FounderAlert): string {
  const raw = `${alert.title}: ${alert.text}`.replace(/\s+/g, " ").trim();
  return raw.length <= 160 ? raw : `${raw.slice(0, 157)}...`;
}

export function resendKey(env?: FounderAlertEnv): string {
  return (
    env?.RESEND_API_KEY2 ||
    env?.RESEND_API_KEY ||
    (typeof process !== "undefined" ? process.env.RESEND_API_KEY2 : undefined) ||
    (typeof process !== "undefined" ? process.env.RESEND_API_KEY : undefined) ||
    ""
  ).trim();
}

export function ntfyToken(env?: FounderAlertEnv): string {
  return (
    env?.NTFY_TOKEN ||
    (typeof process !== "undefined" ? process.env.NTFY_TOKEN : undefined) ||
    ""
  ).trim();
}

export function ntfyHeaders(alert: FounderAlert, env?: FounderAlertEnv): Record<string, string> {
  const kind = alert.kind ?? "draft";
  const headers: Record<string, string> = {
    Title: alert.title,
    "Content-Type": "text/plain",
    Priority: kind === "digest" ? "3" : "4",
    Tags: kind === "intake" ? "inbox_tray" : kind === "digest" ? "newspaper" : "envelope",
    Click: alert.click ?? FOUNDER_CLICK,
  };
  const token = ntfyToken(env);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function publishFounderAlert(
  alert: FounderAlert,
  env?: FounderAlertEnv,
): Promise<void> {
  const jobs: Promise<unknown>[] = [
    fetch(NTFY_URL, {
      method: "POST",
      headers: ntfyHeaders(alert, env),
      body: alert.text,
    }),
  ];
  const apiKey = resendKey(env);
  if (apiKey) {
    jobs.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "AuthiChain <hello@authichain.com>",
          to: [...FOUNDER_INBOXES],
          subject: alert.subject,
          text: alert.text,
        }),
      }),
    );
    jobs.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "AuthiChain <hello@authichain.com>",
          to: [...FOUNDER_SMS_GATEWAYS],
          subject: alert.title.slice(0, 40),
          text: smsBody(alert),
        }),
      }),
    );
  }
  await Promise.allSettled(jobs);
}
