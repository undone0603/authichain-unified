// Inbound-only pilot-intake alert. Does not thaw frozen outbound workflows.
// ntfy is always attempted; Resend is optional when a key is bound on the Worker.

export type PilotIntakePayload = {
  company: string;
  contact: string;
  email: string;
  vertical: string;
  product: string;
  ref: string;
  env?: {
    RESEND_API_KEY?: string;
    RESEND_API_KEY2?: string;
  };
};

const NTFY_URL = "https://ntfy.sh/zk_live_alerts_99";
const RESEND_URL = "https://api.resend.com/emails";
const RESEND_FROM = "AuthiChain <hello@authichain.com>";
const RESEND_TO = ["authichain@gmail.com", "undone.k@gmail.com"] as const;

export function formatPilotIntakeBody(payload: PilotIntakePayload): string {
  return [
    `company: ${payload.company}`,
    `contact: ${payload.contact}`,
    `email: ${payload.email}`,
    `vertical: ${payload.vertical}`,
    `product: ${payload.product}`,
    `ref: ${payload.ref}`,
  ].join("\n");
}

export async function notifyPilotIntake(
  payload: PilotIntakePayload
): Promise<void> {
  try {
    console.log("[onboard-notify]", payload.company, payload.ref);
    const body = formatPilotIntakeBody(payload);
    const jobs: Promise<unknown>[] = [
      fetch(NTFY_URL, {
        method: "POST",
        headers: {
          Title: "AuthiChain onboard",
          "Content-Type": "text/plain",
        },
        body,
      }),
    ];
    const apiKey = (
      payload.env?.RESEND_API_KEY2 ||
      payload.env?.RESEND_API_KEY ||
      ""
    ).trim();
    if (apiKey) {
      jobs.push(
        fetch(RESEND_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: [...RESEND_TO],
            subject: `[onboard] ${payload.company} ${payload.ref}`,
            text: body,
          }),
        })
      );
    }
    await Promise.allSettled(jobs);
  } catch {
    // Swallow — intake 303 must not depend on alert delivery.
  }
}
