import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { logActivity } from "../db";

type IntegrationCheckResult = {
  configured: boolean;
  connected: boolean;
  details?: Record<string, unknown>;
  error?: string;
};

type LiveSystemsCheckResult = {
  timestamp: string;
  integrations: {
    stripe: IntegrationCheckResult;
    hubspot: IntegrationCheckResult;
    gmail: IntegrationCheckResult;
    posthog: IntegrationCheckResult;
    ga4: IntegrationCheckResult;
  };
  ready: boolean;
  blockers: string[];
};

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function checkStripe(): Promise<IntegrationCheckResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { configured: false, connected: false, error: "STRIPE_SECRET_KEY missing" };
  }
  try {
    const { getStripe } = await import("../stripe-service");
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve();
    return {
      configured: true,
      connected: true,
      details: {
        accountId: account.id,
        country: account.country,
        chargesEnabled: account.charges_enabled,
      },
    };
  } catch (error) {
    return { configured: true, connected: false, error: toErrorMessage(error) };
  }
}

async function checkHubSpot(): Promise<IntegrationCheckResult> {
  if (!process.env.HUBSPOT_SERVICE_KEY) {
    return { configured: false, connected: false, error: "HUBSPOT_SERVICE_KEY missing" };
  }
  try {
    const { getCRMStats } = await import("../hubspot-service");
    const stats = await getCRMStats();
    return {
      configured: true,
      connected: !!stats.connected,
      details: {
        contacts: stats.contacts,
        companies: stats.companies,
        deals: stats.deals,
        missingScopes: stats.missingScopes,
      },
      error: stats.error,
    };
  } catch (error) {
    return { configured: true, connected: false, error: toErrorMessage(error) };
  }
}

async function checkGmail(): Promise<IntegrationCheckResult> {
  const token = process.env.GMAIL_ACCESS_TOKEN || "";
  const fromEmail = process.env.GMAIL_FROM_EMAIL || "";
  if (!token || !fromEmail) {
    return {
      configured: false,
      connected: false,
      error: "GMAIL_ACCESS_TOKEN or GMAIL_FROM_EMAIL missing",
    };
  }
  try {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        configured: true,
        connected: false,
        error: `gmail_profile_failed:${response.status}:${text.slice(0, 200)}`,
      };
    }
    const data: any = await response.json().catch(() => ({}));
    return {
      configured: true,
      connected: true,
      details: {
        emailAddress: data?.emailAddress,
        messagesTotal: data?.messagesTotal,
        fromEmail,
      },
    };
  } catch (error) {
    return { configured: true, connected: false, error: toErrorMessage(error) };
  }
}

async function checkPostHog(): Promise<IntegrationCheckResult> {
  const host = (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  const key = process.env.POSTHOG_PROJECT_KEY || process.env.VITE_POSTHOG_KEY || "";
  if (!key) {
    return { configured: false, connected: false, error: "POSTHOG_PROJECT_KEY/VITE_POSTHOG_KEY missing" };
  }
  try {
    const eventPayload = {
      api_key: key,
      event: "agentz_live_systems_check",
      distinct_id: "agentz-system",
      properties: {
        source: "authichain-unified",
        checkId: randomUUID(),
      },
    };
    const response = await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventPayload),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        configured: true,
        connected: false,
        error: `posthog_capture_failed:${response.status}:${text.slice(0, 200)}`,
      };
    }
    return {
      configured: true,
      connected: true,
      details: { host, event: eventPayload.event },
    };
  } catch (error) {
    return { configured: true, connected: false, error: toErrorMessage(error) };
  }
}

async function checkGa4(): Promise<IntegrationCheckResult> {
  const measurementId = process.env.GA4_MEASUREMENT_ID || "";
  const apiSecret = process.env.GA4_API_SECRET || "";
  if (!measurementId || !apiSecret) {
    return { configured: false, connected: false, error: "GA4_MEASUREMENT_ID or GA4_API_SECRET missing" };
  }
  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: "agentz.1",
        events: [{ name: "agentz_live_systems_check", params: { source: "authichain-unified" } }],
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        configured: true,
        connected: false,
        error: `ga4_collect_failed:${response.status}:${text.slice(0, 200)}`,
      };
    }
    return {
      configured: true,
      connected: true,
      details: { measurementId },
    };
  } catch (error) {
    return { configured: true, connected: false, error: toErrorMessage(error) };
  }
}

export async function runLiveSystemsCheck(): Promise<LiveSystemsCheckResult> {
  const [stripe, hubspot, gmail, posthog, ga4] = await Promise.all([
    checkStripe(),
    checkHubSpot(),
    checkGmail(),
    checkPostHog(),
    checkGa4(),
  ]);

  const integrations = { stripe, hubspot, gmail, posthog, ga4 };
  const blockers: string[] = [];
  for (const [name, result] of Object.entries(integrations)) {
    if (!result.configured) blockers.push(`${name}:not_configured`);
    else if (!result.connected) blockers.push(`${name}:not_connected`);
  }

  const payload: LiveSystemsCheckResult = {
    timestamp: new Date().toISOString(),
    integrations,
    ready: blockers.length === 0,
    blockers,
  };

  await logActivity({
    userId: null,
    action: "live_systems_check",
    entityType: "automation",
    entityId: 0,
    details: payload,
  });

  return payload;
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runLiveSystemsCheck()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Live systems check failed:", err);
      process.exit(1);
    });
}
