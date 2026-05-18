/**
 * SignWell Adapter Library
 * Zero-cost DocuSign replacement for AuthiChain outreach
 * Compatible with SignWell free tier (25 docs/month)
 */

export const SIGNWELL_API_BASE = "https://api.signwell.com";

interface SignWellDocument {
  id: string;
  template_id: string;
  title: string;
  status: string;
  is_completed: boolean;
  is_viewed: boolean;
  is_sent: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  is_draft: boolean;
  signing_url: string | null;
  recipients: SignWellRecipient[];
  embedded_signing_enabled: boolean;
}

interface SignWellRecipient {
  id: string;
  email: string;
  name: string;
  role: string;
  order: number;
  language: string;
  is_completed: boolean;
  is_viewed: boolean;
}

interface SignWellField {
  type: string;
  name: string;
  value?: string;
  required: boolean;
  signer_id?: string;
  page?: number;
  y?: number;
  x?: number;
  width?: number;
  height?: number;
}

interface SignWellTemplate {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface SignWellConfig {
  apiKey: string;
  testMode?: boolean;
}

export interface CreateDocumentParams {
  title: string;
  email_message?: string;
  email_to_sender: boolean;
  embedded_signing_enabled: boolean;
  fields: SignWellField[];
  recipients: Pick<SignWellRecipient, "email" | "name" | "role" | "order" | "language">[];
  template_id?: string;
}

export interface OutreachRecipient {
  name: string;
  email: string;
  company?: string;
  role?: string;
}

export class SignWellClient {
  private apiKey: string;
  private testMode: boolean;
  private docsCreatedThisMonth: number = 0;
  private readonly maxFreeDocsPerMonth = 25;

  constructor(config: SignWellConfig) {
    if (!config.apiKey || config.apiKey.trim() === "") {
      throw new Error("SIGNWELL_API_KEY is required. Set it in your .env file.");
    }
    this.apiKey = config.apiKey.trim();
    this.testMode = config.testMode ?? process.env.SIGNWELL_TEST_MODE === "true";
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown
  ): Promise<T> {
    const url = `${SIGNWELL_API_BASE}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (this.testMode) {
      console.log(`[SignWell TEST MODE] ${method} ${url}`);
    }
    const options: RequestInit = { method, headers };
    if (body && method !== "GET") options.body = JSON.stringify(body);
    const response = await fetch(url, options);
    const data = await response.json() as T | { detail?: string };
    if (!response.ok) {
      throw new Error(`SignWell API error (${response.status}): ${(data as { detail?: string }).detail ?? JSON.stringify(data)}`);
    }
    return data as T;
  }

  public async getTemplates(): Promise<SignWellTemplate[]> {
    const res = await this.request<{ results: SignWellTemplate[] }>(`/v1/templates`, "GET");
    return res.results || [];
  }

  public async createDocument(params: CreateDocumentParams): Promise<SignWellDocument> {
    this.checkFreeTierLimit();
    const doc = await this.request<SignWellDocument>("/v1/documents", "POST", params);
    this.docsCreatedThisMonth++;
    console.log(`[SignWell] Document created: ${doc.id} - ${this.docsCreatedThisMonth}/${this.maxFreeDocsPerMonth}`);
    return doc;
  }

  public async getDocument(id: string): Promise<SignWellDocument> {
    return this.request<SignWellDocument>(`/v1/documents/${id}`, "GET");
  }

  public async cancelDocument(id: string): Promise<void> {
    await this.request(`/v1/documents/${id}`, "DELETE");
  }

  public async createOutreachDocument(
    templateId: string,
    recipient: OutreachRecipient,
    documentTitle: string,
    fields?: SignWellField[],
    customMessage?: string
  ): Promise<SignWellDocument> {
    const message = customMessage ?? `Hi ${recipient.name}, please review and sign this document.`;
    return this.createDocument({
      title: documentTitle,
      email_message: message,
      email_to_sender: true,
      embedded_signing_enabled: true,
      template_id: templateId,
      recipients: [{ email: recipient.email, name: recipient.name, role: "Signer", order: 1, language: "en" }],
      fields: fields ?? [],
    });
  }

  private checkFreeTierLimit(): void {
    if (this.docsCreatedThisMonth >= this.maxFreeDocsPerMonth) {
      throw new Error(`SignWell free tier limit reached (${this.maxFreeDocsPerMonth} docs/month)`);
    }
  }

  public getRemainingFreeDocs(): number {
    return Math.max(0, this.maxFreeDocsPerMonth - this.docsCreatedThisMonth);
  }

  public async listDocuments(): Promise<{ documents: SignWellDocument[] }> {
    const res = await this.request<{ results: SignWellDocument[] }>("/v1/documents", "GET");
    return { documents: res.results || [] };
  }

  public isTestMode(): boolean { return this.testMode; }
}

export function createSignWellClientFromEnv(): SignWellClient {
  const apiKey = process.env.SIGNWELL_API_KEY;
  const testMode = process.env.SIGNWELL_TEST_MODE === "true";
  if (!apiKey) throw new Error("Missing SIGNWELL_API_KEY. Refer to SIGNWELL_MIGRATION.md");
  return new SignWellClient({ apiKey, testMode });
}

export type { SignWellDocument, SignWellRecipient, SignWellField, SignWellTemplate, CreateDocumentParams, OutreachRecipient };
