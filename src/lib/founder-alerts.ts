// Founder alert fan-out. ntfy topic stays public; SMS is email-to-SMS.
// ntfy.sh Email/Call headers need a paid token. Textbelt free US is disabled.
// Never include lead bodies longer than a pager line on SMS.

export const NTFY_URL = "https://ntfy.sh/zk_live_alerts_99";
export const FOUNDER_INBOXES = ["authichain@gmail.com", "undone.k@gmail.com"] as const;
export const FOUNDER_SMS_E164 = "+19895056723";
export const FOUNDER_SMS_NATIONAL = "9895056723";

/** US carrier email-to-SMS. First match that delivers wins; extras bounce. */
export const FOUNDER_SMS_GATEWAYS = [
  `${FOUNDER_SMS_NATIONAL}@vtext.com`,
  `${FOUNDER_SMS_NATIONAL}@txt.att.net`,
  `${FOUNDER_SMS_NATIONAL}@tmomail.net`,
] as const;

export type FounderAlert = {
  title: string;
  text: string;
  subject: string;
};

export type FounderAlertEnv = {
  RESEND_API_KEY?: string;
  RESEND_API_KEY2?: string;
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

export async function publishFounderAlert(
  alert: FounderAlert,
  env?: FounderAlertEnv,
): Promise<void> {
  const jobs: Promise<unknown>[] = [
    fetch(NTFY_URL, {
      method: "POST",
      headers: {
        Title: alert.title,
        "Content-Type": "text/plain",
      },
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
