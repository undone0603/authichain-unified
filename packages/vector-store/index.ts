import { LocalIndex, IndexItem } from "vectra";
import OpenAI from "openai";
import * as path from "path";
import * as fs from "fs";

export interface AuthiChainCompanyProfile {
  id: string;
  name: string;
  industry: string;
  size: string;
  location: string;
  useCase: string;
  budget: string;
  timeline: string;
  painPoints: string[];
  techStack: string[];
  score?: number;
}

export interface VectorQueryResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

const INDEX_PATH = process.env.VECTOR_STORE_PATH || path.join(process.cwd(), ".vectra-index");
let _index: LocalIndex | null = null;
let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for vector store");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

async function getIndex(): Promise<LocalIndex> {
  if (!_index) {
    _index = new LocalIndex(INDEX_PATH);
    if (!(await _index.isIndexCreated())) {
      await _index.createIndex();
    }
  }
  return _index;
}

async function embed(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

export async function upsertDocument(
  id: string,
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const index = await getIndex();
  const vector = await embed(content);
  await index.upsertItem({ id, vector, metadata: { ...metadata, content } });
}

export async function upsertCompanyProfile(profile: AuthiChainCompanyProfile): Promise<void> {
  const text = [
    profile.name, profile.industry, profile.useCase,
    profile.painPoints.join(" "), profile.techStack.join(" "),
  ].join(" ");
  await upsertDocument(`company-${profile.id}`, text, { type: "company", ...profile });
}

export async function queryDocuments(
  query: string,
  topK = 10,
  filter?: Record<string, unknown>
): Promise<VectorQueryResult[]> {
  const index = await getIndex();
  const vector = await embed(query);
  const results = await (index.queryItems as any)(vector, topK, filter as any);
  return results.map((r: any) => ({
    id: r.item.id,
    score: r.score,
    metadata: r.item.metadata as Record<string, unknown>,
  }));
}

export async function findMatchingCompanies(
  useCase: string,
  topK = 5
): Promise<AuthiChainCompanyProfile[]> {
  const results = await queryDocuments(useCase, topK, { type: "company" });
  return results.map((r) => r.metadata as unknown as AuthiChainCompanyProfile);
}

export async function deleteDocument(id: string): Promise<void> {
  const index = await getIndex();
  await index.deleteItem(id);
}

export async function listDocuments(): Promise<string[]> {
  const index = await getIndex();
  const items = await index.listItems();
  return items.map((item: IndexItem) => item.id);
}

export async function getDocumentCount(): Promise<number> {
  const docs = await listDocuments();
  return docs.length;
}

export interface GovernmentOpportunity extends VectorQueryResult {
  score: number;
}

export const vectorStoreUtils = {
  upsertDocument,
  upsertCompanyProfile,
  queryDocuments,
  findMatchingCompanies,
  deleteDocument,
  listDocuments,
  getDocumentCount,
  findMatchingOpportunities: async (params: any): Promise<GovernmentOpportunity[]> => {
    // Stub implementation to satisfy the agent
    return [];
  }
};

export default vectorStoreUtils;
