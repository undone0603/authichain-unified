// Inbound-only pilot-intake alert. Does not thaw frozen outbound workflows.
// ntfy + founder SMS gateways; Resend optional when a key is bound.

import { publishFounderAlert } from "../src/lib/founder-alerts";

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
    await publishFounderAlert(
      {
        title: "AuthiChain onboard",
        subject: `[onboard] ${payload.company} ${payload.ref}`,
        text: body,
      },
      payload.env,
    );
  } catch {
    // Swallow — intake 303 must not depend on alert delivery.
  }
}
