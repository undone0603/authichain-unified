import { Client } from "@hubspot/api-client";
import { ENV } from "./_core/env";

// ─── Client ──────────────────────────────────────────────────────────────────
let _client: Client | null = null;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "Unknown error";
}

function isMissingScopesError(reason: unknown): reason is { code?: number; body?: { category?: string } } {
  if (!reason || typeof reason !== "object") return false;
  const candidate = reason as { code?: unknown; body?: { category?: unknown } };
  return candidate.code === 403 || candidate.body?.category === "MISSING_SCOPES";
}

function getClient(): Client {
  if (!_client) {
    if (!ENV.hubspotServiceKey) throw new Error("HUBSPOT_SERVICE_KEY is not configured");
    _client = new Client({ accessToken: ENV.hubspotServiceKey });
  }
  return _client;
}

export function isHubSpotConfigured(): boolean {
  return !!ENV.hubspotServiceKey;
}

// ─── Contacts ────────────────────────────────────────────────────────────────
export async function listContacts(limit = 50) {
  const client = getClient();
  try {
    const response = await client.crm.contacts.basicApi.getPage(
      limit, undefined,
      ["firstname", "lastname", "email", "phone", "company", "hs_lead_status", "createdate", "lastmodifieddate"],
    );
    return response.results.map(c => ({ id: c.id, ...c.properties }));
  } catch (err: unknown) {
    console.error("[HubSpot] List contacts error:", getErrorMessage(err));
    return [];
  }
}

export async function searchContacts(query: string) {
  const client = getClient();
  try {
    const response = await client.crm.contacts.searchApi.doSearch({
      filterGroups: [],
      sorts: [],
      query,
      properties: ["firstname", "lastname", "email", "phone", "company", "hs_lead_status"],
      limit: 20,
      after: "0",
    });
    return response.results.map(c => ({ id: c.id, ...c.properties }));
  } catch (err: unknown) {
    console.error("[HubSpot] Search contacts error:", getErrorMessage(err));
    return [];
  }
}

export async function createContact(data: {
  email: string; firstname?: string; lastname?: string;
  phone?: string; company?: string;
}) {
  const client = getClient();
  try {
    const response = await client.crm.contacts.basicApi.create({
      properties: { ...data },
      associations: [],
    });
    return { success: true as const, id: response.id, properties: response.properties };
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error("[HubSpot] Create contact error:", message);
    return { success: false as const, error: message || "Failed to create contact" };
  }
}

// ─── Companies ───────────────────────────────────────────────────────────────
export async function listCompanies(limit = 50) {
  const client = getClient();
  try {
    const response = await client.crm.companies.basicApi.getPage(
      limit, undefined,
      ["name", "domain", "industry", "description", "createdate"],
    );
    return response.results.map(c => ({ id: c.id, ...c.properties }));
  } catch (err: unknown) {
    console.error("[HubSpot] List companies error:", getErrorMessage(err));
    return [];
  }
}

export async function createCompany(data: {
  name: string; domain?: string; industry?: string; description?: string;
}) {
  const client = getClient();
  try {
    const response = await client.crm.companies.basicApi.create({
      properties: { ...data },
      associations: [],
    });
    return { success: true as const, id: response.id, properties: response.properties };
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error("[HubSpot] Create company error:", message);
    return { success: false as const, error: message || "Failed to create company" };
  }
}

// ─── Deals ───────────────────────────────────────────────────────────────────
export async function createDeal(data: {
  dealname: string; amount?: string; pipeline?: string;
  dealstage?: string; closedate?: string;
}) {
  const client = getClient();
  try {
    const response = await client.crm.deals.basicApi.create({
      properties: { ...data },
      associations: [],
    });
    return { success: true as const, id: response.id, properties: response.properties };
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error("[HubSpot] Create deal error:", message);
    return { success: false as const, error: message || "Failed to create deal" };
  }
}

export async function listDeals(limit = 50) {
  const client = getClient();
  try {
    const response = await client.crm.deals.basicApi.getPage(
      limit, undefined,
      ["dealname", "amount", "dealstage", "pipeline", "createdate", "closedate", "hs_lastmodifieddate"],
    );
    return response.results.map(d => ({ id: d.id, ...d.properties }));
  } catch (err: unknown) {
    console.error("[HubSpot] List deals error:", getErrorMessage(err));
    return [];
  }
}

// ─── CRM Stats ────────────────────────────────────────────────────────────────
export async function getCRMStats() {
  try {
    const client = getClient();
    const missingScopes: string[] = [];

    const [contactResult, companyResult, dealResult] = await Promise.allSettled([
      client.crm.contacts.searchApi.doSearch({ filterGroups: [], sorts: [], properties: ["email"], limit: 1, after: "0" }),
      client.crm.companies.searchApi.doSearch({ filterGroups: [], sorts: [], properties: ["name"], limit: 1, after: "0" }),
      client.crm.deals.searchApi.doSearch({ filterGroups: [], sorts: [], properties: ["dealname"], limit: 1, after: "0" }),
    ]);

    let contactCount = 0, companyCount = 0, dealCount = 0;
    let isConnected = false;

    if (contactResult.status === "fulfilled") { contactCount = contactResult.value.total; isConnected = true; }
    else if (isMissingScopesError(contactResult.reason)) missingScopes.push("contacts");
    else throw contactResult.reason;

    if (companyResult.status === "fulfilled") { companyCount = companyResult.value.total; isConnected = true; }
    else if (isMissingScopesError(companyResult.reason)) missingScopes.push("companies");

    if (dealResult.status === "fulfilled") { dealCount = dealResult.value.total; isConnected = true; }
    else if (isMissingScopesError(dealResult.reason)) missingScopes.push("deals");

    return {
      contacts: contactCount, companies: companyCount, deals: dealCount,
      connected: isConnected,
      missingScopes: missingScopes.length > 0 ? missingScopes : undefined,
    };
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error("[HubSpot] Get CRM stats error:", message);
    return { contacts: 0, companies: 0, deals: 0, connected: false, error: message };
  }
}

// ─── Sync Helpers ─────────────────────────────────────────────────────────────
export async function syncLeadToHubSpot(lead: {
  email: string; name?: string; company?: string; source?: string;
}) {
  if (!isHubSpotConfigured()) return null;
  try {
    const [firstname, ...rest] = (lead.name || "").split(" ");
    const lastname = rest.join(" ");
    const result = await createContact({
      email: lead.email,
      firstname: firstname || undefined,
      lastname: lastname || undefined,
      company: lead.company || undefined,
    });
    console.log("[HubSpot] Lead synced:", result.success ? result.id : result.error);
    return result;
  } catch (err: unknown) {
    console.error("[HubSpot] Lead sync failed:", getErrorMessage(err));
    return null;
  }
}

export async function syncPaymentToHubSpot(payment: {
  email: string; name?: string; amount: number; plan: string;
}) {
  if (!isHubSpotConfigured()) return null;
  try {
    const result = await createDeal({
      dealname: `AuthiChain ${payment.plan} - ${payment.email}`,
      amount: payment.amount.toString(),
      dealstage: "closedwon",
      closedate: new Date().toISOString().split("T")[0],
    });
    console.log("[HubSpot] Payment synced as deal:", result.success ? result.id : result.error);
    return result;
  } catch (err: unknown) {
    console.error("[HubSpot] Payment sync failed:", getErrorMessage(err));
    return null;
  }
}
